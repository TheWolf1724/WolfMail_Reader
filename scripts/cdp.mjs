// Utilidad de pruebas: controla la aplicacion Electron por el protocolo de depuracion (CDP).
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function launch({ port = 9333, extraArgs = [], env = {}, exe = null } = {}) {
  const userData = mkdtempSync(join(tmpdir(), 'wolfmail-e2e-'))
  const electron = join(process.cwd(), 'node_modules/.bin/electron')
  const proc = spawn(exe ?? electron, [...(exe ? [] : ['.']), `--remote-debugging-port=${port}`, `--user-data-dir=${userData}`, '--no-sandbox', '--inspect=9339', ...extraArgs], {
    env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe']
  })
  let log = ''
  proc.stdout.on('data', (d) => (log += d))
  proc.stderr.on('data', (d) => (log += d))
  let target
  for (let i = 0; i < 80 && !target; i++) {
    await new Promise((r) => setTimeout(r, 250))
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      target = list.find((t) => t.type === 'page')
    } catch { /* aun arrancando */ }
  }
  if (!target) { proc.kill(); throw new Error('No arranco la aplicacion:\n' + log) }
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  }
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails))
    return r.result?.result?.value
  }
  // Las capturas se piden al proceso principal por el inspector de Node (webContents.capturePage):
  // la captura de CDP se queda esperando un fotograma bajo Xvfb sin gestor de ventanas.
  let mainWs = null
  const mainEval = async (expression) => {
    if (!mainWs) {
      const list = await (await fetch('http://127.0.0.1:9339/json')).json()
      mainWs = new WebSocket(list[0].webSocketDebuggerUrl)
      await new Promise((r, j) => { mainWs.onopen = r; mainWs.onerror = j })
    }
    return new Promise((res) => {
      const i = ++id
      const h = (m) => { const d = JSON.parse(m.data); if (d.id === i) { mainWs.removeEventListener('message', h); res(d) } }
      mainWs.addEventListener('message', h)
      mainWs.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }))
    })
  }
  const shot = async (file) => {
    try {
      const r = await mainEval(`process.mainModule.require('electron').BrowserWindow.getAllWindows()[0].webContents.capturePage().then(i => i.toPNG().toString('base64'))`)
      const data = r.result?.result?.value
      if (data) { writeFileSync(file, Buffer.from(data, 'base64')); return true }
      console.log('aviso: captura vacia', JSON.stringify(r.result).slice(0, 200))
    } catch (e) { console.log('aviso: no se pudo capturar', e.message) }
    return false
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const close = () => { try { ws.close(); mainWs?.close() } catch { /* nada */ } proc.kill('SIGTERM') }
  return { send, evaluate, shot, sleep, close, getLog: () => log, userData }
}
