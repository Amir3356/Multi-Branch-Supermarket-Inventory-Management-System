// Chart colours per theme: validated categorical pairs (blue, orange) + recessive chrome
export const CHART_THEMES = {
  dark: { series1: '#3987e5', series2: '#d95926', deEmphasis: '#475569', grid: '#1f2937', axis: '#64748b', surface: '#111827' },
  light: { series1: '#2a78d6', series2: '#eb6834', deEmphasis: '#cbd5e1', grid: '#e2e8f0', axis: '#64748b', surface: '#ffffff' }
}

/** Round axis ticks (0 / 500 / 1,000 ...) that always include zero */
export const niceTicks = (values, count = 4) => {
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const raw = (max - min) / count || 1
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((st) => st >= raw)
  const ticks = []
  for (let t = Math.floor(min / step) * step; t <= Math.ceil(max / step) * step + step / 2; t += step) ticks.push(Math.round(t * 100) / 100)
  return ticks
}
