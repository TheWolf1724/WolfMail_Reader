import { describe, it, expect } from 'vitest'
import { buildAuthUrl, createPkce, exchangeCode, refreshToken } from '../src/core/oauth'
import { createHash } from 'node:crypto'
import { orderMailboxes } from '../src/core/imap'

describe('oauth', () => {
  it('PKCE: el challenge es el SHA-256 del verifier', () => {
    const p = createPkce()
    const expected = createHash('sha256').update(p.verifier).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(p.challenge).toBe(expected)
    expect(p.verifier.length).toBeGreaterThanOrEqual(43)
    expect(createPkce().state).not.toBe(p.state)
  })
  it('construye la URL de autorizacion con S256 y state', () => {
    const p = createPkce()
    const u = new URL(buildAuthUrl('google', 'cid', 'http://127.0.0.1:5555/cb', p, 'a@b.com'))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(u.searchParams.get('code_challenge_method')).toBe('S256')
    expect(u.searchParams.get('state')).toBe(p.state)
    expect(u.searchParams.get('access_type')).toBe('offline')
    const m = new URL(buildAuthUrl('microsoft', 'cid', 'http://localhost:1/cb', p))
    expect(m.searchParams.get('scope')).toContain('IMAP.AccessAsUser.All')
  })
  it('intercambia y renueva tokens, y propaga errores', async () => {
    const ok = (async (_u: unknown, init: RequestInit) => {
      const b = new URLSearchParams(String(init.body))
      return new Response(JSON.stringify({ access_token: 'AT-' + b.get('grant_type'), refresh_token: b.get('grant_type') === 'authorization_code' ? 'RT' : undefined, expires_in: 100 }), { status: 200 })
    }) as unknown as typeof fetch
    const t = await exchangeCode('google', 'c', undefined, 'code', 'http://x', 'v', ok)
    expect(t.accessToken).toBe('AT-authorization_code')
    expect(t.refreshToken).toBe('RT')
    const r = await refreshToken('google', 'c', undefined, 'RT', ok)
    expect(r.refreshToken).toBe('RT') // se conserva si el servidor no devuelve otro
    const bad = (async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Token caducado' }), { status: 400 })) as unknown as typeof fetch
    await expect(refreshToken('google', 'c', undefined, 'x', bad)).rejects.toThrow('Token caducado')
  })
  it('ordena buzones: omite no seleccionables y deja "Todos" al final', () => {
    const mk = (path: string, specialUse?: string, flags: string[] = []) => ({ path, specialUse, flags: new Set(flags) }) as never
    const r = orderMailboxes([mk('[Gmail]/All Mail', '\\All'), mk('INBOX'), mk('[Gmail]', undefined, ['\\Noselect']), mk('[Gmail]/Starred', '\\Flagged'), mk('Clientes')])
    expect((r as { path: string }[]).map((x) => x.path)).toEqual(['INBOX', 'Clientes', '[Gmail]/All Mail'])
  })
})
