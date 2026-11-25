/// <reference types="electron-vite/node" />
import {
  app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, protocol, session, shell, utilityProcess,
  type MenuItemConstructorOptions, type UtilityProcess
} from 'electron'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import MailComposer from 'nodemailer/lib/mail-composer'
import workerPath from './worker?modulePath'
import { Library } from '../core/library'
import { PROVIDERS, refreshToken } from '../core/oauth'
import type { ImapAccount } from '../core/imap'
import type { ImportProgress, ListFilter, MessageFull, Settings } from '../core/types'
import type { AccountView, AddPasswordAccount, AppInfo } from '../shared/ipc'
import { Store, type StoredAccount } from './store'
import { runOAuth } from './oauth-flow'

const isDev = !app.isPackaged
const SCHEME = 'wolfmail-att'
const ATT_URL = /^wolfmail-att:\/\/a\/(\d+)$/

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }])

// ---------- Modo portable y carpeta de datos ----------
function resolveDataDir(): { dir: string; portable: boolean } {
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR ?? (process.env.APPIMAGE ? dirname(process.env.APPIMAGE) : dirname(app.getPath('exe')))
  const portableDir = join(exeDir, 'WolfMailData')
  if (!isDev && (existsSync(portableDir) || existsSync(join(exeDir, 'portable.flag')) || process.argv.includes('--portable') || !!process.env.PORTABLE_EXECUTABLE_DIR)) {
    return { dir: portableDir, portable: true }
  }
  return { dir: join(app.getPath('userData'), 'datos'), portable: false }
}

const DANGEROUS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'msp', 'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'ps1', 'psm1', 'lnk', 'jar',
  'sh', 'bash', 'app', 'appimage', 'desktop', 'reg', 'hta', 'cpl', 'dll', 'pif', 'msc', 'apk', 'deb', 'rpm', 'run',
  'bin', 'command', 'scf', 'url', 'gadget', 'iso', 'dmg', 'pkg', 'inf', 'ocx', 'sys', 'chm', 'py', 'pl', 'rb'
])

let win: BrowserWindow | null = null
let lib: Library
let store: Store
let dataDir = ''
let portable = false
let worker: UtilityProcess | null = null
let nextJob = 1
let activeJob = 0
const pendingOpen: string[] = []

const send = (channel: string, payload?: unknown): void => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

// ---------- Utilidades ----------
const int = (v: unknown, name: string): number => {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new Error(`Parametro no valido: ${name}`)
  return v
}
const str = (v: unknown, name: string, max = 4096): string => {
  if (typeof v !== 'string' || v.length > max) throw new Error(`Parametro no valido: ${name}`)
  return v
}

function sanitizeFilter(f: unknown): ListFilter {
  const o = (f ?? {}) as Record<string, unknown>
  const out: ListFilter = {}
  if (o.sourceId !== undefined) out.sourceId = int(o.sourceId, 'sourceId')
  if (o.folderId !== undefined) out.folderId = int(o.folderId, 'folderId')
  if (typeof o.query === 'string') out.query = o.query.slice(0, 500)
  if (o.unreadOnly === true) out.unreadOnly = true
  if (o.withAttachments === true) out.withAttachments = true
  if (o.grouped === true) out.grouped = true
  if (o.sort === 'date-desc' || o.sort === 'date-asc' || o.sort === 'from' || o.sort === 'subject') out.sort = o.sort
  return out
}

/** Sustituye cid: por el esquema interno y devuelve el mensaje listo para mostrar. */
function present(m: MessageFull): MessageFull {
  if (!m.html) return m
  const byCid = new Map(m.attachments.filter((a) => a.cid).map((a) => [a.cid!.toLowerCase(), a.id]))
  const html = m.html.replace(/\bcid:([^"'\s)>]+)/gi, (full, cid: string) => {
    const id = byCid.get(decodeURIComponent(cid).toLowerCase().replace(/^<|>$/g, ''))
    return id ? `${SCHEME}://a/${id}` : full
  })
  return { ...m, html }
}

const safeName = (n: string): string => n.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 150) || 'adjunto'

