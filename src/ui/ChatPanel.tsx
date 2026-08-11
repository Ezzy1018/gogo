import { useEffect, useRef, useState } from "react"
import { useStore } from "../state/store"
import { bridge } from "../game/bridge"
import { Close, Send } from "./Icons"
import { MAX_CHAT_LENGTH } from "../shared/config"

const time = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

export function ChatPanel({ onSend }: { onSend: (text: string, scope: "room" | "nearby") => void }) {
  const open = useStore((s) => s.panel) === "chat"
  const openPanel = useStore((s) => s.openPanel)
  const messages = useStore((s) => s.messages)
  const myId = useStore((s) => s.myId)
  const scope = useStore((s) => s.chatScope)
  const setScope = useStore((s) => s.setChatScope)
  const nearby = useStore((s) => s.nearbyIds)
  const [draft, setDraft] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open])

  if (!open) return null

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onSend(text, scope)
    setDraft("")
  }

  return (
    <aside className="drawer panel" aria-label="Chat">
      <header className="drawer__head">
        <h2 className="drawer__title pixel">Chat</h2>
        <button className="drawer__close" onClick={() => openPanel("chat")} aria-label="Close chat">
          <Close />
        </button>
      </header>

      <div className="chat__scopes">
        <button
          className={"chat__scope" + (scope === "room" ? " is-active" : "")}
          onClick={() => setScope("room")}
        >
          Everyone
        </button>
        <button
          className={"chat__scope" + (scope === "nearby" ? " is-active" : "")}
          onClick={() => setScope("nearby")}
          title="Only people currently in earshot"
        >
          Nearby {nearby.length > 0 ? "(" + nearby.length + ")" : ""}
        </button>
      </div>

      <div className="chat__list scroll" ref={listRef}>
        {messages.length === 0 ? (
          <p className="chat__empty">
            Nothing here yet. Say hello, or walk over to someone and just talk.
          </p>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={"chat__msg" + (m.from === myId ? " is-me" : "")}>
            <div className="chat__meta">
              <span className="chat__from">{m.from === myId ? "You" : m.fromName}</span>
              {m.scope === "nearby" ? <span className="badge badge--soft">nearby</span> : null}
              <span className="chat__time">{time(m.at)}</span>
            </div>
            <div className="chat__bubble">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="chat__composer">
        <input
          ref={inputRef}
          className="input"
          value={draft}
          maxLength={MAX_CHAT_LENGTH}
          placeholder={scope === "nearby" ? "Message people nearby" : "Message everyone"}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => bridge.emit("inputLock", true)}
          onBlur={() => bridge.emit("inputLock", false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit()
            e.stopPropagation()
          }}
        />
        <button className="btn btn--primary chat__send" onClick={submit} disabled={!draft.trim()} aria-label="Send">
          <Send />
        </button>
      </div>
    </aside>
  )
}
