import { useEffect, useMemo, useState } from "react"
import { useStore } from "../state/store"
import { AvatarPreview } from "./AvatarPreview"
import { Dice } from "./Icons"
import {
  SKINS, HAIRS, HAIR_COLORS, TOPS, TOP_COLORS, BOTTOMS, BOTTOM_COLORS, SHOES, ACCESSORIES,
  randomCharacter,
} from "../game/character"
import type { CharacterConfig } from "../shared/types"
import { MAX_NAME_LENGTH } from "../shared/config"

type Props = { onJoin: (name: string, character: CharacterConfig) => void; busy: boolean }

const SWATCH: Record<string, string> = {
  dark: "#39211E", brown: "#60372A", light: "#C79A55", ginger: "#B15426",
  blue: "#3D7FB5", teal: "#2E8B8B", clay: "#D8623F", amber: "#F2A93B", moss: "#6FA83C", plum: "#82568A",
  indigo: "#3B4A6B", charcoal: "#423E3A", khaki: "#B39A63",
  medium: "#F2B078", light_skin: "#FFD3A8", tan: "#CE8A55", deep: "#90583A",
}

const LABEL: Record<string, string> = {
  none: "None", buzz: "Buzz", bun: "Bun", tee: "T-shirt", plusone: "Nice",
}
const pretty = (v: string) => LABEL[v] ?? v.charAt(0).toUpperCase() + v.slice(1)

export function Onboarding({ onJoin, busy }: Props) {
  const storedName = useStore((s) => s.name)
  const storedCharacter = useStore((s) => s.character)
  const [name, setName] = useState(storedName)
  const [character, setCharacter] = useState<CharacterConfig>(storedCharacter)
  const [tab, setTab] = useState<"body" | "clothes" | "extras">("body")
  const [frame, setFrame] = useState(0)

  // A slow idle breath on the preview. The avatar should feel alive before
  // you have even joined.
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 620)
    return () => clearInterval(id)
  }, [])

  const set = <K extends keyof CharacterConfig>(key: K, value: CharacterConfig[K]) =>
    setCharacter((c) => ({ ...c, [key]: value }))

  const canJoin = name.trim().length > 0 && !busy
  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 5) return "Working late"
    if (h < 12) return "Good morning"
    if (h < 17) return "Good afternoon"
    return "Good evening"
  }, [])

  return (
    <div className="onboarding">
      <div className="onboarding__scrim" />
      <div className="onboarding__card panel panel--raised">
        <header className="onboarding__head">
          <div className="onboarding__brand pixel">GATHERA</div>
          <h1 className="onboarding__title">{greeting}. Pull up a chair.</h1>
          <p className="onboarding__sub">
            A little office in another world. Walk over to someone to talk to them.
          </p>
        </header>

        <div className="onboarding__body">
          <div className="onboarding__stage">
            <div className="onboarding__pedestal">
              <AvatarPreview config={character} scale={4} frame={frame} />
            </div>
            <button
              className="btn onboarding__random"
              type="button"
              onClick={() => setCharacter(randomCharacter())}
            >
              <Dice /> Surprise me
            </button>
          </div>

          <div className="onboarding__form">
            <label className="field">
              <span className="field__label">What should people call you?</span>
              <input
                className="input"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                placeholder="Ankit"
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canJoin) onJoin(name.trim(), character)
                }}
              />
            </label>

            <div className="tabs" role="tablist">
              {(["body", "clothes", "extras"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={"tabs__tab" + (tab === t ? " is-active" : "")}
                  onClick={() => setTab(t)}
                >
                  {pretty(t)}
                </button>
              ))}
            </div>

            <div className="onboarding__options scroll">
              {tab === "body" && (
                <>
                  <Chips label="Skin" options={SKINS} value={character.skin} onPick={(v) => set("skin", v)} swatchKey={(v) => (v === "light" ? "light_skin" : v)} />
                  <Chips label="Hair" options={HAIRS} value={character.hair} onPick={(v) => set("hair", v)} />
                  <Chips label="Hair colour" options={HAIR_COLORS} value={character.hairColor} onPick={(v) => set("hairColor", v)} swatchKey={(v) => v} />
                </>
              )}
              {tab === "clothes" && (
                <>
                  <Chips label="Top" options={TOPS} value={character.top} onPick={(v) => set("top", v)} />
                  <Chips label="Top colour" options={TOP_COLORS} value={character.topColor} onPick={(v) => set("topColor", v)} swatchKey={(v) => v} />
                  <Chips label="Bottom" options={BOTTOMS} value={character.bottom} onPick={(v) => set("bottom", v)} />
                  <Chips label="Bottom colour" options={BOTTOM_COLORS} value={character.bottomColor} onPick={(v) => set("bottomColor", v)} swatchKey={(v) => v} />
                </>
              )}
              {tab === "extras" && (
                <>
                  <Chips label="Shoes" options={SHOES} value={character.shoes} onPick={(v) => set("shoes", v)} />
                  <Chips label="Accessory" options={ACCESSORIES} value={character.accessory} onPick={(v) => set("accessory", v)} />
                </>
              )}
            </div>
          </div>
        </div>

        <footer className="onboarding__foot">
          <p className="onboarding__hint">
            Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the arrow keys. Your camera
            and mic stay off until you turn them on.
          </p>
          <button
            className="btn btn--primary onboarding__join"
            disabled={!canJoin}
            onClick={() => onJoin(name.trim(), character)}
          >
            {busy ? "Opening the door..." : "Step inside"}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Chips<T extends string>({
  label, options, value, onPick, swatchKey,
}: {
  label: string
  options: readonly T[]
  value: T
  onPick: (v: T) => void
  swatchKey?: (v: T) => string
}) {
  return (
    <div className="chips">
      <span className="chips__label">{label}</span>
      <div className="chips__row">
        {options.map((o) => {
          const colour = swatchKey ? SWATCH[swatchKey(o)] : undefined
          return (
            <button
              key={o}
              className={"chip" + (value === o ? " is-active" : "") + (colour ? " chip--swatch" : "")}
              onClick={() => onPick(o)}
              title={pretty(o)}
              aria-pressed={value === o}
            >
              {colour ? <span className="chip__dot" style={{ background: colour }} /> : null}
              {colour ? null : pretty(o)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