// ---------- Importacion y sincronizacion en proceso aparte ----------
function ensureWorker(): UtilityProcess {
  if (worker) return worker
  worker = utilityProcess.fork(workerPath, [], { serviceName: 'WolfMail importador' })
  worker.on('message', (m: { type: string; progress?: ImportProgress; result?: ImportProgress }) => {
    if (m.type === 'progress' && m.progress) send('progress', m.progress)
    if (m.type === 'done' && m.result) {
      activeJob = 0
      send('progress', m.result)
      send('dataChanged')
    }
  })
  worker.on('exit', () => {
    if (activeJob) send('progress', { jobId: activeJob, file: '', phase: 'error', processed: 0, added: 0, duplicates: 0, failed: 1, message: 'El proceso de importacion se detuvo inesperadamente.' } satisfies ImportProgress)
    activeJob = 0
    worker = null
  })
  return worker
}

function startJob(msg: Record<string, unknown>): number {
  if (activeJob) throw new Error('Ya hay una importacion en curso. Espere a que termine o cancelela.')
  const jobId = nextJob++
  activeJob = jobId
  ensureWorker().postMessage({ ...msg, jobId, dir: dataDir })
  return jobId
}

// ---------- Cuentas ----------
const view = (a: StoredAccount): AccountView => ({
  id: a.id, label: a.label, user: a.user, provider: a.provider, secretStored: !!a.secret
})

async function imapAccountFor(a: StoredAccount): Promise<ImapAccount> {
  const secret = store.getSecret(a)
  if (!secret) throw new Error('No hay credenciales guardadas para esta cuenta. Vuelva a anadirla.')
  if (a.provider === 'imap') {
    return { id: a.id, label: a.label, host: a.host, port: a.port, secure: a.secure, user: a.user, auth: { kind: 'password', password: secret } }
  }
  const parsed = JSON.parse(secret) as { clientId: string; clientSecret?: string; refresh: string }
  const { clientId, clientSecret } = parsed
  const t = await refreshToken(a.provider, clientId, clientSecret, parsed.refresh)
  if (t.refreshToken && t.refreshToken !== parsed.refresh) {
    store.putSecret(a, JSON.stringify({ clientId, clientSecret, refresh: t.refreshToken }))
    store.saveAccounts()
  }
  return { id: a.id, label: a.label, host: a.host, port: a.port, secure: true, user: a.user, auth: { kind: 'oauth', accessToken: t.accessToken } }
}

// ---------- Ventana ----------
function createWindow(): void {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 760, minHeight: 520, show: false,
    title: 'WolfMail', backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true,
      nodeIntegration: false, webSecurity: true, spellcheck: false
    }
  })
  // Si 'ready-to-show' no llega (algunos entornos graficos sin aceleracion), la ventana se muestra igualmente.
  const reveal = (): void => { if (win && !win.isDestroyed() && !win.isVisible()) win.show() }
  win.once('ready-to-show', reveal)
  win.webContents.once('did-finish-load', () => setTimeout(reveal, 400))
  win.on('closed', () => { win = null })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.on('did-finish-load', () => {
    if (pendingOpen.length) send('openPaths', pendingOpen.splice(0))
  })
  if (isDev && process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

function buildMenu(): void {
  const action = (a: string) => (): void => send('menu', a)
  const t: MenuItemConstructorOptions[] = [
    { label: 'Archivo', submenu: [
      { label: 'Abrir archivos...', accelerator: 'CmdOrCtrl+O', click: action('open-files') },
      { label: 'Abrir carpeta...', accelerator: 'CmdOrCtrl+Shift+O', click: action('open-folder') },
      { label: 'Cuentas...', click: action('accounts') },
      { type: 'separator' }, { role: 'quit', label: 'Salir' }
    ] },
    { label: 'Edicion', submenu: [
      { role: 'copy', label: 'Copiar' }, { role: 'selectAll', label: 'Seleccionar todo' },
      { label: 'Buscar', accelerator: 'CmdOrCtrl+F', click: action('search') }
    ] },
    { label: 'Ver', submenu: [
      { label: 'Ajustes...', accelerator: 'CmdOrCtrl+,', click: action('settings') },
      { type: 'separator' }, { role: 'zoomIn', label: 'Aumentar zoom' }, { role: 'zoomOut', label: 'Reducir zoom' },
      { role: 'resetZoom', label: 'Zoom normal' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Pantalla completa' },
      ...(isDev ? [{ role: 'toggleDevTools' } as MenuItemConstructorOptions] : [])
    ] },
    { label: 'Ayuda', submenu: [
      { label: 'Atajos de teclado', accelerator: 'F1', click: action('help') },
      { label: 'Acerca de WolfMail', click: action('about') }
    ] }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(t))
}

// ---------- IPC ----------
function handle(channel: string, fn: (...args: unknown[]) => unknown | Promise<unknown>): void {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.senderFrame?.url && !/^(file:|http:\/\/localhost)/.test(event.senderFrame.url)) throw new Error('Origen no permitido')
    return fn(...args)
  })
}

