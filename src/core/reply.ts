// Texto citado para responder y reenviar: limpio, corto y cortado en un limite natural.

const NESTED_START = [
  /^-{2,}\s*(forwarded message|mensaje reenviado|original message|mensaje original)\s*-{2,}\s*$/i,
  /^(el|on)\b.{5,200}(escribi[oó]|wrote)\s*:?\s*$/i,
  /^(de|from)\s*:.*@/i,
  /^-- ?$/
]

const SIGN_OFF = /^(un saludo|saludos|un abrazo|atentamente|cordialmente|gracias|muchas gracias|best regards|kind regards|regards|thanks|thank you|cheers)[,.!]?$/i

/** Quita el ruido tipico de la parte de texto de correos HTML: [image: x], [cid:x] y enlaces <http://...>. */
export function cleanBodyText(text: string): string {
  let t = text.replace(/\r\n?/g, '\n')
  t = t.replace(/\[(?:image|imagen|cid)\s*:[^\]]*\]\s*/gi, '')
  t = t.replace(/[ \t]*<(?:https?:\/\/|mailto:)[^>\s]*>/gi, '')
  t = t.replace(/^\s*<(?:https?:\/\/|mailto:)[^>\n]*$/gim, '')
  t = t.split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n')
  return t.replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Devuelve el texto propio del mensaje, sin el historial anidado (citas, reenviados, firma).
 * Si no queda nada (todo era un reenvio), devuelve el texto limpio completo.
 */
export function ownText(text: string): string {
  const clean = cleanBodyText(text)
  const lines = clean.split('\n')
  let end = lines.length
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l.startsWith('>') || NESTED_START.some((r) => r.test(l))) { end = i; break }
  }
  // Tras la despedida solo hay firma (telefonos, direccion, logos): no se cita.
  const kept = lines.slice(0, end)
  const sign = kept.findIndex((l) => SIGN_OFF.test(l.trim()))
  const own = (sign >= 0 ? kept.slice(0, sign + 1) : kept).join('\n').trim()
  return own || clean
}

/** Corta en limite de linea para que el texto codificado no pase de `max`; anade [...] si recorta. */
export function limitLines(text: string, max: number, enc: (s: string) => string = encodeURIComponent): string {
  if (enc(text).length <= max) return text
  const out: string[] = []
  let used = enc('\n[...]').length
  for (const line of text.split('\n')) {
    const n = enc(line + '\n').length
    if (used + n > max) break
    out.push(line)
    used += n
  }
  return out.join('\n').replace(/\s+$/, '') + '\n[...]'
}

const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "mar, 3 nov 2026 a las 11:21" */
export function replyDate(ms: number | null): string {
  if (ms === null) return ''
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} a las ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function replyBody(opts: { mode: 'reply' | 'forward'; text: string; who: string; date: number | null; subject: string; to: string; max: number }): string {
  const { mode, who, date, subject, max } = opts
  if (mode === 'forward') {
    const head = `\n\n---------- Mensaje reenviado ----------\nDe: ${who}\nFecha: ${replyDate(date)}\nAsunto: ${subject}\nPara: ${opts.to}\n\n`
    return head + limitLines(cleanBodyText(opts.text), max - encodeURIComponent(head).length)
  }
  const head = `\n\nEl ${replyDate(date)}, ${who} escribió:\n`
  const quoted = ownText(opts.text).split('\n').map((l) => (l ? '> ' + l : '>')).join('\n')
  return head + limitLines(quoted, max - encodeURIComponent(head).length)
}
