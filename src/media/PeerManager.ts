/**
 * Owns the peer-to-peer mesh.
 *
 * Every UI tick the world hands us the current positions. We decide who should
 * be connected, open and close connections accordingly, and set each person's
 * volume from the distance ramp. Nothing else in the app talks to WebRTC.
 *
 * Why a mesh and not an SFU: at 5 to 8 people in one bubble the upload cost is
 * fine, and a mesh costs nothing to run. MAX_PEERS is the guard rail.
 */
import { Peer } from "./PeerConnection"
import { shouldConnect, volumeFor, distanceTiles } from "./proximity"
import { MAX_PEERS, TEARDOWN_GRACE_MS, FALLBACK_ICE_SERVERS } from "../shared/config"
import type { PlayerState, SignalData } from "../shared/types"
import { useStore } from "../state/store"

type SendSignal = (to: string, data: SignalData) => void

export class PeerManager {
  private peers = new Map<string, Peer>()
  /** ids that fell out of range and are on the grace timer */
  private pendingClose = new Map<string, number>()
  private iceServers: RTCIceServer[] = [...FALLBACK_ICE_SERVERS]
  private localStream: MediaStream | null = null
  private myId: string | null = null
  private sendSignal: SendSignal = () => {}
  /** signals that arrived before we opened the connection */
  private earlySignals = new Map<string, SignalData[]>()

  configure(opts: {
    myId: string
    iceServers?: RTCIceServer[]
    sendSignal: SendSignal
  }) {
    this.myId = opts.myId
    if (opts.iceServers?.length) this.iceServers = opts.iceServers
    this.sendSignal = opts.sendSignal
  }

  setIceServers(servers: RTCIceServer[]) {
    if (servers.length) this.iceServers = servers
  }

  async setLocalStream(stream: MediaStream | null) {
    this.localStream = stream
    await Promise.all([...this.peers.values()].map((p) => p.setLocalStream(stream)))
  }

  /**
   * Called at UI_SYNC_HZ from the game scene.
   * `me` and `others` are the authoritative snapshot for this frame.
   */
  update(me: PlayerState, others: PlayerState[]) {
    if (!this.myId) return
    const store = useStore.getState()
    const now = Date.now()
    const wanted = new Set<string>()

    // Sort by distance so that if we hit MAX_PEERS we keep the closest people,
    // which is also who the user is most likely actually talking to.
    const ranked = others
      .filter((p) => p.id !== me.id)
      .map((p) => ({ p, d: distanceTiles(me, p) }))
      .sort((a, b) => a.d - b.d)

    for (const { p, d } of ranked) {
      const connected = this.peers.has(p.id)
      const want = shouldConnect(me, p, connected)

      if (want && (connected || wanted.size < MAX_PEERS)) {
        wanted.add(p.id)
        this.pendingClose.delete(p.id)
        if (!connected) this.open(p.id)

        const peer = this.peers.get(p.id)
        peer?.setVolume(volumeFor(me, p))

        const sharedZone = me.zoneId !== null && me.zoneId === p.zoneId
        store.upsertPeer(p.id, {
          distanceTiles: sharedZone ? 0 : d,
          hasVideo: p.cam,
        })
      }
    }

    // Anything not wanted this frame gets a grace period before teardown, so
    // that brushing past the edge of someone's bubble does not kill the call.
    for (const id of this.peers.keys()) {
      if (wanted.has(id)) continue
      const since = this.pendingClose.get(id)
      if (since === undefined) {
        this.pendingClose.set(id, now)
      } else if (now - since > TEARDOWN_GRACE_MS) {
        this.close(id)
      }
    }

    store.setNearby([...wanted])
  }

  private open(peerId: string) {
    if (!this.myId || this.peers.has(peerId)) return
    const store = useStore.getState()

    const peer = new Peer(peerId, this.myId, this.iceServers, this.localStream, {
      onSignal: (data) => this.sendSignal(peerId, data),
      onStream: (stream) => store.upsertPeer(peerId, { stream }),
      onState: (status) => {
        store.upsertPeer(peerId, { status })
        if (status === "failed") {
          // Rebuild once from scratch; ICE restart already failed at this point.
          setTimeout(() => {
            if (this.peers.get(peerId) === peer) {
              this.close(peerId)
            }
          }, 1500)
        }
      },
    })

    this.peers.set(peerId, peer)
    store.upsertPeer(peerId, { id: peerId, status: "connecting", stream: null })

    // Replay anything that arrived while we were deciding.
    const queued = this.earlySignals.get(peerId)
    if (queued) {
      this.earlySignals.delete(peerId)
      for (const data of queued) void peer.handleSignal(data)
    }
  }

  private close(peerId: string) {
    const peer = this.peers.get(peerId)
    peer?.close()
    this.peers.delete(peerId)
    this.pendingClose.delete(peerId)
    this.earlySignals.delete(peerId)
    useStore.getState().removePeer(peerId)
  }

  handleSignal(from: string, data: SignalData) {
    const peer = this.peers.get(from)
    if (peer) {
      void peer.handleSignal(data)
      return
    }
    // The other side saw us first. Open our half, then replay.
    if (this.peers.size < MAX_PEERS) {
      this.open(from)
      void this.peers.get(from)?.handleSignal(data)
      return
    }
    const queue = this.earlySignals.get(from) ?? []
    queue.push(data)
    this.earlySignals.set(from, queue.slice(-12))
  }

  /** Ghost mode and leaving both need a hard stop. */
  closeAll() {
    for (const id of [...this.peers.keys()]) this.close(id)
  }

  /** Retry playing every remote audio element after a user gesture. */
  resumeAudio() {
    for (const peer of this.peers.values()) peer.resumeAudio()
  }

  get count() {
    return this.peers.size
  }

  async debugStats() {
    const out: Record<string, { bytes: number; state: string }> = {}
    for (const [id, peer] of this.peers) {
      const s = await peer.getStats()
      out[id] = { bytes: s.bytes, state: peer.connectionState }
    }
    return out
  }
}

export const peerManager = new PeerManager()
