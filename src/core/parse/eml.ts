import { readFile } from 'node:fs/promises'
import type { NormalizedMessage } from '../types'
import { parseRfc822, type ParseOptions } from './common'

export async function* parseEml(path: string, opts: ParseOptions): AsyncGenerator<NormalizedMessage> {
  const raw = await readFile(path)
  yield await parseRfc822(raw, opts)
}

/** Apple Mail (.emlx): primera linea con la longitud, despues el mensaje y un plist final. */
export async function* parseEmlx(path: string, opts: ParseOptions): AsyncGenerator<NormalizedMessage> {
  const raw = await readFile(path)
  const nl = raw.indexOf(0x0a)
  const len = parseInt(raw.subarray(0, nl).toString('ascii').trim(), 10)
  const body = Number.isFinite(len) && len > 0 ? raw.subarray(nl + 1, nl + 1 + len) : raw.subarray(nl + 1)
  yield await parseRfc822(body, opts)
}
