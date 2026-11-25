import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Library } from '../src/core/library'
import { importPaths } from '../src/core/importer'
import { parseQuery, queryToSql, tokenize } from '../src/core/query'
import { normalizeSubject, cleanMessageId } from '../src/core/threading'
import { rtfToContent } from '../src/core/parse/rtf'

const FIX = join(__dirname, 'fixtures')
const PST = join(__dirname, '..', 'node_modules', 'pst-extractor', 'example', 'testdata', 'enron.pst')
const OST = join(__dirname, '..', 'node_modules', 'pst-extractor', 'example', 'testdata', 'pstextractortest@outlook.com.ost')

let dir: string
let lib: Library
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'wolfmail-')); lib = new Library(join(dir, 'lib')) })
afterEach(() => { lib.close(); rmSync(dir, { recursive: true, force: true }) })

const eml = (id: string, subj: string, extra = '', body = 'Hola mundo') =>
  `Message-ID: <${id}>\r\nFrom: Ana Perez <ana@example.com>\r\nTo: Luis <luis@example.com>\r\nSubject: ${subj}\r\nDate: Mon, 02 Mar 2020 10:00:00 +0000\r\n${extra}MIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n`

describe('consulta', () => {
  it('tokeniza frases y operadores', () => {
    expect(tokenize('de:ana "hola mundo" -spam')).toEqual(['de:ana', '"hola mundo"', '-spam'])
  })
  it('interpreta operadores', () => {
    const q = parseQuery('de:ana asunto:factura despues:2020-01-01 tiene:adjunto es:noleido palabra')
    expect(q.from).toEqual(['ana'])
    expect(q.subject).toEqual(['factura'])
    expect(q.after).toBe(Date.UTC(2020, 0, 1))
    expect(q.hasAttachment).toBe(true)
    expect(q.unread).toBe(true)
    expect(q.fts).toEqual(['"palabra"*'])
  })
  it('escapa comillas y no admite inyeccion SQL', () => {
    const s = queryToSql(parseQuery(`de:"x'; DROP TABLE messages;--" "a\\"b"`))
    expect(s.where.join(' ')).not.toContain('DROP')
    expect(s.params.length).toBeGreaterThan(0)
  })
  it('normaliza asuntos y message-id', () => {
    expect(normalizeSubject('RE: Re[2]: RV: Hola  mundo')).toBe('hola mundo')
    expect(cleanMessageId(' <ABC@x> ')).toBe('abc@x')
  })
})

