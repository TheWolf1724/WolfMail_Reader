# Conectar cuentas de Google y Outlook

WolfMail lee las cuentas por IMAP en **modo solo lectura**: abre los buzones sin permiso de escritura y nunca marca, mueve ni borra mensajes. Todo se copia a la biblioteca local; la sincronización es incremental (solo se descargan los mensajes nuevos).

Todo el proceso es gratuito. WolfMail no incluye claves de terceros: cada usuario registra su propia aplicación, de modo que sus datos solo pasan por su cuenta.

## Gmail / Google

Opción A (la más sencilla): **contraseña de aplicación**
1. Active la verificación en dos pasos en su cuenta de Google.
2. Cree una contraseña de aplicación (Cuenta de Google, Seguridad, Contraseñas de aplicaciones).
3. En WolfMail: Cuentas, tipo "IMAP + contraseña", servidor `imap.gmail.com`, puerto `993`.

Opción B: **OAuth 2.0**
1. En Google Cloud Console cree un proyecto y active la API de Gmail.
2. Configure la pantalla de consentimiento (externa, en modo de prueba) y añada su cuenta como usuario de prueba.
3. Cree credenciales: ID de cliente OAuth, tipo "Aplicación de escritorio".
4. Copie el ID de cliente (y el secreto, si lo muestra) en WolfMail, Cuentas, Gmail / Google.

Nota: en modo de prueba, Google caduca el permiso a los 7 días; vuelva a autorizar. Para evitarlo, use la opción A o importe una exportación de Google Takeout (`.mbox`), que no necesita cuenta.

## Outlook / Microsoft 365

Microsoft ha desactivado la autenticación con contraseña en IMAP para cuentas personales (outlook.com, hotmail.com), por lo que hace falta OAuth:
1. En Microsoft Entra (portal de Azure, gratuito) registre una aplicación: "Cuentas personales y de cualquier directorio".
2. Autenticación: añada la plataforma "Aplicaciones móviles y de escritorio" con redirección `http://localhost`.
3. Permisos de API: Office 365 Exchange Online, delegado, `IMAP.AccessAsUser.All`.
4. Copie el ID de aplicación (cliente) en WolfMail, Cuentas, Outlook / Microsoft.

Alternativa sin cuenta: exporte su buzón de Outlook a `.pst` (Archivo, Abrir y exportar, Importar o exportar) y ábralo en WolfMail.

## Dónde se guardan las credenciales

Cifradas con el llavero del sistema (Windows DPAPI, macOS Keychain, libsecret/KWallet en Linux). Si el sistema no tiene llavero, WolfMail no escribe el secreto en disco y lo conserva solo durante la sesión. WolfMail guarda el *refresh token*, no su contraseña de Google o Microsoft.

## Estado de la verificación

La sincronización IMAP y los flujos OAuth están cubiertos por pruebas unitarias (PKCE, construcción de URL, canje y renovación de tokens, orden de buzones). No se han probado contra servidores reales de Google o Microsoft, porque requieren credenciales del usuario; los primeros usuarios deben comprobarlo con una cuenta de prueba.
