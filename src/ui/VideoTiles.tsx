import { useEffect, useRef } from "react"
import { useStore } from "../state/store"
import { videoPresentation } from "../media/proximity"
import { MicOff } from "./Icons"

/**
 * Video lives in the world, not in a sidebar (Art Bible s11).
 *
 * Each tile is anchored just above the person's avatar in screen space and
 * grows as you walk towards them. Beyond the small radius the tile disappears
 * entirely and the world name plate carries the identity instead.
 */
export function VideoTiles() {
  const peers = useStore((s) => s.peers)
  const players = useStore((s) => s.players)
  const localStream = useStore((s) => s.localStream)
  const camOn = useStore((s) => s.camOn)
  const micOn = useStore((s) => s.micOn)
  const myId = useStore((s) => s.myId)
  const speaking = useStore((s) => s.speaking)

  const visible = Object.values(peers).filter((p) => {
    const player = players[p.id]
    if (!player || !p.onScreen) return false
    const shown = videoPresentation(p.distanceTiles, false)
    return shown.showTile && p.stream !== null
  })

  return (
    <>
      <div className="tiles">
        {visible.map((p) => {
          const player = players[p.id]
          const shown = videoPresentation(p.distanceTiles, false)
          return (
            <RemoteTile
              key={p.id}
              stream={p.stream}
              name={player.name}
              size={shown.size}
              x={p.screenX}
              y={p.screenY}
              muted={player.muted}
              camOn={player.cam}
              speaking={!!player.speaking}
              connecting={p.status !== "connected"}
            />
          )
        })}
      </div>

      {localStream && (camOn || micOn) ? (
        <div className={"selfview panel" + (myId && speaking[myId] ? " is-speaking" : "")}>
          <SelfVideo stream={localStream} camOn={camOn} />
          <div className="selfview__bar">
            <span>You</span>
            {!micOn ? <MicOff size={13} /> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

function RemoteTile({
  stream, name, size, x, y, muted, camOn, speaking, connecting,
}: {
  stream: MediaStream | null
  name: string
  size: number
  x: number
  y: number
  muted: boolean
  camOn: boolean
  speaking: boolean
  connecting: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !stream) return
    if (el.srcObject !== stream) el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])

  const height = Math.round(size * 0.75)

  return (
    <div
      className={"tile" + (speaking ? " is-speaking" : "")}
      style={{
        width: size,
        height,
        transform: "translate(" + (x - size / 2) + "px, " + (y - height - 46) + "px)",
      }}
    >
      <video ref={ref} autoPlay playsInline muted className="tile__video" />
      {!camOn ? (
        <div className="tile__placeholder">
          <span className="tile__initial">{name.charAt(0).toUpperCase()}</span>
        </div>
      ) : null}
      {connecting ? <div className="tile__connecting">connecting</div> : null}
      <div className="tile__bar">
        <span className="tile__name">{name}</span>
        {muted ? <MicOff size={13} /> : null}
      </div>
    </div>
  )
}

function SelfVideo({ stream, camOn }: { stream: MediaStream; camOn: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.srcObject !== stream) el.srcObject = stream
    void el.play().catch(() => {})
  }, [stream])
  return (
    <>
      <video ref={ref} autoPlay playsInline muted className="selfview__video" />
      {!camOn ? <div className="selfview__off">Camera off</div> : null}
    </>
  )
}
