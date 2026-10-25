import { useEffect, useMemo, useState } from 'react'
import { audio } from '../engine/audio'

// Every food & (non-alcoholic) drink emoji; each page load picks its own mix.
const FOODS = [
  // fruit
  '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥',
  // veg
  '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🥜', '🫘', '🌰', '🫚', '🫛', '🍄',
  // prepared
  '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮',
  '🌯', '🫔', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🫕', '🥣', '🥗', '🍿', '🧈', '🥫',
  // asian
  '🍱', '🍘', '🍙', '🍚', '🍛', '🍜', '🍝', '🍠', '🍢', '🍣', '🍤', '🍥', '🥮', '🍡', '🥟', '🥠', '🥡', '🦪',
  // sweets
  '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯',
  // drinks
  '🥛', '☕', '🫖', '🍵', '🧃', '🥤', '🧋',
]

// A fresh seed per page load, so every visit gets a new scatter. Within a
// visit the layout stays put (and survives resizes with the same mix).
const SEED = 1 + Math.floor(Math.random() * 2147483645)

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

// Distance from a point to an axis-aligned rect (0 inside).
const rectDist = (x: number, y: number, [x0, y0, x1, y1]: number[]) =>
  Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1))

// Spread stickers evenly over the free space around the wordmark, the dial
// and the bottom dock. Best-candidate sampling: each sticker tries many
// random spots and keeps the one farthest from everything already placed,
// which fills gaps first and never clumps, yet differs on every load.
// Mirrors the --dial size and .stage offset in styles.css.
function layout(w: number, h: number): Sticker[] {
  const r = rng(SEED)
  const pool = [...FOODS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  const dial = Math.max(250, Math.min(420, w * 0.84, h - 300))
  const dialR = dial / 2 + 44
  const cx = w / 2
  const cy = h / 2 + 12
  const titleHalf = Math.min(330, w * 0.42)
  const title = [cx - titleHalf, -Infinity, cx + titleHalf, 150]
  const dock = [cx - 280, h - 140, cx + 280, Infinity]

  // How many fit: roughly one per 70k px² of free space.
  const free = w * h - Math.PI * dialR * dialR - titleHalf * 2 * 150 - Math.min(w, 560) * 140
  const target = Math.max(10, Math.min(22, Math.round(free / 70000)))
  const small = Math.min(w, h) < 600
  const minGap = small ? 52 : 72
  // Distances to edges and obstacles are scaled up, so a sticker only needs
  // part of a gap from them: half on big screens, a third around obstacles
  // on phones, where the free space is a thin ring.
  const pad = small ? 3 : 2

  const placed: [number, number][] = []
  const room = (x: number, y: number) =>
    Math.min(
      2 * Math.min(x, y, w - x, h - y),
      pad * (Math.hypot(x - cx, y - cy) - dialR),
      pad * rectDist(x, y, title),
      pad * rectDist(x, y, dock),
      ...placed.map(([px, py]) => Math.hypot(px - x, py - y)),
    )

  const out: Sticker[] = []
  for (let i = 0; i < target; i++) {
    let best: [number, number] = [0, 0]
    let bestRoom = -Infinity
    // Fill whichever quarter around the dial has the fewest stickers, so
    // left/right and top/bottom stay balanced.
    const counts = [0, 0, 0, 0]
    for (const [px, py] of placed) counts[(px < cx ? 0 : 1) + (py < cy ? 0 : 2)]++
    const fewest = Math.min(...counts)
    const open = counts.flatMap((c, q) => (c === fewest ? [q] : []))
    const q = open[Math.floor(r() * open.length)]
    const [x0, y0] = [q % 2 ? cx : 0, q < 2 ? 0 : cy]
    const [qw, qh] = [q % 2 ? w - cx : cx, q < 2 ? cy : h - cy]
    // Only candidates in free space count, so narrow screens (where most of
    // the area is dial) still get a fair search.
    for (let k = 0, tries = 0; k < 150 && tries < 6000; tries++) {
      const x = x0 + r() * qw
      const y = y0 + r() * qh
      const d = room(x, y)
      if (d <= 0) continue
      k++
      if (d > bestRoom) {
        bestRoom = d
        best = [x, y]
      }
    }
    // Small screens simply get fewer stickers.
    if (bestRoom < minGap) break
    placed.push(best)
    const depth = 0.4 + r() * 0.6
    out.push({
      emoji: pool[i],
      x: (best[0] / w) * 100,
      y: (best[1] / h) * 100,
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
