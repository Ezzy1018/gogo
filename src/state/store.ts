/**
 * Single zustand store. Two rules that keep this app fast:
 *
 *  1. Phaser owns positions. The store holds a THROTTLED mirror of them
 *     (UI_SYNC_HZ), never the 60fps truth. React must not rerender on movement.
 *  2. Anything React needs to draw lives here. Anything only the world needs
 *     stays in the Phaser scene.
 */
import { create } from "zustand"
import type { CharacterConfig, ChatMessage, PlayerState, Presence, Reaction } from "../shared/types"
import { DEFAULT_CHARACTER } from "../shared/types"
import { IDENTITY_KEY, MAX_CHAT_LENGTH } from "../shared/config"

export type ConnectionStatus = "idle" | "connecting" | "online" | "reconnecting" | "offline"
export type PeerStatus = "new" | "connecting" | "connected" | "failed" | "closed"

export type PeerView = {
  id: string
  status: PeerStatus
  stream: MediaStream | null
  hasVideo: boolean
  /** screen space position of the peer's head, for anchoring their video tile */
  screenX: number
  screenY: number
  distanceTiles: number
  onScreen: boolean
}

export type ToastItem = {
  id: number
  text: string
  tone: "info" | "success" | "warning" | "danger"
}

export type Identity = { name: string; character: CharacterConfig }

export type Panel = "none" | "chat" | "people" | "settings"

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Identity
    if (!parsed?.name) return null
    return { name: parsed.name, character: { ...DEFAULT_CHARACTER, ...parsed.character } }
  } catch {
    return null
  }
}

function saveIdentity(identity: Identity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity))
  } catch {
    /* private browsing, ignore */
  }
}

const stored = typeof window === "undefined" ? null : loadIdentity()

let toastSeq = 0

export type Store = {
  // ---------- identity ----------
  myId: string | null
  name: string
  character: CharacterConfig
  joined: boolean
  isHost: boolean

  // ---------- world mirror (throttled) ----------
  players: Record<string, PlayerState>
  zoneId: string | null
  zoneName: string | null
  zoneIcon: string | null
  zonePrivate: boolean
  nearbyIds: string[]

  // ---------- connection ----------
  status: ConnectionStatus
  latencyMs: number
  turnActive: boolean

  // ---------- media ----------
  micOn: boolean
  camOn: boolean
  ghost: boolean
  hand: boolean
  presence: Presence
  deskId: number | null
  deskPrompt: boolean
  localStream: MediaStream | null
  mediaError: string | null
  devices: { audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }
  audioDeviceId: string | null
  videoDeviceId: string | null
  peers: Record<string, PeerView>
  speaking: Record<string, boolean>

  // ---------- ui ----------
  panel: Panel
  unread: number
  messages: ChatMessage[]
  toasts: ToastItem[]
  reactions: { id: number; from: string; emoji: Reaction }[]
  showDebug: boolean
  chatScope: "room" | "nearby"

  // ---------- actions ----------
  setIdentity: (name: string, character: CharacterConfig) => void
  setMyId: (id: string) => void
  setJoined: (v: boolean) => void
  setStatus: (s: ConnectionStatus) => void
  setLatency: (ms: number) => void
  setTurnActive: (v: boolean) => void

  syncPlayers: (players: PlayerState[]) => void
  upsertPlayer: (p: PlayerState) => void
  removePlayer: (id: string) => void
  setZone: (zone: { id: string; name: string; icon: string; private: boolean } | null) => void
  setNearby: (ids: string[]) => void

  setLocalStream: (s: MediaStream | null) => void
  setMediaError: (e: string | null) => void
  setDevices: (d: { audio: MediaDeviceInfo[]; video: MediaDeviceInfo[] }) => void
  selectDevice: (kind: "audio" | "video", id: string) => void
  toggleMic: () => void
  toggleCam: () => void
  toggleGhost: () => void
  toggleHand: () => void
  setPresence: (p: Presence) => void
  setDeskId: (id: number | null) => void
  setDeskPrompt: (v: boolean) => void
  setMic: (v: boolean) => void

  upsertPeer: (id: string, patch: Partial<PeerView>) => void
  removePeer: (id: string) => void
  setSpeaking: (id: string, v: boolean) => void

  openPanel: (p: Panel) => void
  addMessage: (m: ChatMessage) => void
  setMessages: (m: ChatMessage[]) => void
  setChatScope: (s: "room" | "nearby") => void
  toast: (text: string, tone?: ToastItem["tone"]) => void
  dismissToast: (id: number) => void
  addReaction: (from: string, emoji: Reaction) => void
  toggleDebug: () => void
  reset: () => void
}

