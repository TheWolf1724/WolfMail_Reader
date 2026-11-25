# Diseño y planteamiento de WolfMail

## 1. Problema

El visor de referencia (CoolUtils Mail Viewer, aplicación Delphi de Windows) es poco orgánico: abre un mensaje cada vez, no reconstruye conversaciones, no lee el histórico completo de un buzón y no ofrece búsqueda. Se pide un lector completo, fácil de usar, para Windows y Linux (instalable y portable), con Google y Outlook, tema claro (con diseño preparado para oscuro), y con cuidado especial en accesibilidad, UX, diseño y rendimiento.

## 2. Lluvia de ideas y decisiones

| Idea | Decisión | Motivo |
| --- | --- | --- |
| Visor de un mensaje por ventana | Descartada | Es el problema original |
| Biblioteca local con índice | **Adoptada** | Permite leer todo el histórico, buscar y ordenar al instante |
| Conectar a la nube con la API de Gmail / Graph | Descartada | Exige registrar una aplicación verificada por Google/Microsoft; IMAP + OAuth del propio usuario cubre lo mismo gratis |
| Importar Google Takeout (`.mbox`) y Outlook (`.pst`) | **Adoptada** | Es lo que ya tiene el usuario; no necesita cuentas ni red |
| IMAP de solo lectura | **Adoptada** | Cuentas vivas sin riesgo: nunca escribe en el servidor |
| Redactar y enviar | Descartada | Fuera de alcance: es un lector. Reduce superficie de ataque |
| Aplicación nativa (Qt/Rust) | Descartada | Electron da una sola base para Windows y Linux, accesibilidad web madura (ARIA, lectores de pantalla) y empaquetado portable/instalable gratuito |
| Base de datos | SQLite integrado en Node (`node:sqlite`) con FTS5 | Sin módulos nativos que compilar por plataforma |
| Marco de interfaz | React 19 + CSS propio con variables | Sin librerías de componentes: control total de accesibilidad y peso |

## 3. Arquitectura

```
Proceso principal (Electron)         Proceso auxiliar (utilityProcess)     Interfaz (renderer, aislada)
  ventana, menú, diálogos, IPC  <-->   importador / sincronizador IMAP  -->   React, sin acceso a Node
  biblioteca (lectura)                 biblioteca (escritura, WAL)            solo window.wolf (preload)
  cuentas y ajustes (safeStorage)
```

- `src/core`: lógica pura sin Electron (probada con vitest): lectores de formato, biblioteca, consultas, hilos, IMAP, OAuth.
- La importación corre en un proceso aparte: la interfaz no se bloquea con PST de varios GB. SQLite en modo WAL permite leer mientras se escribe.
- Los mensajes se normalizan a un único modelo (`NormalizedMessage`); la interfaz no sabe de qué formato vienen.

### Modelo de datos

Orígenes (archivo, carpeta o cuenta) → carpetas → mensajes. Los adjuntos se guardan en disco por hash SHA-256 (sin duplicados). Un índice FTS5 (`unicode61 remove_diacritics`) indexa asunto, remitente, destinatarios y cuerpo. Los mensajes se deduplican por `Message-ID` (o huella del contenido) dentro de cada origen, así reimportar un archivo no duplica nada.

### Conversaciones

Los hilos se construyen con `Message-ID`, `In-Reply-To` y `References`; si faltan, por asunto normalizado (sin `Re:`/`RV:`/`Fwd:`) y proximidad de 30 días, solo en respuestas. La vista de conversación muestra todos los mensajes del hilo, también los de otras carpetas (Enviados), que es lo que el visor original no hacía.

## 4. Formatos

- `.eml`/`.emlx`: mailparser. `.mbox`: división en streaming (ficheros de varios GB en memoria constante), deshace el escape `>From`, lee `X-Gmail-Labels`.
- `.msg`: `@kenjiuno/msgreader`; si solo hay cuerpo RTF comprimido, se descomprime y se desencapsula el HTML (`\fromhtml`). Si hay cabeceras de transporte, se usan para direcciones SMTP e hilos.
- `.pst`/`.ost`: `pst-extractor` (JavaScript puro), con jerarquía de carpetas, adjuntos y estado de leído.
- Detección por firma del archivo (`!BDN`, cabecera CFB, `From `), no solo por extensión.
- Fechas: una cabecera `Date` ilegible nunca se sustituye por "hoy" (mailparser lo hace); se rescata la primera fecha válida, después `Received`, o se deja sin fecha.

