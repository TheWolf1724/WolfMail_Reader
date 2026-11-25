# Registro de cambios

## 0.3.3 - 2026-11-25
- Responder y reenviar citan el mensaje completo (con su historial), limpio de [image:] y enlaces sueltos y con las lineas partidas del texto plano re-unidas. Limite del enlace: 8000 caracteres (1900 en Windows). Si el mensaje no cabe, se copia el texto completo al portapapeles para pegarlo con Ctrl+V.

## 0.3.2 - 2026-11-25
- Responder y reenviar: el texto citado ya no arrastra marcadores [image: ...], enlaces <http://...>, firmas ni el historial anidado; se corta en un limite de linea (sin romper frases ni emojis) y la fecha tiene formato natural.

## 0.3.1 - 2026-11-25
- Corregido: los operadores de busqueda (de:, para:, asunto:, adjunto:, carpeta:, etiqueta:) distinguian acentos y mayusculas no ASCII; ahora `de:jose` encuentra a "José" y `de:lopez` a "López".

## 0.3.0 - 2026-11-25
- Barra de acciones fija sobre el lector: Responder, Responder a todos, Reenviar e Imprimir.
- Atajos Ctrl+P / Ctrl+R / Ctrl+Mayus+R / Ctrl+Mayus+F funcionando desde el menu.
- Corregido: las imagenes incrustadas (firmas, logos) no se veian; la deteccion de imagenes remotas era incompleta; el ajuste "Imagenes remotas: nunca" no se aplicaba.
- Seguridad: la ventana de impresion/PDF no puede navegar ni usar red; se quitan .doc/.xls/.ppt de la lista de adjuntos que se abren directamente; se borran temporales de sesiones anteriores.
- Imprimir/PDF funciona con correos HTML grandes; responder no falla con emojis ni sin programa de correo; responder a un mensaje propio va a sus destinatarios.
- No se puede quitar un origen durante una importacion; IMAP reintenta los mensajes que no se pudieron leer; la importacion limita la memoria con adjuntos grandes.
- RTF: comillas curvas, euro y \uc correctos. Menu Edicion con deshacer, cortar y pegar. Arbol de carpetas desplegado y accesible por teclado. Avisos que no se pisan.

## 0.2.0 - 2026-11-25
- Imprimir el mensaje (Ctrl+P): dialogo del sistema en Windows; en Linux abre un PDF en el visor para imprimir desde alli.
- Responder (Ctrl+R), responder a todos (Ctrl+Mayus+R) y reenviar (Ctrl+Mayus+F): abren el programa de correo del sistema con destinatarios, asunto y texto citado. WolfMail sigue siendo solo lector y no envia correo.
- El PDF incluye la lista de adjuntos.

## 0.1.0 - 2026-11-25
Primera version.
- Lectura de .msg, .eml, .emlx, .mbox (incluido Google Takeout), .pst y .ost; carpetas completas.
- Biblioteca local con busqueda de texto completo y operadores; conversaciones completas.
- Cuentas IMAP de solo lectura (Gmail, Outlook/Microsoft 365) con OAuth 2.0 PKCE o contrasena de aplicacion.
- Tema claro (por defecto) y oscuro; accesibilidad por teclado y lector de pantalla; diseno adaptable.
- Instalable y portable para Windows y Linux.
