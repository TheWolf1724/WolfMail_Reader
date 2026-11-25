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

export async function replyMsg(id: number, mode: 'reply' | 'all' | 'forward', t: T, notify: Notify): Promise<void> {
  let r = { ok: false, truncated: false, full: '' }
  try { r = await window.wolf.replyMessage(id, mode) } catch { /* se avisa abajo */ }
  if (!r.ok) { notify(t('No se pudo abrir el programa de correo')); return }
  if (r.truncated) {
    // El enlace no admite todo el texto: el mensaje completo queda en el portapapeles.
    try { await navigator.clipboard.writeText(r.full); notify(t('Abierto en su programa de correo. El texto completo está copiado: péguelo con Ctrl+V.')); return } catch { /* sin portapapeles */ }
  }
  notify(t('Abierto en su programa de correo'))
}
