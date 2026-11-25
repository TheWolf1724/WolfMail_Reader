import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser'
import type { Address, NormalizedAttachment, NormalizedMessage } from '../types'
import { parseReferences } from '../threading'
import { stripTags } from '../library'

export interface ParseOptions {
  /** Carpeta por defecto para formatos que no tienen jerarquia (eml, msg, mbox). */
  defaultFolder: string
  signal?: AbortSignal
}

export function flattenAddresses(obj: AddressObject | AddressObject[] | undefined): Address[] {
  if (!obj) return []
  const list = Array.isArray(obj) ? obj : [obj]
  const out: Address[] = []
  for (const o of list) {
    for (const v of o.value) {
      if (v.group) {
        for (const g of v.group) out.push({ name: g.name ?? '', email: g.address ?? '' })
      } else if (v.address || v.name) out.push({ name: v.name ?? '', email: v.address ?? '' })
    }
  }
  return out
}

function headersToString(parsed: ParsedMail, raw: Buffer): string {
  const idx = raw.indexOf('\r\n\r\n')
  const idx2 = raw.indexOf('\n\n')
  const end = idx === -1 ? idx2 : idx2 === -1 ? idx : Math.min(idx, idx2)
  const head = end === -1 ? raw : raw.subarray(0, end)
  void parsed
  return head.toString('utf8').slice(0, 200_000)
}

const DATE_RE = /(?:[A-Za-z]{3},?\s+)?\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:[+-]\d{4}|[A-Z]{1,5}))?/

function validTime(s: string): number | null {
  const t = Date.parse(s)
  // Se descartan fechas absurdas (antes de 1970 o muy en el futuro): casi siempre son basura de cabecera.
  return Number.isNaN(t) || t < 0 || t > Date.now() + 366 * 864e5 ? null : t
}

/**
 * Fecha del mensaje a partir de las cabeceras en bruto. mailparser devuelve "ahora" cuando la cabecera
 * Date es ilegible, lo que mezclaria correos antiguos con los nuevos; aqui se prefiere no tener fecha.
 */
export function headerDate(headers: string): number | null {
  const unfolded = headers.replace(/\r?\n[ \t]+/g, ' ')
  const d = /^Date:[ \t]*(.*)$/im.exec(unfolded)
  if (d) {
    const whole = validTime(d[1].replace(/\([^)]*\)/g, '').trim())
    if (whole !== null) return whole
    const m = DATE_RE.exec(d[1].replace(/\([^)]*\)/g, ''))
    const first = m ? validTime(m[0]) : null
    if (first !== null) return first
  }
  // Ultimo recurso: fecha de recepcion de la cabecera Received mas antigua (la ultima de la lista).
  const rec = [...unfolded.matchAll(/^Received:.*;[ \t]*(.+)$/gim)]
  for (let i = rec.length - 1; i >= 0; i--) {
    const t = validTime(rec[i][1].replace(/\([^)]*\)/g, '').trim())
    if (t !== null) return t
  }
  return null
}

/** Convierte un mensaje RFC 822 en bruto en un mensaje normalizado. */
export async function parseRfc822(raw: Buffer, opts: ParseOptions, extra?: Partial<NormalizedMessage>): Promise<NormalizedMessage> {
  const p = await simpleParser(raw, { skipImageLinks: true, skipHtmlToText: true, skipTextToHtml: true, skipTextLinks: true })
  const attachments: NormalizedAttachment[] = p.attachments.map((a) => ({
    name: a.filename || (a.contentType.startsWith('message/') ? 'mensaje.eml' : 'adjunto'),
    mime: a.contentType || 'application/octet-stream',
    size: a.size,
    cid: a.cid ? a.cid.replace(/^<|>$/g, '') : null,
    inline: a.contentDisposition === 'inline' || (!!a.cid && a.related === true),
    data: a.content
  }))
  const from = flattenAddresses(p.from)[0] ?? null
  return {
    messageId: p.messageId ?? null,
    inReplyTo: p.inReplyTo ?? null,
    references: parseReferences(p.references),
    subject: p.subject ?? '',
    from,
    to: flattenAddresses(p.to),
    cc: flattenAddresses(p.cc),
    bcc: flattenAddresses(p.bcc),
    date: headerDate(headersToString(p, raw)),
    text: p.text ?? (typeof p.html === 'string' ? stripTags(p.html) : ''),
    html: typeof p.html === 'string' ? p.html : null,
    headers: headersToString(p, raw),
    attachments,
    folder: opts.defaultFolder,
    labels: [],
    unread: false,
    ...extra
  }
}
