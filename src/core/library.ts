// Biblioteca local: indice SQLite con busqueda de texto completo y adjuntos en disco.
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type {
  Address, AttachmentInfo, FolderInfo, ListFilter, MessageFull, MessageRow,
  NormalizedMessage, SourceInfo, SourceKind
} from './types'
import { cleanMessageId, normalizeSubject } from './threading'
import { parseQuery, queryToSql } from './query'

const SCHEMA_VERSION = 1

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, path TEXT, added INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  path TEXT NOT NULL, name TEXT NOT NULL, depth INTEGER NOT NULL,
  UNIQUE (source_id, path)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  dedup_key TEXT NOT NULL,
  message_id TEXT, in_reply_to TEXT, thread_id TEXT NOT NULL, subject_norm TEXT NOT NULL,
  subject TEXT NOT NULL, from_name TEXT NOT NULL, from_email TEXT NOT NULL,
  to_text TEXT NOT NULL, cc_text TEXT NOT NULL,
  to_json TEXT NOT NULL, cc_json TEXT NOT NULL, bcc_json TEXT NOT NULL,
  date INTEGER, snippet TEXT NOT NULL, body_text TEXT NOT NULL, body_html TEXT,
  headers TEXT NOT NULL, labels TEXT NOT NULL,
  has_attachments INTEGER NOT NULL DEFAULT 0, unread INTEGER NOT NULL DEFAULT 0,
  UNIQUE (source_id, dedup_key)
);
CREATE INDEX IF NOT EXISTS idx_msg_folder_date ON messages (folder_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_msg_source_date ON messages (source_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_msg_thread ON messages (thread_id, date);
CREATE INDEX IF NOT EXISTS idx_msg_mid ON messages (message_id);
CREATE INDEX IF NOT EXISTS idx_msg_subj ON messages (subject_norm);
CREATE TABLE IF NOT EXISTS msg_refs (
  source_id INTEGER NOT NULL, message_id TEXT NOT NULL, thread_id TEXT NOT NULL, PRIMARY KEY (source_id, message_id, thread_id)
);
CREATE INDEX IF NOT EXISTS idx_refs_mid ON msg_refs (message_id);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
  cid TEXT, inline INTEGER NOT NULL DEFAULT 0, hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_att_msg ON attachments (message_id);
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  subject, sender, recipients, body, tokenize = 'unicode61 remove_diacritics 2'
);
`

const fmtAddr = (a: Address): string => (a.name ? `${a.name} <${a.email}>` : a.email)
const addrText = (list: Address[]): string => list.map(fmtAddr).join(', ')

export function makeSnippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 160)
}

export interface AddResult {
  status: 'added' | 'duplicate'
  id: number
}

type Row = Record<string, unknown>

export class Library {
  readonly db: DatabaseSync
  readonly blobDir: string
  private folderCache = new Map<string, number>()

  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true })
    this.blobDir = join(dir, 'adjuntos')
    mkdirSync(this.blobDir, { recursive: true })
    this.db = new DatabaseSync(join(dir, 'biblioteca.db'))
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 15000;')
    this.db.exec(SCHEMA)
    const v = this.db.prepare(`SELECT value FROM meta WHERE key='schema'`).get() as Row | undefined
    if (!v) this.db.prepare(`INSERT INTO meta (key, value) VALUES ('schema', ?)`).run(String(SCHEMA_VERSION))
  }

  close(): void {
    this.db.close()
  }

  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN')
    try {
      const r = fn()
      this.db.exec('COMMIT')
      return r
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
  }

  // ---------- Origenes y carpetas ----------

  addSource(kind: SourceKind, name: string, path: string | null): number {
    if (path) {
      const ex = this.db.prepare('SELECT id FROM sources WHERE path = ? AND kind = ?').get(path, kind) as Row | undefined
      if (ex) return Number(ex.id)
    }
    const r = this.db.prepare('INSERT INTO sources (kind, name, path, added) VALUES (?,?,?,?)').run(kind, name, path, Date.now())
    return Number(r.lastInsertRowid)
  }

  removeSource(id: number): void {
    const hashes = this.db
      .prepare('SELECT DISTINCT a.hash FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.source_id = ?')
      .all(id) as Row[]
    this.db.prepare('DELETE FROM messages_fts WHERE rowid IN (SELECT id FROM messages WHERE source_id = ?)').run(id)
    const src = this.db.prepare('SELECT kind, path FROM sources WHERE id = ?').get(id) as Row | undefined
    if (src?.kind === 'imap' && String(src.path).startsWith('imap://')) {
      // Sin esto, volver a sincronizar la cuenta saltaria todo lo ya descargado.
      this.db.prepare('DELETE FROM meta WHERE key LIKE ?').run(`imap:${String(src.path).slice(7)}:%`)
    }
    this.db.prepare('DELETE FROM msg_refs WHERE thread_id IN (SELECT thread_id FROM messages WHERE source_id = ?)').run(id)
    this.db.prepare('DELETE FROM sources WHERE id = ?').run(id)
    this.folderCache.clear()
    // Los blobs huerfanos se limpian en compact().
    void hashes
  }

  /** Elimina del disco los adjuntos que ya nadie referencia. */
  compact(): number {
    const used = new Set((this.db.prepare('SELECT DISTINCT hash FROM attachments').all() as Row[]).map((r) => String(r.hash)))
    let removed = 0
    for (const sub of readdirSync(this.blobDir)) {
      const d = join(this.blobDir, sub)
      for (const f of readdirSync(d)) {
        if (!used.has(f)) {
          rmSync(join(d, f), { force: true })
          removed++
        }
      }
    }
    return removed
  }

  listSources(): SourceInfo[] {
    const rows = this.db
      .prepare(`SELECT s.*, (SELECT COUNT(*) FROM messages m WHERE m.source_id = s.id) AS n FROM sources s ORDER BY s.added`)
      .all() as Row[]
    return rows.map((r) => ({
      id: Number(r.id), kind: r.kind as SourceKind, name: String(r.name),
      path: (r.path as string | null) ?? null, added: Number(r.added), messageCount: Number(r.n)
    }))
  }

  ensureFolder(sourceId: number, path: string): number {
    const p = path.trim() || 'Sin carpeta'
    const key = `${sourceId}\u0000${p}`
    const cached = this.folderCache.get(key)
    if (cached) return cached
    const parts = p.split('/')
    const row = this.db.prepare('SELECT id FROM folders WHERE source_id = ? AND path = ?').get(sourceId, p) as Row | undefined
    let id: number
    if (row) id = Number(row.id)
    else {
      const r = this.db
        .prepare('INSERT INTO folders (source_id, path, name, depth) VALUES (?,?,?,?)')
        .run(sourceId, p, parts[parts.length - 1], parts.length - 1)
      id = Number(r.lastInsertRowid)
    }
    this.folderCache.set(key, id)
    return id
  }

  listFolders(sourceId: number): FolderInfo[] {
    const rows = this.db
      .prepare(
        `SELECT f.id, f.source_id, f.path, f.name, f.depth,
           (SELECT COUNT(*) FROM messages m WHERE m.folder_id = f.id) AS n,
           (SELECT COUNT(*) FROM messages m WHERE m.folder_id = f.id AND m.unread = 1) AS u
         FROM folders f WHERE f.source_id = ? ORDER BY f.path COLLATE NOCASE`
      )
      .all(sourceId) as Row[]
    return rows
      .map((r) => ({
        id: Number(r.id), sourceId: Number(r.source_id), path: String(r.path), name: String(r.name),
        depth: Number(r.depth), count: Number(r.n), unread: Number(r.u)
      }))
      .filter((f) => f.count > 0 || rows.some((o) => String(o.path).startsWith(f.path + '/')))
  }

  // ---------- Escritura ----------

  private storeBlob(data: Uint8Array): string {
    const hash = createHash('sha256').update(data).digest('hex')
    const dir = join(this.blobDir, hash.slice(0, 2))
    const file = join(dir, hash)
    if (!existsSync(file)) {
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, data)
    }
    return hash
  }

  private dedupKey(m: NormalizedMessage): string {
    const mid = cleanMessageId(m.messageId)
    if (mid) return 'mid:' + mid
    const h = createHash('sha1')
    h.update(`${m.date ?? ''}|${m.subject}|${m.from?.email ?? ''}|${addrText(m.to)}|${m.text.slice(0, 2000)}`)
    return 'h:' + h.digest('hex')
  }

  private resolveThread(sourceId: number, m: NormalizedMessage, mid: string | null): string {
    const ids = [...new Set([...(mid ? [mid] : []), ...m.references, ...(m.inReplyTo ? [cleanMessageId(m.inReplyTo)!] : [])].filter(Boolean))]
    let thread: string | null = null
    if (ids.length) {
      const q = this.db.prepare('SELECT thread_id FROM msg_refs WHERE source_id = ? AND message_id = ? LIMIT 1')
      for (const id of ids) {
        const r = q.get(sourceId, id) as Row | undefined
        if (r) { thread = String(r.thread_id); break }
      }
    }
    if (!thread) {
      // Mismo asunto normalizado y fecha cercana (30 dias): evita hilos partidos por clientes que no ponen References.
      const norm = normalizeSubject(m.subject)
      if (norm && m.date !== null && (m.inReplyTo || m.references.length || /^\s*(re|rv|fwd?|enc)\s*:/i.test(m.subject))) {
        const r = this.db
          .prepare('SELECT thread_id FROM messages WHERE source_id = ? AND subject_norm = ? AND date BETWEEN ? AND ? ORDER BY date LIMIT 1')
          .get(sourceId, norm, m.date - 30 * 864e5, m.date + 30 * 864e5) as Row | undefined
        if (r) thread = String(r.thread_id)
      }
    }
    if (!thread) thread = 't' + createHash('sha1').update(`${sourceId}|${mid ?? ''}|${m.subject}|${m.date}|${Math.random()}`).digest('hex').slice(0, 16)
    const ins = this.db.prepare('INSERT OR IGNORE INTO msg_refs (source_id, message_id, thread_id) VALUES (?,?,?)')
    for (const id of ids) ins.run(sourceId, id, thread)
    return thread
  }

  addMessage(sourceId: number, m: NormalizedMessage): AddResult {
    this.db.exec('SAVEPOINT msg')
    try {
      const r = this.addMessageInner(sourceId, m)
      this.db.exec('RELEASE msg')
      return r
    } catch (e) {
      this.db.exec('ROLLBACK TO msg; RELEASE msg')
      throw e
    }
  }

  private addMessageInner(sourceId: number, m: NormalizedMessage): AddResult {
    const key = this.dedupKey(m)
    const dup = this.db.prepare('SELECT id FROM messages WHERE source_id = ? AND dedup_key = ?').get(sourceId, key) as Row | undefined
    if (dup) return { status: 'duplicate', id: Number(dup.id) }

    const mid = cleanMessageId(m.messageId)
    const folderId = this.ensureFolder(sourceId, m.folder)
    const thread = this.resolveThread(sourceId, m, mid)
    const from = m.from ?? { name: '', email: '' }
    const r = this.db
      .prepare(
        `INSERT INTO messages (source_id, folder_id, dedup_key, message_id, in_reply_to, thread_id, subject_norm, subject,
           from_name, from_email, to_text, cc_text, to_json, cc_json, bcc_json, date, snippet, body_text, body_html,
           headers, labels, has_attachments, unread)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        sourceId, folderId, key, mid, cleanMessageId(m.inReplyTo), thread, normalizeSubject(m.subject), m.subject,
        from.name, from.email, addrText(m.to), addrText(m.cc),
        JSON.stringify(m.to), JSON.stringify(m.cc), JSON.stringify(m.bcc),
        m.date, makeSnippet(m.text || stripTags(m.html ?? '')), m.text, m.html, m.headers,
        JSON.stringify(m.labels), m.attachments.some((a) => !a.inline || !a.cid) ? 1 : 0, m.unread ? 1 : 0
      )
    const id = Number(r.lastInsertRowid)
    const att = this.db.prepare('INSERT INTO attachments (message_id, name, mime, size, cid, inline, hash) VALUES (?,?,?,?,?,?,?)')
    for (const a of m.attachments) {
      const hash = this.storeBlob(a.data)
      att.run(id, a.name || 'adjunto', a.mime || 'application/octet-stream', a.data.byteLength, a.cid, a.inline ? 1 : 0, hash)
    }
    this.db
      .prepare('INSERT INTO messages_fts (rowid, subject, sender, recipients, body) VALUES (?,?,?,?,?)')
      .run(id, m.subject, fmtAddr(from), addrText([...m.to, ...m.cc]), m.text || stripTags(m.html ?? ''))
    return { status: 'added', id }
  }

  // ---------- Lectura ----------

  private rowToList(r: Row): MessageRow {
    return {
      id: Number(r.id), threadId: String(r.thread_id), sourceId: Number(r.source_id), folderId: Number(r.folder_id),
      subject: String(r.subject), fromName: String(r.from_name), fromEmail: String(r.from_email),
      toText: String(r.to_text), date: r.date === null ? null : Number(r.date), snippet: String(r.snippet),
      hasAttachments: r.has_attachments === 1 || r.has_attachments === 1n, unread: r.unread === 1 || r.unread === 1n,
      threadCount: Number(r.n ?? 1)
    }
  }

  private buildWhere(f: ListFilter): { sql: string; params: (string | number)[] } {
    const where: string[] = []
    const params: (string | number)[] = []
    if (f.sourceId) { where.push('m.source_id = ?'); params.push(f.sourceId) }
    if (f.folderId) { where.push('m.folder_id = ?'); params.push(f.folderId) }
    if (f.unreadOnly) where.push('m.unread = 1')
    if (f.withAttachments) where.push('m.has_attachments = 1')
    if (f.query?.trim()) {
      const part = queryToSql(parseQuery(f.query))
      where.push(...part.where)
      params.push(...part.params)
    }
    return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', params }
  }

  private orderBy(sort: ListFilter['sort'], grouped: boolean): string {
    const d = grouped ? 'MAX(m.date)' : 'm.date'
    switch (sort) {
      case 'date-asc': return `ORDER BY ${d} ASC, m.id ASC`
      case 'from': return 'ORDER BY m.from_name COLLATE NOCASE, m.from_email COLLATE NOCASE, m.id'
      case 'subject': return 'ORDER BY m.subject_norm, m.id'
      default: return `ORDER BY ${d} DESC, m.id DESC`
    }
  }

  count(f: ListFilter): number {
    const w = this.buildWhere(f)
    const sel = f.grouped ? 'COUNT(DISTINCT m.thread_id)' : 'COUNT(*)'
    const r = this.db.prepare(`SELECT ${sel} AS c FROM messages m ${w.sql}`).get(...w.params) as Row
    return Number(r.c)
  }

  list(f: ListFilter, offset: number, limit: number): MessageRow[] {
    const w = this.buildWhere(f)
    const cols = `m.id, m.thread_id, m.source_id, m.folder_id, m.subject, m.from_name, m.from_email, m.to_text, m.date, m.snippet, m.has_attachments, m.unread`
    let sql: string
    if (f.grouped) {
      sql = `SELECT ${cols}, COUNT(*) AS n, MAX(m.date) AS md FROM messages m ${w.sql} GROUP BY m.thread_id ${this.orderBy(f.sort, true)} LIMIT ? OFFSET ?`
    } else {
      sql = `SELECT ${cols}, 1 AS n FROM messages m ${w.sql} ${this.orderBy(f.sort, false)} LIMIT ? OFFSET ?`
    }
    const rows = this.db.prepare(sql).all(...w.params, limit, offset) as Row[]
    const out = rows.map((r) => this.rowToList(r))
    if (f.grouped && out.length) {
      // Tamano real de la conversacion (sin filtros): refleja todo el historico.
      const q = this.db.prepare('SELECT COUNT(*) AS c FROM messages WHERE thread_id = ?')
      for (const row of out) row.threadCount = Number((q.get(row.threadId) as Row).c)
    }
    return out
  }

  getMessage(id: number): MessageFull | null {
    const r = this.db
      .prepare(`SELECT m.*, f.path AS folder_path FROM messages m JOIN folders f ON f.id = m.folder_id WHERE m.id = ?`)
      .get(id) as Row | undefined
    if (!r) return null
    const row = this.rowToList({ ...r, n: 1 })
    return {
      ...row,
      to: JSON.parse(String(r.to_json)), cc: JSON.parse(String(r.cc_json)), bcc: JSON.parse(String(r.bcc_json)),
      text: String(r.body_text), html: (r.body_html as string | null) ?? null, headers: String(r.headers),
      folderPath: String(r.folder_path), labels: JSON.parse(String(r.labels)),
      attachments: this.getAttachments(id)
    }
  }

  getAttachments(messageId: number): AttachmentInfo[] {
    const rows = this.db.prepare('SELECT id, message_id, name, mime, size, cid, inline FROM attachments WHERE message_id = ? ORDER BY id').all(messageId) as Row[]
    return rows.map((a) => ({
      id: Number(a.id), messageId: Number(a.message_id), name: String(a.name), mime: String(a.mime),
      size: Number(a.size), cid: (a.cid as string | null) ?? null, inline: Number(a.inline) === 1
    }))
  }

  readAttachment(id: number): { info: AttachmentInfo; data: Buffer } | null {
    const a = this.db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Row | undefined
    if (!a) return null
    const hash = String(a.hash)
    const file = join(this.blobDir, hash.slice(0, 2), hash)
    if (!existsSync(file)) return null
    return {
      info: {
        id: Number(a.id), messageId: Number(a.message_id), name: String(a.name), mime: String(a.mime),
        size: Number(a.size), cid: (a.cid as string | null) ?? null, inline: Number(a.inline) === 1
      },
      data: readFileSync(file)
    }
  }

  /** Conversacion completa (todas las carpetas del mismo origen), en orden cronologico. */
  getThread(threadId: string): MessageFull[] {
    const ids = this.db.prepare('SELECT id FROM messages WHERE thread_id = ? ORDER BY date, id').all(threadId) as Row[]
    return ids.map((r) => this.getMessage(Number(r.id))!).filter(Boolean)
  }

  markRead(id: number, read: boolean): void {
    this.db.prepare('UPDATE messages SET unread = ? WHERE id = ?').run(read ? 0 : 1, id)
  }

  stats(): { sources: number; messages: number } {
    const a = this.db.prepare('SELECT COUNT(*) c FROM sources').get() as Row
    const b = this.db.prepare('SELECT COUNT(*) c FROM messages').get() as Row
    return { sources: Number(a.c), messages: Number(b.c) }
  }
}



const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '-', mdash: '-', hellip: '...', laquo: '"', raquo: '"', iexcl: '!', iquest: '?' }

/** Texto plano aproximado de un HTML: respeta saltos de bloque y decodifica entidades. */
export function stripTags(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
      }
      return ENTITIES[e.toLowerCase()] ?? m
    })
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
