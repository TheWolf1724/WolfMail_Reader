// Interpreta la sintaxis de busqueda del usuario y la traduce a SQL parametrizado.
//
// Operadores: de:, para:, asunto:, adjunto:, carpeta:, antes:, despues:, tiene:adjunto, es:noleido
// Cualquier otro termino se busca en asunto, remitente, destinatarios y cuerpo (FTS5).
// Las comillas dobles agrupan frases. Un guion delante excluye el termino.

export interface ParsedQuery {
  fts: string[] // expresiones FTS5 ya escapadas
  ftsNot: string[]
  from: string[]
  to: string[]
  subject: string[]
  attachment: string[]
  folder: string[]
  label: string[]
  before: number | null
  after: number | null
  hasAttachment: boolean
  unread: boolean
}

const OPERATORS = new Set([
  'de', 'from', 'para', 'to', 'asunto', 'subject', 'adjunto', 'attachment',
  'carpeta', 'folder', 'etiqueta', 'label', 'antes', 'before', 'despues', 'after', 'tiene', 'has', 'es', 'is'
])

export function tokenize(input: string): string[] {
  const tokens: string[] = []
  const re = /(-?[\p{L}]+:)?"([^"]*)"|(\S+)/gu
  let m: RegExpExecArray | null
  while ((m = re.exec(input))) {
    if (m[3] !== undefined) tokens.push(m[3])
    else tokens.push(`${m[1] ?? ''}"${m[2]}"`)
  }
  return tokens
}

function unquote(v: string): string {
  return v.replace(/^"(.*)"$/, '$1')
}

export function ftsEscape(term: string): string {
  const clean = term.replace(/"/g, '""')
  return `"${clean}"`
}

function parseDate(v: string): number | null {
  const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return null
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3])
  return Number.isNaN(t) ? null : t
}

export function parseQuery(input: string): ParsedQuery {
  const q: ParsedQuery = {
    fts: [], ftsNot: [], from: [], to: [], subject: [], attachment: [], folder: [], label: [],
    before: null, after: null, hasAttachment: false, unread: false
  }
  for (const tok of tokenize(input.trim())) {
    const neg = tok.startsWith('-') && tok.length > 1
    const body = neg ? tok.slice(1) : tok
    const op = body.match(/^([\p{L}]+):(.*)$/su)
    if (op && OPERATORS.has(op[1].toLowerCase())) {
      const key = op[1].toLowerCase()
      const val = unquote(op[2])
      if (!val) continue
      switch (key) {
        case 'de': case 'from': q.from.push(val); break
        case 'para': case 'to': q.to.push(val); break
        case 'asunto': case 'subject': q.subject.push(val); break
        case 'adjunto': case 'attachment': q.attachment.push(val); break
        case 'carpeta': case 'folder': q.folder.push(val); break
        case 'etiqueta': case 'label': q.label.push(val); break
        case 'antes': case 'before': q.before = parseDate(val) ?? q.before; break
        case 'despues': case 'after': q.after = parseDate(val) ?? q.after; break
        case 'tiene': case 'has':
          if (/^(adjunto|adjuntos|attachment|attachments)$/i.test(val)) q.hasAttachment = true
          break
        case 'es': case 'is':
          if (/^(noleido|unread)$/i.test(val)) q.unread = true
          break
      }
      continue
    }
    const term = unquote(body)
    if (!term) continue
    const expr = term.includes(' ') ? ftsEscape(term) : `${ftsEscape(term)}*`
    if (neg) q.ftsNot.push(expr)
    else q.fts.push(expr)
  }
  return q
}

export interface SqlPart {
  where: string[]
  params: (string | number)[]
}

const like = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => '\\' + c)}%`

/** Genera condiciones para la tabla `messages m` (con alias m). */
export function queryToSql(q: ParsedQuery): SqlPart {
  const where: string[] = []
  const params: (string | number)[] = []
  if (q.fts.length || q.ftsNot.length) {
    let expr = q.fts.join(' AND ')
    if (q.ftsNot.length) {
      const neg = q.ftsNot.join(' OR ')
      expr = expr ? `(${expr}) NOT (${neg})` : ''
      if (!expr) {
        where.push(`m.id NOT IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)`)
        params.push(neg)
      }
    }
    if (expr) {
      where.push(`m.id IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)`)
      params.push(expr)
    }
  }
  for (const v of q.from) {
    where.push(`(m.from_email LIKE ? ESCAPE '\\' OR m.from_name LIKE ? ESCAPE '\\')`)
    params.push(like(v), like(v))
  }
  for (const v of q.to) {
    where.push(`(m.to_text LIKE ? ESCAPE '\\' OR m.cc_text LIKE ? ESCAPE '\\')`)
    params.push(like(v), like(v))
  }
  for (const v of q.subject) {
    where.push(`m.subject LIKE ? ESCAPE '\\'`)
    params.push(like(v))
  }
  for (const v of q.attachment) {
    where.push(`EXISTS (SELECT 1 FROM attachments a WHERE a.message_id = m.id AND a.name LIKE ? ESCAPE '\\')`)
    params.push(like(v))
  }
  for (const v of q.folder) {
    where.push(`m.folder_id IN (SELECT id FROM folders WHERE path LIKE ? ESCAPE '\\')`)
    params.push(like(v))
  }
  for (const v of q.label) {
    where.push(`m.labels LIKE ? ESCAPE '\\'`)
    params.push(like(v))
  }
  if (q.before !== null) { where.push('m.date < ?'); params.push(q.before) }
  if (q.after !== null) { where.push('m.date >= ?'); params.push(q.after) }
  if (q.hasAttachment) where.push('m.has_attachments = 1')
  if (q.unread) where.push('m.unread = 1')
  return { where, params }
}
