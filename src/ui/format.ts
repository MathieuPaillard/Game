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

/** Temps écoulé depuis un événement : « à l’instant », « il y a 5 min », « il y a 2 h »… */
export function formatAgo(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

/** 75 000 ms → « 1 min 15 s » */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return minutes ? `${hours} h ${String(minutes).padStart(2, '0')} min` : `${hours} h`
  if (minutes > 0) return seconds ? `${minutes} min ${String(seconds).padStart(2, '0')} s` : `${minutes} min`
  return `${seconds} s`
}
