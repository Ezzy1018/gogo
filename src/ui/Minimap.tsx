/**
 * Bottom-left office map. A camera window follows you so kitchen, lounge,
 * and the work floor each fill the frame when you are there.
 */
import zones from "../shared/zones.json"
import { DESK_SLOTS } from "../shared/desks"
import {
  MAP_HEIGHT_TILES,
  MAP_WIDTH_TILES,
  MINIMAP_HEIGHT_PX,
  MINIMAP_VIEW_TILES_H,
  MINIMAP_VIEW_TILES_W,
  MINIMAP_WIDTH_PX,
  TILE_SIZE,
} from "../shared/config"
import { useStore } from "../state/store"

const ZONE_CLASS: Record<string, string> = {
  work: "minimap__zone--work",
  meeting: "minimap__zone--meeting",
  kitchen: "minimap__zone--kitchen",
  lounge: "minimap__zone--lounge",
  focus: "minimap__zone--focus",
  entrance: "minimap__zone--entrance",
  desk: "minimap__zone--desk",
}

export function Minimap() {
  const players = useStore((s) => s.players)
  const myId = useStore((s) => s.myId)
  const me = myId ? players[myId] : null
  const list = Object.values(players)

  const viewW = MINIMAP_VIEW_TILES_W
  const viewH = MINIMAP_VIEW_TILES_H
  const sx = MINIMAP_WIDTH_PX / viewW
  const sy = MINIMAP_HEIGHT_PX / viewH

  const meTX = me ? me.x / TILE_SIZE : MAP_WIDTH_TILES / 2
  const meTY = me ? me.y / TILE_SIZE : MAP_HEIGHT_TILES / 2
  const camX = Math.max(0, Math.min(MAP_WIDTH_TILES - viewW, meTX - viewW / 2))
  const camY = Math.max(0, Math.min(MAP_HEIGHT_TILES - viewH, meTY - viewH / 2))

  const worldLeft = -camX * sx
  const worldTop = -camY * sy
  const worldW = MAP_WIDTH_TILES * sx
  const worldH = MAP_HEIGHT_TILES * sy

  return (
    <aside
      className="minimap panel"
      aria-label="Office map"
      style={{ width: MINIMAP_WIDTH_PX + 16, height: MINIMAP_HEIGHT_PX + 42 }}
    >
      <div className="minimap__title pixel">Map</div>
      <div className="minimap__stage" style={{ width: MINIMAP_WIDTH_PX, height: MINIMAP_HEIGHT_PX }}>
        <div
          className="minimap__world"
          style={{
            width: worldW,
            height: worldH,
            transform: `translate(${worldLeft}px, ${worldTop}px)`,
          }}
        >
          {zones
            .filter((z) => z.id !== "desk")
            .map((z) => (
              <div
                key={z.id}
                className={"minimap__zone " + (ZONE_CLASS[z.id] ?? "")}
                title={z.name}
                style={{
                  left: z.x * sx,
                  top: z.y * sy,
                  width: z.w * sx,
                  height: z.h * sy,
                }}
              >
                <span className="minimap__zone-label">{z.icon}</span>
              </div>
            ))}

          {DESK_SLOTS.map((d) => (
            <div
              key={"desk-" + d.id}
              className="minimap__desk"
              style={{
                left: d.deskTX * sx,
                top: d.deskTY * sy,
                width: 2 * sx,
                height: sy,
              }}
            />
          ))}

          {list.map((p) => {
            const isMe = p.id === myId
            const left = (p.x / TILE_SIZE) * sx
            const top = (p.y / TILE_SIZE) * sy
            return (
              <div
                key={p.id}
                className={
                  "minimap__dot" +
                  (isMe ? " minimap__dot--you" : "") +
                  (p.presence === "away" ? " minimap__dot--away" : "")
                }
                title={p.name}
                style={{ left, top }}
              />
            )
          })}
        </div>
      </div>
      <div className="minimap__legend">
        <span>{me?.zoneId ? zones.find((z) => z.id === me.zoneId)?.name ?? "Floor" : "Floor"}</span>
        {me?.deskId != null ? <span>Desk {me.deskId + 1}</span> : null}
      </div>
    </aside>
  )
}
