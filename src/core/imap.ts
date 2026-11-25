// Sincronizacion de solo lectura por IMAP (Gmail, Outlook y servidores genericos).
// Nunca se modifican ni se borran mensajes en el servidor: los buzones se abren en modo lectura.
import { ImapFlow, type ListResponse } from 'imapflow'
import type { Library } from './library'
import type { ImportProgress } from './types'
import { parseRfc822 } from './parse/common'

export interface ImapAccount {
  id: string
  label: string
  host: string
  port: number
  secure: boolean
  user: string
  auth: { kind: 'password'; password: string } | { kind: 'oauth'; accessToken: string }
}

export interface SyncOptions {
  jobId?: number
  signal?: AbortSignal
  onProgress?: (p: ImportProgress) => void
  /** Maximo de mensajes por carpeta en esta pasada (0 = sin limite). */
  limitPerFolder?: number
}

const SKIP_USE = new Set(['\\Flagged', '\\Important'])
const BATCH = 40

function metaKey(accountId: string, folder: string): string {
  return `imap:${accountId}:${folder}`
}

function getMeta(lib: Library, key: string): { validity: string; lastUid: number } | null {
  const r = lib.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
  return r ? JSON.parse(r.value) : null
}

function setMeta(lib: Library, key: string, v: { validity: string; lastUid: number }): void {
  lib.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(v))
}

export function orderMailboxes(list: Pick<ListResponse, 'path' | 'flags' | 'specialUse'>[]): typeof list {
  const usable = list.filter((m) => !m.flags?.has('\\Noselect') && !m.flags?.has('\\NonExistent') && !(m.specialUse && SKIP_USE.has(m.specialUse)))
  // "Todos" va al final: asi cada mensaje conserva primero su carpeta mas especifica.
  return [...usable].sort((a, b) => Number(a.specialUse === '\\All') - Number(b.specialUse === '\\All'))
}

export async function syncImap(lib: Library, acc: ImapAccount, opts: SyncOptions = {}): Promise<ImportProgress> {
  const state: ImportProgress = { jobId: opts.jobId ?? 0, file: acc.label, phase: 'leyendo', processed: 0, added: 0, duplicates: 0, failed: 0 }
  const emit = (): void => opts.onProgress?.({ ...state })
  const client = new ImapFlow({
    host: acc.host, port: acc.port, secure: acc.secure, logger: false,
    auth: acc.auth.kind === 'oauth' ? { user: acc.user, accessToken: acc.auth.accessToken } : { user: acc.user, pass: acc.auth.password }
  })
  client.on('error', () => { /* se informa al fallar la operacion en curso */ })
  const sourceId = lib.addSource('imap', acc.label, `imap://${acc.user}@${acc.host}`)
  try {
    await client.connect()
    const boxes = orderMailboxes(await client.list())
    for (const box of boxes) {
      if (opts.signal?.aborted) break
      const lock = await client.getMailboxLock(box.path, { readOnly: true })
      try {
        const mb = client.mailbox
        if (!mb || typeof mb === 'boolean') continue
        const key = metaKey(acc.id, box.path)
        const prev = getMeta(lib, key)
        const validity = String(mb.uidValidity)
        let from = prev && prev.validity === validity ? prev.lastUid + 1 : 1
        if (!mb.exists) { setMeta(lib, key, { validity, lastUid: prev?.validity === validity ? prev.lastUid : 0 }); continue }
        const uids = ((await client.search({ uid: `${from}:*` }, { uid: true })) || []).filter((u) => u >= from).sort((a, b) => a - b)
        const todo = opts.limitPerFolder ? uids.slice(-opts.limitPerFolder) : uids
        state.file = `${acc.label}: ${box.path}`
        emit()
        for (let i = 0; i < todo.length; i += BATCH) {
          if (opts.signal?.aborted) break
          const chunk = todo.slice(i, i + BATCH)
          const parsed: Awaited<ReturnType<typeof parseRfc822>>[] = []
          for await (const msg of client.fetch(chunk.join(','), { uid: true, source: true, flags: true }, { uid: true })) {
            try {
              if (!msg.source) continue
              parsed.push(await parseRfc822(msg.source, { defaultFolder: box.path }, { unread: !msg.flags?.has('\\Seen'), folder: box.path }))
            } catch { state.failed++ }
            state.processed++
          }
          state.phase = 'guardando'
          lib.transaction(() => {
            for (const m of parsed) {
              try {
                const r = lib.addMessage(sourceId, m)
                if (r.status === 'added') state.added++
                else state.duplicates++
              } catch { state.failed++ }
            }
          })
          state.phase = 'leyendo'
          setMeta(lib, key, { validity, lastUid: chunk[chunk.length - 1] })
          emit()
        }
      } finally {
        lock.release()
      }
    }
    state.phase = opts.signal?.aborted ? 'cancelado' : 'terminado'
  } catch (e) {
    state.phase = 'error'
    state.message = (e as Error).message
  } finally {
    await client.logout().catch(() => client.close())
  }
  emit()
  return { ...state }
}
