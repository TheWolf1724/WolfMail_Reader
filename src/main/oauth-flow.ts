// Flujo OAuth con navegador del sistema y servidor de retorno en 127.0.0.1.
import { createServer, type Server } from 'node:http'
import { shell } from 'electron'
import { buildAuthUrl, createPkce, exchangeCode, type Provider, type TokenSet } from '../core/oauth'

export function runOAuth(provider: Provider, clientId: string, clientSecret: string | undefined, loginHint: string): Promise<TokenSet> {
  const pkce = createPkce()
  return new Promise((resolve, reject) => {
    let server: Server | null = null
    const finish = (err: Error | null, tokens?: TokenSet): void => {
      clearTimeout(timer)
      server?.close()
      if (err) reject(err)
      else resolve(tokens!)
    }
    const timer = setTimeout(() => finish(new Error('Se agoto el tiempo de espera de la autorizacion (3 minutos).')), 180_000)
    server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (url.pathname !== '/callback') { res.writeHead(404).end(); return }
      const page = (msg: string): string =>
        `<!doctype html><meta charset="utf-8"><title>WolfMail</title><body style="font:16px system-ui;margin:3rem"><p>${msg}</p>`
      if (url.searchParams.get('state') !== pkce.state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(page('Respuesta no valida. Puede cerrar esta pestana.'))
        return
      }
      const code = url.searchParams.get('code')
      const err = url.searchParams.get('error')
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' }).end(page('Autorizacion cancelada. Puede cerrar esta pestana.'))
        finish(new Error(err ? `Autorizacion rechazada: ${err}` : 'Autorizacion cancelada'))
        return
      }
      try {
        const port = (server!.address() as { port: number }).port
        const t = await exchangeCode(provider, clientId, clientSecret, code, `http://127.0.0.1:${port}/callback`, pkce.verifier)
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page('Cuenta autorizada. Ya puede volver a WolfMail y cerrar esta pestana.'))
        finish(null, t)
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' }).end(page('No se pudo completar la autorizacion.'))
        finish(e as Error)
      }
    })
    server.on('error', (e) => finish(e))
    server.listen(0, '127.0.0.1', () => {
      const port = (server!.address() as { port: number }).port
      void shell.openExternal(buildAuthUrl(provider, clientId, `http://127.0.0.1:${port}/callback`, pkce, loginHint || undefined))
    })
  })
}
