// Next sequential id for a list of records, e.g. SL-5011 → SL-5012, ACC-004 → ACC-005
export const nextId = (records, prefix, pad = 0) => {
  const next = Math.max(0, ...records.map((r) => Number(String(r.id).split('-')[1]) || 0)) + 1
  return `${prefix}-${pad ? String(next).padStart(pad, '0') : next}`
}
