// OAuth 2.0 con PKCE para aplicaciones de escritorio (redireccion a localhost).
// El usuario aporta su propio identificador de cliente: no se incluyen claves de terceros.
import { createHash, randomBytes } from 'node:crypto'

export type Provider = 'google' | 'microsoft'

export interface ProviderConfig {
  authUrl: string
  tokenUrl: string
  scope: string
  imapHost: string
  imapPort: number
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://mail.google.com/',
    imapHost: 'imap.gmail.com',
    imapPort: 993
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'https://outlook.office.com/IMAP.AccessAsUser.All offline_access',
    imapHost: 'outlook.office365.com',
    imapPort: 993
  }
}

export interface Pkce {
  verifier: string
  challenge: string
  state: string
}

const b64url = (b: Buffer): string => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function createPkce(): Pkce {
  const verifier = b64url(randomBytes(48))
  return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()), state: b64url(randomBytes(16)) }
}

export function buildAuthUrl(p: Provider, clientId: string, redirectUri: string, pkce: Pkce, loginHint?: string): string {
  const c = PROVIDERS[p]
  const u = new URL(c.authUrl)
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', c.scope)
  u.searchParams.set('state', pkce.state)
  u.searchParams.set('code_challenge', pkce.challenge)
  u.searchParams.set('code_challenge_method', 'S256')
  if (p === 'google') { u.searchParams.set('access_type', 'offline'); u.searchParams.set('prompt', 'consent') }
  if (loginHint) u.searchParams.set('login_hint', loginHint)
  return u.toString()
}

export interface TokenSet {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
}

type FetchLike = typeof fetch

async function tokenRequest(p: Provider, body: URLSearchParams, f: FetchLike): Promise<TokenSet> {
  const res = await f(PROVIDERS[p].tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || typeof json.access_token !== 'string') {
    const msg = typeof json.error_description === 'string' ? json.error_description : typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
    throw new Error(`Error de autorizacion: ${msg}`)
  }
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000
  }
}

export function exchangeCode(p: Provider, clientId: string, clientSecret: string | undefined, code: string, redirectUri: string, verifier: string, f: FetchLike = fetch): Promise<TokenSet> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, redirect_uri: redirectUri, code_verifier: verifier })
  if (clientSecret) body.set('client_secret', clientSecret)
  return tokenRequest(p, body, f)
}

export async function refreshToken(p: Provider, clientId: string, clientSecret: string | undefined, refresh: string, f: FetchLike = fetch): Promise<TokenSet> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, refresh_token: refresh })
  if (clientSecret) body.set('client_secret', clientSecret)
  if (p === 'microsoft') body.set('scope', PROVIDERS.microsoft.scope)
  const t = await tokenRequest(p, body, f)
  return { ...t, refreshToken: t.refreshToken ?? refresh }
}
