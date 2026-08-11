/**
 * Gathera realtime server. Runs on PartyKit / Cloudflare Durable Objects.
 *
 * Responsibilities:
 *   - authoritative player registry (identity, position, flags, host)
 *   - fixed rate state broadcast
 *   - chat relay + short history
 *   - WebRTC signalling relay (it never touches media itself)
 *   - TURN credential minting at GET /ice
 *
 * It deliberately does NOT simulate movement. Clients are authoritative over
 * their own position; this is a trusted-team tool, not a competitive game.
 */
import type * as Party from "partykit/server"
import {
  SERVER_TICK_HZ,
  EVICT_MS,
  MAX_CHAT_LENGTH,
  MAX_NAME_LENGTH,
  CHAT_HISTORY,
  FALLBACK_ICE_SERVERS,
} from "../src/shared/config"
import { DESK_SLOTS, deskSeatPx, getDesk } from "../src/shared/desks"
import type {
  ClientMessage,
  ServerMessage,
  PlayerState,
  ChatMessage,
  CharacterConfig,
  Presence,
} from "../src/shared/types"
import { DEFAULT_CHARACTER } from "../src/shared/types"

type Env = {
  TURN_KEY_ID?: string
  TURN_KEY_API_TOKEN?: string
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const clampStr = (v: unknown, max: number, fallback = "") =>
  typeof v === "string" ? v.slice(0, max).trim() || fallback : fallback

const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback

export default class GatheraServer implements Party.Server {
  players = new Map<string, PlayerState>()
  lastSeen = new Map<string, number>()
  history: ChatMessage[] = []
  timer: ReturnType<typeof setInterval> | null = null
  seq = 0

  constructor(readonly room: Party.Room) {}

  // ---------------- lifecycle ----------------

  onConnect(conn: Party.Connection) {
    this.lastSeen.set(conn.id, Date.now())
    this.startLoop()
    // The player is not announced until it sends `join` with a name.
  }

  onClose(conn: Party.Connection) {
    this.removePlayer(conn.id)
  }

  onError(conn: Party.Connection) {
    this.removePlayer(conn.id)
  }

  private removePlayer(id: string) {
    const existed = this.players.delete(id)
    this.lastSeen.delete(id)
    if (existed) {
      // Exclude the leaving id: PartyKit throws if we send on a closed socket.
      this.broadcast({ t: "left", id }, [id])
      this.ensureHost()
    }
    if (this.players.size === 0) this.stopLoop()
  }

  private startLoop() {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), 1000 / SERVER_TICK_HZ)
  }

  private stopLoop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private tick() {
    const now = Date.now()
    // evict anyone whose heartbeat stopped. close() triggers onClose -> removePlayer.
    for (const [id, seen] of this.lastSeen) {
      if (now - seen > EVICT_MS) {
        const conn = this.getConnection(id)
        if (conn) conn.close()
        else this.removePlayer(id)
      }
    }
    if (this.players.size === 0) return this.stopLoop()
    this.broadcast({ t: "tick", players: [...this.players.values()], now })
  }

  private getConnection(id: string) {
    return this.room.getConnection(id)
  }

  // ---------------- host ----------------

  /** First joiner hosts. On leave it passes to the longest connected player. */
  private ensureHost() {
    const all = [...this.players.values()]
    if (all.length === 0) return
    if (all.some((p) => p.isHost)) return
    const next = all.sort((a, b) => a.joinedAt - b.joinedAt)[0]
    next.isHost = true
  }

  /** First free desk seat, or null when the office is full. */
  private claimDesk(exceptId?: string): number | null {
    const taken = new Set<number>()
    for (const p of this.players.values()) {
      if (p.id === exceptId) continue
      if (p.deskId != null) taken.add(p.deskId)
    }
    for (const desk of DESK_SLOTS) {
      if (!taken.has(desk.id)) return desk.id
    }
    return null
  }

  // ---------------- messaging ----------------

  private broadcast(msg: ServerMessage, without?: string[]) {
    try {
      this.room.broadcast(JSON.stringify(msg), without)
    } catch {
      // A peer may already be mid-close; don't let that kill the room tick.
    }
  }

  private send(id: string, msg: ServerMessage) {
    this.getConnection(id)?.send(JSON.stringify(msg))
  }

  onMessage(raw: string, sender: Party.Connection) {
    this.lastSeen.set(sender.id, Date.now())

    let msg: ClientMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      return this.send(sender.id, { t: "error", message: "Malformed message" })
    }

    switch (msg.t) {
      case "ping":
        return

      case "join": {
        const name = clampStr(msg.name, MAX_NAME_LENGTH, "Guest")
        const character = this.sanitizeCharacter(msg.character)
        const deskId = this.claimDesk(sender.id)
        const desk = getDesk(deskId)
        const seat = desk ? deskSeatPx(desk) : { x: 29.5 * 32, y: 35.5 * 32 }
        const player: PlayerState = {
          id: sender.id,
          name,
          character,
          x: seat.x,
          y: seat.y,
          dir: desk?.dir ?? "up",
          moving: false,
          pose: desk ? "sit" : "idle",
          ghost: false,
          muted: false,
          cam: false,
          hand: false,
          speaking: false,
          zoneId: desk ? "work" : null,
          deskId,
          presence: desk ? "idle" : "active",
          isHost: this.players.size === 0,
          joinedAt: Date.now(),
        }
        this.players.set(sender.id, player)
        this.ensureHost()
        this.send(sender.id, {
          t: "welcome",
          you: sender.id,
          players: [...this.players.values()],
          history: this.history.slice(-CHAT_HISTORY),
          now: Date.now(),
        })
        this.broadcast({ t: "joined", player }, [sender.id])
        this.startLoop()
        return
      }

      case "move": {
        const p = this.players.get(sender.id)
        if (!p) return
        p.x = num(msg.x, p.x)
        p.y = num(msg.y, p.y)
        if (msg.dir === "up" || msg.dir === "down" || msg.dir === "left" || msg.dir === "right") p.dir = msg.dir
        p.moving = !!msg.moving
        if (msg.pose === "idle" || msg.pose === "walk" || msg.pose === "sit" || msg.pose === "sleep") p.pose = msg.pose
        p.zoneId = typeof msg.zoneId === "string" ? msg.zoneId : null
        if (p.presence !== "away") {
          if (msg.moving) p.presence = "active"
          else if (msg.pose === "sit" || msg.pose === "sleep") p.presence = "idle"
          else p.presence = "active"
        }
        return
      }

      case "flags": {
        const p = this.players.get(sender.id)
        if (!p) return
        if (typeof msg.muted === "boolean") p.muted = msg.muted
        if (typeof msg.cam === "boolean") p.cam = msg.cam
        if (typeof msg.ghost === "boolean") p.ghost = msg.ghost
        if (typeof msg.hand === "boolean") p.hand = msg.hand
        if (typeof msg.speaking === "boolean") p.speaking = msg.speaking
        if (msg.presence === "active" || msg.presence === "away" || msg.presence === "idle") {
          p.presence = msg.presence as Presence
          if (msg.presence === "away") {
            const desk = getDesk(p.deskId)
            if (desk) {
              const seat = deskSeatPx(desk)
              p.x = seat.x
              p.y = seat.y
              p.dir = desk.dir
              p.moving = false
              p.pose = "sit"
              p.zoneId = "work"
            }
          }
        }
        return
      }

      case "chat": {
        const p = this.players.get(sender.id)
        if (!p) return
        const text = clampStr(msg.text, MAX_CHAT_LENGTH)
        if (!text) return
        const message: ChatMessage = {
          id: `${Date.now()}-${this.seq++}`,
          from: p.id,
          fromName: p.name,
          text,
          scope: msg.scope === "nearby" ? "nearby" : "room",
          at: Date.now(),
        }
        if (message.scope === "room") {
          this.history.push(message)
          if (this.history.length > CHAT_HISTORY) this.history.shift()
          this.broadcast({ t: "chat", message })
        } else {
          // nearby chat is delivered only to the sender's current bubble
          const targets = Array.isArray(msg.nearbyIds) ? msg.nearbyIds : []
          this.send(sender.id, { t: "chat", message })
          for (const id of targets) {
            if (typeof id === "string" && this.players.has(id)) {
              this.send(id, { t: "chat", message })
            }
          }
        }
        return
      }

      case "signal": {
        if (!this.players.has(sender.id)) return
        if (typeof msg.to !== "string" || !this.players.has(msg.to)) return
        this.send(msg.to, { t: "signal", from: sender.id, data: msg.data })
        return
      }

      case "react": {
        if (!this.players.has(sender.id)) return
        this.broadcast({ t: "react", from: sender.id, emoji: msg.emoji })
        return
      }

      case "host": {
        const me = this.players.get(sender.id)
        // Host powers are enforced here, never in the browser.
        if (!me?.isHost) {
          return this.send(sender.id, { t: "error", message: "Only the host can do that" })
        }
        const target = this.players.get(msg.target)
        if (!target || target.id === me.id) return
        if (msg.action === "mute") {
          target.muted = true
          this.send(target.id, { t: "forceMute" })
        } else if (msg.action === "kick") {
          this.send(target.id, { t: "kicked", reason: `Removed by ${me.name}` })
          this.getConnection(target.id)?.close()
          this.removePlayer(target.id)
        }
        return
      }
    }
  }

  private sanitizeCharacter(c: unknown): CharacterConfig {
    const src = (c ?? {}) as Record<string, unknown>
    const pick = <K extends keyof CharacterConfig>(k: K, allowed: readonly string[]): CharacterConfig[K] => {
      const v = src[k as string]
      return (typeof v === "string" && allowed.includes(v) ? v : DEFAULT_CHARACTER[k]) as CharacterConfig[K]
    }
    return {
      skin: pick("skin", ["light", "medium", "tan", "deep"]),
      hair: pick("hair", ["short", "messy", "long", "bun", "curly", "buzz"]),
      hairColor: pick("hairColor", ["dark", "brown", "light", "ginger"]),
      top: pick("top", ["sweater", "shirt", "hoodie", "jacket", "tee"]),
      topColor: pick("topColor", ["blue", "teal", "clay", "amber", "moss", "plum"]),
      bottom: pick("bottom", ["jeans", "trousers", "skirt", "shorts"]),
      bottomColor: pick("bottomColor", ["indigo", "charcoal", "khaki"]),
      shoes: pick("shoes", ["sneakers", "boots", "flats"]),
      accessory: pick("accessory", ["none", "glasses", "headphones", "cap", "scarf"]),
    }
  }

  // ---------------- HTTP: TURN credentials ----------------

  async onRequest(req: Party.Request) {
    const url = new URL(req.url)
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS })
    if (!url.pathname.endsWith("/ice")) {
      return new Response("Not found", { status: 404, headers: CORS })
    }

    const env = this.room.env as Env
    const keyId = env.TURN_KEY_ID
    const token = env.TURN_KEY_API_TOKEN

    // No TURN configured: STUN only. Works on most home networks, fails on
    // symmetric NAT and strict corporate firewalls. See README.
    if (!keyId || !token) {
      return Response.json({ iceServers: FALLBACK_ICE_SERVERS, turn: false }, { headers: CORS })
    }

    try {
      const res = await fetch(
        "https://rtc.live.cloudflare.com/v1/turn/keys/" + keyId + "/credentials/generate",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ ttl: 86400 }),
        },
      )
      if (!res.ok) throw new Error(`TURN ${res.status}`)
      const data = (await res.json()) as { iceServers: RTCIceServer }
      return Response.json(
        { iceServers: [...FALLBACK_ICE_SERVERS, data.iceServers], turn: true },
        { headers: CORS },
      )
    } catch {
      return Response.json({ iceServers: FALLBACK_ICE_SERVERS, turn: false }, { headers: CORS })
    }
  }
}
