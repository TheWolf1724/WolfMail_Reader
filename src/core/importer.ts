import { basename, dirname, extname, relative, sep } from 'node:path'
import { stat } from 'node:fs/promises'
import type { Library } from './library'
import type { ImportProgress, NormalizedMessage } from './types'
import { detectKind, findMailFiles, parseFile } from './parse'

export interface ImportOptions {
  jobId?: number
  signal?: AbortSignal
  onProgress?: (p: ImportProgress) => void
}

const BATCH = 100
/** Tope de bytes de adjuntos acumulados antes de guardar un lote (evita agotar la memoria). */
const BATCH_BYTES = 48 * 1024 * 1024

function folderFor(file: string, root: string | null, kind: string): string {
  const stem = basename(file, extname(file))
  if (root) {
    const rel = relative(root, dirname(file))
    const dirPart = rel ? rel.split(sep).join('/') : basename(root)
    return kind === 'mbox' ? `${dirPart}/${stem}` : dirPart
  }
  return kind === 'mbox' ? stem : basename(dirname(file)) || 'Mensajes'
}

/** Importa ficheros o carpetas a la biblioteca. Devuelve el resumen final. */
export async function importPaths(lib: Library, paths: string[], opts: ImportOptions = {}): Promise<ImportProgress> {
  const jobId = opts.jobId ?? 0
  const state: ImportProgress = { jobId, file: '', phase: 'leyendo', processed: 0, added: 0, duplicates: 0, failed: 0 }
  const emit = (): void => opts.onProgress?.({ ...state })
  let lastEmit = 0
  const tick = (force = false): void => {
    const now = Date.now()
    if (force || now - lastEmit > 150) { lastEmit = now; emit() }
  }

  for (const p of paths) {
    if (opts.signal?.aborted) break
    let isDir = false
    try { isDir = (await stat(p)).isDirectory() } catch (e) {
      state.failed++
      state.message = `No se puede leer ${basename(p)}: ${(e as Error).message}`
      continue
    }
    const files: string[] = []
    if (isDir) for await (const f of findMailFiles(p)) files.push(f)
    else files.push(p)
    if (!files.length) {
      state.message = `La carpeta ${basename(p)} no contiene ficheros de correo compatibles.`
      continue
    }
    let sourceKind: 'folder' | Awaited<ReturnType<typeof detectKind>> = 'folder'
    if (!isDir) {
      sourceKind = await detectKind(p)
      if (!sourceKind) { state.failed++; state.message = `Formato no reconocido: ${basename(p)}`; continue }
    }
    const sourceId = lib.addSource(sourceKind as never, basename(p), p)

    for (const file of files) {
      if (opts.signal?.aborted) break
      state.file = basename(file)
      state.phase = 'leyendo'
      tick(true)
      const kind = await detectKind(file).catch(() => null)
      if (!kind) { state.failed++; continue }
      const gen = parseFile(file, { defaultFolder: folderFor(file, isDir ? p : null, kind), signal: opts.signal })
      let pending: NormalizedMessage[] = []
      let pendingBytes = 0
      const flush = (): void => {
        if (!pending.length) return
        state.phase = 'guardando'
        lib.transaction(() => {
          for (const m of pending) {
            try {
              const r = lib.addMessage(sourceId, m)
              if (r.status === 'added') state.added++
              else state.duplicates++
            } catch { state.failed++ }
          }
        })
        pending = []
        pendingBytes = 0
        state.phase = 'leyendo'
      }
      try {
        for await (const m of gen) {
          pending.push(m)
          pendingBytes += m.attachments.reduce((n, a) => n + a.data.byteLength, 0)
          state.processed++
          if (pending.length >= BATCH || pendingBytes >= BATCH_BYTES) flush()
          tick()
          if (opts.signal?.aborted) break
        }
        flush()
      } catch (e) {
        flush()
        state.failed++
        state.message = `Error en ${basename(file)}: ${(e as Error).message}`
      }
    }
  }
  state.phase = opts.signal?.aborted ? 'cancelado' : 'terminado'
  tick(true)
  return { ...state }
}
