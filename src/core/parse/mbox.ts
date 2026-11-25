import { createReadStream } from 'node:fs'
import type { NormalizedMessage } from '../types'
import { parseRfc822, type ParseOptions } from './common'

const FROM_LINE = /^From \S+.*\d{2}:\d{2}(:\d{2})?\s.*$|^From \S+ .+\d{4}\s*$/

/** Divide un fichero mbox en mensajes en bruto, en streaming (soporta ficheros de varios GB). */
export async function* splitMbox(path: string, signal?: AbortSignal): AsyncGenerator<Buffer> {
  const stream = createReadStream(path, { highWaterMark: 1 << 20 })
  let carry = ''
  let current: string[] = []
  let prevBlank = true
  let started = false
  const flush = (): Buffer | null => {
    if (!current.length) return null
    // Se quita el salto de linea de separacion que anade mbox y se deshace el escape ">From ".
    const buf = Buffer.from(current.join('\n').replace(/\n+$/, '') + '\n', 'latin1')
    current = []
    return buf
  }
  for await (const chunk of stream) {
    if (signal?.aborted) { stream.destroy(); return }
    const text = carry + (chunk as Buffer).toString('latin1')
    const lines = text.split('\n')
    carry = lines.pop() ?? ''
    for (let line of lines) {
      if (line.endsWith('\r')) line = line.slice(0, -1)
      if (prevBlank && line.startsWith('From ') && FROM_LINE.test(line)) {
        const m = started ? flush() : null
        started = true
        if (m) yield m
        prevBlank = false
        continue
      }
      if (/^>+From /.test(line)) line = line.slice(1)
      prevBlank = line === ''
      if (started) current.push(line)
      else if (line !== '') {
        // Fichero sin linea "From " inicial: se trata como un solo mensaje.
        started = true
        current.push(line)
      }
    }
  }
  if (carry) current.push(carry.endsWith('\r') ? carry.slice(0, -1) : carry)
  const last = flush()
  if (last) yield last
}

const UNREAD_LABELS = /^(unread|no le[ií]do|sin leer)$/i
const MAILBOXES = /^(inbox|recibidos|bandeja de entrada|sent|enviados|drafts|borradores|spam|trash|papelera|archived|archivados)$/i
const SYSTEM_LABELS = /^(destacados|starred|important|importante|categor[ií]a|category|opened|abierto|chat|chats|unread|no le[ií]do|sin leer)/i

export async function* parseMbox(path: string, opts: ParseOptions): AsyncGenerator<NormalizedMessage> {
  for await (const raw of splitMbox(path, opts.signal)) {
    const msg = await parseRfc822(raw, opts)
    // Gmail Takeout: etiquetas en X-Gmail-Labels.
    const m = /^X-Gmail-Labels:\s*((?:.*\r?\n(?:[ \t].*\r?\n)*))/im.exec(msg.headers + '\n')
    if (m) {
      const labels = m[1].replace(/\r?\n[ \t]+/g, '').trim().split(',').map((s) => s.trim()).filter(Boolean)
      msg.labels = labels
      msg.unread = labels.some((l) => UNREAD_LABELS.test(l))
      // Una carpeta por mensaje: primero los buzones estandar, despues la primera etiqueta propia.
      const folder = labels.find((l) => MAILBOXES.test(l)) ?? labels.find((l) => !SYSTEM_LABELS.test(l)) ?? labels[0]
      if (folder) msg.folder = `${opts.defaultFolder}/${folder.replace(/\//g, '-')}`
    } else {
      const st = /^Status:\s*(\S*)/im.exec(msg.headers)
      if (st && !st[1].includes('R')) msg.unread = true
    }
    yield msg
  }
}
