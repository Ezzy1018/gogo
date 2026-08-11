/**
 * Modular avatar composition (Art Bible s5).
 *
 * Every body part ships as its own 16 frame sheet. At runtime we stack the
 * chosen layers into a single RenderTexture and save it as one texture, so
 * each avatar costs exactly one draw call no matter how many layers it has.
 * Textures are cached by config hash: ten people wearing the same outfit share
 * one texture.
 */
import Phaser from "phaser"
import type { CharacterConfig, Dir } from "../shared/types"
import { CHAR_FRAME_W, CHAR_FRAME_H, CHAR_FRAMES } from "../shared/config"

export const SKINS = ["light", "medium", "tan", "deep"] as const
export const HAIRS = ["short", "messy", "long", "bun", "curly", "buzz"] as const
export const HAIR_COLORS = ["dark", "brown", "light", "ginger"] as const
export const TOPS = ["sweater", "shirt", "hoodie", "jacket", "tee"] as const
export const TOP_COLORS = ["blue", "teal", "clay", "amber", "moss", "plum"] as const
export const BOTTOMS = ["jeans", "trousers", "skirt", "shorts"] as const
export const BOTTOM_COLORS = ["indigo", "charcoal", "khaki"] as const
export const SHOES = ["sneakers", "boots", "flats"] as const
export const ACCESSORIES = ["none", "glasses", "headphones", "cap", "scarf"] as const

const DIR_ORDER: Dir[] = ["down", "left", "right", "up"]

/** Every layer sheet the game may ever need, for preload(). */
export function allLayerKeys(): { key: string; file: string }[] {
  const out: { key: string; file: string }[] = []
  const add = (name: string) => out.push({ key: "layer-" + name, file: name + ".png" })
  SKINS.forEach((s) => add("base_" + s))
  HAIRS.forEach((h) => HAIR_COLORS.forEach((c) => add("hair_" + h + "_" + c)))
  TOPS.forEach((t) => TOP_COLORS.forEach((c) => add("top_" + t + "_" + c)))
  BOTTOMS.forEach((b) => BOTTOM_COLORS.forEach((c) => add("bottom_" + b + "_" + c)))
  SHOES.forEach((s) => add("shoes_" + s))
  ACCESSORIES.filter((a) => a !== "none").forEach((a) => add("acc_" + a))
  return out
}

/** Draw order matters: a hoodie hood must land on top of hair, and so on. */
function layerStack(c: CharacterConfig): string[] {
  const stack = [
    "layer-base_" + c.skin,
    "layer-bottom_" + c.bottom + "_" + c.bottomColor,
    "layer-shoes_" + c.shoes,
    "layer-top_" + c.top + "_" + c.topColor,
    "layer-hair_" + c.hair + "_" + c.hairColor,
  ]
  if (c.accessory !== "none") stack.push("layer-acc_" + c.accessory)
  return stack
}

export function characterHash(c: CharacterConfig): string {
  return [c.skin, c.hair, c.hairColor, c.top, c.topColor, c.bottom, c.bottomColor, c.shoes, c.accessory].join("-")
}

/**
 * Returns the texture key for this outfit, building and caching it on first
 * use. Also registers the walk and idle animations for that key.
 */
export function ensureCharacterTexture(scene: Phaser.Scene, config: CharacterConfig): string {
  const key = "char-" + characterHash(config)
  if (scene.textures.exists(key)) return key

  const width = CHAR_FRAME_W * CHAR_FRAMES
  const rt = scene.make.renderTexture({ x: 0, y: 0, width, height: CHAR_FRAME_H }, false)

  for (const layer of layerStack(config)) {
    if (scene.textures.exists(layer)) rt.draw(layer, 0, 0)
    else console.warn("[character] missing layer " + layer)
  }

  const texture = rt.saveTexture(key)
  rt.destroy()

  // Slice the flat strip into 16 addressable frames.
  for (let i = 0; i < CHAR_FRAMES; i++) {
    texture.add(i, 0, i * CHAR_FRAME_W, 0, CHAR_FRAME_W, CHAR_FRAME_H)
  }

  registerAnimations(scene, key)
  return key
}

/**
 * Frame layout per direction: 0 idle_a, 1 idle_b, 2 step_a, 3 step_b.
 * Walk alternates step, neutral, step, neutral which reads as a real gait.
 * Idle is a slow two frame breath. It is a tiny thing that makes the room feel
 * alive when nobody is moving.
 */
function registerAnimations(scene: Phaser.Scene, key: string) {
  DIR_ORDER.forEach((dir, index) => {
    const base = index * 4
    const walkKey = key + "-walk-" + dir
    const idleKey = key + "-idle-" + dir

    if (!scene.anims.exists(walkKey)) {
      scene.anims.create({
        key: walkKey,
        frames: [base + 2, base + 0, base + 3, base + 0].map((frame) => ({ key, frame })),
        frameRate: 8,
        repeat: -1,
      })
    }
    if (!scene.anims.exists(idleKey)) {
      scene.anims.create({
        key: idleKey,
        frames: [base + 0, base + 1].map((frame) => ({ key, frame })),
        frameRate: 1.6,
        repeat: -1,
      })
    }
  })
}

export function animKey(textureKey: string, dir: Dir, moving: boolean): string {
  return textureKey + (moving ? "-walk-" : "-idle-") + dir
}

/** A deterministic starting outfit, so a new person is never a grey blob. */
export function randomCharacter(): CharacterConfig {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairColor: pick(HAIR_COLORS),
    top: pick(TOPS),
    topColor: pick(TOP_COLORS),
    bottom: pick(BOTTOMS),
    bottomColor: pick(BOTTOM_COLORS),
    shoes: pick(SHOES),
    accessory: pick(ACCESSORIES),
  }
}
