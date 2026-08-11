import { useEffect, useState } from "react"
import { useStore } from "../state/store"
import type { MainScene } from "../game/MainScene"
import { peerManager } from "../media/PeerManager"

/** Toggled with the backtick key. Invaluable when a call will not connect. */
export function DebugOverlay({ scene }: { scene: MainScene | null }) {
  const show = useStore((s) => s.showDebug)
  const status = useStore((s) => s.status)
  const latency = useStore((s) => s.latencyMs)
  const turn = useStore((s) => s.turnActive)
  const peers = useStore((s) => s.peers)
  const nearby = useStore((s) => s.nearbyIds)
  const [stats, setStats] = useState({ fps: 0, remotes: 0, x: 0, y: 0, tileX: 0, tileY: 0, zone: "" })

  useEffect(() => {
    if (!show || !scene) return
    const id = setInterval(() => setStats(scene.stats()), 500)
    return () => clearInterval(id)
  }, [show, scene])

  if (!show) return null

  return (
    <div className="debug panel">
      <div className="debug__title pixel">debug</div>
      <Row k="fps" v={String(stats.fps)} />
      <Row k="socket" v={status + " " + latency + "ms"} />
      <Row k="turn" v={turn ? "active" : "stun only"} />
      <Row k="tile" v={stats.tileX + ", " + stats.tileY} />
      <Row k="zone" v={stats.zone} />
      <Row k="avatars" v={String(stats.remotes)} />
      <Row k="peers" v={peerManager.count + " of " + nearby.length + " nearby"} />
      {Object.values(peers).map((p) => (
        <Row key={p.id} k={p.id.slice(0, 6)} v={p.status + " " + p.distanceTiles.toFixed(1) + "t"} />
      ))}
    </div>
  )
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="debug__row">
    <span>{k}</span>
    <b>{v}</b>
  </div>
)
