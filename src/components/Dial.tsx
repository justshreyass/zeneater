import { useEffect, useRef, useState } from 'react'
import { CHEWS_PER_BITE, PREP_MS } from '../engine/timeline'
import type { Snapshot } from '../engine/timeline'
import type { Status, Summary } from '../engine/useSession'
import { LENS_ID, LiquidLens, supportsLens } from './LiquidLens'

const VB = 400
const C = VB / 2
const RIM = 172
const HOLD_R = 194

// Golden yolk → tangerine → strawberry, following the notes upward.
function dotColor(i: number) {
  const t = i / (CHEWS_PER_BITE - 1)
  const hue = t < 0.6 ? 40 - (t / 0.6) * 20 : 20 - ((t - 0.6) / 0.4) * 32
  return `hsl(${(hue + 360) % 360} 100% ${52 + t * 8}%)`
}

interface Props {
  status: Status
  snap: Snapshot
  summary: Summary | null
  holdProgress: number
  onStart: () => void
}

export function Dial({ status, snap, summary, holdProgress, onStart }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize(Math.round(el.getBoundingClientRect().width))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const inSession = status === 'running' || status === 'paused'
  const chewing = inSession && snap.phase === 'chew'
  const prepping = inSession && snap.phase === 'prep'

  // Squish on every chew, like a little jaw.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!chewing || snap.chews === 0) return
    const big = snap.chews === CHEWS_PER_BITE
    bodyRef.current?.animate(
      big
        ? [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(0.97)' }, { transform: 'scale(1)' }]
        : [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.025, 0.965)' }, { transform: 'scale(1, 1)' }],
      { duration: big ? 700 : 260, easing: 'cubic-bezier(.3,1.6,.5,1)' },
    )
  }, [chewing, snap.chews])

  return (
    <div
      ref={ref}
      className={`dial ${status} ${inSession ? snap.phase : ''}`}
      style={{ '--hold': holdProgress } as React.CSSProperties}
    >
      <LiquidLens size={size} />
      <div className={`glass ${supportsLens ? 'lens' : ''}`} style={supportsLens ? { backdropFilter: `url(#${LENS_ID}) blur(10px) saturate(1.7) brightness(1.06)` } : undefined} />
      <div className="glass-shine" />

      <div className="dial-body" ref={bodyRef}>
        <svg className="dial-svg" viewBox={`0 0 ${VB} ${VB}`}>
          <defs>
            <linearGradient id="prep-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFE14D" />
              <stop offset="100%" stopColor="#FF9F1C" />
            </linearGradient>
          </defs>

          {prepping && <PrepRing progress={snap.prepProgress} />}
          {(chewing || status === 'idle' || status === 'done') && (
            <ChewDots
              chews={chewing ? snap.chews : status === 'done' ? CHEWS_PER_BITE : 0}
              beat={chewing ? snap.beatProgress : 0}
              idle={status === 'idle'}
              still={status === 'done'}
              bite={snap.bite}
            />
          )}

          {holdProgress > 0 && (
            <circle
              className="hold-ring"
              cx={C}
              cy={C}
              r={HOLD_R}
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - holdProgress}
              transform={`rotate(-90 ${C} ${C})`}
            />
          )}
        </svg>

        <div className="dial-content">
          {status === 'idle' && (
            <button className="start-btn" onClick={onStart}>
              <span className="start-emoji">🍽️</span>
              <span className="start-label">Start</span>
              <span className="kbd-hint">
                or press <kbd>space</kbd>
              </span>
            </button>
          )}

          {status === 'done' && summary && <Done summary={summary} onStart={onStart} />}

          {inSession && holdProgress > 0 && (
            <div className="center-stack">
              <span className="eyebrow">keep holding</span>
              <span className="big hold-big">{Math.ceil(3 - holdProgress * 3)}</span>
              <span className="caption">to finish your meal</span>
            </div>
          )}

          {inSession && holdProgress === 0 && status === 'paused' && (
            <div className="center-stack paused-stack">
              <span className="eyebrow">bite {snap.bite}</span>
              <span className="pause-icon" aria-label="Paused">
                <i />
                <i />
              </span>
              <span className="caption">
                paused · tap <kbd>space</kbd>
                <span className="touch-only"> to resume</span>
              </span>
            </div>
          )}

          {inSession && holdProgress === 0 && status === 'running' && prepping && (
            <div className="center-stack">
              <span className="eyebrow">bite {snap.bite} · get ready</span>
              <span className="big" key={Math.ceil(snap.prepRemainingMs / 1000)}>
                {Math.max(1, Math.ceil(snap.prepRemainingMs / 1000))}
              </span>
              <span className="caption">{snap.prepRemainingMs > PREP_MS - 2500 ? 'prepare your next bite' : 'take your bite 🥄'}</span>
            </div>
          )}

          {inSession && holdProgress === 0 && status === 'running' && chewing && (
            <div className="center-stack">
              <span className="eyebrow">bite {snap.bite}</span>
              <span className={`big chew-count ${snap.chews === CHEWS_PER_BITE ? 'complete' : ''}`}>
                {snap.chews}
                <small>/{CHEWS_PER_BITE}</small>
              </span>
              <span className="caption">{chewCaption(snap.chews)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function chewCaption(n: number) {
  if (n === 0) return 'chew with the beat'
  if (n < 12) return 'slow and steady'
  if (n < 24) return 'taste every bit'
  if (n < CHEWS_PER_BITE) return 'almost there…'
  return 'swallow & smile ✨'
}

function PrepRing({ progress }: { progress: number }) {
  return (
    <g transform={`rotate(-90 ${C} ${C})`}>
      <circle className="ring-track" cx={C} cy={C} r={RIM} />
      <circle
        className="ring-fill"
        cx={C}
        cy={C}
        r={RIM}
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={progress}
        stroke="url(#prep-grad)"
      />
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2
        const passed = progress >= i / 7
        return (
          <circle
            key={i}
            className={`sec-mark ${passed ? 'passed' : ''}`}
            cx={C + Math.cos(a) * (RIM - 22)}
            cy={C + Math.sin(a) * (RIM - 22)}
            r={3.5}
          />
        )
      })}
    </g>
  )
}

