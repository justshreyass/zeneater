// Slow, drifting blobs of warm colour behind everything. `heat` (0 → 1)
// warms the scene as a bite builds toward chew 32.
export function Background({ heat }: { heat: number }) {
  return (
    <div className="bg" aria-hidden style={{ '--heat': heat } as React.CSSProperties}>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="blob b4" />
      <div className="blob b5" />
      <div className="heat" />
      <div className="grain" />
    </div>
  )
}
