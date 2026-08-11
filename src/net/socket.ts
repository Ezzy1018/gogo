/**
 * Thin typed wrapper over PartySocket.
 *
 * PartySocket already handles exponential backoff reconnection, so we do not
 * write our own retry loop. What we add:
 *   - typed send()/on() so message shapes cannot drift from the server
 *   - heartbeat + round trip latency
 *   - automatic re-join after a reconnect (the server forgets us on close)
 */
import PartySocket from "partysocket"
import {
  PARTYKIT_HOST,
  DEFAULT_ROOM,
  HEARTBEAT_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
} from "../shared/config"
import type { CharacterConfig, ClientMessage, ServerMessage } from "../shared/types"

type Handler<T extends ServerMessage["t"]> = (msg: Extract<ServerMessage, { t: T }>) => void

type NetStatus = "connecting" | "online" | "reconnecting" | "offline"
type StatusHandler = (status: NetStatus) => void

export class NetClient {
  private socket: PartySocket | null = null
  private handlers = new Map<string, Set<(m: ServerMessage) => void>>()
  private statusHandlers = new Set<StatusHandler>()
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private lastPingAt = 0
  private hasJoinedOnce = false
  private identity: { name: string; character: CharacterConfig } | null = null

  latencyMs = 0

  get id(): string | null {
    return this.socket?.id ?? null
  }

  connect(room = DEFAULT_ROOM) {
    if (this.socket) return
    this.emitStatus("connecting")

    this.socket = new PartySocket({
      host: PARTYKIT_HOST,
      room,
      minUptime: 2000,
      maxRetries: Infinity,
      minReconnectionDelay: RECONNECT_BASE_MS,
      maxReconnectionDelay: RECONNECT_MAX_MS,
      reconnectionDelayGrowFactor: 1.6,
    })

    this.socket.addEventListener("open", () => {
      this.emitStatus("online")
      // Join may have been sent while the socket was still connecting, or this
      // may be a reconnect with a new connection id. Re-announce either way.
      if (this.identity) {
        this.hasJoinedOnce = true
        this.send({ t: "join", name: this.identity.name, character: this.identity.character })
      }
      this.startHeartbeat()
    })

    this.socket.addEventListener("close", () => {
      this.stopHeartbeat()
      this.emitStatus("reconnecting")
    })

    this.socket.addEventListener("error", () => {
      this.emitStatus("reconnecting")
    })

    this.socket.addEventListener("message", (event: MessageEvent) => {
      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }
      if (msg.t === "tick" && this.lastPingAt) {
        this.latencyMs = Math.round(Date.now() - this.lastPingAt)
        this.lastPingAt = 0
      }
      const set = this.handlers.get(msg.t)
      if (set) for (const fn of set) fn(msg)
    })

    // Browsers throttle timers in hidden tabs; nudge the socket back on return.
    document.addEventListener("visibilitychange", this.onVisibility)
  }

  private onVisibility = () => {
    if (document.visibilityState === "visible" && this.socket) {
      if (this.socket.readyState !== WebSocket.OPEN) this.socket.reconnect()
      else this.ping()
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeat = setInterval(() => this.ping(), HEARTBEAT_MS)
  }

  private stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat)
    this.heartbeat = null
  }

  private ping() {
    this.lastPingAt = Date.now()
    this.send({ t: "ping" })
  }

  join(name: string, character: CharacterConfig) {
    this.identity = { name, character }
    this.hasJoinedOnce = true
    this.send({ t: "join", name, character })
  }

  send(msg: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg))
    }
  }

  on<T extends ServerMessage["t"]>(type: T, handler: Handler<T>) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler as (m: ServerMessage) => void)
    return () => {
      this.handlers.get(type)?.delete(handler as (m: ServerMessage) => void)
    }
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  private emitStatus(status: NetStatus) {
    for (const fn of this.statusHandlers) fn(status)
  }

  /** Asks the server to mint TURN credentials. Falls back to STUN only. */
  async fetchIceServers(
    room = DEFAULT_ROOM,
  ): Promise<{ iceServers: RTCIceServer[]; turn: boolean }> {
    const local = PARTYKIT_HOST.startsWith("localhost") || PARTYKIT_HOST.startsWith("127.")
    const protocol = local ? "http" : "https"
    const url = protocol + "://" + PARTYKIT_HOST + "/parties/main/" + room + "/ice"
    const res = await fetch(url)
    if (!res.ok) throw new Error("ICE fetch failed: " + res.status)
    return res.json()
  }

  disconnect() {
    this.stopHeartbeat()
    document.removeEventListener("visibilitychange", this.onVisibility)
    this.socket?.close()
    this.socket = null
    this.handlers.clear()
  }
}

export const net = new NetClient()
