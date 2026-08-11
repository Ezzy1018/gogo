/**
 * The world. Owns the tilemap, every avatar, the camera and the atmosphere.
 *
 * Performance contract: this file runs at 60fps and must never cause a React
 * render directly. It reports outward at UI_SYNC_HZ through the bridge, and
 * that is the only coupling.
 */
import Phaser from "phaser"
import {
  TILE_SIZE,
  PLAYER_SPEED,
  CAMERA_ZOOM,
  CAMERA_LERP,
  POSITION_SEND_HZ,
  UI_SYNC_HZ,
  CHAR_FRAME_W,
  CHAR_FRAME_H,
  FEET_OFFSET_Y,
  IDLE_SIT_MS,
  IDLE_SLEEP_MS,
} from "../shared/config"
import type { CharacterConfig, Dir, PlayerState } from "../shared/types"
import { bridge, type ZoneInfo } from "./bridge"
import { allLayerKeys, ensureCharacterTexture, animKey } from "./character"
import { DESK_SIT_RANGE_TILES, deskLabelPx, deskSeatPx, getDesk } from "../shared/desks"

type ZoneRect = ZoneInfo & { rect: Phaser.Geom.Rectangle }

type Avatar = {
  id: string
  sprite: Phaser.GameObjects.Sprite
  shadow: Phaser.GameObjects.Image
  plate: Phaser.GameObjects.Container
  plateText: Phaser.GameObjects.Text
  ring: Phaser.GameObjects.Arc
  statusIcon: Phaser.GameObjects.Text
  textureKey: string
  hash: string
  targetX: number
  targetY: number
  dir: Dir
  moving: boolean
  name: string
}

const DEPTH = {
  ground: 0,
  decor: 1,
  furniture: 2,
  light: 5,
  avatars: 10,
  above: 20,
  weather: 24,
  vignette: 30,
} as const

