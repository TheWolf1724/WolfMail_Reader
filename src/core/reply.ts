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

/** Une las lineas partidas a ~76 columnas por el texto plano de los correos HTML ("...Proyecto\nActualizado."). */
export function unwrap(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]
    while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/^\s*(>|[-*•]|\d+[.)]|-{2,})/.test(lines[i + 1])) {
      const cur = l.trimEnd()
      const next = lines[i + 1].trim()
      if (/<$/.test(cur)) { l = cur + next; i++; continue } // "Nombre <\ncorreo@x>"
      const wrapped = cur.length >= 58 && cur.length <= 80 && !/^[\wÁÉÍÓÚÑáéíóúñ ]{1,20}:\s/.test(next)
      const cont = cur.length >= 58 && /^[a-záéíóúñ]/.test(next) // sigue en minuscula: continuacion
      if (!/[.:;!?)\]>]$/.test(cur) && (wrapped || cont)) { l = cur + ' ' + next; i++ } else break
    }
    out.push(l)
  }
  return out.join('\n')
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

export interface ReplyResult {
  body: string
  /** Texto completo (sin recortar) para el portapapeles cuando el enlace no admite tanto. */
  full: string
  truncated: boolean
}

type HeadOpts = { mode: 'reply' | 'forward'; who: string; date: number | null; subject: string; to: string }

/** Cabecera de la cita: "El ... escribió:" o el bloque de mensaje reenviado. */
export function quoteHead(o: HeadOpts): string {
  return o.mode === 'forward'
    ? `---------- Mensaje reenviado ----------\nDe: ${o.who}\nFecha: ${replyDate(o.date)}\nAsunto: ${o.subject}\nPara: ${o.to}\n`
    : `El ${replyDate(o.date)}, ${o.who} escribió:`
}

export function replyBody(opts: { mode: 'reply' | 'forward'; text: string; who: string; date: number | null; subject: string; to: string; max: number }): ReplyResult {
  const { mode, who, date, subject, max } = opts
  const clean = unwrap(cleanBodyText(opts.text))
  const head = '\n\n' + quoteHead({ mode, who, date, subject, to: opts.to }) + '\n' + (mode === 'forward' ? '\n' : '')
  const content = mode === 'forward' ? clean : clean.split('\n').map((l) => (l ? '> ' + l : '>')).join('\n')
  const room = max - encodeURIComponent(head).length
  const limited = limitLines(content, room)
  return { body: head + limited, full: (head + content).replace(/^\n+/, ''), truncated: limited !== content }
}
