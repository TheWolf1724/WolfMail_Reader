import { PSTFile, PSTFolder, PSTMessage, PSTAttachment } from 'pst-extractor'
import type { Address, NormalizedAttachment, NormalizedMessage } from '../types'
import { cleanMessageId, parseReferences } from '../threading'
import { parseRfc822, type ParseOptions } from './common'
import { rtfFromCompressed, rtfToContent } from './rtf'

const CHUNK = 8176

function readAttachment(att: PSTAttachment): NormalizedAttachment | null {
  const stream = att.fileInputStream
  if (!stream) return null
  const parts: Buffer[] = []
  const buf = Buffer.alloc(CHUNK)
  let total = 0
  const expected = att.filesize || 0
  for (;;) {
    const n = stream.read(buf)
    if (n <= 0) break
    parts.push(Buffer.from(buf.subarray(0, n)))
    total += n
    if (n < CHUNK || (expected && total >= expected)) break
  }
  const data = Buffer.concat(parts)
  const cid = att.contentId ? att.contentId.replace(/^<|>$/g, '') : null
  return {
    name: att.longFilename || att.filename || att.displayName || 'adjunto',
    mime: att.mimeTag || 'application/octet-stream',
    size: data.byteLength, cid, inline: !!cid, data
  }
}

async function convert(m: PSTMessage, folderPath: string, opts: ParseOptions): Promise<NormalizedMessage> {
  const to: Address[] = [], cc: Address[] = [], bcc: Address[] = []
  for (let i = 0; i < m.numberOfRecipients; i++) {
    const r = m.getRecipient(i)
    if (!r) continue
    const email = r.smtpAddress || (r.emailAddress?.includes('@') ? r.emailAddress : r.emailAddress)
    const a = { name: r.displayName && r.displayName !== email ? r.displayName : '', email: email ?? '' }
    if (r.recipientType === 2) cc.push(a)
    else if (r.recipientType === 3) bcc.push(a)
    else to.push(a)
  }
  const headers = m.transportMessageHeaders ?? ''
  let from: Address | null = null
  let messageId: string | null = m.internetMessageId || null
  let inReplyTo: string | null = m.inReplyToId || null
  let references: string[] = []
  let date: number | null = (m.clientSubmitTime ?? m.messageDeliveryTime)?.getTime() ?? null
  if (headers.trim()) {
    try {
      const p = await parseRfc822(Buffer.from(headers + '\r\n\r\n', 'utf8'), opts)
      if (p.from?.email) from = p.from
      messageId = p.messageId ?? messageId
      inReplyTo = p.inReplyTo ?? inReplyTo
      references = p.references
      date = date ?? p.date
      if (!to.length) to.push(...p.to)
      if (!cc.length) cc.push(...p.cc)
    } catch { /* se usan los campos MAPI */ }
  }
  if (!from) {
    const e = m.senderEmailAddress
    from = { name: m.senderName && m.senderName !== e ? m.senderName : '', email: e?.includes('@') ? e : (m.senderName || e || '') }
    if (!from.email && !from.name) from = null
  }
  let text = m.body ?? ''
  let html: string | null = m.bodyHTML || null
  if (!html && !text.trim()) {
    const rtfRaw = m.bodyRTF
    if (rtfRaw) {
      const c = rtfToContent(rtfRaw)
      text = c.text
      html = c.html
    }
  }
  const attachments: NormalizedAttachment[] = []
  for (let i = 0; i < m.numberOfAttachments; i++) {
    try {
      const a = readAttachment(m.getAttachment(i))
      if (a) attachments.push(a)
    } catch { /* adjunto danado: se omite */ }
  }
  void rtfFromCompressed
  const f = (a: Address): string => (a.name ? `${a.name} <${a.email}>` : a.email)
  return {
    messageId, inReplyTo, references: references.length ? references : parseReferences(null),
    subject: m.subject ?? '', from, to, cc, bcc, date, text, html,
    headers: headers || [
      from ? `From: ${f(from)}` : '', to.length ? `To: ${to.map(f).join(', ')}` : '', `Subject: ${m.subject ?? ''}`,
      date ? `Date: ${new Date(date).toUTCString()}` : '', '(Mensaje de PST/OST sin cabeceras de transporte.)'
    ].filter(Boolean).join('\r\n'),
    attachments, folder: folderPath, labels: [], unread: !m.isRead
  }
}

function* walk(folder: PSTFolder, path: string[]): Generator<{ folder: PSTFolder; path: string }> {
  yield { folder, path: path.join('/') }
  if (folder.hasSubfolders) {
    for (const sub of folder.getSubFolders()) {
      yield* walk(sub, [...path, (sub.displayName || 'Carpeta').replace(/\//g, '-')])
    }
  }
}

const isMail = (cls: string | undefined): boolean => !cls || /^(IPM\.Note|IPM\.Post|REPORT|IPM\.Schedule\.Meeting)/i.test(cls) || cls === 'IPM'

export async function* parsePst(path: string, opts: ParseOptions): AsyncGenerator<NormalizedMessage> {
  const pst = new PSTFile(path)
  try {
    const root = pst.getRootFolder()
    for (const { folder, path: fpath } of walk(root, [])) {
      if (opts.signal?.aborted) return
      if (folder.contentCount <= 0) continue
      const label = fpath || opts.defaultFolder
      let child: unknown = folder.getNextChild()
      while (child) {
        if (opts.signal?.aborted) return
        if (child instanceof PSTMessage) {
          if (isMail(child.messageClass)) {
            try { yield await convert(child, label, opts) } catch { /* mensaje ilegible: se salta */ }
          }
        }
        child = folder.getNextChild()
      }
    }
  } finally {
    pst.close()
  }
}

export { cleanMessageId }
