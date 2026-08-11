/**
 * Bottom-left office map. Fed from the store (throttled player mirrors) and
 * static zone defs — never reads Phaser directly.
 */
import zones from "../shared/zones.json"
import { DESK_SLOTS } from "../shared/desks"
import {
  MAP_HEIGHT_TILES,
  MAP_WIDTH_TILES,
  MINIMAP_HEIGHT_PX,
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
  const sx = MINIMAP_WIDTH_PX / MAP_WIDTH_TILES
  const sy = MINIMAP_HEIGHT_PX / MAP_HEIGHT_TILES

  const me = myId ? players[myId] : null
  const list = Object.values(players)

  return (
    <aside
      className="minimap panel"
      aria-label="Office map"
      style={{ width: MINIMAP_WIDTH_PX, height: MINIMAP_HEIGHT_PX }}
    >
      <div className="minimap__title pixel">Map</div>
      <div className="minimap__stage">
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
      <div className="minimap__legend">
        <span>{me?.zoneId ? zones.find((z) => z.id === me.zoneId)?.name ?? "Floor" : "Floor"}</span>
        {me?.deskId != null ? <span>Desk {me.deskId + 1}</span> : null}
      </div>
    </aside>
  )
}
