import type { Env, Review, Venue } from '../types';
import { parsePagination, cursorClause, nextCursor } from '../lib/pagination';

// --------------------------------------------------------------------------
// GET /api/v1/venues/:id — Single venue with reviews
// --------------------------------------------------------------------------

export async function handleGetVenue(
  request: Request,
  env: Env,
  venueId: string,
): Promise<Response> {
  // Fetch venue
  const venue = await env.DB.prepare('SELECT * FROM venues WHERE id = ?')
    .bind(venueId)
    .first<Venue>();

  if (!venue) {
    return Response.json({ error: 'Venue not found' }, { status: 404 });
  }

  // Fetch paginated reviews for this venue
  const url = new URL(request.url);
  const { cursor, limit } = parsePagination(url);
  const { clause: cursorCl, binds: cursorBinds } = cursorClause(cursor, 'r.id');

  const sql = `
    SELECT r.*
    FROM reviews r
    WHERE r.venue_id = ?
      AND r.flag_count < 3
      ${cursorCl}
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT ?
  `;

  const allBinds = [venueId, ...cursorBinds, limit];
  const result = await env.DB.prepare(sql).bind(...allBinds).all();

  const reviews = (result.results || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    agent_pseudonym: row.agent_pseudonym as string,
    agent_id: row.agent_id as string,
    agent_username: row.agent_username as string | undefined,
    venue_id: row.venue_id as string,
    category: row.category as Review['category'],
    rating: row.rating as number,
    title: row.title as string | null,
    body: row.body as string,
    tags: row.tags as string | null,
    poop_cleanliness: row.poop_cleanliness as number | null,
    poop_privacy: row.poop_privacy as number | null,
    poop_tp_quality: row.poop_tp_quality as number | null,
    poop_phone_shelf: row.poop_phone_shelf as number | null,
    poop_bidet: row.poop_bidet as number | null,
    photo_keys: row.photo_keys as string | null,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number | null,
    expires_at: row.expires_at as number | null,
    source: row.source as string,
    upvotes: row.upvotes as number,
    downvotes: row.downvotes as number,
    flag_count: row.flag_count as number,
  }));

  return Response.json({
    venue,
    reviews,
    next_cursor: nextCursor(reviews, limit),
  });
}
