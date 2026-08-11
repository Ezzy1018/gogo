/**
 * Mounts Phaser into the DOM exactly once and hands the scene to React.
 *
 * The three settings that matter for the art are pixelArt, roundPixels and
 * antialias. Remove any of them and every sprite turns into mush.
 */
import { useEffect, useRef } from "react"
import Phaser from "phaser"
import { MainScene } from "./MainScene"
import type { CharacterConfig } from "../shared/types"

type Props = {
  myId: string
  name: string
  character: CharacterConfig
  onReady: (scene: MainScene) => void
}

export function PhaserGame({ myId, name, character, onReady }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Phaser.Game | null>(null)

  useEffect(() => {
    if (!hostRef.current || gameRef.current) return

    // Scene.events is only injected after the Scene Manager boots the scene.
    // Listening on a pre-built instance here throws and blanks the React tree.
    // Hand readiness through the registry instead; MainScene calls it from create().
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      backgroundColor: "#C9A97E",
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: "100%",
        height: "100%",
      },
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scene: [MainScene],
      banner: false,
      callbacks: {
        preBoot: (g) => {
          g.registry.set("myId", myId)
          g.registry.set("sceneReady", (scene: MainScene) => {
            scene.setLocalIdentity(name, character)
            onReady(scene)
          })
        },
      },
    })

    gameRef.current = game

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
    // Deliberately mount-once. Identity changes are pushed through the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={hostRef} className="world-host" aria-hidden="true" />
}
