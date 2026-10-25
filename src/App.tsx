import { useEffect, useRef, useState } from 'react'
import { Background } from './components/Background'
import { Confetti } from './components/Confetti'
import { Dial } from './components/Dial'
import { Stickers } from './components/Stickers'
import { audio } from './engine/audio'
import { CHEWS_PER_BITE } from './engine/timeline'
import { usePressControl } from './engine/usePressControl'
import { useSession } from './engine/useSession'

export default function App() {
  const { status, snap, summary, start, toggle, end } = useSession()
  const [muted, setMuted] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const inSession = status === 'running' || status === 'paused'

  const holdProgress = usePressControl({
    enabled: inSession,
    onStart: start,
    onTap: toggle,
    onHold: end,
    onKey: (k) => {
      if (k !== 'm') return
      audio.setMuted(!audio.muted)
      setMuted(audio.muted)
    },
    pointerTarget: mainRef,
  })

  // Burst of confetti for every finished bite, and one more for the meal.
  const [burst, setBurst] = useState(0)
  useEffect(() => {
    if (snap.bitesDone > 0) setBurst((b) => b + 1)
  }, [snap.bitesDone])
  useEffect(() => {
    if (status === 'done' && summary && summary.bites > 0) setBurst((b) => b + 1)
  }, [status, summary])

  // Gentle parallax for the stickers.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = document.documentElement
      r.style.setProperty('--mx', String(e.clientX / window.innerWidth - 0.5))
      r.style.setProperty('--my', String(e.clientY / window.innerHeight - 0.5))
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  const heat = inSession && snap.phase === 'chew' ? snap.chews / CHEWS_PER_BITE : 0

  return (
    <main ref={mainRef} className={`app ${status} ${inSession ? snap.phase : ''} ${holdProgress > 0 ? 'holding' : ''}`}>
      <Background heat={heat} />
      <Stickers interactive={!inSession} />

      <header className={`brand ${inSession ? 'small' : ''}`}>
        <h1>
          Zen<span>Eater</span>
        </h1>
        {!inSession && <p className="tagline">Chew every bite 32 times. Taste the whole thing.</p>}
      </header>

      <div className="stage">
        <Dial status={status} snap={snap} summary={summary} holdProgress={holdProgress} onStart={start} />
        <Confetti trigger={burst} />
      </div>

      <footer className="hints">
        {inSession ? (
          <>
            <span className="kb-only">
              <kbd>space</kbd> pause / resume
            </span>
            <span className="touch-only">tap to pause</span>
            <span className="dot-sep" />
            <span className="kb-only">
              hold <kbd>space</kbd> 3s to finish
            </span>
            <span className="touch-only">hold 3s to finish</span>
          </>
        ) : (
          <>
            <span>7s to prep a bite</span>
            <span className="dot-sep" />
            <span>chew to the beat ×32</span>
            <span className="dot-sep" />
            <span>repeat</span>
          </>
        )}
        {muted && (
          <>
            <span className="dot-sep" />
            <span>
              muted · <kbd>m</kbd>
            </span>
          </>
        )}
      </footer>
    </main>
  )
}
