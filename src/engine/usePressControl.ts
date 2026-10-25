import { useEffect, useRef, useState } from 'react'

export const HOLD_MS = 3000
// A release before this counts as a tap; between this and HOLD_MS it's
// treated as a cancelled hold and does nothing.
const TAP_MAX_MS = 550
// Don't flash the hold ring for an ordinary tap.
const HOLD_VISIBLE_AFTER_MS = 220

interface Options {
  enabled: boolean
  // Called on a press when a session isn't active (start / restart). The
  // whole press is consumed so it can't also count as a tap or hold.
  onStart?: () => void
  onTap?: () => void
  onHold?: () => void
  onKey?: (key: string) => void
  pointerTarget?: React.RefObject<HTMLElement | null>
}

// Space bar (or a finger on touch screens): tap to pause/resume, hold for
// three seconds to finish.
export function usePressControl({ enabled, onStart, onTap, onHold, onKey, pointerTarget }: Options) {
  const [holdProgress, setHoldProgress] = useState(0)
  const opts = useRef({ enabled, onStart, onTap, onHold, onKey })
  opts.current = { enabled, onStart, onTap, onHold, onKey }

  useEffect(() => {
    let downAt: number | null = null
    let consumed = false
    let raf = 0

    const frame = () => {
      if (downAt === null) return
      const held = performance.now() - downAt
      setHoldProgress(held < HOLD_VISIBLE_AFTER_MS ? 0 : Math.min(1, (held - HOLD_VISIBLE_AFTER_MS) / (HOLD_MS - HOLD_VISIBLE_AFTER_MS)))
      if (held >= HOLD_MS) {
        downAt = null
        consumed = true
        setHoldProgress(0)
        opts.current.onHold?.()
        return
      }
      raf = requestAnimationFrame(frame)
    }

    const press = () => {
      const o = opts.current
      if (!o.enabled) {
        consumed = true
        o.onStart?.()
        return
      }
      consumed = false
      downAt = performance.now()
      raf = requestAnimationFrame(frame)
    }

    const release = () => {
      cancelAnimationFrame(raf)
      setHoldProgress(0)
      if (consumed || downAt === null) {
        downAt = null
        consumed = false
        return
      }
      const held = performance.now() - downAt
      downAt = null
      if (held < TAP_MAX_MS) opts.current.onTap?.()
    }

    const isSpace = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' '

    const onKeyDown = (e: KeyboardEvent) => {
      if (isSpace(e)) {
        e.preventDefault()
        if (!e.repeat && downAt === null) press()
      } else if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) {
        opts.current.onKey?.(e.key.toLowerCase())
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isSpace(e)) return
      e.preventDefault()
      release()
    }
    // If the window loses focus mid-hold, we'll never see the keyup.
    const onBlur = () => {
      cancelAnimationFrame(raf)
      downAt = null
      setHoldProgress(0)
    }

    const el = pointerTarget?.current
    const onPointerDown = (e: PointerEvent) => {
      if (!opts.current.enabled || e.button !== 0) return
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault()
      if (downAt === null) press()
    }
    const onPointerUp = () => downAt !== null && release()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    el?.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      el?.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [pointerTarget])

  return holdProgress
}
