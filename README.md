# ZenEater 🍙

A tiny, playful timer that helps you chew every bite 32 times.

1. **Prep** – 7 seconds to get your next bite ready (tick-tock).
2. **Chew** – a melodious note on every chew, climbing from low to high until chew 32.
3. **Repeat** – the next prep timer starts on its own.

## Controls

Hands get messy, so everything runs on the space bar:

| Action | Space bar | Touch screen |
| --- | --- | --- |
| Start | press | tap **Start** |
| Pause / resume | tap | tap anywhere |
| Finish the meal | hold for 3 s | hold for 3 s |
| Mute | `M` | – |

Nothing is saved, and there's no login.

## Develop

```bash
npm install
npm run dev
```

`npm run build` outputs a static site to `dist/`. Vercel detects the Vite preset automatically.

## How it works

- `src/engine/timeline.ts` – the whole session is a deterministic loop of bite cycles, so every visual and sound is derived from one number: active (unpaused) time. Tweak `PREP_MS`, `CHEW_MS` and `CHEWS_PER_BITE` here.
- `src/engine/audio.ts` – all sounds are synthesised with Web Audio: no audio files. Chews walk up a G major pentatonic scale in phrases of four, and chew 32 lands on the tonic with a strummed chord.
- `src/engine/useSession.ts` – the session clock, plus a lookahead scheduler that queues notes on the audio clock so the beat stays steady.
- `src/engine/usePressControl.ts` – tap vs. 3-second hold detection for the space bar and touch.
