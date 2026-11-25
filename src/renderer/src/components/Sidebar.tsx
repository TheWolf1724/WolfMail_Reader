import { useState } from 'react'
import type { FolderInfo, SourceInfo } from '../../../core/types'
import { IconChevron, IconFile, IconFolder, IconMail, IconTrash } from './Icons'
import { useT } from '../i18n'

export interface Scope { sourceId?: number; folderId?: number }

interface Props {
  sources: SourceInfo[]
  folders: Record<number, FolderInfo[]>
  scope: Scope
  totalMessages: number
  onSelect: (s: Scope) => void
  onRemove: (s: SourceInfo) => void
  onLoadFolders: (sourceId: number) => void
}

export function Sidebar({ sources, folders, scope, totalMessages, onSelect, onRemove, onLoadFolders }: Props): JSX.Element {
  const t = useT()
  const [open, setOpen] = useState<Set<number>>(new Set(sources.map((s) => s.id)))
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())

  const toggle = (id: number): void => {
    setOpen((o) => {
      const n = new Set(o)
      if (n.has(id)) n.delete(id)
      else { n.add(id); onLoadFolders(id) }
      return n
    })
  }

  const visibleFolders = (list: FolderInfo[]): FolderInfo[] => {
    const out: FolderInfo[] = []
    for (const f of list) {
      const hidden = [...collapsedFolders].some((c) => f.path.startsWith(c + '/'))
      if (!hidden) out.push(f)
    }
    return out
  }

  return (
    <>
      <h2 className="pane-title" id="side-title">{t('Orígenes')}</h2>
      <ul className="tree" role="tree" aria-labelledby="side-title" onKeyDown={(e) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
        const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=treeitem]')]
        const i = items.indexOf(document.activeElement as HTMLElement)
        if (i < 0) return
        e.preventDefault()
        const n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))
        items[n].focus()
      }}>
        <li role="none">
          <div role="treeitem" aria-selected={!scope.sourceId} aria-level={1} tabIndex={!scope.sourceId ? 0 : -1} className="tree-item"
            onClick={() => onSelect({})} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect({}) } }}>
            <IconMail /><span className="name">{t('Todos los correos')}</span><span className="count">{totalMessages.toLocaleString()}</span>
          </div>
        </li>
        {sources.map((s) => {
          const expanded = open.has(s.id)
          const all = folders[s.id] ?? []
          // Un fichero suelto (.eml/.msg) no tiene jerarquia: no se muestra su carpeta artificial.
          const fl = (s.kind === 'eml' || s.kind === 'msg') && all.length <= 1 ? [] : all
          return (
            <li role="none" key={s.id}>
              <div role="treeitem" aria-level={1} aria-expanded={expanded} aria-selected={scope.sourceId === s.id && !scope.folderId} tabIndex={scope.sourceId === s.id && !scope.folderId ? 0 : -1}
                className="tree-item" onClick={() => onSelect({ sourceId: s.id })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect({ sourceId: s.id }) }
                  if (e.key === 'ArrowRight' && !expanded) toggle(s.id)
                  if (e.key === 'ArrowLeft' && expanded) toggle(s.id)
                }}>
                <button className="twisty" tabIndex={-1} aria-hidden="true" aria-expanded={expanded} onClick={(e) => { e.stopPropagation(); toggle(s.id) }}><IconChevron /></button>
                {s.kind === 'folder' ? <IconFolder /> : <IconFile />}
                <span className="name" title={s.path ?? s.name}>{s.name}</span>
                <span className="count">{s.messageCount.toLocaleString()}</span>
                <button className="btn icon ghost remove" aria-label={`${t('Eliminar')}: ${s.name}`} onClick={(e) => { e.stopPropagation(); onRemove(s) }}><IconTrash /></button>
              </div>
              {expanded && (
                <ul role="group">
                  {visibleFolders(fl).map((f) => {
                    const hasChildren = fl.some((o) => o.path.startsWith(f.path + '/'))
                    const collapsed = collapsedFolders.has(f.path)
                    return (
                      <li role="none" key={f.id}>
                        <div role="treeitem" aria-level={f.depth + 2} aria-selected={scope.folderId === f.id} aria-expanded={hasChildren ? !collapsed : undefined}
                          tabIndex={scope.folderId === f.id ? 0 : -1} className="tree-item" style={{ paddingLeft: 8 + (f.depth + 1) * 16 }}
                          onClick={() => onSelect({ sourceId: s.id, folderId: f.id })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect({ sourceId: s.id, folderId: f.id }) }
                            if (hasChildren && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                              setCollapsedFolders((c) => { const n = new Set(c); if (e.key === 'ArrowLeft') n.add(f.path); else n.delete(f.path); return n })
                            }
                          }}>
                          <IconFolder />
                          <span className="name" title={f.path}>{f.name}</span>
                          <span className={'count' + (f.unread ? ' has-unread' : '')}>
                            {f.unread ? <><span className="sr-only">{f.unread} {t('No leídos')}, </span>{f.unread}</> : f.count.toLocaleString()}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
