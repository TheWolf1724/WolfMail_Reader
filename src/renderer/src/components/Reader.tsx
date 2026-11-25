import { useCallback, useEffect, useState } from 'react'
import type { AttachmentInfo, MessageFull, MessageRow } from '../../../core/types'
import { avatarColor, formatDate, formatSize, initials, senderLabel } from '../format'
import { HtmlBody } from './HtmlBody'
import { IconBack, IconClip, IconCode, IconPrint, IconReply, IconSave } from './Icons'
import { printMsg, replyMsg } from '../actions'
import { useT } from '../i18n'

interface Props {
  row: MessageRow | null
  lang: string
  fontScale: number
  allowRemoteAlways: boolean
  narrow: boolean
  onBack: () => void
  onRead: (id: number) => void
  onLink: (url: string) => void
  onHeaders: (m: MessageFull) => void
  onNotify: (msg: string) => void
  onAskOpen: (a: AttachmentInfo) => void
}

const fmtAddr = (a: { name: string; email: string }): string => (a.name ? `${a.name} <${a.email}>` : a.email)

export function Reader({ row, lang, fontScale, allowRemoteAlways, narrow, onBack, onRead, onLink, onHeaders, onNotify, onAskOpen }: Props): JSX.Element {
  const t = useT()
  const [thread, setThread] = useState<MessageFull[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [remoteOk, setRemoteOk] = useState<Set<number>>(new Set())
  const [blocked, setBlocked] = useState<Set<number>>(new Set())

  useEffect(() => {
    let cancelled = false
    setThread([])
    if (!row) return
    void window.wolf.getThread(row.threadId).then((msgs) => {
      if (cancelled) return
      setThread(msgs)
      // Se abre el mensaje elegido y el ultimo de la conversacion.
      const open = new Set<number>([row.id])
      if (msgs.length) open.add(msgs[msgs.length - 1].id)
      setExpanded(open)
      setRemoteOk(new Set())
      setBlocked(new Set())
      if (row.unread) { void window.wolf.markRead(row.id, true); onRead(row.id) }
    })
    return () => { cancelled = true }
  }, [row?.id, row?.threadId]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: number): void => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  if (!row) {
    return <div className="empty" role="status"><h2>{t('Seleccione un mensaje')}</h2></div>
  }
  const current = thread.find((m) => m.id === row.id)

  return (
    <>
      <div className="reader-top">
        {narrow && <button className="btn ghost" onClick={onBack}><IconBack />{t('Cerrar')}</button>}
        <h2>{row.subject || t('Sin asunto')}</h2>
        <div className="meta">{thread.length > 1 ? `${t('Conversación')}: ${thread.length} ${t('mensajes')}` : current?.folderPath ?? ''}</div>
      </div>
      <div className="reader-scroll" role="region" aria-label={t('Lectura del mensaje')} tabIndex={-1} id="reader">
        {thread.map((m) => {
          const open = expanded.has(m.id)
          const who = senderLabel(m.fromName, m.fromEmail, t('Sin remitente'))
          const bodyId = 'body-' + m.id
          return (
            <article key={m.id} className={'msg-card' + (m.id === row.id ? ' current' : '')} aria-label={`${who}, ${formatDate(m.date, lang, true)}`}>
              <button className="head" aria-expanded={open} aria-controls={bodyId} onClick={() => toggle(m.id)}>
                <span className="avatar" style={{ background: avatarColor(m.fromEmail || m.fromName) }} aria-hidden="true">{initials(m.fromName, m.fromEmail)}</span>
                <span className="who">
                  <div className="name">{who}</div>
                  <div className="sub">{open ? m.fromEmail : m.snippet}</div>
                </span>
                {m.hasAttachments && <IconClip width={16} height={16} aria-hidden="true" />}
                <span className="when">{formatDate(m.date, lang)}</span>
              </button>
              {open && (
                <div className="msg-body" id={bodyId}>
                  <dl className="hdr-table">
                    <dt>{t('De')}</dt><dd>{fmtAddr({ name: m.fromName, email: m.fromEmail })}</dd>
                    {m.to.length > 0 && <><dt>{t('Para')}</dt><dd>{m.to.map(fmtAddr).join(', ')}</dd></>}
                    {m.cc.length > 0 && <><dt>{t('Cc')}</dt><dd>{m.cc.map(fmtAddr).join(', ')}</dd></>}
                    <dt>{t('Fecha')}</dt><dd>{formatDate(m.date, lang, true)}</dd>
                    {m.labels.length > 0 && <><dt>{t('Etiquetas')}</dt><dd>{m.labels.join(', ')}</dd></>}
                  </dl>
                  <div className="actions">
                    <button className="btn" onClick={() => onHeaders(m)}><IconCode />{t('Ver cabeceras')}</button>
                    <button className="btn" onClick={() => replyMsg(m.id, 'reply', t, onNotify)}><IconReply />{t('Responder')}</button>
                    <button className="btn" onClick={() => replyMsg(m.id, 'all', t, onNotify)}>{t('Responder a todos')}</button>
                    <button className="btn" onClick={() => replyMsg(m.id, 'forward', t, onNotify)}>{t('Reenviar')}</button>
                    <button className="btn" onClick={() => printMsg(m.id, t, onNotify)}><IconPrint />{t('Imprimir')}</button>
                    <button className="btn" onClick={async () => { const p = await window.wolf.exportPdf(m.id); if (p) onNotify(`${t('Guardado')}: ${p}`) }}><IconSave />{t('Exportar a PDF')}</button>
                    <button className="btn" onClick={async () => { const p = await window.wolf.saveSource(m.id); if (p) onNotify(`${t('Guardado')}: ${p}`) }}><IconSave />{t('Guardar como .eml')}</button>
                  </div>
                  {blocked.has(m.id) && !remoteOk.has(m.id) && !allowRemoteAlways && (
                    <div className="banner" role="status">
                      <span>{t('Se han bloqueado las imágenes remotas para proteger su privacidad.')}</span>
                      <button className="btn" onClick={() => setRemoteOk((s) => new Set(s).add(m.id))}>{t('Mostrar en este mensaje')}</button>
                    </div>
                  )}
                  <MessageBody m={m} fontScale={fontScale} allowRemote={allowRemoteAlways || remoteOk.has(m.id)} setBlocked={setBlocked} onLink={onLink} />
                  {m.attachments.filter((a) => !a.inline || !a.cid).length > 0 && (
                    <section aria-label={t('Adjuntos')}>
                      <div className="atts">
                        {m.attachments.filter((a) => !a.inline || !a.cid).map((a) => (
                          <div className="att" key={a.id}>
                            <IconClip />
                            <button className="btn ghost" style={{ minHeight: 28, padding: '0 6px' }} onClick={() => onAskOpen(a)} title={t('Abrir adjunto')}>
                              <span className="nm">{a.name}</span>
                            </button>
                            <span className="sz">{formatSize(a.size)}</span>
                            <button className="btn icon ghost" style={{ minHeight: 28, width: 28 }} aria-label={`${t('Guardar adjunto')}: ${a.name}`} title={t('Guardar adjunto')}
                              onClick={async () => { const p = await window.wolf.saveAttachment(a.id); if (p) onNotify(`${t('Guardado')}: ${p}`) }}><IconSave /></button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </>
  )
}

function MessageBody({ m, fontScale, allowRemote, setBlocked, onLink }: {
  m: MessageFull; fontScale: number; allowRemote: boolean
  setBlocked: React.Dispatch<React.SetStateAction<Set<number>>>; onLink: (u: string) => void
}): JSX.Element {
  const onBlocked = useCallback((b: boolean) => {
    setBlocked((s) => {
      if (s.has(m.id) === b) return s
      const n = new Set(s)
      if (b) n.add(m.id); else n.delete(m.id)
      return n
    })
  }, [m.id, setBlocked])
  return <HtmlBody html={m.html} text={m.text} fontScale={fontScale} allowRemote={allowRemote} onRemoteBlocked={onBlocked} onLink={onLink} />
}
