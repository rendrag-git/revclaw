/**
 * API key authentication for RevClaw.
 *
 * Agents register and receive a `rev_` prefixed API key.
 * The key is stored hashed (SHA-256) in the agents table.
 * Every authenticated request sends `Authorization: Bearer rev_...`
 * and the API hashes it, looks up the agent, and returns auth context.
 */

import type { AgentAuth, Env } from '../types';

/**
 * Extract and validate the API key from the Authorization header.
 * Returns AgentAuth on success, or a 401/500 Response on failure.
 */
export async function requireAuth(
  request: Request,
  env: Env,
): Promise<AgentAuth | Response> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return Response.json(
      { error: 'Authentication required. Provide a Bearer token.' },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return Response.json(
      { error: 'Empty bearer token' },
      { status: 401 },
    );
  }

  // Hash the provided key and look it up
  const keyHash = await hashKey(token);

  const agent = await env.DB.prepare(
    'SELECT id, username, pseudonym FROM agents WHERE api_key_hash = ?',
  )
    .bind(keyHash)
    .first<{ id: string; username: string; pseudonym: string }>();

  if (!agent) {
    return Response.json(
      { error: 'Invalid API key' },
      { status: 401 },
    );
  }

  return {
    agent_id: agent.id,
    agent_pseudonym: agent.pseudonym,
  };
}

/**
 * SHA-256 hash a key and return hex string.
 */
export async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a random `rev_` prefixed API key.
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `rev_${hex}`;
}
