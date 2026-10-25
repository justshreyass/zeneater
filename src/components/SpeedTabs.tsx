import { SPEED_ORDER, SPEEDS, type Speed } from '../engine/timeline'

// Segmented control for chewing pace. Also driven by the R / N / F keys.
export function SpeedTabs({ speed, onChange }: { speed: Speed; onChange: (s: Speed) => void }) {
  const index = SPEED_ORDER.indexOf(speed)
  return (
    <div className="speed-tabs glass-pill" role="radiogroup" aria-label="Chewing speed">
      <span className="speed-thumb" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden />
      {SPEED_ORDER.map((s) => (
        <button
          key={s}
          role="radio"
          aria-checked={s === speed}
          className={`speed-tab ${s === speed ? 'active' : ''}`}
          tabIndex={-1}
          onClick={() => onChange(s)}
        >
          {SPEEDS[s].label}
          <kbd>{SPEEDS[s].key.toUpperCase()}</kbd>
        </button>
      ))}
    </div>
  )
}