function registerIpc(): void {
  handle('appInfo', (): AppInfo => ({ version: app.getVersion(), portable, dataDir, secureStorage: Store.canEncrypt(), platform: process.platform }))
  handle('stats', () => lib.stats())
  handle('listSources', () => lib.listSources())
  handle('listFolders', (id) => lib.listFolders(int(id, 'sourceId')))
  handle('count', (f) => lib.count(sanitizeFilter(f)))
  handle('list', (f, off, lim) => lib.list(sanitizeFilter(f), int(off, 'offset'), Math.min(int(lim, 'limit'), 500)))
  handle('getMessage', (id) => { const m = lib.getMessage(int(id, 'id')); return m ? present(m) : null })
  handle('getThread', (t) => lib.getThread(str(t, 'threadId', 100)).map(present))
  handle('markRead', (id, read) => lib.markRead(int(id, 'id'), read === true))
  handle('removeSource', (id) => { lib.removeSource(int(id, 'sourceId')); lib.compact(); send('dataChanged') })

  handle('pickFiles', async () => {
    const r = await dialog.showOpenDialog(win!, {
      title: 'Abrir archivos de correo', properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Correo (msg, eml, mbox, pst, ost, emlx)', extensions: ['msg', 'eml', 'emlx', 'mbox', 'mbx', 'pst', 'ost', 'oft'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ]
    })
    return r.canceled ? [] : r.filePaths
  })
  handle('pickFolder', async () => {
    const r = await dialog.showOpenDialog(win!, { title: 'Abrir carpeta de correo', properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('startImport', (paths) => {
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > 5000) throw new Error('Lista de rutas no valida')
    return startJob({ type: 'import', paths: paths.map((p) => str(p, 'ruta', 4096)) })
  })
  handle('cancelJob', () => { worker?.postMessage({ type: 'cancel' }) })

  handle('saveAttachment', async (id) => {
    const a = lib.readAttachment(int(id, 'id'))
    if (!a) return null
    const r = await dialog.showSaveDialog(win!, { title: 'Guardar adjunto', defaultPath: safeName(a.info.name) })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, a.data)
    return r.filePath
  })
  handle('openAttachment', async (id) => {
    const a = lib.readAttachment(int(id, 'id'))
    if (!a) return 'error'
    const ext = extname(a.info.name).slice(1).toLowerCase()
    if (DANGEROUS.has(ext) || !ext) return 'blocked'
    const dir = join(app.getPath('temp'), 'wolfmail-abrir')
    mkdirSync(dir, { recursive: true })
    const file = join(dir, `${a.info.id}-${safeName(a.info.name)}`)
    writeFileSync(file, a.data, { mode: 0o600 })
    return (await shell.openPath(file)) === '' ? 'opened' : 'error'
  })
  handle('openExternal', async (url) => {
    const u = new URL(str(url, 'url', 8192))
    if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) return false
    await shell.openExternal(u.toString())
    return true
  })
  handle('exportPdf', (id) => exportPdf(int(id, 'id')))
  handle('saveSource', async (id) => {
    const m = lib.getMessage(int(id, 'id'))
    if (!m) return null
    const r = await dialog.showSaveDialog(win!, { title: 'Guardar como .eml', defaultPath: safeName(m.subject || 'mensaje') + '.eml', filters: [{ name: 'Mensaje (.eml)', extensions: ['eml'] }] })
    if (r.canceled || !r.filePath) return null
    const attachments = m.attachments.map((a) => lib.readAttachment(a.id)).filter(Boolean).map((a) => ({
      filename: a!.info.name, content: a!.data, contentType: a!.info.mime, cid: a!.info.cid ?? undefined,
      contentDisposition: (a!.info.inline ? 'inline' : 'attachment') as 'inline' | 'attachment'
    }))
    const fmt = (l: { name: string; email: string }[]): string => l.map((x) => (x.name ? `"${x.name.replace(/"/g, '')}" <${x.email}>` : x.email)).join(', ')
    const mail = new MailComposer({
      from: m.fromEmail ? (m.fromName ? `"${m.fromName.replace(/"/g, '')}" <${m.fromEmail}>` : m.fromEmail) : undefined,
      to: fmt(m.to) || undefined, cc: fmt(m.cc) || undefined, subject: m.subject, date: m.date ? new Date(m.date) : undefined,
      text: m.text, html: m.html ?? undefined, attachments
    })
    const buf: Buffer = await new Promise((res, rej) => mail.compile().build((e, b) => (e ? rej(e) : res(b))))
    writeFileSync(r.filePath, buf)
    return r.filePath
  })

  handle('getSettings', () => store.settings)
  handle('setSettings', (patch) => {
    const p = patch as Partial<Settings>
    const clean: Partial<Settings> = {}
    if (p.theme === 'light' || p.theme === 'dark' || p.theme === 'system') clean.theme = p.theme
    if (p.language === 'es' || p.language === 'en') clean.language = p.language
    if (typeof p.fontScale === 'number') clean.fontScale = Math.min(1.6, Math.max(0.85, p.fontScale))
    if (p.density === 'comfortable' || p.density === 'compact') clean.density = p.density
    if (typeof p.grouped === 'boolean') clean.grouped = p.grouped
    if (p.loadRemoteImages === 'never' || p.loadRemoteImages === 'ask') clean.loadRemoteImages = p.loadRemoteImages
    if (p.readingPane === 'right' || p.readingPane === 'bottom') clean.readingPane = p.readingPane
    const s = store.setSettings(clean)
    nativeTheme.themeSource = s.theme
    return s
  })
  handle('systemPrefersDark', () => nativeTheme.shouldUseDarkColors)

  handle('listAccounts', () => store.accounts.map(view))
  handle('addPasswordAccount', (a) => {
    const o = a as AddPasswordAccount
    const acc: StoredAccount = {
      id: randomUUID(), label: str(o.label, 'label', 100) || str(o.user, 'user', 200), user: str(o.user, 'user', 200),
      provider: 'imap', host: str(o.host, 'host', 200), port: int(o.port, 'port'), secure: o.secure !== false
    }
    store.putSecret(acc, str(o.password, 'password', 500))
    store.accounts.push(acc)
    store.saveAccounts()
    return view(acc)
  })
  handle('startOAuth', async (provider, clientId, clientSecret, user) => {
    if (provider !== 'google' && provider !== 'microsoft') throw new Error('Proveedor no valido')
    const cid = str(clientId, 'clientId', 300).trim()
    if (!cid) throw new Error('Falta el identificador de cliente (client ID).')
    const sec = str(clientSecret, 'clientSecret', 300).trim() || undefined
    const email = str(user, 'user', 200).trim()
    const t = await runOAuth(provider, cid, sec, email)
    if (!t.refreshToken) throw new Error('El proveedor no devolvio permiso de acceso continuado (refresh token).')
    const cfg = PROVIDERS[provider]
    const acc: StoredAccount = {
      id: randomUUID(), label: email || (provider === 'google' ? 'Gmail' : 'Outlook'), user: email, provider,
      host: cfg.imapHost, port: cfg.imapPort, secure: true, clientId: cid
    }
    store.putSecret(acc, JSON.stringify({ clientId: cid, clientSecret: sec, refresh: t.refreshToken }))
    store.accounts.push(acc)
    store.saveAccounts()
    return view(acc)
  })
  handle('removeAccount', (id) => store.removeAccount(str(id, 'id', 100)))
  handle('syncAccount', async (id) => {
    const acc = store.accounts.find((a) => a.id === str(id, 'id', 100))
    if (!acc) throw new Error('Cuenta no encontrada')
    const account = await imapAccountFor(acc)
    return startJob({ type: 'sync', account })
  })
}

async function exportPdf(id: number): Promise<string | null> {
  const m = lib.getMessage(id)
  if (!m) return null
  const r = await dialog.showSaveDialog(win!, { title: 'Exportar a PDF', defaultPath: safeName(m.subject || 'mensaje') + '.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (r.canceled || !r.filePath) return null
  const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const p = present(m)
  const fmt = (l: { name: string; email: string }[]): string => esc(l.map((x) => (x.name ? `${x.name} <${x.email}>` : x.email)).join(', '))
  const body = p.html ?? `<pre style="white-space:pre-wrap;font:inherit">${esc(p.text)}</pre>`
  const doc = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${SCHEME}: data:; style-src 'unsafe-inline'">
<style>body{font:13px/1.45 system-ui,sans-serif;color:#111;margin:0}h1{font-size:18px;margin:0 0 8px}dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid #999}dt{color:#555}dd{margin:0}</style></head>
<body><h1>${esc(p.subject || '(sin asunto)')}</h1><dl><dt>De</dt><dd>${esc(p.fromName ? `${p.fromName} <${p.fromEmail}>` : p.fromEmail)}</dd><dt>Para</dt><dd>${fmt(p.to)}</dd>${p.cc.length ? `<dt>Cc</dt><dd>${fmt(p.cc)}</dd>` : ''}<dt>Fecha</dt><dd>${p.date ? esc(new Date(p.date).toLocaleString('es-ES')) : ''}</dd></dl>${body}</body></html>`
  // Ventana oculta sin JavaScript y sin red: el HTML del correo no puede ejecutar nada.
  const w = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, contextIsolation: true, partition: 'pdf-export' } })
  try {
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(doc))
    writeFileSync(r.filePath, await w.webContents.printToPDF({ pageSize: 'A4', printBackground: false }))
    return r.filePath
  } finally {
    w.destroy()
  }
}

// ---------- Arranque ----------
const lock = app.requestSingleInstanceLock()
if (!lock) app.quit()
else {
  const collect = (argv: string[]): string[] => argv.slice(isDev ? 2 : 1).filter((a) => !a.startsWith('-') && existsSync(a))
  app.on('second-instance', (_e, argv) => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
    const p = collect(argv)
    if (p.length) send('openPaths', p)
  })

  void app.whenReady().then(async () => {
    await Store.init()
    const d = resolveDataDir()
    dataDir = d.dir
    portable = d.portable
    mkdirSync(dataDir, { recursive: true })
    if (portable) app.setPath('userData', join(dataDir, 'electron'))
    lib = new Library(dataDir)
    store = new Store(dataDir)
    nativeTheme.themeSource = store.settings.theme
    nativeTheme.on('updated', () => send('systemTheme', nativeTheme.shouldUseDarkColors))

    // Todo permiso de navegador (camara, notificaciones, etc.) denegado: un lector no los necesita.
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
    session.defaultSession.setPermissionCheckHandler(() => false)

    protocol.handle(SCHEME, (req) => {
      const m = ATT_URL.exec(req.url)
      if (!m) return new Response('No encontrado', { status: 404 })
      const a = lib.readAttachment(Number(m[1]))
      if (!a || !/^image\/(png|jpe?g|gif|webp|bmp|svg\+xml|x-icon|avif)$/i.test(a.info.mime)) return new Response('No permitido', { status: 403 })
      return new Response(new Uint8Array(a.data), {
        headers: { 'Content-Type': a.info.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'" }
      })
    })

    registerIpc()
    buildMenu()
    pendingOpen.push(...collect(process.argv))
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => {
    worker?.kill()
    try { rmSync(join(app.getPath('temp'), 'wolfmail-abrir'), { recursive: true, force: true }) } catch { /* nada */ }
    try { lib?.close() } catch { /* nada */ }
  })
}

