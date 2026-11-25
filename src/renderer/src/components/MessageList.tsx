import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ListFilter, MessageRow } from '../../../core/types'
import { formatDate, senderLabel } from '../format'
import { IconClip, IconThread } from './Icons'
import { useT } from '../i18n'

const PAGE = 100

interface Props {
  filter: ListFilter
  version: number // cambia cuando cambian los datos
  lang: string
  selectedId: number | null
  onSelect: (row: MessageRow) => void
  onOpen: () => void
  onTotal: (n: number) => void
  listRef: React.RefObject<HTMLDivElement | null>
  readIds: Set<number>
}

export function MessageList({ filter, version, lang, selectedId, onSelect, onOpen, onTotal, listRef, readIds }: Props): JSX.Element {
  const t = useT()
  const [total, setTotal] = useState(0)
  const [rowH, setRowH] = useState(72)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewH, setViewH] = useState(600)
  const [active, setActive] = useState(0)
  const pages = useRef(new Map<number, MessageRow[]>())
  const inflight = useRef(new Set<number>())
  const [, bump] = useState(0)
  const epoch = useRef(0)
  const lastFilter = useRef('')
  const wantSelect = useRef(false)
  const filterKey = JSON.stringify(filter)

  // Altura de fila segun densidad y tamano de texto (variable CSS --row-h).
  useLayoutEffect(() => {
    const read = (): void => {
      const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-h')) || 72
      const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale')) || 1
      setRowH(Math.round(v * scale))
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-density', 'style'] })
    return () => mo.disconnect()
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewH(el.clientHeight))
    ro.observe(el)
    setViewH(el.clientHeight)
    return () => ro.disconnect()
  }, [listRef])

  // Nueva consulta: vaciar cache y pedir el total.
  useEffect(() => {
    const my = ++epoch.current
    pages.current.clear()
    inflight.current.clear()
    // Solo una consulta nueva vuelve al principio; recargar datos conserva la posicion.
    if (lastFilter.current !== filterKey) {
      lastFilter.current = filterKey
      setActive(0)
      if (listRef.current) listRef.current.scrollTop = 0
    }
    void window.wolf.count(filter).then((n) => {
      if (my !== epoch.current) return
      setTotal(n)
      setActive((a) => Math.max(0, Math.min(a, n - 1)))
      onTotal(n)
      bump((x) => x + 1)
    }).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, version])

  const ensure = useCallback((page: number) => {
    if (page < 0 || pages.current.has(page) || inflight.current.has(page)) return
    inflight.current.add(page)
    const my = epoch.current
    void window.wolf.list(filter, page * PAGE, PAGE).then((rows) => {
      if (my !== epoch.current) return
      pages.current.set(page, rows)
      inflight.current.delete(page)
      bump((x) => x + 1)
    }).catch(() => { inflight.current.delete(page); setTimeout(() => bump((x) => x + 1), 1500) }) // reintento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  const first = Math.max(0, Math.floor(scrollTop / rowH) - 4)
  const last = Math.min(total - 1, Math.ceil((scrollTop + viewH) / rowH) + 4)
  for (let p = Math.floor(first / PAGE); p <= Math.floor(Math.max(last, 0) / PAGE); p++) if (total) ensure(p)

  const rowAt = (i: number): MessageRow | undefined => pages.current.get(Math.floor(i / PAGE))?.[i % PAGE]

  const moveTo = (i: number): void => {
    const n = Math.min(total - 1, Math.max(0, i))
    setActive(n)
    const el = listRef.current
    if (el) {
      if (n * rowH < el.scrollTop) el.scrollTop = n * rowH
      else if ((n + 1) * rowH > el.scrollTop + el.clientHeight) el.scrollTop = (n + 1) * rowH - el.clientHeight
    }
    const r = rowAt(n)
    if (r) onSelect(r)
    else wantSelect.current = true // la pagina aun no ha llegado: se selecciona al cargarse
  }

  const onKey = (e: React.KeyboardEvent): void => {
    const page = Math.max(1, Math.floor(viewH / rowH) - 1)
    switch (e.key) {
      case 'ArrowDown': case 'j': moveTo(active + 1); break
      case 'ArrowUp': case 'k': moveTo(active - 1); break
      case 'PageDown': moveTo(active + page); break
      case 'PageUp': moveTo(active - page); break
      case 'Home': moveTo(0); break
      case 'End': moveTo(total - 1); break
      case 'Enter': case 'ArrowRight': onOpen(); break
      default: return
    }
    e.preventDefault()
  }

  const activeRow = rowAt(active)
  useEffect(() => {
    if (wantSelect.current && activeRow) { wantSelect.current = false; onSelect(activeRow) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRow])

  const items: JSX.Element[] = []
  for (let i = first; i <= last; i++) {
    const r = rowAt(i)
    const top = i * rowH
    if (!r) {
      items.push(<div key={'s' + i} id={'row-' + i} role="option" aria-selected={false} aria-label="..." className="msg-row" style={{ top }}><div className="line"><span className="from" style={{ opacity: 0.4 }}>...</span></div></div>)
      continue
    }
    const who = senderLabel(r.fromName, r.fromEmail, t('Sin remitente'))
    items.push(
      <div key={r.id} id={'row-' + i} role="option" aria-selected={r.id === selectedId} aria-posinset={i + 1} aria-setsize={total}
        className={'msg-row' + (r.unread && !readIds.has(r.id) ? ' unread' : '') + (i === active ? ' active' : '')} style={{ top }}
        onClick={() => { setActive(i); onSelect(r); listRef.current?.focus() }} onDoubleClick={onOpen}
        aria-label={`${r.unread && !readIds.has(r.id) ? t('No leídos') + ', ' : ''}${who}, ${r.subject || t('Sin asunto')}, ${formatDate(r.date, lang, true)}${r.hasAttachments ? ', ' + t('Con adjuntos') : ''}${r.threadCount > 1 ? ', ' + r.threadCount + ' ' + t('mensajes') : ''}`}>
        <div className="line">
          <span className="from">{who}</span>
          {r.threadCount > 1 && <span className="badge" aria-hidden="true"><IconThread />{r.threadCount}</span>}
          {r.hasAttachments && <span className="badge" aria-hidden="true"><IconClip /></span>}
          <span className="date" aria-hidden="true">{formatDate(r.date, lang)}</span>
        </div>
        <div className="subject" aria-hidden="true">{r.subject || t('Sin asunto')}</div>
        <div className="snippet" aria-hidden="true">{r.snippet}</div>
      </div>
    )
  }

  return (
    <div ref={listRef} className="list-scroll" role="listbox" tabIndex={0} aria-label={t('Mensajes')} aria-activedescendant={total ? 'row-' + active : undefined}
      aria-busy={total > 0 && !rowAt(active)} onScroll={(e) => setScrollTop((e.target as HTMLElement).scrollTop)} onKeyDown={onKey}
      onFocus={() => { const r = rowAt(active); if (r && selectedId === null) onSelect(r) }}>
      {total === 0 ? (
        <div className="empty" role="status">{filter.query ? t('Ningún resultado') : t('No hay mensajes')}</div>
      ) : (
        <div className="list-inner" style={{ height: total * rowH }}>{items}</div>
      )}
    </div>
  )
}
