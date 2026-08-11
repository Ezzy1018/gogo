import { useStore } from "../state/store"

const STATUS_LABEL: Record<string, string> = {
  idle: "Offline",
  connecting: "Connecting",
  online: "Connected",
  reconnecting: "Reconnecting",
  offline: "Offline",
}

export function TopBar() {
  const status = useStore((s) => s.status)
  const latency = useStore((s) => s.latencyMs)
  const players = useStore((s) => s.players)
  const zoneName = useStore((s) => s.zoneName)
  const zoneIcon = useStore((s) => s.zoneIcon)
  const zonePrivate = useStore((s) => s.zonePrivate)
  const nearby = useStore((s) => s.nearbyIds)

  const count = Object.keys(players).length

  return (
    <header className="topbar">
      <div className="topbar__group panel">
        <span className="topbar__brand pixel">GATHERA</span>
        <span className="topbar__divider" />
        <span className="topbar__people">
          <b>{count}</b> {count === 1 ? "person" : "people"} here
        </span>
      </div>

      <div className="topbar__group panel topbar__zone">
        <span className="topbar__zone-icon">{zoneIcon ?? "\uD83D\uDEB6"}</span>
        <span className="topbar__zone-name pixel">{zoneName ?? "Open floor"}</span>
        {zonePrivate ? <span className="badge badge--private">private</span> : null}
        {nearby.length > 0 ? (
          <span className="badge badge--live">
            {nearby.length} in earshot
          </span>
        ) : null}
      </div>

      <div className="topbar__group panel">
        <span className={"dot dot--" + status} />
        <span className="topbar__status">{STATUS_LABEL[status] ?? status}</span>
        {status === "online" && latency > 0 ? (
          <span className="topbar__latency">{latency}ms</span>
        ) : null}
      </div>
    </header>
  )
}
