import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AttachmentInfo, FolderInfo, ImportProgress, ListFilter, MessageFull, MessageRow, Settings, SourceInfo } from '../../core/types'
import { DEFAULT_SETTINGS } from '../../core/types'
import type { AppInfo } from '../../shared/ipc'
import { LangContext, translate } from './i18n'
import { Sidebar, type Scope } from './components/Sidebar'
import { MessageList } from './components/MessageList'
import { Reader } from './components/Reader'
import { AboutDialog, AccountsDialog, ConfirmDialog, HeadersDialog, HelpDialog, SettingsDialog } from './components/Dialogs'
import { IconFile, IconFolder, IconHelp, IconMail, IconMenu, IconSearch, IconSettings, IconUser, IconClose } from './components/Icons'

type Modal =
  | { kind: 'settings' } | { kind: 'help' } | { kind: 'about' } | { kind: 'accounts' }
  | { kind: 'headers'; m: MessageFull }
  | { kind: 'link'; url: string }
  | { kind: 'attachment'; a: AttachmentInfo }
  | { kind: 'remove'; s: SourceInfo }
  | null

export function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [systemDark, setSystemDark] = useState(false)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [folders, setFolders] = useState<Record<number, FolderInfo[]>>({})
  const [stats, setStats] = useState({ sources: 0, messages: 0 })
  const [scope, setScope] = useState<Scope>({})
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [withAtt, setWithAtt] = useState(false)
  const [sort, setSort] = useState<NonNullable<ListFilter['sort']>>('date-desc')
  const [version, setVersion] = useState(0)
  const [selected, setSelected] = useState<MessageRow | null>(null)
  const [total, setTotal] = useState(0)
  const [modal, setModal] = useState<Modal>(null)
  const [job, setJob] = useState<ImportProgress | null>(null)
  const [toast, setToast] = useState('')
  const [dragging, setDragging] = useState(false)
  const [narrow, setNarrow] = useState(window.innerWidth <= 900)
  const [showSide, setShowSide] = useState(false)
  const [readMode, setReadMode] = useState(false)
  const [widths, setWidths] = useState({ side: 260, list: 400, listH: 320 })
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const lang = settings.language
  const t = useCallback((s: string) => translate(lang, s), [lang])

  // ---------- Carga inicial ----------
  const reload = useCallback(async () => {
    const [s, st] = await Promise.all([window.wolf.listSources(), window.wolf.stats()])
    setSources(s)
    setStats(st)
    const f: Record<number, FolderInfo[]> = {}
    await Promise.all(s.map(async (x) => { f[x.id] = await window.wolf.listFolders(x.id) }))
    setFolders(f)
    setVersion((v) => v + 1)
  }, [])

  useEffect(() => {
    void window.wolf.getSettings().then(setSettings)
    void window.wolf.appInfo().then(setInfo)
    void window.wolf.systemPrefersDark().then(setSystemDark)
    void reload()
    const offs = [
      window.wolf.onSystemTheme(setSystemDark),
      window.wolf.onDataChanged(() => void reload()),
      window.wolf.onProgress((p) => setJob(p)),
      window.wolf.onOpenPaths((p) => void startImport(p)),
      window.wolf.onMenu((a) => menuAction(a))
    ]
    return () => offs.forEach((o) => o())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- Apariencia ----------
  useEffect(() => {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
    const r = document.documentElement
    r.dataset.theme = dark ? 'dark' : 'light'
    r.dataset.density = settings.density
    r.style.setProperty('--scale', String(settings.fontScale))
    r.lang = settings.language
  }, [settings, systemDark])

  useEffect(() => {
    const on = (): void => setNarrow(window.innerWidth <= 900)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  // Busqueda con retardo para no consultar en cada pulsacion.
  useEffect(() => {
    const id = setTimeout(() => setQuery(queryInput), 220)
    return () => clearTimeout(id)
  }, [queryInput])

  const filter: ListFilter = useMemo(() => ({
    sourceId: scope.sourceId, folderId: scope.folderId, query: query || undefined,
    unreadOnly: unreadOnly || undefined, withAttachments: withAtt || undefined, sort, grouped: settings.grouped
  }), [scope, query, unreadOnly, withAtt, sort, settings.grouped])

  const notify = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(''), 5000) }, [])

  const patchSettings = (p: Partial<Settings>): void => {
    setSettings((s) => ({ ...s, ...p }))
    void window.wolf.setSettings(p).then(setSettings)
  }

  // ---------- Importacion ----------
  const startImport = useCallback(async (paths: string[]) => {
    if (!paths.length) return
    try {
      const id = await window.wolf.startImport(paths)
      setJob({ jobId: id, file: '', phase: 'leyendo', processed: 0, added: 0, duplicates: 0, failed: 0 })
    } catch (e) { notify((e as Error).message) }
  }, [notify])

  const menuAction = (a: string): void => {
    if (a === 'open-files') void window.wolf.pickFiles().then((p) => startImport(p))
    else if (a === 'open-folder') void window.wolf.pickFolder().then((p) => { if (p) void startImport([p]) })
    else if (a === 'accounts') setModal({ kind: 'accounts' })
    else if (a === 'settings') setModal({ kind: 'settings' })
    else if (a === 'help') setModal({ kind: 'help' })
    else if (a === 'about') setModal({ kind: 'about' })
    else if (a === 'search') searchRef.current?.focus()
  }

  const finished = job && (job.phase === 'terminado' || job.phase === 'error' || job.phase === 'cancelado')
  const running = job && !finished

  // ---------- Teclado global ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement).tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'F6') {
        e.preventDefault()
        const order = [document.querySelector<HTMLElement>('.sidebar [role=treeitem][tabindex="0"]'), listRef.current, document.getElementById('reader')]
        const targets = order.filter(Boolean) as HTMLElement[]
        const cur = targets.findIndex((x) => x.contains(document.activeElement))
        targets[(cur + (e.shiftKey ? targets.length - 1 : 1)) % targets.length]?.focus()
      } else if (!typing && (e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'f'))) {
        e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select()
      } else if (!typing && (e.key === '?' || e.key === 'F1') && !modal) {
        e.preventDefault(); setModal({ kind: 'help' })
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQueryInput(''); listRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal])

  // ---------- Arrastrar y soltar ----------
  useEffect(() => {
    let depth = 0
    const over = (e: DragEvent): void => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault() }
    const enter = (e: DragEvent): void => { if (e.dataTransfer?.types.includes('Files')) { depth++; setDragging(true) } }
    const leave = (): void => { depth = Math.max(0, depth - 1); if (!depth) setDragging(false) }
    const drop = (e: DragEvent): void => {
      e.preventDefault(); depth = 0; setDragging(false)
      const files = [...(e.dataTransfer?.files ?? [])]
      void startImport(window.wolf.pathsForFiles(files))
    }
    window.addEventListener('dragover', over); window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragenter', enter); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }, [startImport])

  // ---------- Divisores redimensionables (raton y teclado) ----------
  const startDrag = (key: 'side' | 'list' | 'listH', e: React.PointerEvent): void => {
    e.preventDefault()
    const x0 = key === 'listH' ? e.clientY : e.clientX
    const w0 = widths[key]
    const move = (ev: PointerEvent): void => {
      const d = (key === 'listH' ? ev.clientY : ev.clientX) - x0
      setWidths((w) => ({ ...w, [key]: Math.min(key === 'side' ? 480 : 900, Math.max(key === 'side' ? 180 : 260, w0 + d)) }))
    }
    const up = (): void => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const splitKey = (key: 'side' | 'list' | 'listH') => (e: React.KeyboardEvent): void => {
    const step = e.shiftKey ? 60 : 20
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    setWidths((w) => ({ ...w, [key]: Math.min(key === 'side' ? 480 : 900, Math.max(key === 'side' ? 180 : 260, w[key] + dir * step)) }))
  }

  const askLink = useCallback((url: string) => setModal({ kind: 'link', url }), [])
  const empty = stats.messages === 0 && !running
  const scopeTitle = scope.folderId
    ? folders[scope.sourceId!]?.find((f) => f.id === scope.folderId)?.name
    : scope.sourceId ? sources.find((s) => s.id === scope.sourceId)?.name : t('Todos los correos')
  const bottom = settings.readingPane === 'bottom' && !narrow

  const panesStyle = { '--side-w': `${widths.side}px`, '--list-w': `${widths.list}px`, '--list-h': `${widths.listH}px` } as React.CSSProperties

  return (
    <LangContext.Provider value={lang}>
      <a className="skip-link" href="#list-region" onClick={(e) => { e.preventDefault(); listRef.current?.focus() }}>{t('Saltar a la lista de mensajes')}</a>
      <div className="app">
        <header className="toolbar">
          {narrow && <button className="btn icon ghost" aria-label={t('Carpetas')} aria-expanded={showSide} onClick={() => { setShowSide((s) => !s); setReadMode(false) }}><IconMenu /></button>}
          <div className="brand"><IconMail />WolfMail</div>
          <button className="btn" onClick={() => menuAction('open-files')}><IconFile />{narrow ? '' : t('Abrir archivos')}<span className="sr-only">{narrow ? t('Abrir archivos') : ''}</span></button>
          <button className="btn" onClick={() => menuAction('open-folder')}><IconFolder />{narrow ? '' : t('Abrir carpeta')}<span className="sr-only">{narrow ? t('Abrir carpeta') : ''}</span></button>
          <button className="btn" onClick={() => menuAction('accounts')}><IconUser />{narrow ? '' : t('Cuentas')}<span className="sr-only">{narrow ? t('Cuentas') : ''}</span></button>
          <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); setQuery(queryInput) }}>
            <label htmlFor="q" className="sr-only">{t('Buscar en el correo')}</label>
            <IconSearch className="lead" />
            <input id="q" ref={searchRef} className="input" type="search" autoComplete="off" spellCheck={false} value={queryInput}
              placeholder={t('Buscar... (de:, asunto:, adjunto:, antes:)')} onChange={(e) => setQueryInput(e.target.value)} aria-describedby="q-help" />
            <span id="q-help" className="sr-only">{t('Pulse F1 para ver la sintaxis de búsqueda')}</span>
            {queryInput && <button type="button" className="btn icon ghost clear" aria-label={t('Limpiar búsqueda')} onClick={() => { setQueryInput(''); searchRef.current?.focus() }}><IconClose /></button>}
          </form>
          <button className="btn" aria-pressed={unreadOnly} onClick={() => setUnreadOnly((v) => !v)}>{t('No leídos')}</button>
          <button className="btn" aria-pressed={withAtt} onClick={() => setWithAtt((v) => !v)}>{t('Con adjuntos')}</button>
          <span className="spacer" />
          <button className="btn icon ghost" aria-label={t('Atajos de teclado')} title={t('Atajos de teclado') + ' (F1)'} onClick={() => setModal({ kind: 'help' })}><IconHelp /></button>
          <button className="btn icon ghost" aria-label={t('Ajustes')} title={t('Ajustes') + ' (Ctrl+,)'} onClick={() => setModal({ kind: 'settings' })}><IconSettings /></button>
        </header>

        {empty ? (
          <main className="pane" style={{ display: 'grid', placeItems: 'center' }}>
            <div className="empty" style={{ maxWidth: 560 }}>
              <h1 style={{ color: 'var(--text)', margin: '0 0 8px' }}>{t('Bienvenido a WolfMail')}</h1>
              <p>{t('Lea sus correos de Outlook y Google sin conexión: archivos .msg, .eml, .mbox, .pst y .ost, o cuentas por IMAP.')}</p>
              <p>{t('Arrastre aquí sus archivos o carpetas, o use los botones.')}</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn primary" onClick={() => menuAction('open-files')} autoFocus><IconFile />{t('Abrir archivos')}</button>
                <button className="btn" onClick={() => menuAction('open-folder')}><IconFolder />{t('Abrir carpeta')}</button>
                <button className="btn" onClick={() => menuAction('accounts')}><IconUser />{t('Cuentas')}</button>
              </div>
            </div>
          </main>
        ) : (
          <div className={'panes' + (bottom ? ' bottom' : '') + (showSide ? ' show-side' : '') + (readMode ? ' read-mode' : '')} style={panesStyle}>
            <nav className="pane sidebar" aria-label={t('Carpetas')}>
              <Sidebar sources={sources} folders={folders} scope={scope} totalMessages={stats.messages}
                onSelect={(s) => { setScope(s); setSelected(null); setShowSide(false); setReadMode(false) }}
                onRemove={(s) => setModal({ kind: 'remove', s })}
                onLoadFolders={(id) => void window.wolf.listFolders(id).then((f) => setFolders((x) => ({ ...x, [id]: f })))} />
            </nav>
            <div className="splitter" role="separator" aria-orientation="vertical" aria-label={t('Ancho de carpetas')} aria-valuenow={widths.side} tabIndex={0}
              onPointerDown={(e) => startDrag('side', e)} onKeyDown={splitKey('side')} />
            <section className="pane list-pane" id="list-region" aria-label={t('Lista de mensajes')}>
              <div className="list-head">
                <h2 className="title" style={{ margin: 0, fontSize: '1rem' }}>{scopeTitle}</h2>
                <span className="total" role="status">{total.toLocaleString()} {settings.grouped ? t('conversaciones') : t('mensajes')}</span>
                <div className="ctrls">
                  <label className="sr-only" htmlFor="sort">{t('Ordenar')}</label>
                  <select id="sort" className="input" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                    <option value="date-desc">{t('Más recientes primero')}</option>
                    <option value="date-asc">{t('Más antiguos primero')}</option>
                    <option value="from">{t('Remitente')}</option>
                    <option value="subject">{t('Asunto')}</option>
                  </select>
                  <button className="btn" aria-pressed={settings.grouped} onClick={() => patchSettings({ grouped: !settings.grouped })}>{t('Conversaciones')}</button>
                </div>
              </div>
              <MessageList filter={filter} version={version} lang={lang} selectedId={selected?.id ?? null} listRef={listRef}
                onSelect={(r) => setSelected(r)} onOpen={() => { setReadMode(true); document.getElementById('reader')?.focus() }} onTotal={setTotal} />
            </section>
            {!narrow && <div className={'splitter' + (bottom ? ' h' : '')} role="separator" aria-orientation={bottom ? 'horizontal' : 'vertical'} aria-label={t('Tamaño de la lista')}
              aria-valuenow={bottom ? widths.listH : widths.list} tabIndex={0} onPointerDown={(e) => startDrag(bottom ? 'listH' : 'list', e)} onKeyDown={splitKey(bottom ? 'listH' : 'list')} />}
            <main className="pane reader-pane" aria-label={t('Lectura del mensaje')}>
              <Reader row={selected} lang={lang} fontScale={settings.fontScale} allowRemoteAlways={false} narrow={narrow}
                onBack={() => setReadMode(false)} onLink={askLink} onHeaders={(m) => setModal({ kind: 'headers', m })}
                onNotify={notify} onAskOpen={(a) => setModal({ kind: 'attachment', a })} />
            </main>
          </div>
        )}

        <footer className="status">
          <span role="status" aria-live="polite">
            {running ? `${t('Importando')}: ${job!.file} - ${job!.processed.toLocaleString()} ${t('mensajes')}`
              : finished ? `${job!.phase === 'error' ? t('Error') : job!.phase === 'cancelado' ? t('Importación cancelada') : t('Importación terminada')}: ${job!.added.toLocaleString()} ${t('nuevos')}${job!.duplicates ? `, ${job!.duplicates.toLocaleString()} ${t('duplicados')}` : ''}${job!.failed ? `, ${job!.failed} ${t('con errores')}` : ''}${job!.message ? ' - ' + job!.message : ''}`
              : `${stats.messages.toLocaleString()} ${t('mensajes')} - ${stats.sources} ${t('orígenes')}`}
          </span>
          {running && <><span className="progress" aria-hidden="true"><i /></span><button className="btn" style={{ minHeight: 24, padding: '0 10px' }} onClick={() => void window.wolf.cancelJob(job!.jobId)}>{t('Cancelar importación')}</button></>}
          {finished && <button className="btn ghost" style={{ minHeight: 24, padding: '0 10px' }} onClick={() => setJob(null)}>{t('Cerrar')}</button>}
          <span className="spacer" />
          {info?.portable && <span>{t('Portable')}</span>}
          <span>v{info?.version}</span>
        </footer>
      </div>

      {dragging && <div className="dropzone-overlay" aria-hidden="true">{t('Suelte los archivos para importarlos')}</div>}
      {toast && <div className="toast" role="status">{toast}</div>}

      {modal?.kind === 'settings' && <SettingsDialog settings={settings} onChange={patchSettings} onClose={() => setModal(null)} />}
      {modal?.kind === 'help' && <HelpDialog onClose={() => setModal(null)} />}
      {modal?.kind === 'about' && <AboutDialog info={info} onClose={() => setModal(null)} />}
      {modal?.kind === 'accounts' && <AccountsDialog info={info} onClose={() => setModal(null)} onSynced={(id) => setJob({ jobId: id, file: '', phase: 'leyendo', processed: 0, added: 0, duplicates: 0, failed: 0 })} onError={notify} />}
      {modal?.kind === 'headers' && <HeadersDialog headers={modal.m.headers} onClose={() => setModal(null)} />}
      {modal?.kind === 'link' && (
        <ConfirmDialog title={t('Abrir enlace')} confirm={t('Abrir en el navegador')} onNo={() => setModal(null)}
          onYes={() => { void window.wolf.openExternal(modal.url); setModal(null) }}
          body={<><p>{t('El enlace se abrirá fuera de WolfMail. Compruebe que la dirección es la esperada:')}</p><p style={{ fontFamily: 'var(--font-mono)', overflowWrap: 'anywhere' }}>{modal.url}</p></>} />
      )}
      {modal?.kind === 'attachment' && (
        <ConfirmDialog title={t('Abrir adjunto')} confirm={t('Abrir')} onNo={() => setModal(null)}
          onYes={async () => {
            const a = modal.a; setModal(null)
            const r = await window.wolf.openAttachment(a.id)
            if (r === 'blocked') notify(t('Este tipo de archivo puede ser peligroso y no se abre. Puede guardarlo.'))
            else if (r === 'error') notify(t('No se pudo abrir el adjunto. Puede guardarlo.'))
          }}
          body={<><p>{t('Los adjuntos pueden contener software malicioso. Ábralo solo si confía en el remitente.')}</p><p><strong>{modal.a.name}</strong></p></>} />
      )}
      {modal?.kind === 'remove' && (
        <ConfirmDialog title={t('Quitar origen')} confirm={t('Quitar')} danger onNo={() => setModal(null)}
          onYes={async () => { const s = modal.s; setModal(null); await window.wolf.removeSource(s.id); if (scope.sourceId === s.id) setScope({}); setSelected(null) }}
          body={<p>{t('Se quitará de WolfMail la copia de')} <strong>{modal.s.name}</strong> ({modal.s.messageCount.toLocaleString()} {t('mensajes')}). {t('El archivo o la cuenta original no se modifican.')}</p>} />
      )}
      
    </LangContext.Provider>
  )
}
