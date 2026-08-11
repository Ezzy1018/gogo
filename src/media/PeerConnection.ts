/**
 * One WebRTC connection to one other person.
 *
 * Uses the "perfect negotiation" pattern from the WebRTC spec. The short
 * version: both sides may try to offer at the same time (glare). We break the
 * tie deterministically by comparing connection ids, so exactly one side is
 * polite and rolls back. Without this, two people walking into each other at
 * the same moment get a dead connection roughly half the time.
 */
import type { SignalData } from "../shared/types"

export type PeerEvents = {
  onStream: (stream: MediaStream) => void
  onState: (state: "new" | "connecting" | "connected" | "failed" | "closed") => void
  onSignal: (data: SignalData) => void
}

export class Peer {
  readonly id: string
  readonly polite: boolean

  private pc: RTCPeerConnection
  private events: PeerEvents
  private audioSender: RTCRtpSender | null = null
  private videoSender: RTCRtpSender | null = null
  private audioEl: HTMLAudioElement | null = null
  private makingOffer = false
  private ignoreOffer = false
  private closed = false
  private pendingCandidates: RTCIceCandidateInit[] = []

  remoteStream: MediaStream | null = null

  constructor(
    peerId: string,
    myId: string,
    iceServers: RTCIceServer[],
    localStream: MediaStream | null,
    events: PeerEvents,
  ) {
    this.id = peerId
    this.events = events
    // Deterministic tie break. The lexicographically smaller id is the caller
    // (impolite); the other side is polite and yields on collision.
    this.polite = myId > peerId

    this.pc = new RTCPeerConnection({ iceServers, bundlePolicy: "max-bundle" })

    // Create transceivers up front so that muting never triggers renegotiation.
    const audioTransceiver = this.pc.addTransceiver("audio", { direction: "sendrecv" })
    const videoTransceiver = this.pc.addTransceiver("video", { direction: "sendrecv" })
    this.audioSender = audioTransceiver.sender
    this.videoSender = videoTransceiver.sender

    void this.setLocalStream(localStream)

    this.pc.onnegotiationneeded = async () => {
      if (this.closed) return
      try {
        this.makingOffer = true
        await this.pc.setLocalDescription()
        if (this.pc.localDescription) {
          this.events.onSignal({ kind: "offer", sdp: this.pc.localDescription })
        }
      } catch {
        /* negotiation raced with a close, safe to drop */
      } finally {
        this.makingOffer = false
      }
    }

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.events.onSignal({ kind: "ice", candidate: candidate.toJSON() })
    }

    this.pc.ontrack = ({ track, streams }) => {
      const stream = streams[0] ?? new MediaStream([track])
      this.remoteStream = stream
      this.attachAudio(stream)
      this.events.onStream(stream)
    }

    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState
      if (s === "connected") this.events.onState("connected")
      else if (s === "connecting" || s === "new") this.events.onState("connecting")
      else if (s === "failed") {
        this.events.onState("failed")
        // One free retry. ICE restarts fix most transient network flaps.
        this.restartIce()
      } else if (s === "closed" || s === "disconnected") this.events.onState("closed")
    }
  }

  /**
   * Remote audio is played through a hidden audio element rather than a React
   * <video> tag, so that audio keeps working at full quality even when the
   * person is too far away to have a visible video tile.
   */
  private attachAudio(stream: MediaStream) {
    if (!this.audioEl) {
      this.audioEl = document.createElement("audio")
      this.audioEl.autoplay = true
      this.audioEl.setAttribute("playsinline", "true")
      this.audioEl.muted = false
      this.audioEl.dataset.peer = this.id
      this.audioEl.style.display = "none"
      document.body.appendChild(this.audioEl)
    }
    if (this.audioEl.srcObject !== stream) {
      this.audioEl.srcObject = stream
    }
    void this.audioEl.play().catch(() => {
      // Autoplay may block until a gesture; PeerManager.resumeAudio retries.
    })
  }

  /** Call from a user gesture so browsers allow remote audio. */
  resumeAudio() {
    if (!this.audioEl) return
    this.audioEl.muted = false
    void this.audioEl.play().catch(() => {})
  }

  /** 0 to 1. Driven by the proximity ramp every UI tick. */
  setVolume(volume: number) {
    if (this.audioEl) this.audioEl.volume = Math.max(0, Math.min(1, volume))
  }

  /** Swap our outgoing tracks without renegotiating. */
  async setLocalStream(stream: MediaStream | null) {
    const audio = stream?.getAudioTracks()[0] ?? null
    const video = stream?.getVideoTracks()[0] ?? null
    try {
      if (this.audioSender) await this.audioSender.replaceTrack(audio)
      if (this.videoSender) await this.videoSender.replaceTrack(video)
    } catch {
      /* connection closed mid swap */
    }
  }

  async handleSignal(data: SignalData) {
    if (this.closed) return
    try {
      if (data.kind === "ice") {
        if (!this.pc.remoteDescription) {
          // Candidates can arrive before the description. Queue, do not drop.
          this.pendingCandidates.push(data.candidate)
          return
        }
        await this.pc.addIceCandidate(data.candidate).catch(() => {})
        return
      }

      const description = data.sdp
      const offerCollision =
        description.type === "offer" && (this.makingOffer || this.pc.signalingState !== "stable")

      this.ignoreOffer = !this.polite && offerCollision
      if (this.ignoreOffer) return

      await this.pc.setRemoteDescription(description)
      await this.flushCandidates()

      if (description.type === "offer") {
        await this.pc.setLocalDescription()
        if (this.pc.localDescription) {
          this.events.onSignal({ kind: "answer", sdp: this.pc.localDescription })
        }
      }
    } catch {
      /* malformed or late signal, ignore rather than crash the mesh */
    }
  }

  private async flushCandidates() {
    const queued = this.pendingCandidates
    this.pendingCandidates = []
    for (const c of queued) {
      await this.pc.addIceCandidate(c).catch(() => {})
    }
  }

  private restartIce() {
    if (this.closed || this.polite) return
    try {
      this.pc.restartIce()
    } catch {
      /* not supported, the manager will tear down and rebuild instead */
    }
  }

  get connectionState() {
    return this.pc.connectionState
  }

  async getStats() {
    try {
      const stats = await this.pc.getStats()
      let bytes = 0
      let candidateType = ""
      stats.forEach((r) => {
        if (r.type === "inbound-rtp") bytes += (r as { bytesReceived?: number }).bytesReceived ?? 0
        if (r.type === "candidate-pair" && (r as { state?: string }).state === "succeeded") {
          candidateType = (r as { remoteCandidateId?: string }).remoteCandidateId ?? ""
        }
      })
      return { bytes, candidateType }
    } catch {
      return { bytes: 0, candidateType: "" }
    }
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.pc.onnegotiationneeded = null
    this.pc.onicecandidate = null
    this.pc.ontrack = null
    this.pc.onconnectionstatechange = null
    try {
      this.pc.close()
    } catch {
      /* already gone */
    }
    if (this.audioEl) {
      this.audioEl.srcObject = null
      this.audioEl.remove()
      this.audioEl = null
    }
    this.remoteStream = null
    this.events.onState("closed")
  }
}
