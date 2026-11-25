import { useEffect, useState } from 'react'
import type { Settings } from '../../../core/types'
import type { AccountView, AppInfo } from '../../../shared/ipc'
import { Dialog } from './Dialog'
import { IconRefresh, IconTrash } from './Icons'
import { useT } from '../i18n'

export function ConfirmDialog({ title, body, confirm, danger, onYes, onNo }: {
  title: string; body: React.ReactNode; confirm: string; danger?: boolean; onYes: () => void; onNo: () => void
}): JSX.Element {
  const t = useT()
  return (
    <Dialog title={title} onClose={onNo} width={520}
      footer={<><button className="btn" onClick={onNo} autoFocus>{t('Cancelar')}</button><button className={'btn ' + (danger ? 'danger' : 'primary')} onClick={onYes}>{confirm}</button></>}>
      {body}
    </Dialog>
  )
}

export function HeadersDialog({ headers, onClose }: { headers: string; onClose: () => void }): JSX.Element {
  const t = useT()
  return (
    <Dialog title={t('Cabeceras del mensaje')} onClose={onClose} width={820} footer={<button className="btn" onClick={() => void navigator.clipboard.writeText(headers)}>{t('Copiar')}</button>}>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{headers}</pre>
    </Dialog>
  )
}

function Radio<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: [T, string][]; onChange: (v: T) => void }): JSX.Element {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([v, label]) => (
        <label key={v}><input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />{label}</label>
      ))}
    </div>
  )
}

export function SettingsDialog({ settings, onChange, onClose }: { settings: Settings; onChange: (p: Partial<Settings>) => void; onClose: () => void }): JSX.Element {
  const t = useT()
  return (
    <Dialog title={t('Ajustes')} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>{t('Cerrar')}</button>}>
      <div className="field"><span className="label" id="l-theme">{t('Tema')}</span>
        <Radio name="theme" value={settings.theme} onChange={(theme) => onChange({ theme })} options={[['light', t('Claro')], ['dark', t('Oscuro')], ['system', t('Sistema')]]} /></div>
      <div className="field"><span className="label">{t('Idioma')}</span>
        <Radio name="lang" value={settings.language} onChange={(language) => onChange({ language })} options={[['es', 'Español'], ['en', 'English']]} /></div>
      <div className="field"><label htmlFor="fs">{t('Tamaño del texto')}: {Math.round(settings.fontScale * 100)} %</label>
        <input id="fs" type="range" min={0.85} max={1.6} step={0.05} value={settings.fontScale} onChange={(e) => onChange({ fontScale: Number(e.target.value) })} /></div>
      <div className="field"><span className="label">{t('Densidad')}</span>
        <Radio name="den" value={settings.density} onChange={(density) => onChange({ density })} options={[['comfortable', t('Cómoda')], ['compact', t('Compacta')]]} /></div>
      <div className="field"><span className="label">{t('Panel de lectura')}</span>
        <Radio name="pane" value={settings.readingPane} onChange={(readingPane) => onChange({ readingPane })} options={[['right', t('A la derecha')], ['bottom', t('Abajo')]]} /></div>
      <div className="field"><span className="label">{t('Imágenes remotas')}</span>
        <Radio name="img" value={settings.loadRemoteImages} onChange={(loadRemoteImages) => onChange({ loadRemoteImages })} options={[['ask', t('Preguntar en cada mensaje')], ['never', t('Nunca')]]} />
        <span className="hint">{t('Las imágenes remotas permiten al remitente saber que ha abierto el mensaje.')}</span></div>
      <div className="field"><span className="label">{t('Cita al responder')}</span>
        <Radio name="rq" value={settings.replyQuote} onChange={(replyQuote) => onChange({ replyQuote })} options={[['rich', t('Con formato (pegar con Ctrl+V)')], ['text', t('Solo texto (dentro del enlace)')]]} />
        <span className="hint">{t('Al responder se copia el mensaje con su formato y se pega en la redacción. El texto plano pierde negritas, tablas e imágenes.')}</span></div>
    </Dialog>
  )
}

