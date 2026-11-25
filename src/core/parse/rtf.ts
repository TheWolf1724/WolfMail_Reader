// Outlook guarda a veces el cuerpo solo como RTF comprimido. Aqui se descomprime y se
// convierte a HTML (si el RTF encapsula HTML) o a texto plano.
import { decompressRTF } from '@kenjiuno/decompressrtf'

export function rtfFromCompressed(data: Uint8Array | number[]): string | null {
  try {
    const out = decompressRTF(Array.from(data))
    return Buffer.from(out).toString('latin1')
  } catch {
    return null
  }
}

// Grupos de RTF que no son texto del mensaje (fuentes, colores, estilos, imagenes...).
const SKIP_GROUPS = /^\\(fonttbl|colortbl|stylesheet|info|pict|object|latentstyles|listtable|listoverridetable|rsidtbl|generator|themedata|datastore|xmlnstbl|mmathPr|header|footer|fldinst)\b/

function decodeWin1252Byte(b: number): string {
  return Buffer.from([b]).toString('latin1')
}

/** Convierte RTF a texto plano o, si lleva HTML encapsulado (\fromhtml), a HTML. */
export function rtfToContent(rtf: string): { text: string; html: string | null } {
  const fromHtml = /\\fromhtml/.test(rtf.slice(0, 2000))
  const out: string[] = []
  const stack: { skip: boolean; htmlrtf: boolean }[] = []
  let skip = false
  let htmlrtf = false
  let i = 0
  const n = rtf.length
  while (i < n) {
    const c = rtf[i]
    if (c === '{') {
      stack.push({ skip, htmlrtf })
      i++
      // {\*\htmltag ...} en RTF encapsulado: su contenido es HTML real.
      if (fromHtml && rtf.startsWith('\\*\\htmltag', i)) {
        const m = /^\\\*\\htmltag\d*\s?/.exec(rtf.slice(i, i + 20))
        if (m) i += m[0].length
        skip = false
      } else if (rtf.startsWith('\\*', i) || SKIP_GROUPS.test(rtf.slice(i, i + 24))) skip = true
      continue
    }
    if (c === '}') {
      const s = stack.pop()
      if (s) { skip = s.skip; htmlrtf = s.htmlrtf }
      i++
      continue
    }
    if (c === '\\') {
      const next = rtf[i + 1]
      if (next === "'") {
        const hex = rtf.slice(i + 2, i + 4)
        if (!skip && !(fromHtml && htmlrtf)) out.push(decodeWin1252Byte(parseInt(hex, 16)))
        i += 4
        continue
      }
      if (next === '\\' || next === '{' || next === '}') {
        if (!skip && !(fromHtml && htmlrtf)) out.push(next)
        i += 2
        continue
      }
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(rtf.slice(i, i + 40))
      if (!m) { i += 2; continue }
      const word = m[1]
      const arg = m[2] === undefined ? null : parseInt(m[2], 10)
      i += m[0].length
      if (word === 'htmlrtf') htmlrtf = arg !== 0
      else if (!skip && !(fromHtml && htmlrtf)) {
        if (word === 'par' || word === 'line') out.push(fromHtml ? '' : '\n')
        else if (word === 'tab') out.push(fromHtml ? '' : '\t')
        else if (word === 'u' && arg !== null) {
          out.push(String.fromCodePoint(arg < 0 ? arg + 65536 : arg))
          if (rtf[i] === '?') i++
        }
      }
      continue
    }
    if (c === '\r' || c === '\n') { i++; continue }
    if (!skip && !(fromHtml && htmlrtf)) out.push(c)
    i++
  }
  const body = out.join('')
  if (fromHtml) {
    return { text: htmlToPlain(body), html: body }
  }
  return { text: body.replace(/[ \t]+\n/g, '\n').trim(), html: null }
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
