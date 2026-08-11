import { useStore } from "../state/store"
import { Close } from "./Icons"

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  if (toasts.length === 0) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={"toast toast--" + t.tone}>
          <span>{t.text}</span>
          <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <Close size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
