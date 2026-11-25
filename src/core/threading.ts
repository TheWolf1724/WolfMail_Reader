// Utilidades de agrupacion en conversaciones.

const PREFIX = /^\s*((re|rv|fw|fwd|enc|r|aw|wg|sv|vs|tr)\s*(\[\d+\])?\s*:\s*)+/i

export function normalizeSubject(subject: string): string {
  return subject.replace(PREFIX, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export function cleanMessageId(id: string | null | undefined): string | null {
  if (!id) return null
  const m = id.match(/<([^<>\s]+)>/)
  const v = (m ? m[1] : id).trim()
  return v ? v.toLowerCase() : null
}

export function parseReferences(value: string | string[] | null | undefined): string[] {
  if (!value) return []
  const text = Array.isArray(value) ? value.join(' ') : value
  const found = text.match(/<[^<>\s]+>/g) ?? []
  return found.map((x) => cleanMessageId(x)).filter((x): x is string => !!x)
}