describe('importacion', () => {
  it('lee eml con adjunto, imagen inline y conserva acentos', async () => {
    const p = join(dir, 'a.eml')
    const raw = [
      'Message-ID: <m1@x>', 'From: =?UTF-8?Q?Jos=C3=A9_Mu=C3=B1oz?= <jose@example.com>', 'To: luis@example.com',
      'Subject: =?UTF-8?Q?Presupuesto_a=C3=B1o?=', 'Date: Tue, 03 Mar 2020 11:00:00 +0100', 'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="B"', '', '--B', 'Content-Type: text/html; charset=utf-8', '',
      '<p>Hola <b>mundo</b></p><img src="cid:logo@x">', '--B',
      'Content-Type: image/png; name="logo.png"', 'Content-ID: <logo@x>', 'Content-Disposition: inline; filename="logo.png"', 'Content-Transfer-Encoding: base64', '', 'iVBORw0KGgo=', '--B',
      'Content-Type: application/pdf; name="doc.pdf"', 'Content-Disposition: attachment; filename="doc.pdf"', 'Content-Transfer-Encoding: base64', '', 'JVBERi0xLjQK', '--B--', ''
    ].join('\r\n')
    writeFileSync(p, raw)
    const r = await importPaths(lib, [p])
    expect(r.added).toBe(1)
    const list = lib.list({}, 0, 10)
    expect(list[0].subject).toBe('Presupuesto año')
    expect(list[0].fromName).toBe('José Muñoz')
    expect(list[0].hasAttachments).toBe(true)
    const m = lib.getMessage(list[0].id)!
    expect(m.attachments.map((a) => a.name).sort()).toEqual(['doc.pdf', 'logo.png'])
    expect(m.attachments.find((a) => a.name === 'logo.png')!.cid).toBe('logo@x')
    const data = lib.readAttachment(m.attachments.find((a) => a.name === 'doc.pdf')!.id)!
    expect(data.data.toString('latin1')).toBe('%PDF-1.4\n')
  })

  it('lee mbox estilo Gmail con etiquetas, deshace ">From" y agrupa hilos', async () => {
    const p = join(dir, 'Takeout.mbox')
    const m1 = eml('a@x', 'Reunion', 'X-Gmail-Labels: Recibidos,Importante,Clientes\r\n', 'Hola\r\n>From aqui con escape\r\nfin')
    const m2 = eml('b@x', 'Re: Reunion', 'In-Reply-To: <a@x>\r\nReferences: <a@x>\r\nX-Gmail-Labels: Enviados,Clientes\r\n', 'Respuesta')
    writeFileSync(p, `From 1@xxx Mon Mar  2 10:00:00 +0000 2020\n${m1.replace(/\r\n/g, '\n')}\nFrom 2@xxx Mon Mar  2 11:00:00 +0000 2020\n${m2.replace(/\r\n/g, '\n')}\n`)
    const r = await importPaths(lib, [p])
    expect(r.added).toBe(2)
    const rows = lib.list({ grouped: true }, 0, 10)
    expect(rows).toHaveLength(1)
    expect(rows[0].threadCount).toBe(2)
    const thread = lib.getThread(rows[0].threadId)
    expect(thread).toHaveLength(2)
    expect(thread[0].text).toContain('From aqui con escape')
    expect(thread[0].labels).toContain('Clientes')
    expect(lib.listFolders(1).map((f) => f.path)).toContain('Takeout/Recibidos')
    expect(lib.count({ query: 'etiqueta:clientes' })).toBe(2)
  })

  it('deduplica por Message-ID al reimportar', async () => {
    const p = join(dir, 'a.eml')
    writeFileSync(p, eml('dup@x', 'Uno'))
    await importPaths(lib, [p])
    const r = await importPaths(lib, [p])
    expect(r.added).toBe(0)
    expect(r.duplicates).toBe(1)
    expect(lib.stats().messages).toBe(1)
  })

  it('busca por texto, remitente, fecha y excluye terminos', async () => {
    const d = join(dir, 'in'); mkdirSync(d)
    writeFileSync(join(d, '1.eml'), eml('1@x', 'Factura enero', '', 'Importe pendiente de cobro'))
    writeFileSync(join(d, '2.eml'), eml('2@x', 'Vacaciones', '', 'Nos vamos a la playa'))
    await importPaths(lib, [d])
    expect(lib.count({ query: 'factura' })).toBe(1)
    expect(lib.count({ query: 'cobro' })).toBe(1)
    expect(lib.count({ query: 'de:ana' })).toBe(2)
    expect(lib.count({ query: 'playa -factura' })).toBe(1)
    expect(lib.count({ query: '-playa' })).toBe(1)
    expect(lib.count({ query: 'antes:2020-01-01' })).toBe(0)
    expect(lib.count({ query: 'despues:2020-01-01' })).toBe(2)
    expect(lib.count({ query: 'facturá' })).toBe(1) // sin distinguir acentos
  })

  it('ordena y pagina', async () => {
    const d = join(dir, 'in'); mkdirSync(d)
    for (let i = 0; i < 5; i++) writeFileSync(join(d, `${i}.eml`), eml(`${i}@x`, `Asunto ${i}`).replace('02 Mar 2020 10:00:00', `0${i + 1} Mar 2020 10:00:00`))
    await importPaths(lib, [d])
    const rows = lib.list({ sort: 'date-desc' }, 0, 2)
    expect(rows.map((r) => r.subject)).toEqual(['Asunto 4', 'Asunto 3'])
    expect(lib.list({ sort: 'date-asc' }, 4, 2).map((r) => r.subject)).toEqual(['Asunto 4'])
  })
})

describe('formatos de Outlook', () => {
  it('lee .msg con adjunto y cabeceras de transporte', async () => {
    const r = await importPaths(lib, [join(FIX, 'test.msg')])
    expect(r.added).toBe(1)
    const m = lib.getMessage(lib.list({}, 0, 1)[0].id)!
    expect(m.subject).toBe('asdf')
    expect(m.fromEmail).toContain('@')
    expect(m.attachments[0].name).toMatch(/\.jpg$/)
    const a = lib.readAttachment(m.attachments[0].id)!
    expect(a.data.byteLength).toBe(122784)
    expect(a.data[0]).toBe(0xff) // firma JPEG
    expect(m.date).toBe(Date.UTC(2018, 2, 23, 16, 6, 29))
  })

  it('lee .msg Unicode sin cabeceras', async () => {
    const r = await importPaths(lib, [join(FIX, 'unicode.msg')])
    expect(r.added).toBe(1)
    expect(lib.list({}, 0, 1)[0].subject).toBe('A memo.')
  })

  it.skipIf(!existsSync(PST))('lee un PST real con jerarquia de carpetas', async () => {
    const r = await importPaths(lib, [PST])
    expect(r.added).toBe(71) // recuento independiente recorriendo el PST con la propia libreria
    expect(r.failed).toBe(0)
    const folders = lib.listFolders(1)
    expect(folders.length).toBeGreaterThan(1)
    const all = lib.list({}, 0, 100)
    expect(all.every((r) => r.date !== null && r.date < Date.UTC(2010, 0, 1))).toBe(true) // fechas del correo, no la de importacion
    const row = lib.list({ query: 'enron' }, 0, 1)[0]
    expect(row).toBeDefined()
    const m = lib.getMessage(row.id)!
    expect(m.text.length + (m.html?.length ?? 0)).toBeGreaterThan(0)
  })

  it.skipIf(!existsSync(OST))('lee un OST', async () => {
    const r = await importPaths(lib, [OST])
    expect(r.failed).toBe(0)
    expect(r.phase).toBe('terminado')
  })
})

