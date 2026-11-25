# Construir los paquetes

Todo se genera desde Linux y es gratuito. Salida en `release/` (fuera de Git).

```bash
npm install
npm run dist:linux     # WolfMail-X.Y.Z-linux-amd64.deb y WolfMail-X.Y.Z-linux-portable.AppImage
npm run dist:win       # WolfMail-X.Y.Z-windows-setup.exe (NSIS) y WolfMail-X.Y.Z-windows-portable.exe
```

## Windows desde Linux

electron-builder necesita `wine` en el PATH para generar el instalador NSIS (ejecuta el desinstalador temporal) y para editar los metadatos del `.exe`. Instale Wine (por ejemplo `sudo apt install wine64`) o apunte `PATH` a un Wine propio. Sin Wine, el paquete `win-unpacked` se genera igualmente pero el instalador queda incompleto.

Use un prefijo de Wine desechable (`WINEPREFIX=/tmp/wine-build`) y una pantalla virtual (`xvfb-run -a npm run dist:win`) para no tocar su escritorio.

## Version

La version sale de `package.json`. Esquema `mayor.menor.parche`: mayor para cambios grandes, menor para funciones, parche para arreglos. Anotar cada cambio en `CHANGELOG.md`.

## Firma de codigo

Los ejecutables no estan firmados: Windows mostrara "SmartScreen: editor desconocido" y habra que pulsar "Mas informacion, Ejecutar de todas formas". Firmar requiere un certificado de pago, fuera del alcance del proyecto (coste cero).

## Comprobaciones antes de publicar

1. `npm test` y `npm run typecheck`.
2. `xvfb-run -a node scripts/e2e.mjs` (12 comprobaciones sobre la aplicacion real).
3. Abrir el paquete generado: importar `tests/fixtures/test.msg` y comprobar que se lee.
