import { useEffect } from 'react'
import { parallaxFromPoint } from '../lib/parallax'

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'
const FINE_QUERY = '(pointer: fine)'

/**
 * Publishes the pointer position as --px / --py on <html>, normalised to -1..1
 * with 0 at the centre of the viewport.
 *
 * Nothing here calls setState. The values go straight onto the style attribute,
 * so a pointer move costs one style recalculation and zero React renders. That
 * matters: useAutoRefresh already re-renders the whole tree on a timer, and a
 * render per pointer move would be ruinous.
 *
 * <html> rather than a ref, because the ambient deep field lives on
 * body::before / body::after, which are ancestors of everything React renders
 * and so could never read a property set inside the app.
 */
export function usePointerParallax(enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    // On a touch-only device pointermove fires only during a drag, so the
    // listener would cost something and buy nothing.
    if (!window.matchMedia(FINE_QUERY).matches) return

    const root = document.documentElement
    const reduce = window.matchMedia(REDUCE_QUERY)
    let frame = 0
    let lastX = 0
    let lastY = 0
    let written = ''

    const write = (px: number, py: number) => {
      const next = `${px},${py}`
      if (next === written) return
      written = next
      root.style.setProperty('--px', String(px))
      root.style.setProperty('--py', String(py))
    }

    const flush = () => {
      frame = 0
      if (reduce.matches) {
        write(0, 0)
        return
      }
      const { px, py } = parallaxFromPoint(lastX, lastY, window.innerWidth, window.innerHeight)
      write(px, py)
    }

    const onMove = (event: PointerEvent) => {
      lastX = event.clientX
      lastY = event.clientY
      // At most one write per frame, however fast the events arrive.
      if (frame === 0) frame = requestAnimationFrame(flush)
    }

    // Recentre rather than freeze mid-tilt. Also how a live change to the
    // reduced-motion setting takes effect, with no re-render.
    const recentre = () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      frame = 0
      write(0, 0)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', recentre)
    reduce.addEventListener('change', recentre)

    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', recentre)
      reduce.removeEventListener('change', recentre)
      if (frame !== 0) cancelAnimationFrame(frame)
      root.style.removeProperty('--px')
      root.style.removeProperty('--py')
    }
  }, [enabled])
}
