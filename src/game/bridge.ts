/**
 * The one and only seam between React and Phaser.
 *
 * React never reaches into the scene and the scene never imports a component.
 * They talk through this tiny typed emitter. If you find yourself wanting to
 * add a second channel, add an event here instead.
 */
import type { PlayerState, Reaction, Dir } from "../shared/types"

export type ZoneInfo = { id: string; name: string; icon: string; private: boolean }

export type LocalMove = {
  x: number
  y: number
  dir: Dir
  moving: boolean
  pose: "idle" | "walk" | "sit" | "sleep"
  zoneId: string | null
}

export type BridgeEvents = {
  /** net -> world: authoritative snapshot of everyone */
  players: PlayerState[]
  /** net -> world */
  playerLeft: string
  /** net -> world: somebody reacted, float it over their head */
  reaction: { from: string; emoji: Reaction }
  /** world -> net: our position changed enough to be worth sending */
  localMove: LocalMove
  /** world -> react: we walked into or out of a zone */
  zoneChanged: ZoneInfo | null
  /** react -> world: stop capturing keys while the user types */
  inputLock: boolean
  /** react -> world: ghost mode changed our own appearance */
  ghost: boolean
  /** react -> world: place us at our claimed desk on join / away */
  claimDesk: { deskId: number | null; x: number; y: number; dir: Dir; sit: boolean }
  /** react -> world: stand up / sit toggle from the toolbar */
  sitAtDesk: boolean
  /** world -> react: near own desk, for the sit hint */
  deskPrompt: boolean
  /** world -> react: throttled screen positions for anchoring video tiles */
  screenPositions: Record<string, { x: number; y: number; onScreen: boolean }>
}

type Key = keyof BridgeEvents
type Listener<K extends Key> = (payload: BridgeEvents[K]) => void

class Bridge {
  private listeners = new Map<Key, Set<Listener<Key>>>()

  on<K extends Key>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(listener as Listener<Key>)
    return () => {
      this.listeners.get(event)?.delete(listener as Listener<Key>)
    }
  }

  emit<K extends Key>(event: K, payload: BridgeEvents[K]) {
    const set = this.listeners.get(event)
    if (!set) return
    for (const fn of set) {
      try {
        ;(fn as Listener<K>)(payload)
      } catch (err) {
        console.error("[bridge] listener failed for " + String(event), err)
      }
    }
  }

  clear() {
    this.listeners.clear()
  }
}

export const bridge = new Bridge()
