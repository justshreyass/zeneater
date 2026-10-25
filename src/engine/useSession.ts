import { useCallback, useEffect, useRef, useState } from 'react'
import { audio } from './audio'
import { CHEWS_PER_BITE, eventsBetween, snapshot, type Snapshot } from './timeline'

export type Status = 'idle' | 'running' | 'paused' | 'done'

export interface Summary {
  bites: number
  chews: number
  ms: number
}

const SCHEDULER_MS = 25

// Owns the session clock. Visuals read `snap`, sounds are scheduled a little
// ahead of time on the audio clock so the beat stays steady.
export function useSession() {
  const [status, setStatus] = useState<Status>('idle')
  const [snap, setSnap] = useState<Snapshot>(() => snapshot(0))
  const [summary, setSummary] = useState<Summary | null>(null)

  const clock = useRef({ banked: 0, since: 0, running: false, scheduledUntil: 0 })

  const now = useCallback(() => {
    const c = clock.current
    return c.banked + (c.running ? Math.max(0, performance.now() - c.since) : 0)
  }, [])

  // Lookahead scheduler. A larger window while the tab is hidden, since
  // background timers fire less often.
  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => {
      const ctx = audio.context
      if (!ctx) return
      const c = clock.current
      const t = now()
      const target = t + (document.hidden ? 1500 : 150)
      for (const e of eventsBetween(c.scheduledUntil, target)) {
        const when = ctx.currentTime + Math.max(0, e.at - t) / 1000
        if (e.kind === 'tick') audio.tick(when, e.tock, e.urgent)
        else audio.chew(when, e.n)
      }
      c.scheduledUntil = target
    }, SCHEDULER_MS)
    return () => window.clearInterval(id)
  }, [status, now])

  // Render loop.
  useEffect(() => {
    if (status !== 'running') return
    let raf = 0
    const loop = () => {
      setSnap(snapshot(now()))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [status, now])

  useWakeLock(status === 'running' || status === 'paused')

  const start = useCallback(async () => {
    await audio.unlock()
    audio.cue('start')
    clock.current = { banked: 0, since: performance.now(), running: true, scheduledUntil: 0 }
    setSnap(snapshot(0))
    setSummary(null)
    setStatus('running')
  }, [])

  const pause = useCallback(() => {
    const c = clock.current
    if (!c.running) return
    c.banked = now()
    c.running = false
    c.scheduledUntil = c.banked
    audio.cancelFuture()
    audio.cue('pause')
    setSnap(snapshot(c.banked))
    setStatus('paused')
  }, [now])

  const resume = useCallback(async () => {
    const c = clock.current
    if (c.running) return
    await audio.unlock()
    audio.cue('resume')
    // A short grace period so the resume cue doesn't collide with a note.
    c.since = performance.now() + 250
    c.running = true
    setStatus('running')
  }, [])

  const toggle = useCallback(() => {
    if (clock.current.running) pause()
    else resume()
  }, [pause, resume])

  const end = useCallback(() => {
    const c = clock.current
    const t = now()
    c.banked = t
    c.running = false
    audio.cancelFuture()
    audio.cue('end')
    const s = snapshot(t)
    // A half-chewed bite still counts as a bite.
    const partial = s.phase === 'chew' && s.chews > 0 && s.chews < CHEWS_PER_BITE ? 1 : 0
    setSummary({ bites: s.bitesDone + partial, chews: s.totalChews, ms: t })
    setStatus('done')
  }, [now])

  return { status, snap, summary, start, toggle, end }
}

// Keep the screen awake while eating; nobody wants to wipe their hands to
// unlock a phone mid-bite.
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) lock.release()
      } catch {
        /* not allowed right now; fine */
      }
    }
    const onVis = () => document.visibilityState === 'visible' && acquire()
    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      lock?.release()
    }
  }, [active])
}
