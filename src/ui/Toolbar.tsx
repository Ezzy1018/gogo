import { useState } from "react"
import { useStore } from "../state/store"
import {
  MicOn, MicOff, CamOn, CamOff, Chat, People, Settings, Hand, Ghost, Smile, Leave, Desk, Away, Active,
} from "./Icons"
import type { Presence, Reaction } from "../shared/types"

const REACTIONS: { key: Reaction; glyph: string; label: string }[] = [
  { key: "wave", glyph: "\uD83D\uDC4B", label: "Wave" },
  { key: "plusone", glyph: "\uD83D\uDC4D", label: "Agree" },
  { key: "heart", glyph: "\u2764\uFE0F", label: "Love it" },
  { key: "laugh", glyph: "\uD83D\uDE02", label: "Funny" },
  { key: "think", glyph: "\uD83E\uDD14", label: "Thinking" },
  { key: "tada", glyph: "\uD83C\uDF89", label: "Celebrate" },
]

type Props = {
  onToggleMic: () => void
  onToggleCam: () => void
  onToggleHand: () => void
  onToggleGhost: () => void
  onSetPresence: (p: Presence) => void
  onSitAtDesk: () => void
  onReact: (r: Reaction) => void
  onLeave: () => void
}

export function Toolbar(p: Props) {
  const micOn = useStore((s) => s.micOn)
  const camOn = useStore((s) => s.camOn)
  const hand = useStore((s) => s.hand)
  const ghost = useStore((s) => s.ghost)
  const presence = useStore((s) => s.presence)
  const deskId = useStore((s) => s.deskId)
  const deskPrompt = useStore((s) => s.deskPrompt)
  const panel = useStore((s) => s.panel)
  const openPanel = useStore((s) => s.openPanel)
  const unread = useStore((s) => s.unread)
  const mediaError = useStore((s) => s.mediaError)
  const [reactOpen, setReactOpen] = useState(false)

  return (
    <div className="toolbar">
      {deskPrompt && deskId != null ? (
        <div className="toolbar__hint panel">Press E · Sit at your desk</div>
      ) : null}

      {reactOpen ? (
        <div className="reactions panel panel--raised">
          {REACTIONS.map((r) => (
            <button
              key={r.key}
              className="reactions__btn"
              title={r.label}
              onClick={() => {
                p.onReact(r.key)
                setReactOpen(false)
              }}
            >
              {r.glyph}
            </button>
          ))}
        </div>
      ) : null}

      <div className="toolbar__dock panel panel--raised">
        <Tool
          label={micOn ? "Mute" : "Unmute"}
          active={micOn}
          danger={!micOn}
          disabled={!!mediaError && !micOn}
          onClick={p.onToggleMic}
        >
          {micOn ? <MicOn /> : <MicOff />}
        </Tool>

        <Tool
          label={camOn ? "Turn camera off" : "Turn camera on"}
          active={camOn}
          danger={!camOn}
          disabled={!!mediaError && !camOn}
          onClick={p.onToggleCam}
        >
          {camOn ? <CamOn /> : <CamOff />}
        </Tool>

        <span className="toolbar__sep" />

        <Tool
          label="Active"
          active={presence === "active"}
          onClick={() => p.onSetPresence("active")}
        >
          <Active />
        </Tool>

        <Tool
          label="Away"
          active={presence === "away"}
          onClick={() => p.onSetPresence("away")}
        >
          <Away />
        </Tool>

        <Tool
          label={deskId == null ? "No desk" : "On desk"}
          active={presence === "idle"}
          disabled={deskId == null}
          onClick={p.onSitAtDesk}
        >
          <Desk />
        </Tool>

        <span className="toolbar__sep" />

        <Tool label="Raise hand" active={hand} onClick={p.onToggleHand}>
          <Hand />
        </Tool>

        <Tool label="React" active={reactOpen} onClick={() => setReactOpen((v) => !v)}>
          <Smile />
        </Tool>

        <Tool
          label={ghost ? "Become visible" : "Go invisible"}
          active={ghost}
          onClick={p.onToggleGhost}
        >
          <Ghost />
        </Tool>

        <span className="toolbar__sep" />

        <Tool label="Chat" active={panel === "chat"} badge={unread} onClick={() => openPanel("chat")}>
          <Chat />
        </Tool>

        <Tool label="People" active={panel === "people"} onClick={() => openPanel("people")}>
          <People />
        </Tool>

        <Tool label="Settings" active={panel === "settings"} onClick={() => openPanel("settings")}>
          <Settings />
        </Tool>

        <span className="toolbar__sep" />

        <Tool label="Leave" danger onClick={p.onLeave}>
          <Leave />
        </Tool>
      </div>
    </div>
  )
}

function Tool({
  children, label, active, danger, badge, disabled, onClick,
}: {
  children: React.ReactNode
  label: string
  active?: boolean
  danger?: boolean
  badge?: number
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      className={
        "tool" + (active ? " is-active" : "") + (danger && !active ? " is-danger" : "")
      }
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={!!active}
    >
      {children}
      <span className="tool__tip">{label}</span>
      {badge ? <span className="tool__badge">{badge > 9 ? "9+" : badge}</span> : null}
    </button>
  )
}
