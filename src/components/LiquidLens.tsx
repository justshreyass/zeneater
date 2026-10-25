import { useMemo } from 'react'

export const LENS_ID = 'zen-lens'

// Chromium is the only engine that renders SVG filters inside
// backdrop-filter; everyone else gets a frosted blur instead.
export const supportsLens = (() => {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands
  return !!brands?.some((b) => /Chromium/.test(b.brand))
})()

// A displacement map that bends the backdrop near the rim of a circle,
// like light through a thick glass bead.
function lensMap(res = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = res
  const g = c.getContext('2d')!
  const img = g.createImageData(res, res)
  const band = 0.32
  for (let py = 0; py < res; py++) {
    for (let px = 0; px < res; px++) {
      const nx = (px + 0.5) / res * 2 - 1
      const ny = (py + 0.5) / res * 2 - 1
      const r = Math.hypot(nx, ny)
      let dx = 0
      let dy = 0
      if (r > 1 - band && r <= 1) {
        const t = (r - (1 - band)) / band
        const s = t * t * 0.5
        dx = -(nx / r) * s
        dy = -(ny / r) * s
      }
      const i = (py * res + px) * 4
      img.data[i] = 128 + dx * 255
      img.data[i + 1] = 128 + dy * 255
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return c.toDataURL()
}

export function LiquidLens({ size }: { size: number }) {
  const href = useMemo(() => (supportsLens ? lensMap() : ''), [])
  if (!supportsLens || !size) return null
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <filter id={LENS_ID} x="0" y="0" width={size} height={size} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feImage href={href} x="0" y="0" width={size} height={size} preserveAspectRatio="none" result="map" />
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="soft" />
        <feDisplacementMap in="soft" in2="map" scale={size * 0.22} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
