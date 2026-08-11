/**
 * Proximity rules. This file is the single source of truth for "who can hear
 * whom". Both the mesh manager and the video tiles read from it, so they can
 * never disagree.
 */
import {
  BUBBLE_ENTER_TILES,
  BUBBLE_EXIT_TILES,
  FULL_VOLUME_TILES,
  SILENCE_TILES,
  VIDEO_LARGE_TILES,
  VIDEO_SMALL_TILES,
  VIDEO_LARGE_PX,
  VIDEO_SMALL_PX,
  TILE_SIZE,
} from "../shared/config"
import type { PlayerState } from "../shared/types"

export type Positioned = Pick<PlayerState, "x" | "y" | "zoneId" | "ghost">

/** Straight line distance between two players, measured in tiles. */
export function distanceTiles(a: Positioned, b: Positioned): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy) / TILE_SIZE
}

/**
 * Should we hold a media connection to this person right now?
 *
 * Two rules, in order:
 *  1. Ghost mode always wins. Invisible people connect to nobody.
 *  2. If either person is inside a zone, ONLY the zone matters. This is what
 *     makes a meeting room a room: standing outside the glass hears nothing,
 *     and being inside hears everyone regardless of distance.
 *  3. Otherwise use open floor distance, with hysteresis so that standing
 *     exactly on the boundary does not thrash the connection up and down.
 */
export function shouldConnect(
  me: Positioned,
  them: Positioned,
  alreadyConnected: boolean,
): boolean {
  if (me.ghost || them.ghost) return false

  const myZone = me.zoneId
  const theirZone = them.zoneId
  if (myZone !== null || theirZone !== null) return myZone === theirZone

  const threshold = alreadyConnected ? BUBBLE_EXIT_TILES : BUBBLE_ENTER_TILES
  return distanceTiles(me, them) <= threshold
}

/**
 * Volume from 0 to 1. A cosine ramp, not a straight line, because linear
 * falloff sounds abrupt to the ear right where you notice it most.
 */
export function volumeFor(me: Positioned, them: Positioned): number {
  if (me.zoneId !== null || them.zoneId !== null) {
    return me.zoneId === them.zoneId ? 1 : 0
  }
  const d = distanceTiles(me, them)
  if (d <= FULL_VOLUME_TILES) return 1
  if (d >= SILENCE_TILES) return 0
  const t = (d - FULL_VOLUME_TILES) / (SILENCE_TILES - FULL_VOLUME_TILES)
  return (Math.cos(t * Math.PI) + 1) / 2
}

export type VideoPresentation = { size: number; showVideo: boolean; showTile: boolean }

/**
 * The near-to-far ramp. Walking towards someone should feel like walking
 * towards someone: they get bigger, then they are just a face, then a name.
 */
export function videoPresentation(distance: number, sharedZone: boolean): VideoPresentation {
  if (sharedZone) return { size: VIDEO_LARGE_PX, showVideo: true, showTile: true }
  if (distance <= VIDEO_LARGE_TILES) return { size: VIDEO_LARGE_PX, showVideo: true, showTile: true }
  if (distance <= VIDEO_SMALL_TILES) {
    // smoothly interpolate between the two sizes instead of snapping
    const t = (distance - VIDEO_LARGE_TILES) / (VIDEO_SMALL_TILES - VIDEO_LARGE_TILES)
    const size = Math.round(VIDEO_LARGE_PX + (VIDEO_SMALL_PX - VIDEO_LARGE_PX) * t)
    return { size, showVideo: true, showTile: true }
  }
  return { size: VIDEO_SMALL_PX, showVideo: false, showTile: false }
}
