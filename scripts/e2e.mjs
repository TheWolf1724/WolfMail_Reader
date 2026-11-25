// Prueba de humo de la aplicacion real. Uso: xvfb-run -a node scripts/e2e.mjs [carpeta-capturas]
import { launch } from './cdp.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? join(process.cwd(), 'tests', '.tmp')
mkdirSync(out, { recursive: true })
const fixtures = join(process.cwd(), 'tests', 'fixtures')
const eml = join(out, 'html.eml')
writeFileSync(eml, [
  'Message-ID: <e2e1@x>', 'From: "Ana Garcia" <ana@example.com>', 'To: luis@example.com', 'Subject: Prueba HTML con acentos y imagen remota',
  'Date: Mon, 02 Mar 2020 10:00:00 +0000', 'MIME-Version: 1.0', 'Content-Type: text/html; charset=utf-8', '',
  '<h2>Hola</h2><p>Esto es <b>negrita</b>. <a href="https://example.com/x">enlace</a></p><img src="https://tracker.example.com/p.gif" width="10" height="10">',
  '<script>document.title="HACKEADO"</script><form action="https://evil.example"><input name=a></form>', ''
].join('\r\n'))

const app = await launch()
const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(ok ? 'OK   ' : 'FALLO', name, extra) }
const call = (expr) => app.evaluate(`(async()=>{${expr}})()`)
const key = async (k, code = k, mods = 0) => {
  await app.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, modifiers: mods, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : ({ ArrowDown: 40, ArrowUp: 38, Enter: 13, Escape: 27, Home: 36, End: 35, F6: 117 })[k] })
  await app.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code })
}
try {
  await app.sleep(1500)
  check('pantalla de bienvenida vacia', await call(`return document.body.innerText.includes('Bienvenido')`))
  await app.shot(join(out, '01-bienvenida.png'))

  // Arrastrar y soltar un fichero real sobre la ventana.
  const drag = { items: [], files: [eml], dragOperationsMask: 1 }
  await app.send('Input.dispatchDragEvent', { type: 'dragEnter', x: 400, y: 300, data: drag })
  await app.sleep(200)
  check('overlay de arrastre visible', await call(`return !!document.querySelector('.dropzone-overlay')`))
  await app.send('Input.dispatchDragEvent', { type: 'dragOver', x: 400, y: 300, data: drag })
  await app.send('Input.dispatchDragEvent', { type: 'drop', x: 400, y: 300, data: drag })
  for (let i = 0; i < 20; i++) { await app.sleep(300); if (await call(`return (await window.wolf.stats()).messages >= 1`)) break }
  check('soltar un fichero lo importa', await call(`return (await window.wolf.stats()).messages`) === 1)
  check('overlay desaparece al soltar', await call(`return !document.querySelector('.dropzone-overlay')`))
  await call(`return window.wolf.startImport(['${fixtures}/test.msg','${eml}','${process.cwd()}/node_modules/pst-extractor/example/testdata/enron.pst'])`)
  for (let i = 0; i < 40; i++) { await app.sleep(500); if (await call(`return (await window.wolf.stats()).messages >= 73`)) break }
  await app.sleep(800)
  check('importacion de msg + eml + pst', await call(`return (await window.wolf.stats()).messages`) === 73)
  await app.shot(join(out, '02-lista.png'))

  // Teclado: foco a la lista y navegacion.
  await call(`document.querySelector('[role=listbox]').focus()`)
  await key('ArrowDown'); await key('ArrowDown'); await app.sleep(500)
  check('flecha abajo mueve la seleccion', await call(`return document.querySelector('[role=option][aria-selected=true]')?.id`) !== null)

  // Buscar mensaje HTML.
  await call(`const i=document.getElementById('q'); i.focus(); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(i,'imagen remota'); i.dispatchEvent(new Event('input',{bubbles:true}))`)
  await app.sleep(900)
  const n = await call(`return document.querySelectorAll('[role=option]').length`)
  check('busqueda encuentra 1 mensaje', n === 1, `(${n})`)
  await call(`document.querySelector('[role=option]').click()`)
  await app.sleep(1200)
  const fr = await call(`const f=document.querySelector('iframe'); return JSON.stringify({sandbox:f?.getAttribute('sandbox'), hasScript: !!f?.contentDocument?.querySelector('script'), hasForm: !!f?.contentDocument?.querySelector('form'), title: document.title, csp: f?.srcdoc.match(/Content-Security-Policy" content="([^"]*)/)?.[1], banner: document.body.innerText.includes('bloqueado')})`)
  console.log(fr)
  const o = JSON.parse(fr)
  check('iframe aislado (sandbox sin scripts)', o.sandbox === 'allow-same-origin')
  check('script y formulario eliminados', !o.hasScript && !o.hasForm && o.title === 'WolfMail')
  check('imagenes remotas bloqueadas por CSP y aviso visible', !o.csp.includes('https:') && o.banner)
  await app.shot(join(out, '03-lector-claro.png'))

  // Tema oscuro y limpieza de busqueda.
  await call(`await window.wolf.setSettings({theme:'dark'})`)
  await app.send('Page.reload')
  await app.sleep(2500)
  check('tema oscuro aplicado', await call(`return document.documentElement.dataset.theme`) === 'dark')
  await app.shot(join(out, '04-oscuro.png'))
  // Mensaje .msg con adjunto, en tema oscuro (el cuerpo se muestra siempre sobre fondo claro).
  await call(`const i=document.getElementById('q'); i.focus(); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(i,'asdf'); i.dispatchEvent(new Event('input',{bubbles:true}))`)
  await app.sleep(900)
  await call(`document.querySelector('[role=option]').click()`)
  await app.sleep(1000)
  check('adjunto del .msg visible', await call(`return document.body.innerText.includes('.jpg')`))
  check('botones imprimir y responder visibles', await call(`const t=document.body.innerText; return ['Responder','Responder a todos','Reenviar','Imprimir','Exportar a PDF'].every(x=>t.includes(x))`))
  await app.shot(join(out, '05-msg-oscuro.png'))

  // Ayuda con ?, cierre con Esc y foco devuelto.
  await call(`document.getElementById('q').blur(); document.body.focus()`)
  await key('?')
  await app.sleep(500)
  check('dialogo de ayuda modal abierto', await call(`return !!document.querySelector('dialog[open]')`))
  await app.shot(join(out, '06-ayuda.png'))
  await key('Escape')
  await app.sleep(400)
  check('Esc cierra el dialogo', await call(`return !document.querySelector('dialog[open]')`))

  // Pantalla estrecha y tema claro.
  await call(`await window.wolf.setSettings({theme:'light'})`)
  await app.send('Page.reload')
  await app.send('Emulation.setDeviceMetricsOverride', { width: 560, height: 800, deviceScaleFactor: 1, mobile: false })
  await app.sleep(2500)
  check('diseno adaptable sin desbordamiento horizontal', await call(`return document.documentElement.scrollWidth <= innerWidth + 1`))
  await app.shot(join(out, '07-estrecho.png'))
} catch (e) { console.log('ERROR', e.message); results.push({ name: 'excepcion', ok: false }) }
finally {
  const log = app.getLog().split('\n').filter((l) => !l.includes('VMware') && l.trim())
  if (log.length) console.log('--- registro ---\n' + log.slice(-10).join('\n'))
  app.close()
  const bad = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - bad}/${results.length} comprobaciones correctas`)
  setTimeout(() => process.exit(bad ? 1 : 0), 500)
}
