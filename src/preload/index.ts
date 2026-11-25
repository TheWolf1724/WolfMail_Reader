import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { WolfApi } from '../shared/ipc'
import { CHANNELS } from '../shared/ipc'

const invoke = (c: string) => (...a: unknown[]): Promise<unknown> => ipcRenderer.invoke(c, ...a)

function subscribe<T>(channel: string, cb: (v: T) => void): () => void {
  const fn = (_e: unknown, v: T): void => cb(v)
  ipcRenderer.on(channel, fn)
  return () => ipcRenderer.removeListener(channel, fn)
}

const api = Object.fromEntries(CHANNELS.map((c) => [c, invoke(c)])) as unknown as WolfApi
api.pathsForFiles = (files: File[]) => files.map((f) => webUtils.getPathForFile(f)).filter(Boolean)
api.onProgress = (cb) => subscribe('progress', cb)
api.onDataChanged = (cb) => subscribe('dataChanged', cb)
api.onOpenPaths = (cb) => subscribe('openPaths', cb)
api.onMenu = (cb) => subscribe('menu', cb)
api.onSystemTheme = (cb) => subscribe('systemTheme', cb)

contextBridge.exposeInMainWorld('wolf', api)