export function HelpDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const t = useT()
  const rows: [string, string][] = [
    ['Ctrl+O', t('Abrir archivos')], ['Ctrl+Mayús+O', t('Abrir carpeta')], ['Ctrl+F  o  /', t('Buscar en el correo')],
    ['↑ ↓  /  j k', t('Mensaje anterior / siguiente')], ['Inicio / Fin', t('Primer / último mensaje')], ['Intro  o  →', t('Pasar el foco al mensaje')],
    ['F6', t('Cambiar de panel (carpetas, lista, lectura)')], ['Ctrl+P', t('Imprimir')], ['Ctrl+R', t('Responder')], ['Ctrl+Mayús+R', t('Responder a todos')], ['Ctrl+Mayús+F', t('Reenviar')], ['Ctrl+,', t('Ajustes')], ['F1  o  ?', t('Atajos de teclado')], ['Esc', t('Cerrar diálogo o limpiar búsqueda')]
  ]
  const ops: [string, string][] = [
    ['de:ana', t('remitente contiene "ana"')], ['para:luis', t('destinatario')], ['asunto:factura', t('asunto')],
    ['adjunto:pdf', t('nombre de adjunto')], ['carpeta:clientes', t('carpeta')], ['etiqueta:trabajo', t('etiqueta de Gmail')],
    ['antes:2024-01-31  despues:2023-01-01', t('rango de fechas (AAAA-MM-DD)')], ['tiene:adjunto  es:noleido', t('filtros')],
    ['"frase exacta"  -palabra', t('frase y exclusión')]
  ]
  return (
    <Dialog title={t('Atajos de teclado')} onClose={onClose} width={680} footer={<button className="btn primary" onClick={onClose}>{t('Cerrar')}</button>}>
      <table className="keys"><tbody>{rows.map(([k, d]) => <tr key={k}><td><span className="kbd">{k}</span></td><td>{d}</td></tr>)}</tbody></table>
      <h3>{t('Sintaxis de búsqueda')}</h3>
      <table className="keys"><tbody>{ops.map(([k, d]) => <tr key={k}><td><span className="kbd">{k}</span></td><td>{d}</td></tr>)}</tbody></table>
    </Dialog>
  )
}

export function AboutDialog({ info, onClose }: { info: AppInfo | null; onClose: () => void }): JSX.Element {
  const t = useT()
  return (
    <Dialog title={t('Acerca de WolfMail')} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>{t('Cerrar')}</button>}>
      <p><strong>WolfMail</strong> {info?.version}</p>
      <p>{t('Lector de correo de solo lectura para Outlook y Google. No envía, modifica ni borra nada en sus cuentas.')}</p>
      <dl className="hdr-table">
        <dt>{t('Modo')}</dt><dd>{info?.portable ? t('Portable') : t('Instalado')}</dd>
        <dt>{t('Datos')}</dt><dd style={{ fontFamily: 'var(--font-mono)' }}>{info?.dataDir}</dd>
        <dt>{t('Cifrado de credenciales')}</dt><dd>{info?.secureStorage ? t('Disponible (llavero del sistema)') : t('No disponible: las contraseñas solo se guardan durante la sesión')}</dd>
      </dl>
    </Dialog>
  )
}

