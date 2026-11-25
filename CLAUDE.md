# WolfMail

Lector de correo de solo lectura (msg, eml, mbox, pst, ost; cuentas IMAP Google/Outlook) para Windows y Linux. Electron + TypeScript + React. Autor de la marca: TheWolf1724.

## Comandos
- `npm install` / `npm run dev` / `npm run build`
- `npm test` (vitest, núcleo) y `npm run typecheck`
- `xvfb-run -a node scripts/e2e.mjs [carpeta-capturas]`: prueba de humo de la app real y capturas (Linux).
- `npm run dist:linux` (.deb, AppImage) y `npm run dist:win` (NSIS + portable; se genera desde Linux sin Wine gracias a `signAndEditExecutable: false`). Salida en `release/` (fuera de Git).

## Estructura
- `src/core`: sin Electron. Lectores (`parse/`), `library.ts` (SQLite `node:sqlite` + FTS5), `query.ts`, `importer.ts`, `imap.ts`, `oauth.ts`.
- `src/main`: ventana, IPC validado, proceso auxiliar (`worker.ts`), cuentas/ajustes cifrados (`store.ts`).
- `src/preload`, `src/shared/ipc.ts`: puente. Cualquier canal nuevo se añade en `CHANNELS` y `WolfApi`.
- `src/renderer/src`: React. Color solo con variables de `styles.css`; textos en español (clave de `i18n.ts`, traducción inglesa opcional).

## Reglas de este proyecto
- Solo lectura: jamás escribir, mover ni borrar en cuentas o ficheros del usuario. IMAP con `readOnly: true`.
- Sin emojis ni iconos decorativos; iconos SVG propios en `Icons.tsx`.
- Todo cambio en la interfaz mantiene teclado, roles ARIA y contraste (ver docs/DISENO.md, sección 5).
- No cambiar la CSP ni el aislamiento del iframe del cuerpo sin revisión de seguridad.
- Cualquier fecha de cabecera ilegible debe quedar nula, nunca "ahora" (`headerDate`).
- Datos de prueba: `tests/fixtures` (msg de HiraokaHyperTools/msgreader) y los PST/OST de `node_modules/pst-extractor/example/testdata`. No subir correos reales.
- Sin push, sin releases ni repos nuevos hasta que el usuario lo pida. Git local.

## Particularidades
- `ready-to-show` puede no llegar en entornos sin aceleración: la ventana se muestra también tras `did-finish-load`.
- Bajo Xvfb las capturas se piden al proceso principal por el inspector (`--inspect=9339`), no por CDP.
- Modo portable: carpeta `WolfMailData` junto al ejecutable, `portable.flag` o `--portable`.