export const useStore = create<Store>((set, get) => ({
  myId: null,
  name: stored?.name ?? "",
  character: stored?.character ?? DEFAULT_CHARACTER,
  joined: false,
  isHost: false,

  players: {},
  zoneId: null,
  zoneName: null,
  zoneIcon: null,
  zonePrivate: false,
  nearbyIds: [],

  status: "idle",
  latencyMs: 0,
  turnActive: false,

  micOn: false,
  camOn: false,
  ghost: false,
  hand: false,
  presence: "active",
  deskId: null,
  deskPrompt: false,
  localStream: null,
  mediaError: null,
  devices: { audio: [], video: [] },
  audioDeviceId: null,
  videoDeviceId: null,
  peers: {},
  speaking: {},

  panel: "none",
  unread: 0,
  messages: [],
  toasts: [],
  reactions: [],
  showDebug: false,
  chatScope: "room",

  // ---------- identity ----------
  setIdentity: (name, character) => {
    saveIdentity({ name, character })
    set({ name, character })
  },
  setMyId: (myId) => set({ myId }),
  setJoined: (joined) => set({ joined }),
  setStatus: (status) => set({ status }),
  setLatency: (latencyMs) => set({ latencyMs }),
  setTurnActive: (turnActive) => set({ turnActive }),

  // ---------- world ----------
  syncPlayers: (list) => {
    const players: Record<string, PlayerState> = {}
    for (const p of list) players[p.id] = p
    const me = get().myId
    const self = me ? players[me] : null
    set({
      players,
      isHost: me ? !!players[me]?.isHost : false,
      deskId: self?.deskId ?? get().deskId,
      presence: self?.presence ?? get().presence,
    })
  },
  upsertPlayer: (p) => set((s) => ({ players: { ...s.players, [p.id]: p } })),
  removePlayer: (id) =>
    set((s) => {
      const players = { ...s.players }
      delete players[id]
      const peers = { ...s.peers }
      delete peers[id]
      return { players, peers }
    }),
  setZone: (zone) =>
    set({
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? null,
      zoneIcon: zone?.icon ?? null,
      zonePrivate: zone?.private ?? false,
    }),
  setNearby: (nearbyIds) => set({ nearbyIds }),

  // ---------- media ----------
  setLocalStream: (localStream) => set({ localStream }),
  setMediaError: (mediaError) => set({ mediaError }),
  setDevices: (devices) => set({ devices }),
  selectDevice: (kind, id) =>
    set(kind === "audio" ? { audioDeviceId: id } : { videoDeviceId: id }),
  toggleMic: () => set((s) => ({ micOn: !s.micOn })),
  toggleCam: () => set((s) => ({ camOn: !s.camOn })),
  toggleGhost: () => set((s) => ({ ghost: !s.ghost })),
  toggleHand: () => set((s) => ({ hand: !s.hand })),
  setPresence: (presence) => set({ presence }),
  setDeskId: (deskId) => set({ deskId }),
  setDeskPrompt: (deskPrompt) => set({ deskPrompt }),
  setMic: (micOn) => set({ micOn }),

  upsertPeer: (id, patch) =>
    set((s) => {
      const prev: PeerView = s.peers[id] ?? {
        id,
        status: "new",
        stream: null,
        hasVideo: false,
        screenX: 0,
        screenY: 0,
        distanceTiles: 99,
        onScreen: false,
      }
      return { peers: { ...s.peers, [id]: { ...prev, ...patch } } }
    }),
  removePeer: (id) =>
    set((s) => {
      const peers = { ...s.peers }
      delete peers[id]
      return { peers }
    }),
  setSpeaking: (id, v) =>
    set((s) => (s.speaking[id] === v ? s : { speaking: { ...s.speaking, [id]: v } })),

  // ---------- ui ----------
  openPanel: (p) =>
    set((s) => ({ panel: s.panel === p ? "none" : p, unread: p === "chat" ? 0 : s.unread })),
  addMessage: (m) =>
    set((s) => ({
      messages: [...s.messages, m].slice(-200),
      unread: s.panel === "chat" || m.from === s.myId ? s.unread : s.unread + 1,
    })),
  setMessages: (messages) => set({ messages }),
  setChatScope: (chatScope) => set({ chatScope }),
  toast: (text, tone = "info") => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, text: text.slice(0, MAX_CHAT_LENGTH), tone }] }))
    setTimeout(() => get().dismissToast(id), 4200)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  addReaction: (from, emoji) => {
    const id = ++toastSeq
    set((s) => ({ reactions: [...s.reactions, { id, from, emoji }] }))
    setTimeout(() => set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })), 2600)
  },
  toggleDebug: () => set((s) => ({ showDebug: !s.showDebug })),
  reset: () =>
    set({
      myId: null,
      joined: false,
      players: {},
      peers: {},
      messages: [],
      nearbyIds: [],
      status: "idle",
      isHost: false,
      presence: "active",
      deskId: null,
      deskPrompt: false,
    }),
}))

/** Non-reactive read, for use inside the Phaser game loop. */
export const storeApi = useStore
