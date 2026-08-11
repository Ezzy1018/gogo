/**
 * Owns the local camera and microphone.
 *
 * Design decision that avoids a whole class of bugs: we acquire tracks ONCE
 * and then toggle `track.enabled`. We never stop and re-request tracks on
 * mute, because that forces a WebRTC renegotiation with every peer and makes
 * the browser permission chip flicker.
 */
import { AUDIO_CONSTRAINTS, VIDEO_CONSTRAINTS } from "../shared/config"

export type MediaKind = "audio" | "video"

export type SpeakingCallback = (speaking: boolean, level: number) => void

export class LocalMedia {
  stream: MediaStream | null = null
  error: string | null = null
  hasAudio = false
  hasVideo = false

  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private analyserSource: MediaStreamAudioSourceNode | null = null
  private speakingRaf = 0
  private speaking = false
  private onSpeaking: SpeakingCallback | null = null
  private onChange: (() => void) | null = null

  /**
   * Ask for the camera and mic. Degrades gracefully: if the camera is missing
   * or refused we still try for audio only, and if everything fails we return
   * null and the user can still walk around and chat.
   */
  async acquire(deviceIds: { audio?: string | null; video?: string | null } = {}) {
    const audio = { ...AUDIO_CONSTRAINTS, ...(deviceIds.audio ? { deviceId: { exact: deviceIds.audio } } : {}) }
    const video = { ...VIDEO_CONSTRAINTS, ...(deviceIds.video ? { deviceId: { exact: deviceIds.video } } : {}) }

    const attempts: Array<{ label: string; constraints: MediaStreamConstraints }> = [
      { label: "camera and microphone", constraints: { audio, video } },
      { label: "microphone only", constraints: { audio, video: false } },
    ]

    for (const attempt of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(attempt.constraints)
        this.adopt(stream)
        this.error = attempt.label === "microphone only" ? "No camera found, joined with audio only." : null
        return this.stream
      } catch (err) {
        this.error = describeMediaError(err)
      }
    }

    this.stream = null
    this.hasAudio = false
    this.hasVideo = false
    return null
  }

  private adopt(stream: MediaStream) {
    this.stopSpeakingDetection()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = stream
    this.hasAudio = stream.getAudioTracks().length > 0
    this.hasVideo = stream.getVideoTracks().length > 0
    // Start muted and camera off. Nobody wants to be broadcast the instant
    // they load a page.
    this.setEnabled("audio", false)
    this.setEnabled("video", false)
    if (this.hasAudio) this.startSpeakingDetection()
    this.onChange?.()
  }

  setEnabled(kind: MediaKind, enabled: boolean) {
    const tracks = kind === "audio" ? this.stream?.getAudioTracks() : this.stream?.getVideoTracks()
    tracks?.forEach((t) => {
      t.enabled = enabled
    })
  }

  isEnabled(kind: MediaKind) {
    const tracks = kind === "audio" ? this.stream?.getAudioTracks() : this.stream?.getVideoTracks()
    return !!tracks?.some((t) => t.enabled)
  }

  /** Swap to a different mic or camera without dropping the other track. */
  async switchDevice(kind: MediaKind, deviceId: string): Promise<MediaStreamTrack | null> {
    if (!this.stream) return null
    const wasEnabled = this.isEnabled(kind)
    const constraints: MediaStreamConstraints =
      kind === "audio"
        ? { audio: { ...AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } } }
        : { video: { ...VIDEO_CONSTRAINTS, deviceId: { exact: deviceId } } }

    const fresh = await navigator.mediaDevices.getUserMedia(constraints)
    const newTrack = kind === "audio" ? fresh.getAudioTracks()[0] : fresh.getVideoTracks()[0]
    if (!newTrack) return null

    const old = kind === "audio" ? this.stream.getAudioTracks() : this.stream.getVideoTracks()
    old.forEach((t) => {
      this.stream!.removeTrack(t)
      t.stop()
    })
    newTrack.enabled = wasEnabled
    this.stream.addTrack(newTrack)

    if (kind === "audio") {
      this.stopSpeakingDetection()
      this.startSpeakingDetection()
    }
    this.onChange?.()
    return newTrack
  }

  static async listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      return {
        audio: all.filter((d) => d.kind === "audioinput"),
        video: all.filter((d) => d.kind === "videoinput"),
      }
    } catch {
      return { audio: [], video: [] }
    }
  }

  onTracksChanged(fn: () => void) {
    this.onChange = fn
  }

  // ---------- speaking detection ----------

  /**
   * Simple RMS meter with asymmetric thresholds. Rising above 0.045 counts as
   * speech, but it takes a drop below 0.030 to stop, so the ring around an
   * avatar does not strobe between syllables.
   */
  startSpeakingDetection(callback?: SpeakingCallback) {
    if (callback) this.onSpeaking = callback
    if (!this.stream || this.analyser) return
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    try {
      this.audioContext = new Ctx()
      this.analyserSource = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.7
      this.analyserSource.connect(this.analyser)

      const buffer = new Uint8Array(this.analyser.frequencyBinCount)
      const loop = () => {
        if (!this.analyser) return
        this.analyser.getByteTimeDomainData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128
          sum += v * v
        }
        const level = Math.sqrt(sum / buffer.length)
        const enabled = this.isEnabled("audio")
        const next = enabled && (this.speaking ? level > 0.03 : level > 0.045)
        if (next !== this.speaking) {
          this.speaking = next
          this.onSpeaking?.(next, level)
        }
        this.speakingRaf = requestAnimationFrame(loop)
      }
      this.speakingRaf = requestAnimationFrame(loop)
    } catch {
      // AudioContext can be blocked before a user gesture. Not fatal.
    }
  }

  stopSpeakingDetection() {
    if (this.speakingRaf) cancelAnimationFrame(this.speakingRaf)
    this.speakingRaf = 0
    this.analyserSource?.disconnect()
    this.analyser?.disconnect()
    void this.audioContext?.close().catch(() => {})
    this.analyserSource = null
    this.analyser = null
    this.audioContext = null
    this.speaking = false
  }

  destroy() {
    this.stopSpeakingDetection()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
  }
}

export function describeMediaError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? ""
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera and microphone are blocked. Click the padlock in the address bar to allow them."
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera or microphone was found on this device."
    case "NotReadableError":
      return "Your camera or mic is being used by another app. Close Zoom, Meet or Teams and reload."
    default:
      return "Could not start your camera or microphone."
  }
}

export const localMedia = new LocalMedia()
