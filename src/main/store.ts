// Persistencia de ajustes y cuentas. Las contrasenas y tokens se cifran con el almacen del sistema
// (safeStorage). Si el sistema no ofrece cifrado, los secretos solo viven en memoria durante la sesion.
import { safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type Settings } from '../core/types'

export interface StoredAccount {
  id: string
  label: string
  user: string
  provider: 'google' | 'microsoft' | 'imap'
  host: string
  port: number
  secure: boolean
  clientId?: string
  /** Secreto cifrado en base64 (contrasena o refresh token). */
  secret?: string
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(file: string, data: unknown): void {
  mkdirSync(join(file, '..'), { recursive: true })
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  renameSync(tmp, file)
}

export class Store {
  private settingsFile: string
  private accountsFile: string
  private memorySecrets = new Map<string, string>()
  settings: Settings
  accounts: StoredAccount[]

  constructor(readonly dataDir: string) {
    this.settingsFile = join(dataDir, 'ajustes.json')
    this.accountsFile = join(dataDir, 'cuentas.json')
    this.settings = { ...DEFAULT_SETTINGS, ...readJson<Partial<Settings>>(this.settingsFile, {}) }
    this.accounts = readJson<StoredAccount[]>(this.accountsFile, [])
  }

  private static encryptionOk = false

  /** Debe llamarse una vez con la aplicacion lista: la disponibilidad del llavero se consulta de forma asincrona. */
  static async init(): Promise<void> {
    try {
      if (!(await safeStorage.isAsyncEncryptionAvailable())) return
      // En Linux sin llavero, Electron cae a "basic_text": no es cifrado real.
      const be = (safeStorage as unknown as { getSelectedStorageBackend?: () => string }).getSelectedStorageBackend?.()
      Store.encryptionOk = be !== 'basic_text'
    } catch {
      Store.encryptionOk = false
    }
  }

  static canEncrypt(): boolean {
    return Store.encryptionOk
  }

  setSettings(patch: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...patch }
    writeJson(this.settingsFile, this.settings)
    return this.settings
  }

  saveAccounts(): void {
    writeJson(this.accountsFile, this.accounts)
  }

  putSecret(acc: StoredAccount, secret: string): boolean {
    this.memorySecrets.set(acc.id, secret)
    if (Store.canEncrypt()) {
      acc.secret = safeStorage.encryptString(secret).toString('base64')
      return true
    }
    delete acc.secret
    return false
  }

  getSecret(acc: StoredAccount): string | null {
    const mem = this.memorySecrets.get(acc.id)
    if (mem) return mem
    if (acc.secret && Store.canEncrypt()) {
      try { return safeStorage.decryptString(Buffer.from(acc.secret, 'base64')) } catch { return null }
    }
    return null
  }

  removeAccount(id: string): void {
    this.accounts = this.accounts.filter((a) => a.id !== id)
    this.memorySecrets.delete(id)
    this.saveAccounts()
  }
}
