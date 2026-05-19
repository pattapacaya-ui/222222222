import { Hono } from 'hono';
import type { Env } from '../types';
import { getJWKS } from '../services/jwt';

const wellknown = new Hono<{ Bindings: Env }>();

// GET /.well-known/jwks.json
wellknown.get('/.well-known/jwks.json', async (c) => {
  const jwks = await getJWKS(c.env);
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json(jwks);
});

// GET /.well-known/openid-configuration
wellknown.get('/.well-known/openid-configuration', (c) => {
  const baseUrl = `https://legionauth-api.workers.dev`;
  return c.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/v1/oauth/authorize`,
    token_endpoint: `${baseUrl}/v1/auth/refresh`,
    userinfo_endpoint: `${baseUrl}/v1/auth/me`,
    jwks_uri: `${baseUrl}/.well-known/jwks.json`,
    response_types_supported: ['code', 'token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['sub', 'email', 'name', 'picture', 'email_verified'],
  });
});

export default wellknown;
