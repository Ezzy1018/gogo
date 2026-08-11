import type { CharacterConfig } from "../shared/types"
import { CHAR_FRAME_W, CHAR_FRAME_H } from "../shared/config"

/**
 * Shows a composed avatar in plain DOM by stacking the same layer sheets the
 * game uses, cropped to one frame. No canvas, no Phaser: the onboarding screen
 * can preview an outfit before the world has even loaded.
 */
export function AvatarPreview({
  config,
  scale = 4,
  frame = 0,
}: {
  config: CharacterConfig
  scale?: number
  frame?: number
}) {
  const layers = [
    "base_" + config.skin,
    "bottom_" + config.bottom + "_" + config.bottomColor,
    "shoes_" + config.shoes,
    "top_" + config.top + "_" + config.topColor,
    "hair_" + config.hair + "_" + config.hairColor,
    ...(config.accessory !== "none" ? ["acc_" + config.accessory] : []),
  ]

  return (
    <div
      className="avatar-preview"
      style={{ width: CHAR_FRAME_W * scale, height: CHAR_FRAME_H * scale }}
    >
      {layers.map((name) => (
        <span
          key={name}
          className="avatar-preview__layer"
          style={{
            width: CHAR_FRAME_W,
            height: CHAR_FRAME_H,
            transform: "scale(" + scale + ")",
            backgroundImage: "url(/assets/characters/" + name + ".png)",
            backgroundPosition: -(frame * CHAR_FRAME_W) + "px 0px",
          }}
        />
      ))}
    </div>
  )
}
