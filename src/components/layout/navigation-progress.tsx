"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

const HEARTBEAT_KEYFRAMES = `
@keyframes heartbeat {
  0%   { transform: scale(1); }
  14%  { transform: scale(1.18); }
  28%  { transform: scale(1); }
  42%  { transform: scale(1.12); }
  56%  { transform: scale(1); }
  100% { transform: scale(1); }
}
`

export function NavigationProgress() {
  const pathname = usePathname()
  const prevPath = useRef(pathname)
  const [pct, setPct]     = useState(0)
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle")
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function startLoading() {
    clearTimers()
    setPhase("loading")
    setPct(8)
    timers.current.push(setTimeout(() => setPct(25), 150))
    timers.current.push(setTimeout(() => setPct(50), 400))
    timers.current.push(setTimeout(() => setPct(72), 900))
    timers.current.push(setTimeout(() => setPct(85), 1600))
  }

  function finishLoading() {
    clearTimers()
    setPct(100)
    setPhase("done")
    timers.current.push(setTimeout(() => {
      setPhase("idle")
      setPct(0)
    }, 400))
  }

  // Intercept internal link clicks to start animation immediately
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href) return
      if (href.startsWith("http") || href.startsWith("//") || href.startsWith("#") || href.startsWith("mailto")) return
      if (href === pathname) return
      startLoading()
    }
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Complete when pathname changes
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      finishLoading()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (phase === "idle") return null

  return (
    <>
      <style>{HEARTBEAT_KEYFRAMES}</style>

      {/* Top gradient bar */}
      <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
        <div
          className="h-full rounded-full transition-all ease-out"
          style={{
            width: `${pct}%`,
            transitionDuration: phase === "done" ? "200ms" : "600ms",
            background: "linear-gradient(90deg, #6366f1, #8b5cf6, #06b6d4)",
            boxShadow: "0 0 12px 2px #6366f188, 0 0 24px 4px #8b5cf644",
          }}
        />
        {phase === "loading" && (
          <div
            className="absolute top-0 h-full w-24 rounded-full opacity-60"
            style={{
              left: `calc(${pct}% - 5rem)`,
              background: "linear-gradient(90deg, transparent, #a5b4fc, transparent)",
              transition: "left 600ms ease-out",
            }}
          />
        )}
      </div>

      {/* Page overlay — increased opacity for more prominence */}
      <div
        className="fixed inset-0 z-[9990] pointer-events-none transition-opacity duration-300"
        style={{
          opacity: phase === "done" ? 0 : 1,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: phase === "done" ? "none" : "blur(2px)",
          WebkitBackdropFilter: phase === "done" ? "none" : "blur(2px)",
        }}
      />

      {/* Centered spinner with heartbeat */}
      {phase === "loading" && (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center pointer-events-none">
          <div
            className="relative flex items-center justify-center"
            style={{ animation: "heartbeat 1.2s ease-in-out infinite" }}
          >
            {/* Glow backdrop */}
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-40"
              style={{ background: "radial-gradient(circle, #8b5cf6, #6366f1, transparent)" }}
            />

            {/* Spinning conic ring */}
            <div
              className="h-16 w-16 rounded-full animate-spin"
              style={{
                background: "conic-gradient(from 0deg, transparent 55%, #6366f1 80%, #8b5cf6 90%, #06b6d4 100%)",
                filter: "drop-shadow(0 0 8px #6366f1aa)",
              }}
            />

            {/* Inner fill */}
            <div className="absolute inset-[3px] rounded-full bg-background/95" />

            {/* Logo badge */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm select-none"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  boxShadow: "0 2px 12px #6366f166",
                }}
              >
                V
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