function ChewDots({ chews, beat, idle, still, bite }: { chews: number; beat: number; idle: boolean; still: boolean; bite: number }) {
  return (
    <g>
      {Array.from({ length: CHEWS_PER_BITE }, (_, i) => {
        const a = -Math.PI / 2 + (i / CHEWS_PER_BITE) * Math.PI * 2
        const x = C + Math.cos(a) * RIM
        const y = C + Math.sin(a) * RIM
        const lit = i < chews
        const next = i === chews && !idle && !still
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            {next && <circle className="dot-next" r={9 + beat * 5} style={{ opacity: 0.25 + beat * 0.6 }} />}
            <circle
              key={lit ? `lit-${bite}` : 'off'}
              className={`dot ${lit ? 'lit' : ''} ${idle ? 'idle-dot' : ''}`}
              r={lit ? 9 : 6}
              style={idle ? { animationDelay: `${i * 70}ms` } : lit ? { fill: dotColor(i) } : undefined}
            />
          </g>
        )
      })}
    </g>
  )
}

function Done({ summary, onStart }: { summary: Summary; onStart: () => void }) {
  const mins = Math.floor(summary.ms / 60000)
  const secs = Math.floor((summary.ms % 60000) / 1000)
  return (
    <div className="center-stack done-stack">
      <span className="done-emoji">🧘</span>
      <span className="done-title">Well chewed!</span>
      <div className="stats">
        <div>
          <b>{summary.bites}</b>
          <span>{summary.bites === 1 ? 'bite' : 'bites'}</span>
        </div>
        <div>
          <b>{summary.chews}</b>
          <span>chews</span>
        </div>
        <div>
          <b>
            {mins}:{String(secs).padStart(2, '0')}
          </b>
          <span>mindful</span>
        </div>
      </div>
      <button className="again-btn" onClick={onStart}>
        Eat again <kbd>space</kbd>
      </button>
    </div>
  )
}
