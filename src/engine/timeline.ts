// The session is a loop of identical bite cycles, so every visual and sound
// can be derived from active (unpaused) time plus an anchor. The anchor only
// moves when the chewing speed changes mid-session.

export const PREP_MS = 7000
export const CHEWS_PER_BITE = 32
// A quiet moment after chew 32 to actually swallow before the next prep.
export const SWALLOW_MS = 2000
export const TICK_MS = 500

export type Speed = 'relaxed' | 'normal' | 'fast'

export const SPEEDS: Record<Speed, { label: string; key: string; chewMs: number }> = {
  relaxed: { label: 'Relaxed', key: 'r', chewMs: 4000 / 4 },
  normal: { label: 'Normal', key: 'n', chewMs: 4000 / 5 },
  fast: { label: 'Fast', key: 'f', chewMs: 4000 / 6 },
}
export const SPEED_ORDER: Speed[] = ['relaxed', 'normal', 'fast']

const cycleMs = (chewMs: number) => PREP_MS + CHEWS_PER_BITE * chewMs + SWALLOW_MS

// From active time `at` onward, the session is `offset` ms into bite
// `cycle`, chewing at `chewMs` per chew.
export interface Anchor {
  at: number
  cycle: number
  offset: number
  chewMs: number
}

export const startAnchor = (chewMs: number): Anchor => ({ at: 0, cycle: 0, offset: 0, chewMs })

function locate(t: number, a: Anchor) {
  const len = cycleMs(a.chewMs)
  const o = a.offset + Math.max(0, t - a.at)
  const k = Math.floor(o / len)
  return { cycle: a.cycle + k, off: o - k * len }
}

// Switch speed at time `t`, keeping the current chew exactly where it is.
export function rebase(t: number, a: Anchor, chewMs: number): Anchor {
  const { cycle, off } = locate(t, a)
  const chewEnd = PREP_MS + CHEWS_PER_BITE * a.chewMs
  let offset = off
  if (off >= chewEnd) offset = PREP_MS + CHEWS_PER_BITE * chewMs + (off - chewEnd)
  else if (off > PREP_MS) offset = PREP_MS + ((off - PREP_MS) / a.chewMs) * chewMs
  return { at: t, cycle, offset, chewMs }
}

export type Phase = 'prep' | 'chew'

export interface Snapshot {
  phase: Phase
  bite: number // 1-based index of the bite in progress
  prepRemainingMs: number
  prepProgress: number // 0 → 1 over the prep window
  chews: number // 0 → 32 within the current bite
  beatProgress: number // 0 → 1 between two chews
  bitesDone: number
  totalChews: number
}

export function snapshot(t: number, a: Anchor): Snapshot {
  const { cycle, off } = locate(t, a)
  if (off < PREP_MS) {
    return {
      phase: 'prep',
      bite: cycle + 1,
      prepRemainingMs: PREP_MS - off,
      prepProgress: off / PREP_MS,
      chews: 0,
      beatProgress: 0,
      bitesDone: cycle,
      totalChews: cycle * CHEWS_PER_BITE,
    }
  }
  // Chewing, then (once chews hits 32) the swallow pause.
  const chewT = off - PREP_MS
  const chews = Math.min(CHEWS_PER_BITE, Math.floor(chewT / a.chewMs))
  return {
    phase: 'chew',
    bite: cycle + 1,
    prepRemainingMs: 0,
    prepProgress: 1,
    chews,
    beatProgress: chews >= CHEWS_PER_BITE ? 1 : (chewT % a.chewMs) / a.chewMs,
    bitesDone: cycle + (chews >= CHEWS_PER_BITE ? 1 : 0),
    totalChews: cycle * CHEWS_PER_BITE + chews,
  }
}

export type SoundEvent =
  | { kind: 'tick'; at: number; tock: boolean; urgent: boolean }
  | { kind: 'chew'; at: number; n: number }

// Every sound event whose active time falls in [from, to).
export function eventsBetween(from: number, to: number, a: Anchor): SoundEvent[] {
  const out: SoundEvent[] = []
  from = Math.max(from, a.at)
  if (to <= from) return out
  const len = cycleMs(a.chewMs)
  // Work in offsets relative to the anchor's cycle.
  const o0 = a.offset + (from - a.at)
  const o1 = a.offset + (to - a.at)
  const toTime = (o: number) => a.at + (o - a.offset)
  for (let k = Math.floor(o0 / len); k <= Math.floor(o1 / len); k++) {
    const base = k * len
    for (let i = 0; i < PREP_MS / TICK_MS; i++) {
      const o = base + i * TICK_MS
      if (o >= o0 && o < o1) out.push({ kind: 'tick', at: toTime(o), tock: i % 2 === 1, urgent: i * TICK_MS >= PREP_MS - 3000 })
    }
    for (let n = 1; n <= CHEWS_PER_BITE; n++) {
      const o = base + PREP_MS + n * a.chewMs
      if (o >= o0 && o < o1) out.push({ kind: 'chew', at: toTime(o), n })
    }
  }
  return out
}
