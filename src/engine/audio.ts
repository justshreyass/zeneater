// All sounds are synthesised with Web Audio, so there are no assets to load
// and every note can be scheduled sample-accurately on the audio clock.

// G major pentatonic: it's impossible to play a sour note with it.
const PENTA = [0, 2, 4, 7, 9]
const ROOT_MIDI = 55 // G3

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)
const degreeToMidi = (d: number) => ROOT_MIDI + 12 * Math.floor(d / 5) + PENTA[((d % 5) + 5) % 5]

// Chews come in phrases of four that each climb one step higher
// (up, down, up), so 1 → 32 walks two octaves and lands on the tonic.
const PHRASE = [0, 2, 1, 3]
export function chewMidi(n: number): number {
  const i = n - 1
  return degreeToMidi(Math.floor(i / 4) + PHRASE[i % 4])
}

interface Voice {
  when: number
  out: GainNode
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private dry!: GainNode
  private wet!: GainNode
  private voices: Voice[] = []
  private _muted = false

  get context() {
    return this.ctx
  }

  get muted() {
    return this._muted
  }

  async unlock() {
    if (!this.ctx) this.build()
    if (this.ctx!.state !== 'running') await this.ctx!.resume()
  }

  setMuted(m: boolean) {
    this._muted = m
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, t, 0.05)
  }

  // Silence anything scheduled ahead of now (used on pause / stop).
  cancelFuture() {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.voices = this.voices.filter((v) => {
      if (v.when > now + 0.005) {
        v.out.disconnect()
        return false
      }
      return v.when > now - 4
    })
  }

  private build() {
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    this.ctx = ctx
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 3
    this.master = ctx.createGain()
    this.master.gain.value = this._muted ? 0 : 0.9
    this.master.connect(comp).connect(ctx.destination)

    this.dry = ctx.createGain()
    this.dry.connect(this.master)
    const verb = ctx.createConvolver()
    verb.buffer = this.impulse(2.2)
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.32
    this.wet.connect(verb).connect(this.master)
  }

  // A soft, airy room built from decaying stereo noise.
  private impulse(seconds: number) {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
    }
    return buf
  }

  private voice(when: number, reverb = 1) {
    const ctx = this.ctx!
    const out = ctx.createGain()
    out.connect(this.dry)
    if (reverb > 0) {
      const send = ctx.createGain()
      send.gain.value = reverb
      out.connect(send).connect(this.wet)
    }
    if (this.voices.length > 120) this.voices = this.voices.filter((v) => v.when > ctx.currentTime - 4)
    this.voices.push({ when, out })
    return out
  }

  private tone(dest: AudioNode, type: OscillatorType, hz: number, when: number, peak: number, decay: number, attack = 0.004) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = hz
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay)
    osc.connect(g).connect(dest)
    osc.start(when)
    osc.stop(when + attack + decay + 0.05)
  }

  // Wooden clock tick / tock.
  tick(when: number, tock: boolean, urgent: boolean) {
    if (!this.ctx) return
    const ctx = this.ctx
    const out = this.voice(when, 0.25)
    const base = tock ? 820 : 1240
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(base * 1.6, when)
    osc.frequency.exponentialRampToValueAtTime(base, when + 0.02)
    const g = ctx.createGain()
    const peak = urgent ? 0.22 : 0.14
    g.gain.setValueAtTime(0, when)
    g.gain.linearRampToValueAtTime(peak, when + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.07)
    osc.connect(g).connect(out)
    osc.start(when)
    osc.stop(when + 0.1)

    // A breath of filtered noise gives it a woody knock.
    const noise = ctx.createBufferSource()
    const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate)
    const nd = nb.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length)
    noise.buffer = nb
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = base * 2.2
    bp.Q.value = 3
    const ng = ctx.createGain()
    ng.gain.value = peak * 0.6
    noise.connect(bp).connect(ng).connect(out)
    noise.start(when)
  }

  // A kalimba-ish pluck whose pitch and brightness climb with every chew.
  chew(when: number, n: number) {
    if (!this.ctx) return
    const out = this.voice(when, 1)
    const hz = midiToHz(chewMidi(n))
    const lift = n / 32
    const vel = 0.22 + lift * 0.16
    this.tone(out, 'sine', hz, when, vel, 1.4 - lift * 0.4)
    this.tone(out, 'triangle', hz, when, vel * 0.25, 0.5)
    this.tone(out, 'sine', hz * 4, when, vel * 0.12, 0.09) // the "tine" click
    this.tone(out, 'sine', hz * 2.01, when, vel * 0.08 * (1 + lift), 0.6)
    if (n === 32) this.climax(when)
  }

  // Chew 32: a strummed tonic chord with a sparkle on top.
  private climax(when: number) {
    const out = this.voice(when, 1.4)
    const top = chewMidi(32)
    ;[top - 12, top - 5, top, top + 4, top + 7, top + 12].forEach((m, i) => {
      const t = when + 0.06 + i * 0.055
      this.tone(out, 'sine', midiToHz(m), t, 0.11, 2.6, 0.01)
      this.tone(out, 'triangle', midiToHz(m), t, 0.03, 1.2, 0.01)
    })
    ;[top + 19, top + 24, top + 28, top + 31].forEach((m, i) => {
      this.tone(out, 'sine', midiToHz(m), when + 0.4 + i * 0.07, 0.035, 0.7)
    })
  }

  // Little UI blips: start / pause / resume / finish / boop.
  cue(kind: 'start' | 'pause' | 'resume' | 'end' | 'pop') {
    if (!this.ctx) return
    const now = this.ctx.currentTime + 0.01
    const out = this.voice(now, 0.6)
    const seqs: Record<typeof kind, number[]> = {
      start: [67, 71, 74, 79],
      resume: [67, 74],
      pause: [74, 67],
      end: [79, 74, 71, 67, 62],
      pop: [84 + Math.floor(Math.random() * 3) * 2],
    }
    const gap = kind === 'end' ? 0.09 : 0.07
    seqs[kind].forEach((m, i) => {
      this.tone(out, 'sine', midiToHz(m), now + i * gap, 0.16, kind === 'pop' ? 0.18 : 0.45)
      this.tone(out, 'sine', midiToHz(m) * 3, now + i * gap, 0.02, 0.08)
    })
  }
}

export const audio = new AudioEngine()
