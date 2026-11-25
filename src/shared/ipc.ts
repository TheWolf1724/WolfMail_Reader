import type {
  FolderInfo, ImportProgress, ListFilter, MessageFull, MessageRow, Settings, SourceInfo
} from '../core/types'

export interface AccountView {
  id: string
  label: string
  user: string
  provider: 'google' | 'microsoft' | 'imap'
  secretStored: boolean
}

export interface AddPasswordAccount {
  label: string
  user: string
  host: string
  port: number
  secure: boolean
  password: string
}

export interface AppInfo {
  version: string
  portable: boolean
  dataDir: string
  secureStorage: boolean
  platform: string
}

/** API expuesta a la interfaz por el preload. Todo lo que cruza el puente esta aqui. */
/** Resultado de abrir el programa de correo: si el texto no cupo en el enlace, `full` lleva el texto completo. */
export interface ReplyOutcome {
  ok: boolean
  truncated: boolean
  full: string
  /** Modo con formato: el cuerpo del enlace va vacio y la cita (HTML) se entrega para el portapapeles. */
  rich: boolean
  intro: string
  html: string | null
}

export interface WolfApi {
  appInfo(): Promise<AppInfo>
  stats(): Promise<{ sources: number; messages: number }>
  listSources(): Promise<SourceInfo[]>
  listFolders(sourceId: number): Promise<FolderInfo[]>
  count(filter: ListFilter): Promise<number>
  list(filter: ListFilter, offset: number, limit: number): Promise<MessageRow[]>
  getMessage(id: number): Promise<MessageFull | null>
  getThread(threadId: string): Promise<MessageFull[]>
  markRead(id: number, read: boolean): Promise<void>
  removeSource(id: number): Promise<void>

  pickFiles(): Promise<string[]>
  pickFolder(): Promise<string | null>
  pathsForFiles(files: File[]): string[]
  startImport(paths: string[]): Promise<number>
  cancelJob(jobId: number): Promise<void>
  onProgress(cb: (p: ImportProgress) => void): () => void
  onDataChanged(cb: () => void): () => void
  onOpenPaths(cb: (paths: string[]) => void): () => void
  onMenu(cb: (action: string) => void): () => void

  saveAttachment(id: number): Promise<string | null>
  openAttachment(id: number): Promise<'opened' | 'blocked' | 'error'>
  openExternal(url: string): Promise<boolean>
  exportPdf(messageId: number): Promise<string | null>
  /** Segundo paso de responder/reenviar: copia la cita al portapapeles y abre el programa de correo. */
  openReply(html: string | null, text: string): Promise<boolean>
  printMessage(messageId: number): Promise<'printed' | 'cancelled' | 'viewer' | 'error'>
  replyMessage(messageId: number, mode: 'reply' | 'all' | 'forward'): Promise<ReplyOutcome>
  saveSource(messageId: number): Promise<string | null>

  getSettings(): Promise<Settings>
  setSettings(s: Partial<Settings>): Promise<Settings>
  onSystemTheme(cb: (dark: boolean) => void): () => void
  systemPrefersDark(): Promise<boolean>

  listAccounts(): Promise<AccountView[]>
  addPasswordAccount(a: AddPasswordAccount): Promise<AccountView>
  startOAuth(provider: 'google' | 'microsoft', clientId: string, clientSecret: string, user: string): Promise<AccountView>
  removeAccount(id: string): Promise<void>
  syncAccount(id: string): Promise<number>
}

export const CHANNELS = [
  'appInfo', 'stats', 'listSources', 'listFolders', 'count', 'list', 'getMessage', 'getThread', 'markRead',
  'removeSource', 'pickFiles', 'pickFolder', 'startImport', 'cancelJob', 'saveAttachment', 'openAttachment',
  'openExternal', 'exportPdf', 'printMessage', 'replyMessage', 'openReply', 'saveSource', 'getSettings', 'setSettings', 'systemPrefersDark', 'listAccounts',
  'addPasswordAccount', 'startOAuth', 'removeAccount', 'syncAccount'
] as const
export type Channel = (typeof CHANNELS)[number]
