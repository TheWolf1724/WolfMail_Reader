import { sanitizeEmailHtml } from './components/HtmlBody'

// Acciones sobre un mensaje compartidas por los botones y el menu.
export type Notify = (msg: string) => void
type T = (s: string) => string

export async function printMsg(id: number, t: T, notify: Notify): Promise<void> {
  let r: Awaited<ReturnType<typeof window.wolf.printMessage>> = 'error'
  try { r = await window.wolf.printMessage(id) } catch { /* se avisa abajo */ }
  if (r === 'printed') notify(t('Enviado a la impresora'))
  else if (r === 'viewer') notify(t('PDF abierto en el visor: imprima desde allí'))
  else if (r === 'error') notify(t('No se pudo imprimir'))
}

const esc = (x: string): string => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Cita con formato lista para pegar: HTML limpio, solo con imagenes incrustadas (nada remoto). */
export function buildRichQuote(mode: 'reply' | 'all' | 'forward', intro: string, html: string): string {
  const doc = new DOMParser().parseFromString(sanitizeEmailHtml(html), 'text/html')
  doc.querySelectorAll('img').forEach((img) => { if (!/^data:image\//i.test(img.getAttribute('src') ?? '')) img.remove() })
  const body = doc.body.innerHTML
  const head = esc(intro).replace(/\n/g, '<br>')
  return mode === 'forward'
    ? `<div>${head}</div><br>${body}`
    : `<div>${head}</div><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${body}</blockquote>`
}

export async function replyMsg(id: number, mode: 'reply' | 'all' | 'forward', t: T, notify: Notify): Promise<void> {
  let r: Awaited<ReturnType<typeof window.wolf.replyMessage>> | null = null
  try { r = await window.wolf.replyMessage(id, mode) } catch { /* se avisa abajo */ }
  if (!r || !r.ok) { notify(t('No se pudo abrir el programa de correo')); return }
  const useClipboard = r.rich || r.truncated
  let html: string | null = null
  if (r.rich && r.html) { try { html = buildRichQuote(mode, r.intro, r.html) } catch { html = null } }
  let ok = false
  try { ok = await window.wolf.openReply(html, useClipboard ? r.full : '') } catch { /* se avisa abajo */ }
  if (!ok) notify(t('No se pudo abrir el programa de correo'))
  else if (r.rich) notify(t('Abierto en su programa de correo. Pulse Ctrl+V en el cuerpo para pegar el mensaje citado con su formato.'))
  else if (r.truncated) notify(t('Abierto en su programa de correo. El texto completo está copiado: péguelo con Ctrl+V.'))
  else notify(t('Abierto en su programa de correo'))
}
