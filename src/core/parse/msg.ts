import { readFile } from 'node:fs/promises'
import MsgReaderModule from '@kenjiuno/msgreader'
import type { FieldsData } from '@kenjiuno/msgreader'
import type { Address, NormalizedAttachment, NormalizedMessage } from '../types'
import { parseReferences } from '../threading'
import { parseRfc822, flattenAddresses, type ParseOptions } from './common'
import { rtfFromCompressed, rtfToContent } from './rtf'

// El paquete exporta la clase como default (CommonJS/ESM segun el empaquetador).
const MsgReader: typeof MsgReaderModule =
  (MsgReaderModule as unknown as { default?: typeof MsgReaderModule }).default ?? MsgReaderModule

const time = (s: string | undefined): number | null => {
  if (!s) return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}

function addr(name: string | undefined, email: string | undefined): Address {
  return { name: name && name !== email ? name : '', email: email ?? '' }
}

export function parseMsgBuffer(buf: Buffer, opts: ParseOptions, depth = 0): Promise<NormalizedMessage> {
  const reader = new MsgReader(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
  return convert(reader, reader.getFileData(), opts, depth)
}

async function convert(reader: InstanceType<typeof MsgReader>, d: FieldsData, opts: ParseOptions, depth: number): Promise<NormalizedMessage> {
  let from: Address | null = null
  let to: Address[] = []
  let cc: Address[] = []
  let bcc: Address[] = []
  let date = time(d.clientSubmitTime) ?? time(d.messageDeliveryTime) ?? time(d.creationTime)
  let messageId = d.messageId ?? null
  let inReplyTo: string | null = null
  let references: string[] = []
  const headers = d.headers ?? ''

  // Si el .msg trae cabeceras de transporte, son la fuente mas fiable de direcciones SMTP e hilos.
  let fromHeaders = false
  if (headers.trim()) {
    try {
      const p = await parseRfc822(Buffer.from(headers + '\r\n\r\n', 'utf8'), opts)
      if (p.from?.email) { from = p.from; fromHeaders = true }
      if (p.to.length) to = p.to
      if (p.cc.length) cc = p.cc
      messageId = p.messageId ?? messageId
      inReplyTo = p.inReplyTo
      references = p.references
      date = date ?? p.date
    } catch { /* cabeceras ilegibles: se usan los campos MAPI */ }
  }
  if (!fromHeaders) {
    const email = d.senderSmtpAddress || (d.senderAddressType === 'SMTP' ? d.senderEmail : '') || (d.senderEmail?.includes('@') ? d.senderEmail : '')
    if (email || d.senderName) from = addr(d.senderName, email || d.senderEmail)
  }
  if (!to.length || (!cc.length && !bcc.length)) {
    const t: Address[] = [], c: Address[] = [], b: Address[] = []
    for (const r of d.recipients ?? []) {
      const a = addr(r.name, r.smtpAddress || (r.email?.includes('@') ? r.email : r.email))
      if (r.recipType === 'cc') c.push(a)
      else if (r.recipType === 'bcc') b.push(a)
      else t.push(a)
    }
    if (!to.length) to = t
    if (!cc.length) cc = c
    bcc = b
  }

  let text = d.body ?? ''
  let html: string | null = null
  if (d.html && d.html.length) html = Buffer.from(d.html).toString('utf8')
  else if (d.bodyHtml) html = d.bodyHtml
  // Cuerpo solo en RTF comprimido.
  if (!html && (!text.trim()) && d.compressedRtf) {
    const rtf = rtfFromCompressed(d.compressedRtf)
    if (rtf) {
      const c = rtfToContent(rtf)
      text = c.text
      html = c.html
    }
  }

  const attachments: NormalizedAttachment[] = []
  for (const att of d.attachments ?? []) {
    try {
      if (att.innerMsgContent && depth < 5) {
        const inner = reader.getAttachment(att)
        const nested = await parseMsgBuffer(Buffer.from(inner.content), opts, depth + 1)
        attachments.push({
          name: (att.fileName || nested.subject || 'mensaje') + (/\.msg$/i.test(att.fileName ?? '') ? '' : '.msg'),
          mime: 'application/vnd.ms-outlook', size: inner.content.byteLength, cid: null, inline: false, data: inner.content
        })
        continue
      }
      const a = reader.getAttachment(att)
      const cid = att.pidContentId ? String(att.pidContentId).replace(/^<|>$/g, '') : null
      attachments.push({
        name: a.fileName || att.fileName || att.fileNameShort || 'adjunto',
        mime: att.attachMimeTag || 'application/octet-stream',
        size: a.content.byteLength, cid, inline: !!cid && !!att.attachmentHidden, data: a.content
      })
    } catch { /* adjunto danado: se omite sin perder el mensaje */ }
  }

  return {
    messageId, inReplyTo, references: references.length ? references : parseReferences(null),
    subject: d.subject ?? d.normalizedSubject ?? '',
    from, to, cc, bcc, date, text, html,
    headers: headers || syntheticHeaders(d, from, to, date),
    attachments, folder: opts.defaultFolder, labels: [],
    unread: false
  }
}

function syntheticHeaders(d: FieldsData, from: Address | null, to: Address[], date: number | null): string {
  const f = (a: Address): string => (a.name ? `${a.name} <${a.email}>` : a.email)
  return [
    from ? `From: ${f(from)}` : '',
    to.length ? `To: ${to.map(f).join(', ')}` : '',
    `Subject: ${d.subject ?? ''}`,
    date ? `Date: ${new Date(date).toUTCString()}` : '',
    '(Este mensaje .msg no conserva las cabeceras de transporte originales.)'
  ].filter(Boolean).join('\r\n')
}

export async function* parseMsg(path: string, opts: ParseOptions): AsyncGenerator<NormalizedMessage> {
  yield await parseMsgBuffer(await readFile(path), opts)
}

// Reexportado para pruebas.
export { flattenAddresses }
