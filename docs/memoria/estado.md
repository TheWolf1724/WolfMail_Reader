---
name: estado-wolfmail
description: Estado de WolfMail y punto de RETOMAR
metadata:
  type: project
---

Ultima actualizacion: 2026-11-25. **RETOMAR** desde "Pendiente".

## Hecho (v0.2.0: imprimir y responder via mailto; repo https://github.com/TheWolf1724/WolfMail_Reader, releases con max. 2 versiones por sistema)
## Hecho (v0.1.0)
- Nucleo probado (vitest): lectores eml/emlx/mbox(Gmail Takeout)/msg(+RTF)/pst/ost, biblioteca SQLite+FTS5, hilos, busqueda con operadores, IMAP de solo lectura, OAuth PKCE. Ver `docs/DISENO.md`.
- App Electron: 3 paneles, lista virtualizada, conversaciones, tema claro/oscuro, accesibilidad, ajustes, cuentas, importar por arrastre/menu, exportar PDF/.eml.
- Prueba e2e con la app real (`scripts/e2e.mjs`, 12 comprobaciones) y capturas.
- Paquetes: AppImage y .deb generados y probados en Linux; Windows NSIS + portable (ver `docs/CONSTRUCCION.md`).

## Decisiones
- Electron + `node:sqlite` (sin modulos nativos). Publicado en GitHub el 2026-11-25 a peticion del usuario (token en llavero de gh). Es un lector, NO un buzon: no enviar correo, responder/reenviar solo por mailto.
- Cuerpo del correo siempre sobre "papel" claro, incluso en tema oscuro.

## Pendiente
- Verificar IMAP/OAuth con cuentas reales (necesita credenciales del usuario).
- Revision de accesibilidad con lector de pantalla real.
- Firma de codigo de los .exe (requiere certificado de pago): hoy sin firmar.
- Ideas: TNEF/winmail.dat, .olm, etiquetas locales.