export class MainScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap
  private collision!: Phaser.Tilemaps.TilemapLayer
  private zones: ZoneRect[] = []

  private me!: Phaser.Physics.Arcade.Sprite
  private myShadow!: Phaser.GameObjects.Image
  private myPlate!: Phaser.GameObjects.Container
  private myRing!: Phaser.GameObjects.Arc
  private myBubble!: Phaser.GameObjects.Image
  private myTextureKey = ""
  private myDir: Dir = "down"
  private myName = ""
  private myConfig: CharacterConfig | null = null

  private remotes = new Map<string, Avatar>()
  private keys!: {
    up: Phaser.Input.Keyboard.Key[]
    down: Phaser.Input.Keyboard.Key[]
    left: Phaser.Input.Keyboard.Key[]
    right: Phaser.Input.Keyboard.Key[]
    sprint: Phaser.Input.Keyboard.Key
  }

  private inputLocked = false
  private ghost = false
  private myDeskId: number | null = null
  private sitting = false
  private deskPrompt = false
  private deskLabels = new Map<number, Phaser.GameObjects.Container>()
  private lastSendAt = 0
  private lastSyncAt = 0
  private lastInputAt = 0
  private lastSent = {
    x: -1,
    y: -1,
    dir: "down" as Dir,
    moving: false,
    zoneId: null as string | null,
    pose: "idle" as "idle" | "walk" | "sit" | "sleep",
  }
  private currentZone: ZoneInfo | null = null
  private unsubscribe: Array<() => void> = []
  private sitKey: Phaser.Input.Keyboard.Key | null = null

  constructor() {
    super("main")
  }

  // ============================ preload ============================

  preload() {
    this.load.image("tiles", "/assets/tilesets/office.png")
    this.load.tilemapTiledJSON("office", "/assets/maps/office.json")
    this.load.image("shadow", "/assets/tilesets/shadow.png")
    this.load.image("bubble", "/assets/tilesets/bubble.png")
    for (const { key, file } of allLayerKeys()) {
      this.load.image(key, "/assets/characters/" + file)
    }
  }

  // ============================ create ============================

  create() {
    this.buildMap()
    this.buildZones()
    this.buildLocalPlayer()
    this.buildAtmosphere()
    this.buildInput()
    this.wireBridge()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe.forEach((fn) => fn())
      this.unsubscribe = []
    })

    const ready = this.registry.get("sceneReady") as ((scene: MainScene) => void) | undefined
    ready?.(this)
  }

  private buildMap() {
    this.map = this.make.tilemap({ key: "office" })
    const tileset = this.map.addTilesetImage("office", "tiles")
    if (!tileset) throw new Error("Tileset failed to load. Did you run npm run art?")

    const ground = this.map.createLayer("ground", tileset, 0, 0)
    const decor = this.map.createLayer("decor", tileset, 0, 0)
    const furniture = this.map.createLayer("furniture", tileset, 0, 0)
    const above = this.map.createLayer("above", tileset, 0, 0)
    const collision = this.map.createLayer("collision", tileset, 0, 0)
    if (!ground || !decor || !furniture || !above || !collision) {
      throw new Error("Map layers missing. Regenerate the map with npm run art.")
    }

    ground.setDepth(DEPTH.ground)
    decor.setDepth(DEPTH.decor)
    furniture.setDepth(DEPTH.furniture)
    above.setDepth(DEPTH.above)

    // The collision layer is data, not art. Every non empty tile is solid.
    collision.setCollisionByExclusion([-1])
    collision.setVisible(false)
    this.collision = collision

    const w = this.map.widthInPixels
    const h = this.map.heightInPixels
    this.physics.world.setBounds(0, 0, w, h)
    this.cameras.main.setBounds(0, 0, w, h)
    this.cameras.main.setZoom(CAMERA_ZOOM)
    this.cameras.main.roundPixels = true
    this.cameras.main.setBackgroundColor("#C9A97E")
  }

  private buildZones() {
    const layer = this.map.getObjectLayer("objects")
    if (!layer) return
    for (const obj of layer.objects) {
      if (obj.point || !obj.width || !obj.height) continue
      const props = (obj.properties ?? []) as Array<{ name: string; value: unknown }>
      const get = (n: string) => props.find((p) => p.name === n)?.value
      const id = String(get("zoneId") ?? "")
      if (!id) continue
      this.zones.push({
        id,
        name: String(get("zoneName") ?? id),
        icon: String(get("icon") ?? ""),
        private: Boolean(get("private")),
        rect: new Phaser.Geom.Rectangle(obj.x ?? 0, obj.y ?? 0, obj.width, obj.height),
      })
    }
  }

  private spawnPoint(): { x: number; y: number } {
    const layer = this.map.getObjectLayer("objects")
    const spawn = layer?.objects.find((o) => o.name === "spawn")
    return { x: spawn?.x ?? 8 * TILE_SIZE, y: spawn?.y ?? 8 * TILE_SIZE }
  }

  // ============================ avatars ============================

  private makeNameplate(name: string, isMe: boolean) {
    const text = this.add
      .text(0, 0, name, {
        fontFamily: "Silkscreen, monospace",
        fontSize: "8px",
        color: "#2A1D14",
        resolution: 2,
      })
      .setOrigin(0.5, 0.5)

    const padX = 4
    const padY = 2
    const w = Math.ceil(text.width) + padX * 2
    const h = Math.ceil(text.height) + padY * 2

    const bg = this.add.graphics()
    bg.fillStyle(isMe ? 0xf2dfbc : 0xfdf8ee, 0.94)
    bg.lineStyle(1, 0x4a3428, 1)
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 3)
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 3)

    const container = this.add.container(0, 0, [bg, text])
    container.setDepth(DEPTH.avatars)
    return { container, text }
  }

  private buildLocalPlayer() {
    const spawn = this.spawnPoint()

    this.myShadow = this.add.image(spawn.x, spawn.y + FEET_OFFSET_Y, "shadow").setDepth(DEPTH.avatars - 1)
    this.myRing = this.add.circle(spawn.x, spawn.y + FEET_OFFSET_Y, 13, 0x6fa83c, 0).setStrokeStyle(2, 0x6fa83c, 0.9)
    this.myRing.setDepth(DEPTH.avatars - 1)
    this.myBubble = this.add.image(spawn.x, spawn.y + FEET_OFFSET_Y, "bubble").setDepth(DEPTH.light).setAlpha(0)

    this.me = this.physics.add.sprite(spawn.x, spawn.y, "__DEFAULT")
    this.me.setDepth(DEPTH.avatars)
    this.me.setOrigin(0.5, 0.5)
    // The body is a small rectangle at the feet, not the whole sprite. This is
    // what makes walking behind a desk feel right instead of bumping early.
    this.me.body?.setSize(18, 12)
    this.me.body?.setOffset((CHAR_FRAME_W - 18) / 2, CHAR_FRAME_H - 16)
    this.me.setCollideWorldBounds(true)
    this.physics.add.collider(this.me, this.collision)

    const plate = this.makeNameplate("you", true)
    this.myPlate = plate.container

    this.cameras.main.startFollow(this.me, true, CAMERA_LERP, CAMERA_LERP)
  }

  /** Called from React once we know who we are. */
  setLocalIdentity(name: string, config: CharacterConfig) {
    this.myName = name
    this.myConfig = config
    this.myTextureKey = ensureCharacterTexture(this, config)
    this.me.setTexture(this.myTextureKey, 0)
    this.me.play(animKey(this.myTextureKey, this.myDir, false), true)

    this.myPlate.destroy()
    const plate = this.makeNameplate(name, true)
    this.myPlate = plate.container
  }

  private addRemote(state: PlayerState): Avatar {
    const textureKey = ensureCharacterTexture(this, state.character)
    const sprite = this.add.sprite(state.x, state.y, textureKey, 0).setDepth(DEPTH.avatars)
    const shadow = this.add.image(state.x, state.y + FEET_OFFSET_Y, "shadow").setDepth(DEPTH.avatars - 1)
    const ring = this.add
      .circle(state.x, state.y + FEET_OFFSET_Y, 13, 0x6fa83c, 0)
      .setStrokeStyle(2, 0x6fa83c, 0.9)
      .setDepth(DEPTH.avatars - 1)
      .setVisible(false)
    const plate = this.makeNameplate(state.name, false)
    const statusIcon = this.add
      .text(0, 0, "", { fontFamily: "Nunito, sans-serif", fontSize: "12px", resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.avatars)

    sprite.play(animKey(textureKey, state.dir, false), true)

    const avatar: Avatar = {
      id: state.id,
      sprite,
      shadow,
      plate: plate.container,
      plateText: plate.text,
      ring,
      statusIcon,
      textureKey,
      hash: textureKey,
      targetX: state.x,
      targetY: state.y,
      dir: state.dir,
      moving: false,
      name: state.name,
    }
    this.remotes.set(state.id, avatar)
    return avatar
  }

  private removeRemote(id: string) {
    const a = this.remotes.get(id)
    if (!a) return
    a.sprite.destroy()
    a.shadow.destroy()
    a.plate.destroy()
    a.ring.destroy()
    a.statusIcon.destroy()
    this.remotes.delete(id)
  }

  // ============================ atmosphere ============================

  private buildAtmosphere() {
    const w = this.map.widthInPixels
    const h = this.map.heightInPixels

    // 1. One warm wash over the whole world. Sells "afternoon" in a single line.
    this.add
      .rectangle(0, 0, w, h, 0xf7e3b0)
      .setOrigin(0, 0)
      .setAlpha(0.07)
      .setBlendMode(Phaser.BlendModes.OVERLAY)
      .setDepth(DEPTH.light)

    // 2. Light pools under the window wall along the top, breathing slowly.
    for (const [x0, x1] of [[6, 22], [32, 52]] as const) {
      const pool = this.add
        .rectangle(x0 * TILE_SIZE, 3 * TILE_SIZE, (x1 - x0) * TILE_SIZE, 7 * TILE_SIZE, 0xf7e3b0)
        .setOrigin(0, 0)
        .setAlpha(0.12)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.light)
      this.tweens.add({
        targets: pool,
        alpha: { from: 0.1, to: 0.17 },
        duration: 8000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      })
    }

    // 3. Dust motes drifting through the light.
    const dot = this.textures.createCanvas("mote", 3, 3)
    if (dot) {
      const ctx = dot.getContext()
      ctx.fillStyle = "rgba(255, 245, 214, 0.9)"
      ctx.fillRect(0, 0, 3, 3)
      dot.refresh()
      this.add
        .particles(0, 0, "mote", {
          x: { min: 0, max: w },
          y: { min: 2 * TILE_SIZE, max: h },
          lifespan: 9000,
          speedY: { min: -6, max: 6 },
          speedX: { min: -10, max: 10 },
          scale: { min: 0.4, max: 1 },
          alpha: { start: 0, end: 0, ease: "Sine.easeInOut" },
          quantity: 1,
          frequency: 380,
          blendMode: Phaser.BlendModes.ADD,
        })
        .setDepth(DEPTH.weather)
    }

    // 4. Vignette, drawn once into a canvas texture and pinned to the camera.
    const vw = this.scale.width
    const vh = this.scale.height
    const vig = this.textures.createCanvas("vignette", vw, vh)
    if (vig) {
      const ctx = vig.getContext()
      const grad = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75)
      grad.addColorStop(0, "rgba(42, 29, 20, 0)")
      grad.addColorStop(1, "rgba(42, 29, 20, 0.32)")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, vw, vh)
      vig.refresh()
      this.add.image(0, 0, "vignette").setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.vignette)
    }
  }

  // ============================ input ============================

  private buildInput() {
    const kb = this.input.keyboard
    if (!kb) return
    const k = Phaser.Input.Keyboard.KeyCodes
    this.keys = {
      up: [kb.addKey(k.W), kb.addKey(k.UP)],
      down: [kb.addKey(k.S), kb.addKey(k.DOWN)],
      left: [kb.addKey(k.A), kb.addKey(k.LEFT)],
      right: [kb.addKey(k.D), kb.addKey(k.RIGHT)],
      sprint: kb.addKey(k.SHIFT),
    }
    this.sitKey = kb.addKey(k.E)
    // Arrow keys must not scroll the page behind the canvas.
    kb.addCapture([k.UP, k.DOWN, k.LEFT, k.RIGHT, k.SPACE, k.E])
    this.lastInputAt = this.time.now
  }

  private wireBridge() {
    this.unsubscribe.push(
      bridge.on("players", (players) => this.applySnapshot(players)),
      bridge.on("playerLeft", (id) => this.removeRemote(id)),
      bridge.on("inputLock", (locked) => {
        this.inputLocked = locked
        if (locked) this.me.setVelocity(0, 0)
      }),
      bridge.on("ghost", (ghost) => {
        this.ghost = ghost
        this.me.setAlpha(ghost ? 0.45 : 1)
        this.myShadow.setAlpha(ghost ? 0.1 : 1)
      }),
      bridge.on("reaction", ({ from, emoji }) => this.floatReaction(from, emoji)),
      bridge.on("claimDesk", (payload) => this.applyClaimDesk(payload)),
      bridge.on("sitAtDesk", (wantSit) => {
        if (wantSit) this.sitDown()
        else this.standUp()
      }),
    )
  }

  private applyClaimDesk(payload: {
    deskId: number | null
    x: number
    y: number
    dir: Dir
    sit: boolean
  }) {
    this.myDeskId = payload.deskId
    this.me.setPosition(payload.x, payload.y)
    this.myDir = payload.dir
    this.sitting = payload.sit
    this.me.setVelocity(0, 0)
    this.lastInputAt = this.time.now
    this.forcePublish()
  }

  private nearOwnDesk(): boolean {
    const desk = getDesk(this.myDeskId)
    if (!desk || !this.me) return false
    const seat = deskSeatPx(desk)
    const dx = (this.me.x - seat.x) / TILE_SIZE
    const dy = (this.me.y - seat.y) / TILE_SIZE
    return Math.hypot(dx, dy) <= DESK_SIT_RANGE_TILES
  }

  private sitDown() {
    const desk = getDesk(this.myDeskId)
    if (!desk) return
    if (!this.nearOwnDesk() && !this.sitting) return
    const seat = deskSeatPx(desk)
    this.me.setPosition(seat.x, seat.y)
    this.myDir = desk.dir
    this.sitting = true
    this.me.setVelocity(0, 0)
    this.lastInputAt = this.time.now
    this.forcePublish()
  }

  private standUp() {
    if (!this.sitting) return
    this.sitting = false
    this.lastInputAt = this.time.now
    this.forcePublish()
  }

  private forcePublish() {
    this.lastSent = { x: -1, y: -1, dir: this.myDir, moving: false, zoneId: null, pose: "idle" }
  }

  private upsertDeskLabel(deskId: number, ownerName: string | null, isMine: boolean) {
    const desk = getDesk(deskId)
    if (!desk) return
    const pos = deskLabelPx(desk)
    let label = this.deskLabels.get(deskId)
    const text = ownerName ? ownerName + "'s desk" : "Open desk"
    if (!label) {
      const plate = this.add
        .text(0, 0, text, {
          fontFamily: "Silkscreen, monospace",
          fontSize: "7px",
          color: isMine ? "#1F6B6B" : "#4A3428",
          resolution: 2,
        })
        .setOrigin(0.5, 1)
      const w = Math.ceil(plate.width) + 8
      const h = Math.ceil(plate.height) + 4
      const bg = this.add.graphics()
      bg.fillStyle(isMine ? 0xd8f0ee : 0xfdf8ee, 0.92)
      bg.lineStyle(1, isMine ? 0x2e8b8b : 0x4a3428, 1)
      bg.fillRoundedRect(-w / 2, -h, w, h, 3)
      bg.strokeRoundedRect(-w / 2, -h, w, h, 3)
      label = this.add.container(pos.x, pos.y, [bg, plate])
      label.setDepth(DEPTH.furniture + 0.5)
      ;(label as Phaser.GameObjects.Container & { plateText?: Phaser.GameObjects.Text }).plateText = plate
      this.deskLabels.set(deskId, label)
    } else {
      const plate = (label as Phaser.GameObjects.Container & { plateText?: Phaser.GameObjects.Text }).plateText
      if (plate && plate.text !== text) plate.setText(text)
      label.setPosition(pos.x, pos.y)
    }
  }

  // ============================ snapshot ============================

  private applySnapshot(players: PlayerState[]) {
    const seen = new Set<string>()
    const deskOwners = new Map<number, { name: string; id: string }>()
    for (const p of players) {
      if (p.deskId != null) deskOwners.set(p.deskId, { name: p.name, id: p.id })
      if (p.id === this.registry.get("myId")) {
        this.myDeskId = p.deskId
        continue
      }
      seen.add(p.id)
      let avatar = this.remotes.get(p.id)
      if (!avatar) avatar = this.addRemote(p)

      // Outfit changed since we last saw them: rebuild their texture.
      const key = ensureCharacterTexture(this, p.character)
      if (key !== avatar.textureKey) {
        avatar.textureKey = key
        avatar.sprite.setTexture(key, 0)
      }
      if (p.name !== avatar.name) {
        avatar.name = p.name
        avatar.plateText.setText(p.name)
      }

      avatar.targetX = p.x
      avatar.targetY = p.y
      avatar.dir = p.dir
      avatar.moving = p.moving
      const dim =
        p.ghost ? 0.35 : p.presence === "away" ? 0.55 : p.pose === "sleep" ? 0.7 : 1
      avatar.sprite.setAlpha(dim)
      avatar.ring.setVisible(!!p.speaking)
      const icons = [
        p.hand ? "\u270B" : "",
        p.muted ? "\uD83D\uDD07" : "",
        p.presence === "away" ? "\uD83C\uDF19" : "",
        p.presence === "idle" || p.pose === "sleep" ? "\uD83D\uDCA4" : "",
        p.pose === "sit" && p.presence !== "away" ? "\uD83D\uDCBA" : "",
      ]
      avatar.statusIcon.setText(icons.filter(Boolean).join(" "))
    }
    for (const id of [...this.remotes.keys()]) {
      if (!seen.has(id)) this.removeRemote(id)
    }

    const myId = this.registry.get("myId") as string | undefined
    for (const desk of deskOwners.keys()) {
      const owner = deskOwners.get(desk)!
      this.upsertDeskLabel(desk, owner.name, owner.id === myId)
    }
    // Keep labels for unclaimed desks we already showed as open? Skip — only claimed.
  }

  private floatReaction(from: string, emoji: string) {
    const glyph: Record<string, string> = {
      wave: "\uD83D\uDC4B",
      tada: "\uD83C\uDF89",
      heart: "\u2764\uFE0F",
      laugh: "\uD83D\uDE02",
      think: "\uD83E\uDD14",
      plusone: "\uD83D\uDC4D",
    }
    const isMe = from === this.registry.get("myId")
    const src = isMe ? this.me : this.remotes.get(from)?.sprite
    if (!src) return
    const text = this.add
      .text(src.x, src.y - 30, glyph[emoji] ?? "\u2728", { fontSize: "18px", resolution: 2 })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.above + 1)
    this.tweens.add({
      targets: text,
      y: text.y - 34,
      alpha: { from: 1, to: 0 },
      scale: { from: 0.6, to: 1.25 },
      duration: 2200,
      ease: "Sine.easeOut",
      onComplete: () => text.destroy(),
    })
  }

  // ============================ zones ============================

  private zoneAt(x: number, y: number): ZoneInfo | null {
    // Test at the feet. Standing with your head inside a doorway is not being
    // in the room.
    const fy = y + FEET_OFFSET_Y
    for (const z of this.zones) {
      if (Phaser.Geom.Rectangle.Contains(z.rect, x, fy)) {
        return { id: z.id, name: z.name, icon: z.icon, private: z.private }
      }
    }
    return null
  }

  // ============================ update ============================

  update(time: number, delta: number) {
    this.updateLocal(time)
    this.updateRemotes(delta)
    this.publish(time)
  }

  private updateLocal(time: number) {
    if (!this.myTextureKey) return
    const body = this.me.body as Phaser.Physics.Arcade.Body | null
    if (!body) return

    if (this.sitKey && Phaser.Input.Keyboard.JustDown(this.sitKey) && !this.inputLocked) {
      if (this.sitting) this.standUp()
      else this.sitDown()
    }

    let vx = 0
    let vy = 0
    if (!this.inputLocked && !this.sitting && this.keys) {
      const down = (arr: Phaser.Input.Keyboard.Key[]) => arr.some((key) => key.isDown)
      if (down(this.keys.left)) vx -= 1
      if (down(this.keys.right)) vx += 1
      if (down(this.keys.up)) vy -= 1
      if (down(this.keys.down)) vy += 1
    }

    const moving = vx !== 0 || vy !== 0
    if (moving) {
      this.sitting = false
      this.lastInputAt = time
      // Normalise so diagonals are not 41 percent faster.
      const len = Math.hypot(vx, vy)
      const speed = PLAYER_SPEED * (this.keys?.sprint.isDown ? 1.55 : 1)
      body.setVelocity((vx / len) * speed, (vy / len) * speed)
      // Vertical wins ties: it reads better when walking diagonally.
      this.myDir = vy !== 0 ? (vy < 0 ? "up" : "down") : vx < 0 ? "left" : "right"
    } else {
      body.setVelocity(0, 0)
    }

    const wanted = animKey(this.myTextureKey, this.myDir, moving)
    if (this.me.anims.currentAnim?.key !== wanted) this.me.play(wanted, true)

    // Depth sort by feet so people walk in front of and behind furniture.
    this.me.setDepth(DEPTH.avatars + this.me.y / 10000)

    const fx = Math.round(this.me.x)
    const fy = Math.round(this.me.y)
    this.myShadow.setPosition(fx, fy + FEET_OFFSET_Y + 4).setDepth(this.me.depth - 0.01)
    this.myRing.setPosition(fx, fy + FEET_OFFSET_Y + 2).setDepth(this.me.depth - 0.01)
    this.myBubble.setPosition(fx, fy + FEET_OFFSET_Y)
    this.myPlate.setPosition(fx, fy - CHAR_FRAME_H / 2 - 6).setDepth(this.me.depth + 0.01)

    // Idle escalation: a still avatar softens, then dozes off.
    const idleFor = time - this.lastInputAt
    const alpha = this.ghost ? 0.45 : idleFor > IDLE_SLEEP_MS ? 0.72 : 1
    this.me.setAlpha(alpha)

    const near = this.nearOwnDesk()
    if (near !== this.deskPrompt) {
      this.deskPrompt = near
      bridge.emit("deskPrompt", near && !this.sitting)
    }

    const zone = this.zoneAt(this.me.x, this.me.y)
    if (zone?.id !== this.currentZone?.id) {
      this.currentZone = zone
      bridge.emit("zoneChanged", zone)
      // A gentle amber ring confirms you entered somewhere that matters.
      this.tweens.add({
        targets: this.myBubble,
        alpha: { from: zone ? 0.55 : 0.35, to: 0 },
        scale: { from: 0.7, to: 1.35 },
        duration: 700,
        ease: "Sine.easeOut",
      })
    }
  }

  private updateRemotes(delta: number) {
    // Positions arrive 10 times a second; we render 60. Interpolate or every
    // other person looks like they are teleporting.
    const t = Math.min(1, (delta / 1000) * 14)
    for (const a of this.remotes.values()) {
      const nx = Phaser.Math.Linear(a.sprite.x, a.targetX, t)
      const ny = Phaser.Math.Linear(a.sprite.y, a.targetY, t)
      const far = Math.abs(a.targetX - a.sprite.x) + Math.abs(a.targetY - a.sprite.y) > 200
      a.sprite.setPosition(far ? a.targetX : nx, far ? a.targetY : ny)

      const wanted = animKey(a.textureKey, a.dir, a.moving)
      if (a.sprite.anims.currentAnim?.key !== wanted) a.sprite.play(wanted, true)

      const x = Math.round(a.sprite.x)
      const y = Math.round(a.sprite.y)
      a.sprite.setDepth(DEPTH.avatars + y / 10000)
      a.shadow.setPosition(x, y + FEET_OFFSET_Y + 4).setDepth(a.sprite.depth - 0.01)
      a.ring.setPosition(x, y + FEET_OFFSET_Y + 2).setDepth(a.sprite.depth - 0.01)
      a.plate.setPosition(x, y - CHAR_FRAME_H / 2 - 6).setDepth(a.sprite.depth + 0.01)
      a.statusIcon.setPosition(x, y - CHAR_FRAME_H / 2 - 18).setDepth(a.sprite.depth + 0.01)
    }
  }

  private publish(time: number) {
    // Position to the server, at most POSITION_SEND_HZ, and only when changed.
    if (time - this.lastSendAt > 1000 / POSITION_SEND_HZ) {
      this.lastSendAt = time
      const x = Math.round(this.me.x)
      const y = Math.round(this.me.y)
      const moving = this.me.body ? (this.me.body.velocity.x !== 0 || this.me.body.velocity.y !== 0) : false
      const zoneId = this.currentZone?.id ?? null
      const idleFor = time - this.lastInputAt
      const resolvedPose =
        moving ? "walk" : this.sitting ? "sit" : idleFor > IDLE_SLEEP_MS ? "sleep" : idleFor > IDLE_SIT_MS ? "sit" : "idle"
      const changed =
        x !== this.lastSent.x ||
        y !== this.lastSent.y ||
        this.myDir !== this.lastSent.dir ||
        moving !== this.lastSent.moving ||
        zoneId !== this.lastSent.zoneId ||
        resolvedPose !== this.lastSent.pose
      if (changed) {
        this.lastSent = { x, y, dir: this.myDir, moving, zoneId, pose: resolvedPose }
        bridge.emit("localMove", { x, y, dir: this.myDir, moving, pose: resolvedPose, zoneId })
      }
    }

    // Screen positions for the floating video tiles, at UI rate only.
    if (time - this.lastSyncAt > 1000 / UI_SYNC_HZ) {
      this.lastSyncAt = time
      const cam = this.cameras.main
      const out: Record<string, { x: number; y: number; onScreen: boolean }> = {}
      for (const a of this.remotes.values()) {
        const sx = (a.sprite.x - cam.worldView.x) * cam.zoom
        const sy = (a.sprite.y - cam.worldView.y) * cam.zoom
        out[a.id] = {
          x: Math.round(sx),
          y: Math.round(sy),
          onScreen: sx > -160 && sx < cam.width + 160 && sy > -160 && sy < cam.height + 160,
        }
      }
      bridge.emit("screenPositions", out)
    }
  }

  /** Used by the debug overlay. */
  stats() {
    return {
      fps: Math.round(this.game.loop.actualFps),
      remotes: this.remotes.size,
      x: Math.round(this.me?.x ?? 0),
      y: Math.round(this.me?.y ?? 0),
      tileX: Math.round((this.me?.x ?? 0) / TILE_SIZE),
      tileY: Math.round((this.me?.y ?? 0) / TILE_SIZE),
      zone: this.currentZone?.name ?? "open floor",
    }
  }
}
