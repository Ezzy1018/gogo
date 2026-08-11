/**
 * Gathera tuning constants. Single source of truth.
 * Server and client both import from here so they can never drift.
 */

// ---------- World ----------
export const TILE_SIZE = 32
export const PLAYER_SPEED = 160 // world px per second
export const CAMERA_ZOOM = 2
export const CAMERA_LERP = 0.08

// ---------- Networking ----------
export const POSITION_SEND_HZ = 10
export const SERVER_TICK_HZ = 10
/** Beats Cloudflare's 100s idle websocket close. Do not raise above 30000. */
export const HEARTBEAT_MS = 5000
export const EVICT_MS = 15000
export const UI_SYNC_HZ = 5
export const RECONNECT_BASE_MS = 500
export const RECONNECT_MAX_MS = 8000

// ---------- Proximity ----------
/** Hysteresis: connect at 4 tiles, only tear down past 6. Prevents thrash. */
export const BUBBLE_ENTER_TILES = 4
export const BUBBLE_EXIT_TILES = 6
export const TEARDOWN_GRACE_MS = 1500

// ---------- Spatial audio ----------
export const FULL_VOLUME_TILES = 2
export const SILENCE_TILES = 6

// ---------- Video distance ramp (Art Bible s7) ----------
export const VIDEO_LARGE_TILES = 2
export const VIDEO_SMALL_TILES = 4
export const VIDEO_LARGE_PX = 200
export const VIDEO_SMALL_PX = 120

// ---------- Limits ----------
export const MAX_PEERS = 6
export const MAX_VIDEO_TILES = 4
export const MAX_CHAT_LENGTH = 500
export const MAX_NAME_LENGTH = 24
export const CHAT_HISTORY = 100

// ---------- Idle behaviour ----------
export const IDLE_SIT_MS = 60_000
export const IDLE_SLEEP_MS = 300_000

// ---------- Minimap ----------
/** Map is 60x40 tiles; these keep the HUD compact in the bottom-left. */
export const MINIMAP_WIDTH_PX = 168
export const MINIMAP_HEIGHT_PX = 112
export const MAP_WIDTH_TILES = 60
export const MAP_HEIGHT_TILES = 40

// ---------- Media constraints ----------
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 320 },
  height: { ideal: 240 },
  frameRate: { ideal: 20, max: 24 },
}

// ---------- ICE ----------
export const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
]

// ---------- Connection ----------
export const PARTYKIT_HOST =
  import.meta.env.VITE_PARTYKIT_HOST || "127.0.0.1:1999"

export const DEFAULT_ROOM = "office"
export const IDENTITY_KEY = "gathera-identity-v2"

// ---------- Derived helpers ----------
export const tilesToPx = (t: number) => t * TILE_SIZE
export const pxToTiles = (p: number) => p / TILE_SIZE

// ---------- character sheet geometry (must match tools/generate_chars.py) ----------
export const CHAR_FRAME_W = 32
export const CHAR_FRAME_H = 48
/** 4 directions x 4 frames: idle_a, idle_b, step_a, step_b */
export const CHAR_FRAMES = 16
/** feet sit this far below the sprite origin, used for zone and depth tests */
export const FEET_OFFSET_Y = 12
