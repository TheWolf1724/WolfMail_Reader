import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { useT } from '../i18n'

interface Props {
  html: string | null
  text: string
  fontScale: number
  allowRemote: boolean
  onRemoteBlocked: (blocked: boolean) => void
  onLink: (url: string) => void
}

// El cuerpo del correo se limpia con DOMPurify y se muestra en un iframe aislado:
// sin scripts, sin formularios y con una politica de contenido que bloquea la red salvo permiso.
const FORBID_TAGS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea', 'meta', 'link', 'base', 'applet', 'audio', 'video', 'source', 'track', 'dialog']
const REMOTE = /(?:src|srcset|background|poster|href|xlink:href)\s*=\s*["']?\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\/|@import/i

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS, FORBID_ATTR: ['srcdoc', 'formaction', 'ping'],
    // Valor por defecto de DOMPurify mas el esquema interno de imagenes incrustadas (cid:).
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|wolfmail-att):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false, WHOLE_DOCUMENT: false, RETURN_TRUSTED_TYPE: false
  }) as string
}

export function hasRemoteContent(clean: string): boolean {
  // Los enlaces <a href> no cargan nada: solo cuentan los recursos incrustados.
  const noLinks = clean.replace(/<a\b[^>]*>/gi, '<a>')
  return REMOTE.test(noLinks)
}

const LINKIFY = /\bhttps?:\/\/[^\s<>"')\]]+/g

export function PlainText({ text, onLink }: { text: string; onLink: (u: string) => void }): JSX.Element {
  const parts: (string | JSX.Element)[] = []
  let last = 0
  let m: RegExpExecArray | null
  LINKIFY.lastIndex = 0
  while ((m = LINKIFY.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const url = m[0].replace(/[.,;:!?]+$/, '')
    parts.push(<a key={m.index} href={url} onClick={(e) => { e.preventDefault(); onLink(url) }}>{url}</a>)
    last = m.index + url.length
    LINKIFY.lastIndex = last
  }
  parts.push(text.slice(last))
  return <pre>{parts}</pre>
}

export function HtmlBody({ html, text, fontScale, allowRemote, onRemoteBlocked, onLink }: Props): JSX.Element {
  const t = useT()
  const frame = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(80)
  const clean = useMemo(() => (html ? sanitizeEmailHtml(html) : null), [html])
  const remote = useMemo(() => (clean ? hasRemoteContent(clean) : false), [clean])

  useEffect(() => { onRemoteBlocked(remote && !allowRemote) }, [remote, allowRemote, onRemoteBlocked])

  const doc = useMemo(() => {
    if (clean === null) return ''
    const img = allowRemote ? "wolfmail-att: data: https: http:" : 'wolfmail-att: data:'
    const csp = `default-src 'none'; img-src ${img}; style-src 'unsafe-inline'${allowRemote ? ' https:' : ''}; font-src data:`
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">
<base target="_blank"><style>
html{color-scheme:light}body{margin:0;padding:14px 16px;font:${Math.round(15 * fontScale)}px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;background:#fff;overflow-wrap:anywhere;word-break:break-word}
img{max-width:100%;height:auto}table{max-width:100%}a{color:#0b5cad}blockquote{margin:.6em 0;padding-left:12px;border-left:3px solid #c5ccd3;color:#444}pre{white-space:pre-wrap}
</style></head><body>${clean}</body></html>`
  }, [clean, allowRemote, fontScale])

  useEffect(() => {
    const f = frame.current
    if (!f || clean === null) return
    let ro: ResizeObserver | null = null
    const onLoad = (): void => {
      const d = f.contentDocument
      if (!d) return
      const measure = (): void => setHeight(Math.max(60, d.documentElement.scrollHeight))
      measure()
      ro = new ResizeObserver(measure)
      ro.observe(d.documentElement)
      d.addEventListener('click', (e) => {
        const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
        if (!a) return
        e.preventDefault()
        const href = a.getAttribute('href') ?? ''
        if (/^(https?:|mailto:)/i.test(href)) onLink(href)
      })
    }
    f.addEventListener('load', onLoad)
    if (f.contentDocument?.readyState === 'complete' && f.contentDocument.body?.innerHTML) onLoad()
    return () => { f.removeEventListener('load', onLoad); ro?.disconnect() }
  }, [clean, doc, onLink])

  if (clean === null) return <div className="paper"><PlainText text={text} onLink={onLink} /></div>
  return (
    <div className="paper">
      {/* allow-same-origin permite medir y vigilar enlaces desde fuera; sin allow-scripts no se ejecuta nada dentro. */}
      <iframe ref={frame} title={t('Contenido del mensaje')} sandbox="allow-same-origin" srcDoc={doc} style={{ height }} />
    </div>
  )
}
