// Tipos compartidos entre el nucleo, el proceso principal y la interfaz.

export interface Address {
  name: string
  email: string
}

export interface NormalizedAttachment {
  name: string
  mime: string
  size: number
  cid: string | null
  inline: boolean
  data: Uint8Array
}

/** Mensaje ya normalizado, independiente del formato de origen. */
export interface NormalizedMessage {
  messageId: string | null
  inReplyTo: string | null
  references: string[]
  subject: string
  from: Address | null
  to: Address[]
  cc: Address[]
  bcc: Address[]
  date: number | null // milisegundos UTC
  text: string
  html: string | null
  headers: string // cabeceras en bruto (o sinteticas si el formato no las guarda)
  attachments: NormalizedAttachment[]
  /** Ruta de carpeta dentro del origen, p. ej. "Bandeja de entrada/Clientes". */
  folder: string
  /** Etiquetas (Gmail) o categorias. */
  labels: string[]
  unread: boolean
}

export type SourceKind = 'eml' | 'msg' | 'mbox' | 'pst' | 'folder' | 'imap'

export interface SourceInfo {
  id: number
  kind: SourceKind
  name: string
  path: string | null
  added: number
  messageCount: number
}

export interface FolderInfo {
  id: number
  sourceId: number
  path: string
  name: string
  depth: number
  count: number
  unread: number
}

export interface AttachmentInfo {
  id: number
  messageId: number
  name: string
  mime: string
  size: number
  cid: string | null
  inline: boolean
}

export interface MessageRow {
  id: number
  threadId: string
  sourceId: number
  folderId: number
  subject: string
  fromName: string
  fromEmail: string
  toText: string
  date: number | null
  snippet: string
  hasAttachments: boolean
  unread: boolean
  threadCount: number
}

export interface MessageFull extends MessageRow {
  to: Address[]
  cc: Address[]
  bcc: Address[]
  text: string
  html: string | null
  headers: string
  folderPath: string
  labels: string[]
  attachments: AttachmentInfo[]
}

export interface ListFilter {
  sourceId?: number
  folderId?: number
  query?: string
  unreadOnly?: boolean
  withAttachments?: boolean
  sort?: 'date-desc' | 'date-asc' | 'from' | 'subject'
  /** Si es true, agrupa por conversacion (un resultado por hilo). */
  grouped?: boolean
}

export interface ImportProgress {
  jobId: number
  file: string
  phase: 'leyendo' | 'guardando' | 'terminado' | 'error' | 'cancelado'
  processed: number
  added: number
  duplicates: number
  failed: number
  message?: string
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  language: 'es' | 'en'
  fontScale: number // 0.85 - 1.6
  density: 'comfortable' | 'compact'
  grouped: boolean
  loadRemoteImages: 'never' | 'ask'
  readingPane: 'right' | 'bottom'
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  language: 'es',
  fontScale: 1,
  density: 'comfortable',
  grouped: true,
  loadRemoteImages: 'ask',
  readingPane: 'right'
}
