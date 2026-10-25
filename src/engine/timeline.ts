// The whole session is a deterministic loop of identical bite cycles, so every
// visual and sound can be derived from a single number: active (unpaused) time.

export const PREP_MS = 7000
export const CHEWS_PER_BITE = 32
// 5 chews every 4 seconds.
export const CHEW_MS = 4000 / 5
// Chew 1 lands one beat after the bite starts and chew 32 gets its own full
// beat (plus a little breath) before the next prep timer begins.
export const CHEW_PHASE_MS = (CHEWS_PER_BITE + 1) * CHEW_MS + 400
export const CYCLE_MS = PREP_MS + CHEW_PHASE_MS
export const TICK_MS = 500

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

export function snapshot(t: number): Snapshot {
  const cycle = Math.floor(t / CYCLE_MS)
  const off = t - cycle * CYCLE_MS
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
  const chewT = off - PREP_MS
  const chews = Math.min(CHEWS_PER_BITE, Math.floor(chewT / CHEW_MS))
  return {
    phase: 'chew',
    bite: cycle + 1,
    prepRemainingMs: 0,
    prepProgress: 1,
    chews,
    beatProgress: chews >= CHEWS_PER_BITE ? 1 : (chewT % CHEW_MS) / CHEW_MS,
    bitesDone: cycle + (chews >= CHEWS_PER_BITE ? 1 : 0),
    totalChews: cycle * CHEWS_PER_BITE + chews,
  }
}

export type SoundEvent =
  | { kind: 'tick'; at: number; tock: boolean; urgent: boolean }
  | { kind: 'chew'; at: number; n: number }

// Every sound event whose time falls in [from, to).
export function eventsBetween(from: number, to: number): SoundEvent[] {
  const out: SoundEvent[] = []
  if (to <= from) return out
  const first = Math.max(0, Math.floor(from / CYCLE_MS))
  const last = Math.floor(to / CYCLE_MS)
  for (let c = first; c <= last; c++) {
    const base = c * CYCLE_MS
    for (let i = 0; i < PREP_MS / TICK_MS; i++) {
      const at = base + i * TICK_MS
      if (at >= from && at < to) {
        out.push({ kind: 'tick', at, tock: i % 2 === 1, urgent: at - base >= PREP_MS - 3000 })
      }
    }
    for (let n = 1; n <= CHEWS_PER_BITE; n++) {
      const at = base + PREP_MS + n * CHEW_MS
      if (at >= from && at < to) out.push({ kind: 'chew', at, n })
    }
  }
  return out
}
