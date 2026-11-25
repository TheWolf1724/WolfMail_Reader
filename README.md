# WolfMail

Lector de correo electrónico de **solo lectura** para Windows y Linux. Abre mensajes y archivos de correo de Outlook y Google (`.msg`, `.eml`, `.mbox`, `.pst`, `.ost`, `.emlx`) y sincroniza cuentas por IMAP, reuniendo todo el histórico en una biblioteca local con búsqueda instantánea.

No envía, modifica ni borra nada: ni en sus archivos ni en sus cuentas.

## Qué resuelve

- Lee **todo** el histórico: carpetas completas, buzones PST/OST de varios GB y exportaciones de Google Takeout, con importación en segundo plano y barra de progreso.
- Muestra las **conversaciones completas** (incluidos los mensajes de otras carpetas, como Enviados), no solo el último mensaje.
- Búsqueda de texto completo, sin distinguir acentos, con operadores (`de:`, `para:`, `asunto:`, `adjunto:`, `carpeta:`, `etiqueta:`, `antes:`, `despues:`, `tiene:adjunto`, `es:noleido`).
- Lista virtualizada: fluida con cientos de miles de mensajes.

## Formatos y orígenes

| Origen | Formato | Notas |
| --- | --- | --- |
| Outlook | `.msg`, `.oft`, `.pst`, `.ost` | Cuerpo HTML, texto o solo RTF; adjuntos y mensajes adjuntos (`.msg` anidados); jerarquía de carpetas |
| Google | `.mbox` de Takeout | Etiquetas de Gmail (`X-Gmail-Labels`), no leídos |
| General | `.eml`, `.emlx`, `.mbox`, carpetas completas | Detección por firma del archivo, no solo por extensión |
| Cuentas | IMAP (Gmail, Outlook/Microsoft 365, otros) | Solo lectura; OAuth 2.0 con PKCE o contraseña de aplicación. Ver [docs/CUENTAS.md](docs/CUENTAS.md) |

## Instalación

Descargue desde la página de versiones:

| Sistema | Instalable | Portable |
| --- | --- | --- |
| Windows 10/11 (64 bits) | `WolfMail-X.Y.Z-windows-setup.exe` | `WolfMail-X.Y.Z-windows-portable.exe` |
| Linux (64 bits) | `WolfMail-X.Y.Z-linux-amd64.deb` | `WolfMail-X.Y.Z-linux-portable.AppImage` |

**Modo portable:** guarda sus datos junto al ejecutable, en la carpeta `WolfMailData`. En la versión instalada, los datos van al perfil del usuario. También se activa creando un archivo `portable.flag` junto al programa o arrancando con `--portable`.

Linux, AppImage: `chmod +x WolfMail-*.AppImage && ./WolfMail-*.AppImage`. Si da el error `libfuse.so.2` (Ubuntu 22.04 y posteriores), instale `libfuse2` o ejecute `APPIMAGE_EXTRACT_AND_RUN=1 ./WolfMail-*.AppImage`.

## Uso rápido

1. Arrastre archivos o carpetas a la ventana, o use **Abrir archivos** (`Ctrl+O`) / **Abrir carpeta** (`Ctrl+Mayús+O`).
2. Navegue por carpetas a la izquierda, lista en el centro y lectura a la derecha.
3. Busque con `Ctrl+F` o `/`. Pulse `F1` para ver todos los atajos.

## Imprimir y responder
WolfMail es un **lector**, no un buzón: no envía correo. Desde cualquier mensaje puede **imprimirlo** (Ctrl+P; en Linux abre un PDF en el visor para imprimir desde allí), **exportarlo a PDF** o **guardarlo como .eml**. **Responder** (Ctrl+R), **responder a todos** (Ctrl+Mayús+R) y **reenviar** (Ctrl+Mayús+F) abren su programa de correo habitual con destinatarios, asunto y texto citado ya preparados.

## Seguridad y privacidad

- El HTML de los correos se limpia (DOMPurify) y se muestra en un marco aislado sin scripts ni formularios.
- Las **imágenes remotas se bloquean** por defecto (evitan el rastreo de apertura); se muestran por mensaje, a petición.
- Los enlaces piden confirmación mostrando la dirección real. Los adjuntos ejecutables nunca se abren desde la aplicación.
- Las credenciales se cifran con el llavero del sistema (Electron `safeStorage`). Si no hay llavero, solo se guardan durante la sesión.
- Sin telemetría. La aplicación no hace conexiones salvo las cuentas que usted añada.

## Accesibilidad

Diseñado para teclado y lectores de pantalla: regiones de referencia, árbol y lista con roles ARIA, foco visible, diálogos modales nativos, anuncio de estado, texto escalable (85 %-160 %), respeto de `prefers-reduced-motion` y de modo de alto contraste. Detalle en [docs/DISENO.md](docs/DISENO.md).

## Tema claro y oscuro

Tema claro por defecto. El tema oscuro y el automático (según el sistema) están disponibles en **Ajustes**. Todo el color sale de variables CSS (`src/renderer/src/styles.css`).

## Desarrollo

Requisitos: Node.js 24 o superior.

```bash
npm install
npm run dev          # aplicación en modo desarrollo
npm test             # pruebas del núcleo (vitest)
npm run typecheck
npm run dist:linux   # .deb y AppImage en release/
npm run dist:win     # instalador NSIS y portable en release/
```

Prueba de humo de la aplicación real (Linux, con Xvfb): `xvfb-run -a node scripts/e2e.mjs`.

Estructura: `src/core` (lectores, biblioteca SQLite, IMAP, OAuth; sin dependencias de Electron y con pruebas), `src/main` (proceso principal), `src/preload` (puente seguro), `src/renderer` (interfaz React), `docs/`, `tests/`.

## Licencia

MIT. Las dependencias conservan sus licencias propias.