describe('robustez', () => {
  it('fichero corrupto no rompe la importacion de los demas', async () => {
    const d = join(dir, 'in'); mkdirSync(d)
    writeFileSync(join(d, 'mal.msg'), Buffer.from('esto no es un msg'))
    writeFileSync(join(d, 'bien.eml'), eml('ok@x', 'Bien'))
    const r = await importPaths(lib, [d])
    expect(r.added).toBe(1)
  })
  it('cancelar detiene la importacion', async () => {
    const d = join(dir, 'in'); mkdirSync(d)
    for (let i = 0; i < 3; i++) writeFileSync(join(d, `${i}.eml`), eml(`${i}@x`, `A${i}`))
    const ac = new AbortController(); ac.abort()
    const r = await importPaths(lib, [d], { signal: ac.signal })
    expect(r.phase).toBe('cancelado')
    expect(r.added).toBe(0)
  })
  it('borrar un origen limpia mensajes e indice', async () => {
    const p = join(dir, 'a.eml'); writeFileSync(p, eml('x@x', 'Uno', '', 'palabraunica'))
    await importPaths(lib, [p])
    lib.removeSource(1)
    expect(lib.stats().messages).toBe(0)
    expect(lib.count({ query: 'palabraunica' })).toBe(0)
    expect(lib.compact()).toBe(0)
  })
})

describe('rtf', () => {
  it('extrae texto plano', () => {
    expect(rtfToContent('{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}Hola \\\'e1rbol\\par fin}').text).toContain('Hola árbol')
  })
  it('ignora tablas de fuentes y colores', () => {
    const r = rtfToContent('{\\rtf1\\ansi{\\fonttbl{\\f0\\fnil Arial;}{\\f1 Courier New;}}{\\colortbl;\\red0\\green0\\blue0;}{\\*\\generator Riched20}Texto real\\par}')
    expect(r.text).toBe('Texto real')
  })
  it('desencapsula HTML', () => {
    const r = rtfToContent('{\\rtf1\\ansi\\fromhtml1 {\\*\\htmltag64 <p>}\\htmlrtf Hola\\htmlrtf0 {\\*\\htmltag72 </p>}}')
    expect(r.html).toContain('<p>')
  })
})

import { headerDate } from '../src/core/parse/common'
describe('fechas', () => {
  it('una cabecera Date ilegible no se convierte en la fecha de hoy', () => {
    expect(headerDate('Date: garbage\r\nFrom: a@b.c')).toBeNull()
    expect(headerDate('From: a@b.c')).toBeNull()
  })
  it('rescata la primera fecha de una cabecera duplicada', () => {
    expect(headerDate('Date: Thu, 23 Aug 2001 15:49:51 -0700 (PDT),Thu, 23 Aug 2001 15:49:51 -0600')).toBe(Date.UTC(2001, 7, 23, 22, 49, 51))
  })
  it('usa Received como ultimo recurso', () => {
    expect(headerDate('Received: from x by y; Mon, 02 Mar 2020 10:00:00 +0000\r\nSubject: s')).toBe(Date.UTC(2020, 2, 2, 10))
  })
  it('lee fechas normales y plegadas', () => {
    expect(headerDate('Date: Tue, 03 Mar 2020\r\n 11:00:00 +0100')).toBe(Date.UTC(2020, 2, 3, 10))
  })
})

describe('consultas negadas y limpieza (revision)', () => {
  it('-de: excluye y -"frase" se tokeniza', async () => {
    const d = join(dir, 'in'); mkdirSync(d)
    writeFileSync(join(d, '1.eml'), eml('1@x', 'Uno', '', 'foo bar baz'))
    writeFileSync(join(d, '2.eml'), eml('2@x', 'Dos', '', 'otra cosa').replace('Ana Perez <ana@example.com>', 'Pepe <pepe@example.com>'))
    await importPaths(lib, [d])
    expect(lib.count({})).toBe(2)
    expect(lib.count({ query: 'de:pepe' })).toBe(1)
    expect(lib.count({ query: '-de:ana' })).toBe(1)
    expect(lib.count({ query: 'cosa -"foo bar"' })).toBe(1)
    expect(lib.count({ query: '-"foo bar"' })).toBe(1)
    expect(tokenize('-"foo bar"')).toEqual(['-"foo bar"'])
    expect(lib.count({ query: '... foo' })).toBe(1)
  })
  it('hilos no se mezclan entre origenes', async () => {
    const a = join(dir, 'a.eml'), b = join(dir, 'b.eml')
    writeFileSync(a, eml('same@x', 'Hola')); writeFileSync(b, eml('same@x', 'Hola'))
    await importPaths(lib, [a]); await importPaths(lib, [b])
    const rows = lib.list({ grouped: true }, 0, 10)
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.threadCount === 1)).toBe(true)
  })
})
