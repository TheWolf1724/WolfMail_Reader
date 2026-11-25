// Proceso auxiliar: importa ficheros y sincroniza cuentas sin bloquear la interfaz.
import { Library } from '../core/library'
import { importPaths } from '../core/importer'
import { syncImap, type ImapAccount } from '../core/imap'
import type { ImportProgress } from '../core/types'

type Msg =
  | { type: 'import'; jobId: number; dir: string; paths: string[] }
  | { type: 'sync'; jobId: number; dir: string; account: ImapAccount }
  | { type: 'cancel' }

const port = (process as unknown as { parentPort: { on(e: 'message', cb: (m: { data: Msg }) => void): void; postMessage(m: unknown): void } }).parentPort
let ac: AbortController | null = null
const send = (p: ImportProgress): void => port.postMessage({ type: 'progress', progress: p })

port.on('message', async ({ data }) => {
  if (data.type === 'cancel') { ac?.abort(); return }
  ac = new AbortController()
  const lib = new Library(data.dir)
  try {
    const r = data.type === 'import'
      ? await importPaths(lib, data.paths, { jobId: data.jobId, signal: ac.signal, onProgress: send })
      : await syncImap(lib, data.account, { jobId: data.jobId, signal: ac.signal, onProgress: send })
    port.postMessage({ type: 'done', result: r })
  } catch (e) {
    port.postMessage({ type: 'done', result: { jobId: data.jobId, file: '', phase: 'error', processed: 0, added: 0, duplicates: 0, failed: 1, message: (e as Error).message } })
  } finally {
    lib.close()
    ac = null
  }
})
