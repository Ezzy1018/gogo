/**
 * Claimable desk seats on the Work Floor.
 * Coordinates must stay in lockstep with tools/generate_map.py desk_cluster().
 */
import { TILE_SIZE } from "./config"
import type { Dir } from "./types"

export type DeskSlot = {
  id: number
  /** left tile of the two-tile desk */
  deskTX: number
  deskTY: number
  seatTX: number
  seatTY: number
  /** facing the desk while seated */
  dir: Dir
}

const CLUSTERS: Array<[number, number]> = [
  [4, 6],
  [12, 6],
  [20, 6],
  [4, 14],
  [12, 14],
  [20, 14],
]

const OFFSETS: Array<[number, number, "up" | "down"]> = [
  [0, 0, "up"],
  [2, 0, "up"],
  [0, 3, "down"],
  [2, 3, "down"],
]

function buildSlots(): DeskSlot[] {
  const out: DeskSlot[] = []
  for (const [cx, cy] of CLUSTERS) {
    for (const [dx, dy, facing] of OFFSETS) {
      const deskTX = cx + dx
      const deskTY = cy + dy
      const seatTX = deskTX
      const seatTY = facing === "down" ? deskTY + 1 : deskTY - 1
      out.push({
        id: out.length,
        deskTX,
        deskTY,
        seatTX,
        seatTY,
        dir: facing === "down" ? "up" : "down",
      })
    }
  }
  return out
}

export const DESK_SLOTS: DeskSlot[] = buildSlots()

export function getDesk(id: number | null | undefined): DeskSlot | null {
  if (id == null || id < 0 || id >= DESK_SLOTS.length) return null
  return DESK_SLOTS[id]
}

export function deskSeatPx(desk: DeskSlot): { x: number; y: number } {
  return {
    x: (desk.seatTX + 0.5) * TILE_SIZE,
    y: (desk.seatTY + 0.5) * TILE_SIZE,
  }
}

export function deskLabelPx(desk: DeskSlot): { x: number; y: number } {
  return {
    x: (desk.deskTX + 1) * TILE_SIZE,
    y: desk.deskTY * TILE_SIZE - 4,
  }
}

/** How close (tiles) you must be to sit at your desk. */
export const DESK_SIT_RANGE_TILES = 1.6
