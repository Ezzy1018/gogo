/**
 * The orchestrator. Everything that connects the four systems lives here and
 * nowhere else:
 *
 *   net (PartyKit)  <->  store (React)  <->  world (Phaser)  <->  media (WebRTC)
 *
 * If you are adding a feature, decide which of those four owns it first.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { useStore } from "./state/store"
import { net } from "./net/socket"
import { bridge } from "./game/bridge"
import { peerManager } from "./media/PeerManager"
import { localMedia } from "./media/localMedia"
import { PhaserGame } from "./game/PhaserGame"
import type { MainScene } from "./game/MainScene"
import { UI_SYNC_HZ } from "./shared/config"
import type { CharacterConfig, Reaction } from "./shared/types"

import { Onboarding } from "./ui/Onboarding"
import { TopBar } from "./ui/TopBar"
import { Toolbar } from "./ui/Toolbar"
import { VideoTiles } from "./ui/VideoTiles"
import { ChatPanel } from "./ui/ChatPanel"
import { ParticipantList } from "./ui/ParticipantList"
import { SettingsPanel } from "./ui/SettingsPanel"
import { Toasts } from "./ui/Toast"
import { DebugOverlay } from "./ui/DebugOverlay"
import { Minimap } from "./ui/Minimap"
import type { Presence } from "./shared/types"

export default function App() {
  const joined = useStore((s) => s.joined)
  const myId = useStore((s) => s.myId)
  const name = useStore((s) => s.name)
  const character = useStore((s) => s.character)
  const [busy, setBusy] = useState(false)
  const [scene, setScene] = useState<MainScene | null>(null)
  const sceneRef = useRef<MainScene | null>(null)

  // ---------------------------------------------------------------- join

  const handleJoin = useCallback(async (nextName: string, nextCharacter: CharacterConfig) => {
    const store = useStore.getState()
    setBusy(true)
    store.setIdentity(nextName, nextCharacter)

    // Ask for devices first. The click that got us here is the user gesture
    // that lets audio play later, so this is the right moment.
    const stream = await localMedia.acquire()
    store.setLocalStream(stream)
    store.setMediaError(localMedia.error)
    if (localMedia.error && !stream) store.toast(localMedia.error, "warning")

    localMedia.startSpeakingDetection((speaking) => {
      const id = useStore.getState().myId
      if (id) useStore.getState().setSpeaking(id, speaking)
      net.send({ t: "flags", speaking })
    })

    net.connect()
    net.join(nextName, nextCharacter)
    store.setJoined(true)
    setBusy(false)
  }, [])

  // ------------------------------------------------------------- net wiring

  useEffect(() => {
    const store = useStore.getState()

    const offStatus = net.onStatus((status) => {
      store.setStatus(status)
      if (status === "reconnecting") store.toast("Connection dropped. Reconnecting...", "warning")
    })

    const offWelcome = net.on("welcome", async (msg) => {
      store.setMyId(msg.you)
      store.syncPlayers(msg.players)
      store.setMessages(msg.history)
      sceneRef.current?.registry.set("myId", msg.you)

      const me = msg.players.find((p) => p.id === msg.you)
      if (me) {
        store.setDeskId(me.deskId)
        store.setPresence(me.presence)
        bridge.emit("claimDesk", {
          deskId: me.deskId,
          x: me.x,
          y: me.y,
          dir: me.dir,
          sit: me.pose === "sit" || me.presence === "idle",
        })
        if (me.deskId != null) {
          store.toast("Desk " + (me.deskId + 1) + " is yours — press E to sit", "success")
        } else {
          store.toast("The office is full — no free desks right now", "warning")
        }
      }

      // TURN credentials are minted per session by our own server.
      let iceServers: RTCIceServer[] | undefined
      try {
        const ice = await net.fetchIceServers()
        iceServers = ice.iceServers
        store.setTurnActive(ice.turn)
      } catch {
        store.setTurnActive(false)
      }

      peerManager.configure({
        myId: msg.you,
        iceServers,
        sendSignal: (to, data) => net.send({ t: "signal", to, data }),
      })
      void peerManager.setLocalStream(useStore.getState().localStream)
      peerManager.resumeAudio()
      store.toast("Welcome to the office", "success")
    })

    const offTick = net.on("tick", (msg) => {
      store.syncPlayers(msg.players)
      bridge.emit("players", msg.players)
      store.setLatency(net.latencyMs)
    })

    const offJoined = net.on("joined", (msg) => {
      store.upsertPlayer(msg.player)
      store.toast(msg.player.name + " arrived", "info")
    })

    const offLeft = net.on("left", (msg) => {
      const who = useStore.getState().players[msg.id]?.name
      store.removePlayer(msg.id)
      bridge.emit("playerLeft", msg.id)
      if (who) store.toast(who + " left", "info")
    })

    const offChat = net.on("chat", (msg) => store.addMessage(msg.message))

    const offSignal = net.on("signal", (msg) => peerManager.handleSignal(msg.from, msg.data))

    const offReact = net.on("react", (msg) => bridge.emit("reaction", { from: msg.from, emoji: msg.emoji }))

    const offForceMute = net.on("forceMute", () => {
      localMedia.setEnabled("audio", false)
      store.setMic(false)
      store.toast("The host muted you", "warning")
    })

    const offKicked = net.on("kicked", (msg) => {
      store.toast(msg.reason, "danger")
      peerManager.closeAll()
      net.disconnect()
      store.reset()
    })

    const offError = net.on("error", (msg) => store.toast(msg.message, "danger"))

    return () => {
      offStatus(); offWelcome(); offTick(); offJoined(); offLeft()
      offChat(); offSignal(); offReact(); offForceMute(); offKicked(); offError()
    }
  }, [])

  // ----------------------------------------------------------- world wiring

  useEffect(() => {
    const store = useStore.getState()

    const offZone = bridge.on("zoneChanged", (zone) => {
      store.setZone(zone)
    })

    const offMove = bridge.on("localMove", (m) => {
      net.send({ t: "move", x: m.x, y: m.y, dir: m.dir, moving: m.moving, pose: m.pose, zoneId: m.zoneId })
      // Keep the local mirror fresh for minimap + proximity (don't wait on ticks).
      const id = useStore.getState().myId
      if (id) {
        const prev = useStore.getState().players[id]
        if (prev) {
          useStore.getState().upsertPlayer({
            ...prev,
            x: m.x,
            y: m.y,
            dir: m.dir,
            moving: m.moving,
            pose: m.pose,
            zoneId: m.zoneId,
          })
        }
      }
      if (m.moving && useStore.getState().presence === "idle") {
        useStore.getState().setPresence("active")
        net.send({ t: "flags", presence: "active" })
      }
    })

    const offScreen = bridge.on("screenPositions", (positions) => {
      const peers = useStore.getState().peers
      for (const id of Object.keys(peers)) {
        const p = positions[id]
        if (p) useStore.getState().upsertPeer(id, { screenX: p.x, screenY: p.y, onScreen: p.onScreen })
      }
    })

    const offDeskPrompt = bridge.on("deskPrompt", (near) => {
      useStore.getState().setDeskPrompt(near)
    })

    return () => {
      offMove(); offZone(); offScreen(); offDeskPrompt()
    }
  }, [])

  // --------------------------------------------------------- proximity loop

  useEffect(() => {
    if (!joined) return
    const id = setInterval(() => {
      const { players, myId: id2 } = useStore.getState()
      if (!id2) return
      const me = players[id2]
      if (!me) return
      peerManager.update(me, Object.values(players))
    }, 1000 / UI_SYNC_HZ)
    return () => clearInterval(id)
  }, [joined])

  // ------------------------------------------------------------- shortcuts

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      const store = useStore.getState()

      if (e.key === "Escape") {
        store.openPanel(store.panel)
        ;(document.activeElement as HTMLElement | null)?.blur()
        return
      }
      if (typing) return

      if (e.key === "`") { store.toggleDebug(); return }
      if (e.key === "Enter") { e.preventDefault(); if (store.panel !== "chat") store.openPanel("chat"); return }
      if (e.key.toLowerCase() === "m") { toggleMic(); return }
      if (e.key.toLowerCase() === "v") { toggleCam(); return }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------- actions

  const toggleMic = useCallback(() => {
    const store = useStore.getState()
    if (!store.localStream) return store.toast("No microphone available", "warning")
    const next = !store.micOn
    localMedia.setEnabled("audio", next)
    store.setMic(next)
    net.send({ t: "flags", muted: !next })
    // Re-unlock remote playback on the same user gesture that unmuted us.
    peerManager.resumeAudio()
  }, [])

  const toggleCam = useCallback(() => {
    const store = useStore.getState()
    if (!store.localStream || !localMedia.hasVideo) return store.toast("No camera available", "warning")
    const next = !store.camOn
    localMedia.setEnabled("video", next)
    store.toggleCam()
    net.send({ t: "flags", cam: next })
  }, [])

  const toggleHand = useCallback(() => {
    const store = useStore.getState()
    const next = !store.hand
    store.toggleHand()
    net.send({ t: "flags", hand: next })
  }, [])

  const toggleGhost = useCallback(() => {
    const store = useStore.getState()
    const next = !store.ghost
    store.toggleGhost()
    bridge.emit("ghost", next)
    net.send({ t: "flags", ghost: next })
    // Invisible means invisible: drop every call immediately.
    if (next) peerManager.closeAll()
    store.toast(next ? "You are invisible. Nobody can see or hear you." : "You are visible again", "info")
  }, [])

  const setPresence = useCallback((presence: Presence) => {
    const store = useStore.getState()
    store.setPresence(presence)
    net.send({ t: "flags", presence })
    // Presence is a status badge only. Movement lock happens solely while seated.
    if (presence === "away") store.toast("Status: away", "info")
    else if (presence === "active") store.toast("Status: active", "info")
  }, [])

  const sitAtDesk = useCallback(() => {
    bridge.emit("sitAtDesk", true)
    useStore.getState().setPresence("idle")
    net.send({ t: "flags", presence: "idle" })
    useStore.getState().toast("Seated at your desk", "info")
  }, [])

  const react = useCallback((emoji: Reaction) => net.send({ t: "react", emoji }), [])

  const sendChat = useCallback((text: string, scope: "room" | "nearby") => {
    net.send({ t: "chat", text, scope, nearbyIds: useStore.getState().nearbyIds })
  }, [])

  const hostAction = useCallback((action: "mute" | "kick", target: string) => {
    net.send({ t: "host", action, target })
  }, [])

  const switchDevice = useCallback(async (kind: "audio" | "video", deviceId: string) => {
    const store = useStore.getState()
    if (!deviceId) return
    try {
      await localMedia.switchDevice(kind, deviceId)
      store.selectDevice(kind, deviceId)
      await peerManager.setLocalStream(localMedia.stream)
      store.setLocalStream(localMedia.stream)
      store.toast("Switched " + kind + " device", "success")
    } catch {
      store.toast("Could not switch that device", "danger")
    }
  }, [])

  const leave = useCallback(() => {
    peerManager.closeAll()
    localMedia.destroy()
    net.disconnect()
    useStore.getState().reset()
    useStore.getState().setJoined(false)
    window.location.reload()
  }, [])

  // Make sure we say goodbye properly on tab close.
  useEffect(() => {
    const bye = () => {
      peerManager.closeAll()
      net.disconnect()
    }
    window.addEventListener("beforeunload", bye)
    return () => window.removeEventListener("beforeunload", bye)
  }, [])

  // ------------------------------------------------------------- render

  if (!joined) return <Onboarding onJoin={handleJoin} busy={busy} />

  return (
    <div className="app">
      <PhaserGame
        myId={myId ?? "pending"}
        name={name}
        character={character}
        onReady={(s) => {
          sceneRef.current = s
          setScene(s)
          const st = useStore.getState()
          const id = st.myId
          if (id) s.registry.set("myId", id)
          const me = id ? st.players[id] : null
          if (me) {
            bridge.emit("claimDesk", {
              deskId: me.deskId,
              x: me.x,
              y: me.y,
              dir: me.dir,
              sit: me.pose === "sit" || me.presence === "idle",
            })
          }
        }}
      />

      <div className="overlay-root">
        <TopBar />
        <Minimap />
        <VideoTiles />
        <ChatPanel onSend={sendChat} />
        <ParticipantList onHostAction={hostAction} />
        <SettingsPanel onSwitchDevice={switchDevice} />
        <Toolbar
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onToggleHand={toggleHand}
          onToggleGhost={toggleGhost}
          onSetPresence={setPresence}
          onSitAtDesk={sitAtDesk}
          onReact={react}
          onLeave={leave}
        />
        <Toasts />
        <DebugOverlay scene={scene} />
      </div>
    </div>
  )
}
