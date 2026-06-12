export default function Sparkline({ values = [], color = '#6366F1', width = 56, height = 16 }) {
  if (!values.length) return null
  const max = Math.max(...values, 1)
  const step = width / Math.max(values.length - 1, 1)
  const pts = values.map((v, i) => [i * step, height - (v / max) * (height - 2) - 1])
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const fill = d + ` L ${width} ${height} L 0 ${height} Z`
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <path d={fill} fill={color} fillOpacity="0.12" />
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
