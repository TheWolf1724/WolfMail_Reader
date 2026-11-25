import { useEffect, useRef, type ReactNode } from 'react'
import { IconClose } from './Icons'
import { useT } from '../i18n'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/** Dialogo modal sobre <dialog>: el navegador gestiona foco atrapado, Esc y restauracion del foco. */
export function Dialog({ title, onClose, children, footer, width }: Props): JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  const t = useT()
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    return () => { if (d?.open) d.close() }
  }, [])
  const id = 'dlg-' + title.replace(/\W+/g, '-')
  return (
    <dialog ref={ref} aria-labelledby={id} onCancel={(e) => { e.preventDefault(); onClose() }} style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}>
      <div className="dlg-head">
        <h2 id={id}>{title}</h2>
        <button className="btn icon ghost" onClick={onClose} aria-label={t('Cerrar')}><IconClose /></button>
      </div>
      <div className="dlg-body">{children}</div>
      {footer && <div className="dlg-foot">{footer}</div>}
    </dialog>
  )
}
