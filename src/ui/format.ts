const exact = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 })

/** 12345.6 → « 12 345 ». Arrondi vers le bas : on n'affiche que ce qu'on possède vraiment. */
export function formatAmount(value: number): string {
  return exact.format(Math.floor(value))
}

/** Comme formatAmount, mais abrégé au-delà de 100 000 (« 123,4 k ») pour tenir dans la barre. */
export function formatShort(value: number): string {
  return value < 100_000 ? formatAmount(value) : compact.format(Math.floor(value))
}

/** 75 000 ms → « 1 min 15 s » */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, '0')} s`
  return `${seconds} s`
}
