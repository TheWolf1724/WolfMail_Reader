import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser'
import type { Address, NormalizedAttachment, NormalizedMessage } from '../types'
import { parseReferences } from '../threading'

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

/** Convierte un mensaje RFC 822 en bruto en un mensaje normalizado. */
export async function parseRfc822(raw: Buffer, opts: ParseOptions, extra?: Partial<NormalizedMessage>): Promise<NormalizedMessage> {
  const p = await simpleParser(raw, { skipImageLinks: true, skipHtmlToText: false, skipTextToHtml: true, skipTextLinks: true })
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
    date: p.date && !Number.isNaN(p.date.getTime()) ? p.date.getTime() : null,
    text: p.text ?? '',
    html: typeof p.html === 'string' ? p.html : null,
    headers: headersToString(p, raw),
    attachments,
    folder: opts.defaultFolder,
    labels: [],
    unread: false,
    ...extra
  }
}
