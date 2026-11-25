export function formatDate(ts: number | null, lang: string, long = false): string {
  if (ts === null) return ''
  const d = new Date(ts)
  const now = new Date()
  const loc = lang === 'en' ? 'en-GB' : 'es-ES'
  if (long) return d.toLocaleString(loc, { dateStyle: 'full', timeStyle: 'short' })
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' })
  return d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function senderLabel(name: string, email: string, fallback: string): string {
  return name || email || fallback
}

export function initials(name: string, email: string): string {
  const base = (name || email || '?').replace(/[<>"]/g, '').trim()
  const parts = base.split(/[\s.@_-]+/).filter(Boolean)
  const a = parts[0]?.[0] ?? '?'
  const b = parts.length > 1 ? parts[1][0] : ''
  return (a + b).toUpperCase()
}

/** Color estable por remitente, apto para texto blanco (contraste >= 4.5). */
export function avatarColor(key: string): string {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return `hsl(${h % 360} 45% 32%)`
}
