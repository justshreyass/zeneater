import { useEffect, useMemo, useState } from 'react'
import { audio } from '../engine/audio'

const FOODS = ['🍎', '🥑', '🍕', '🥕', '🍙', '🥦', '🍓', '🍩', '🥐', '🍌', '🌮', '🍜', '🍒', '🧀', '🍉', '🥟']

// Deterministic so stickers don't jump around between renders.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

interface Sticker {
  emoji: string
  x: number
  y: number
  size: number
  depth: number
  dur: number
  delay: number
  dx: number
  dy: number
  rot: number
}

// Scatter stickers around the screen, keeping the wordmark, the dial and the
// hint pill clear. Mirrors the --dial size in styles.css.
function layout(w: number, h: number): Sticker[] {
  const r = rng(32)
  const out: Sticker[] = []
  const dial = Math.max(250, Math.min(420, w * 0.84, h - 270))
  const dialR = dial / 2 + 44
  const cx = w / 2
  const cy = h / 2 + 45
  const spacing = Math.max(70, Math.min(w, h) * 0.13)
  const blocked = (x: number, y: number) =>
    Math.hypot(x - cx, y - cy) < dialR ||
    (y < 150 && Math.abs(x - cx) < Math.min(330, w * 0.42)) ||
    (y > h - 90 && Math.abs(x - cx) < 270)

  for (let i = 0; i < FOODS.length; i++) {
    let spot: [number, number] | null = null
    for (let tries = 0; tries < 60 && !spot; tries++) {
      const x = 30 + r() * (w - 60)
      const y = 34 + r() * (h - 68)
      if (!blocked(x, y) && out.every((s) => Math.hypot((s.x / 100) * w - x, (s.y / 100) * h - y) > spacing)) spot = [x, y]
    }
    // Small screens simply get fewer stickers.
    if (!spot) continue
    const depth = 0.4 + r() * 0.6
    out.push({
      emoji: FOODS[i],
      x: (spot[0] / w) * 100,
      y: (spot[1] / h) * 100,
      size: (Math.min(w, h) < 600 ? 26 : 34) + depth * 36,
      depth,
      dur: 9 + r() * 10,
      delay: -r() * 20,
      dx: (r() - 0.5) * 50,
      dy: (r() - 0.5) * 50,
      rot: (r() - 0.5) * 40,
    })
  }
  return out
}

function useViewport() {
  const [vp, setVp] = useState(() => [window.innerWidth, window.innerHeight])
  useEffect(() => {
    let t = 0
    const onResize = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => setVp([window.innerWidth, window.innerHeight]), 200)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return vp
}

export function Stickers({ interactive }: { interactive: boolean }) {
  const [w, h] = useViewport()
  const stickers = useMemo(() => layout(w, h), [w, h])
  const [booped, setBooped] = useState<Record<number, number>>({})

  return (
    <div className="stickers" aria-hidden>
      {stickers.map((s, i) => (
        <div
          key={i}
          className="sticker-pos"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              '--depth': s.depth,
            } as React.CSSProperties
          }
        >
          <div
            className="sticker-float"
            style={
              {
                animationDuration: `${s.dur}s`,
                animationDelay: `${s.delay}s`,
                '--dx': `${s.dx}px`,
                '--dy': `${s.dy}px`,
                '--rot': `${s.rot}deg`,
              } as React.CSSProperties
            }
          >
            <button
              key={booped[i] ?? 0}
              className={`sticker ${booped[i] ? 'boop' : ''}`}
              style={{ fontSize: s.size }}
              tabIndex={-1}
              disabled={!interactive}
              onClick={() => {
                audio.unlock().then(() => audio.cue('pop'))
                setBooped((b) => ({ ...b, [i]: (b[i] ?? 0) + 1 }))
              }}
            >
              {s.emoji}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
