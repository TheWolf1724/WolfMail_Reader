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
  let ok = false
  try { ok = await window.wolf.replyMessage(id, mode) } catch { /* se avisa abajo */ }
  notify(ok ? t('Abierto en su programa de correo') : t('No se pudo abrir el programa de correo'))
}
