import { open, stat, readdir } from 'node:fs/promises'
import { basename, extname, join, relative, dirname } from 'node:path'
import type { NormalizedMessage, SourceKind } from '../types'
import type { ParseOptions } from './common'
import { parseEml, parseEmlx } from './eml'
import { parseMbox } from './mbox'
import { parseMsg } from './msg'
import { parsePst } from './pst'

export type { ParseOptions } from './common'

export const SUPPORTED_EXTENSIONS = ['.eml', '.emlx', '.msg', '.oft', '.mbox', '.mbx', '.pst', '.ost'] as const

const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

/** Detecta el formato por contenido (firma) y, si no basta, por extension. */
export async function detectKind(path: string): Promise<Exclude<SourceKind, 'folder' | 'imap'> | null> {
  const ext = extname(path).toLowerCase()
  const fh = await open(path, 'r')
  try {
    const head = Buffer.alloc(16)
    const { bytesRead } = await fh.read(head, 0, 16, 0)
    const h = head.subarray(0, bytesRead)
    if (h.subarray(0, 4).toString('latin1') === '!BDN') return 'pst'
    if (CFB_MAGIC.every((b, i) => h[i] === b)) return 'msg'
    if (h.subarray(0, 5).toString('latin1') === 'From ') return 'mbox'
  } finally {
    await fh.close()
  }
  if (ext === '.eml' || ext === '.emlx') return 'eml'
  if (ext === '.mbox' || ext === '.mbx') return 'mbox'
  // .msg y .pst exigen su firma binaria: una extension sin firma es un fichero danado o de otro tipo.
  return null
}

export async function* parseFile(path: string, opts: ParseOptions): AsyncGenerator<NormalizedMessage> {
  const kind = await detectKind(path)
  if (!kind) throw new Error(`Formato no reconocido: ${basename(path)}`)
  if (extname(path).toLowerCase() === '.emlx') return yield* parseEmlx(path, opts)
  switch (kind) {
    case 'eml': return yield* parseEml(path, opts)
    case 'msg': return yield* parseMsg(path, opts)
    case 'mbox': return yield* parseMbox(path, opts)
    case 'pst': return yield* parsePst(path, opts)
  }
}

/** Recorre una carpeta y devuelve los ficheros de correo que contiene. */
export async function* findMailFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name))
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* findMailFiles(p)
    else if (e.isFile() && (SUPPORTED_EXTENSIONS as readonly string[]).includes(extname(e.name).toLowerCase())) yield p
  }
}

export async function isDirectory(p: string): Promise<boolean> {
  return (await stat(p)).isDirectory()
}

export { relative, dirname }
