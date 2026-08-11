import { useStore } from "../state/store"
import { AvatarPreview } from "./AvatarPreview"
import { Close, MicOff, Crown, Hand } from "./Icons"
import type { PlayerState } from "../shared/types"

export function ParticipantList({
  onHostAction,
}: {
  onHostAction: (action: "mute" | "kick", target: string) => void
}) {
  const open = useStore((s) => s.panel) === "people"
  const openPanel = useStore((s) => s.openPanel)
  const players = useStore((s) => s.players)
  const myId = useStore((s) => s.myId)
  const isHost = useStore((s) => s.isHost)
  const nearby = useStore((s) => s.nearbyIds)

  if (!open) return null

  const list = Object.values(players).sort((a, b) => {
    if (a.id === myId) return -1
    if (b.id === myId) return 1
    return a.name.localeCompare(b.name)
  })

  const grouped = new Map<string, PlayerState[]>()
  for (const p of list) {
    const key = p.zoneId ?? "open floor"
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(p)
  }

  return (
    <aside className="drawer panel" aria-label="People">
      <header className="drawer__head">
        <h2 className="drawer__title pixel">People</h2>
        <button className="drawer__close" onClick={() => openPanel("people")} aria-label="Close people">
          <Close />
        </button>
      </header>

      <div className="people scroll">
        {[...grouped.entries()].map(([zone, members]) => (
          <section key={zone} className="people__group">
            <h3 className="people__zone">{zone === "open floor" ? "Open floor" : zone}</h3>
            {members.map((p) => (
              <div key={p.id} className="person">
                <div className="person__avatar">
                  <AvatarPreview config={p.character} scale={1} />
                </div>
                <div className="person__body">
                  <div className="person__name">
                    {p.id === myId ? p.name + " (you)" : p.name}
                    {p.isHost ? <span className="person__host" title="Host"><Crown /></span> : null}
                  </div>
                  <div className="person__meta">
                    {nearby.includes(p.id) ? <span className="badge badge--live">in earshot</span> : null}
                    {p.presence === "away" ? <span className="badge badge--warn">away</span> : null}
                    {p.presence === "idle" ? <span className="badge badge--soft">idle</span> : null}
                    {p.presence === "active" ? <span className="badge badge--live">active</span> : null}
                    {p.deskId != null ? <span className="badge badge--soft">desk {p.deskId + 1}</span> : null}
                    {p.ghost ? <span className="badge badge--soft">invisible</span> : null}
                    {p.hand ? <span className="badge badge--warn"><Hand size={11} /> hand up</span> : null}
                    {p.muted ? <MicOff size={13} /> : null}
                  </div>
                </div>
                {isHost && p.id !== myId ? (
                  <div className="person__actions">
                    <button className="person__act" onClick={() => onHostAction("mute", p.id)}>Mute</button>
                    <button className="person__act person__act--danger" onClick={() => onHostAction("kick", p.id)}>Remove</button>
                  </div>
                ) : null}
              </div>
            ))}
          </section>
        ))}
      </div>
    </aside>
  )
}
