/**
 * Wire protocol shared by the PartyKit server and the browser client.
 * If you change anything here, change it on both sides in the same commit.
 */

export type Dir = "up" | "down" | "left" | "right"

export type CharacterConfig = {
  skin: "light" | "medium" | "tan" | "deep"
  hair: "short" | "messy" | "long" | "bun" | "curly" | "buzz"
  hairColor: "dark" | "brown" | "light" | "ginger"
  top: "sweater" | "shirt" | "hoodie" | "jacket" | "tee"
  topColor: "blue" | "teal" | "clay" | "amber" | "moss" | "plum"
  bottom: "jeans" | "trousers" | "skirt" | "shorts"
  bottomColor: "indigo" | "charcoal" | "khaki"
  shoes: "sneakers" | "boots" | "flats"
  accessory: "none" | "glasses" | "headphones" | "cap" | "scarf"
}

export type Pose = "idle" | "walk" | "sit" | "sleep"

/** Manual / derived presence shown on nameplates and the people list. */
export type Presence = "active" | "away" | "idle"

export type PlayerState = {
  id: string
  name: string
  character: CharacterConfig
  /** world pixels */
  x: number
  y: number
  dir: Dir
  moving: boolean
  pose: Pose
  ghost: boolean
  muted: boolean
  cam: boolean
  hand: boolean
  speaking: boolean
  zoneId: string | null
  /** Claimed desk seat id from DESK_SLOTS, or null if the office is full. */
  deskId: number | null
  presence: Presence
  isHost: boolean
  joinedAt: number
}

export type ChatScope = "room" | "nearby"

export type ChatMessage = {
  id: string
  from: string
  fromName: string
  text: string
  scope: ChatScope
  at: number
}

export type SignalData =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; candidate: RTCIceCandidateInit }

export type Reaction = "wave" | "tada" | "heart" | "laugh" | "think" | "plusone"

// ---------------- Client -> Server ----------------

export type ClientMessage =
  | { t: "join"; name: string; character: CharacterConfig }
  | { t: "move"; x: number; y: number; dir: Dir; moving: boolean; pose: Pose; zoneId: string | null }
  | { t: "ping" }
  | { t: "chat"; text: string; scope: ChatScope; nearbyIds?: string[] }
  | { t: "signal"; to: string; data: SignalData }
  | {
      t: "flags"
      muted?: boolean
      cam?: boolean
      ghost?: boolean
      hand?: boolean
      speaking?: boolean
      presence?: Presence
    }
  | { t: "react"; emoji: Reaction }
  | { t: "host"; action: "mute" | "kick"; target: string }

// ---------------- Server -> Client ----------------

export type ServerMessage =
  | { t: "welcome"; you: string; players: PlayerState[]; history: ChatMessage[]; now: number }
  | { t: "tick"; players: PlayerState[]; now: number }
  | { t: "joined"; player: PlayerState }
  | { t: "left"; id: string }
  | { t: "chat"; message: ChatMessage }
  | { t: "signal"; from: string; data: SignalData }
  | { t: "react"; from: string; emoji: Reaction }
  | { t: "forceMute" }
  | { t: "kicked"; reason: string }
  | { t: "error"; message: string }

// ---------------- Map ----------------

export type ZoneDef = {
  id: string
  name: string
  /** tile coords */
  x: number
  y: number
  w: number
  h: number
  /** private zones hard-gate audio: only same-zone people connect */
  private: boolean
  icon: string
}

export const DEFAULT_CHARACTER: CharacterConfig = {
  skin: "medium",
  hair: "messy",
  hairColor: "dark",
  top: "sweater",
  topColor: "teal",
  bottom: "jeans",
  bottomColor: "indigo",
  shoes: "sneakers",
  accessory: "none",
}
