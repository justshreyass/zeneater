import { useEffect, useState } from 'react'

const BITS = ['✨', '🎉', '⭐️', '💛', '🍋', '🌟', '🧡', '✨']

interface Piece {
  id: number
  ch: string
  angle: number
  dist: number
  spin: number
  size: number
  delay: number
}

let nextId = 0

// A little burst from the centre of the dial whenever `trigger` changes.
export function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[]>([])

  useEffect(() => {
    if (!trigger) return
    const batch: Piece[] = Array.from({ length: 22 }, (_, i) => ({
      id: nextId++,
      ch: BITS[i % BITS.length],
      angle: (i / 22) * Math.PI * 2 + Math.random() * 0.3,
      dist: 170 + Math.random() * 160,
      spin: (Math.random() - 0.5) * 720,
      size: 18 + Math.random() * 18,
      delay: Math.random() * 80,
    }))
    setPieces((p) => [...p, ...batch])
    const ids = new Set(batch.map((b) => b.id))
    const t = window.setTimeout(() => setPieces((p) => p.filter((x) => !ids.has(x.id))), 1800)
    return () => window.clearTimeout(t)
  }, [trigger])

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={
            {
              '--x': `${Math.cos(p.angle) * p.dist}px`,
              '--y': `${Math.sin(p.angle) * p.dist}px`,
              '--spin': `${p.spin}deg`,
              fontSize: p.size,
              animationDelay: `${p.delay}ms`,
            } as React.CSSProperties
          }
        >
          {p.ch}
        </span>
      ))}
    </div>
  )
}