## 5. Diseño de interfaz

Tres paneles clásicos (carpetas, lista, lectura) con divisores redimensionables, también por teclado. Panel de lectura a la derecha o abajo. En pantallas estrechas (<= 900 px) pasa a un panel cada vez con botón de carpetas y de retorno.

Principios: lo habitual a un clic, lo avanzado (operadores de búsqueda) descubrible con `F1`; estado siempre visible (barra inferior con progreso y resumen); nada destructivo (quitar un origen solo borra la copia local y lo dice).

### Tema

Todo el color sale de *tokens* CSS (`:root` para claro, `[data-theme='dark']` para oscuro). Cambiar de tema solo redefine tokens. Por defecto claro; oscuro y "sistema" en Ajustes. El cuerpo del correo siempre se muestra sobre "papel" claro: los correos HTML traen colores propios pensados para fondo blanco y forzarlos rompería su legibilidad.

### Accesibilidad (objetivo WCAG 2.2 AA)

- Estructura: *skip link*, regiones con nombre (`nav`, `main`, `search`, `status`), un `h1` real en bienvenida.
- Árbol de carpetas (`role=tree`, `aria-level`, `aria-expanded`, tabulación única con flechas) y lista (`role=listbox`, `aria-activedescendant`, `aria-posinset/setsize` para la lista virtualizada). Cada fila tiene etiqueta hablada completa (no leído, remitente, asunto, fecha, adjunto, tamaño del hilo).
- Teclado completo: flechas, `j/k`, `Inicio/Fin`, `Re Pág/Av Pág`, `/` y `Ctrl+F`, `F6` (cambiar de panel), `?`/`F1`, `Esc`. Divisores con flechas.
- Diálogos con `<dialog>` modal nativo: foco atrapado, `Esc`, restauración del foco.
- Foco siempre visible (3 px), objetivos de toque de 36 px, texto escalable 85-160 % (todo en `rem`), contraste >= 4,5:1 en ambos temas, color nunca como único indicador (el no leído lleva punto y negrita y se anuncia).
- Respeta `prefers-reduced-motion` y `forced-colors` (alto contraste).
- Estado y avisos en regiones `aria-live="polite"`.

## 6. Seguridad

- Renderer con `sandbox`, `contextIsolation`, sin Node, CSP estricta (`default-src 'none'`), navegación y ventanas nuevas bloqueadas, permisos del navegador denegados.
- Puente `preload` mínimo; el proceso principal valida cada parámetro de cada canal IPC.
- Correo HTML: DOMPurify + marco `sandbox="allow-same-origin"` (sin `allow-scripts`) con su propia CSP. Imágenes remotas bloqueadas hasta que el usuario lo pide, por mensaje. Imágenes incrustadas por esquema interno `wolfmail-att://` que solo sirve imágenes.
- Enlaces: confirmación con la URL real; solo `http`, `https` y `mailto`.
- Adjuntos: lista negra de ejecutables y scripts (no se abren), apertura con confirmación, copia temporal con permisos 0600 que se borra al salir.
- Exportar a PDF en una ventana oculta sin JavaScript ni red.
- Credenciales cifradas con `safeStorage`; sin llavero, solo en memoria. Sin telemetría.

## 7. Rendimiento

- Lista virtualizada con paginación de 100 en 100: coste constante con cientos de miles de mensajes.
- Consultas con índices por carpeta/fecha/hilo; búsqueda con FTS5; transacciones por lotes de 100 en la importación.
- Importación en proceso aparte, cancelable; mbox en streaming; adjuntos a disco, no a la base.

## 8. Empaquetado

electron-builder: Windows NSIS (instalador por usuario) y portable de un solo `.exe`; Linux `.deb` y AppImage (portable). El portable guarda datos en `WolfMailData` junto al programa.

## 9. Pendiente / ideas futuras

- Verificar IMAP/OAuth contra servidores reales (requiere credenciales del usuario).
- TNEF (`winmail.dat`), `.olm`, `.nsf`.
- Etiquetas y estrellas locales, exportar conversaciones, sincronización programada.
- Revisión de accesibilidad con lector de pantalla real (Orca, NVDA) por una persona usuaria.
- Firma de código de los ejecutables (requiere certificado de pago; hoy sin firmar, Windows mostrará SmartScreen).
