import { useEffect } from "react"
import { useStore } from "../state/store"
import { LocalMedia } from "../media/localMedia"
import { Close } from "./Icons"

export function SettingsPanel({
  onSwitchDevice,
}: {
  onSwitchDevice: (kind: "audio" | "video", deviceId: string) => void
}) {
  const open = useStore((s) => s.panel) === "settings"
  const openPanel = useStore((s) => s.openPanel)
  const devices = useStore((s) => s.devices)
  const setDevices = useStore((s) => s.setDevices)
  const audioDeviceId = useStore((s) => s.audioDeviceId)
  const videoDeviceId = useStore((s) => s.videoDeviceId)
  const showDebug = useStore((s) => s.showDebug)
  const toggleDebug = useStore((s) => s.toggleDebug)
  const turn = useStore((s) => s.turnActive)
  const mediaError = useStore((s) => s.mediaError)

  useEffect(() => {
    if (!open) return
    void LocalMedia.listDevices().then(setDevices)
  }, [open, setDevices])

  if (!open) return null

  return (
    <aside className="drawer panel" aria-label="Settings">
      <header className="drawer__head">
        <h2 className="drawer__title pixel">Settings</h2>
        <button className="drawer__close" onClick={() => openPanel("settings")} aria-label="Close settings">
          <Close />
        </button>
      </header>

      <div className="settings scroll">
        {mediaError ? <p className="settings__warn">{mediaError}</p> : null}

        <label className="field">
          <span className="field__label">Microphone</span>
          <select
            className="input"
            value={audioDeviceId ?? ""}
            onChange={(e) => onSwitchDevice("audio", e.target.value)}
          >
            <option value="">System default</option>
            {devices.audio.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Camera</span>
          <select
            className="input"
            value={videoDeviceId ?? ""}
            onChange={(e) => onSwitchDevice("video", e.target.value)}
          >
            <option value="">System default</option>
            {devices.video.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>
            ))}
          </select>
        </label>

        <div className="settings__row">
          <div>
            <div className="field__label">Developer overlay</div>
            <p className="settings__hint">Frame rate, peer states and your tile position. Shortcut: backtick.</p>
          </div>
          <button className={"switch" + (showDebug ? " is-on" : "")} onClick={toggleDebug} aria-pressed={showDebug}>
            <span className="switch__knob" />
          </button>
        </div>

        <div className="settings__facts">
          <div><span>Relay</span><b>{turn ? "TURN active" : "STUN only"}</b></div>
          <div><span>Media</span><b>Peer to peer</b></div>
        </div>

        <div className="settings__keys">
          <h3>Shortcuts</h3>
          <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> <span>Walk</span></div>
          <div><kbd>Shift</kbd> <span>Walk faster</span></div>
          <div><kbd>M</kbd> <span>Mute or unmute</span></div>
          <div><kbd>V</kbd> <span>Camera on or off</span></div>
          <div><kbd>Enter</kbd> <span>Jump to chat</span></div>
          <div><kbd>Esc</kbd> <span>Close panels</span></div>
        </div>
      </div>
    </aside>
  )
}