export function AccountsDialog({ info, onClose, onSynced, onError }: { info: AppInfo | null; onClose: () => void; onSynced: (jobId: number) => void; onError: (m: string) => void }): JSX.Element {
  const t = useT()
  const [accounts, setAccounts] = useState<AccountView[]>([])
  const [mode, setMode] = useState<'google' | 'microsoft' | 'imap'>('google')
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ user: '', clientId: '', clientSecret: '', host: '', port: '993', password: '', label: '' })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>): void => setF((s) => ({ ...s, [k]: e.target.value }))
  const refresh = (): void => { void window.wolf.listAccounts().then(setAccounts) }
  useEffect(refresh, [])

  const add = async (): Promise<void> => {
    setBusy(true)
    try {
      if (mode === 'imap') {
        await window.wolf.addPasswordAccount({ label: f.label || f.user, user: f.user, host: f.host, port: Number(f.port) || 993, secure: true, password: f.password })
      } else {
        await window.wolf.startOAuth(mode, f.clientId, f.clientSecret, f.user)
      }
      setF((s) => ({ ...s, password: '' }))
      refresh()
    } catch (e) { onError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Dialog title={t('Cuentas')} onClose={onClose} width={720} footer={<button className="btn primary" onClick={onClose}>{t('Cerrar')}</button>}>
      <p className="hint" style={{ marginTop: 0 }}>{t('Las cuentas se leen por IMAP en modo solo lectura. Los mensajes se copian a su biblioteca local para poder buscarlos sin conexión.')}</p>
      {accounts.map((a) => (
        <div className="card" key={a.id}>
          <div className="grow"><strong>{a.label}</strong><div className="hint">{a.provider === 'google' ? 'Google' : a.provider === 'microsoft' ? 'Outlook / Microsoft' : 'IMAP'} - {a.user}{!a.secretStored && a.provider === 'imap' ? ' - ' + t('contraseña solo en esta sesión') : ''}</div></div>
          <button className="btn" onClick={async () => { try { onSynced(await window.wolf.syncAccount(a.id)); onClose() } catch (e) { onError((e as Error).message) } }}><IconRefresh />{t('Sincronizar')}</button>
          <button className="btn icon danger" aria-label={`${t('Eliminar')}: ${a.label}`} onClick={async () => { await window.wolf.removeAccount(a.id); refresh() }}><IconTrash /></button>
        </div>
      ))}
      <h3>{t('Añadir cuenta')}</h3>
      <div className="field"><span className="label">{t('Tipo')}</span>
        <Radio name="acc" value={mode} onChange={setMode} options={[['google', 'Gmail / Google'], ['microsoft', 'Outlook / Microsoft'], ['imap', 'IMAP + ' + t('contraseña')]]} /></div>
      <div className="field"><label htmlFor="a-user">{t('Correo electrónico')}</label><input id="a-user" className="input" type="email" autoComplete="off" value={f.user} onChange={set('user')} /></div>
      {mode !== 'imap' ? (
        <>
          <div className="field"><label htmlFor="a-cid">{t('Identificador de cliente (client ID)')}</label><input id="a-cid" className="input" autoComplete="off" value={f.clientId} onChange={set('clientId')} aria-describedby="a-cid-h" />
            <span className="hint" id="a-cid-h">{mode === 'google' ? t('Cree un cliente OAuth de tipo "Aplicación de escritorio" en Google Cloud Console (gratuito).') : t('Registre una aplicación pública en Microsoft Entra con redirección http://localhost y permiso IMAP.AccessAsUser.All (gratuito).')} {t('Guía completa en docs/CUENTAS.md.')}</span></div>
          {mode === 'google' && <div className="field"><label htmlFor="a-sec">{t('Secreto de cliente (si Google lo pide)')}</label><input id="a-sec" className="input" type="password" autoComplete="off" value={f.clientSecret} onChange={set('clientSecret')} /></div>}
        </>
      ) : (
        <>
          <div className="row"><div className="field" style={{ flex: 1, minWidth: 200 }}><label htmlFor="a-host">{t('Servidor IMAP')}</label><input id="a-host" className="input" placeholder="imap.gmail.com" value={f.host} onChange={set('host')} /></div>
            <div className="field" style={{ width: 100 }}><label htmlFor="a-port">{t('Puerto')}</label><input id="a-port" className="input" inputMode="numeric" value={f.port} onChange={set('port')} /></div></div>
          <div className="field"><label htmlFor="a-pw">{t('Contraseña de aplicación')}</label><input id="a-pw" className="input" type="password" autoComplete="off" value={f.password} onChange={set('password')} />
            <span className="hint">{t('Use una contraseña de aplicación, nunca la contraseña principal de su cuenta.')}{info && !info.secureStorage ? ' ' + t('Este sistema no tiene llavero: la contraseña no se guardará al cerrar.') : ''}</span></div>
        </>
      )}
      <button className="btn primary" disabled={busy || !f.user || (mode === 'imap' ? !f.host || !f.password : !f.clientId)} onClick={add}>
        {busy ? t('Esperando autorización...') : t('Añadir cuenta')}
      </button>
    </Dialog>
  )
}
