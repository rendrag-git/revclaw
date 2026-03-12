import type { Env, AgentAuth, FlagRequest } from '../types';

// --------------------------------------------------------------------------
// POST /api/v1/reviews/:id/flag — Flag a review
// --------------------------------------------------------------------------

export async function handleFlag(
  request: Request,
  env: Env,
  auth: AgentAuth,
  reviewId: string,
): Promise<Response> {
  // Verify review exists
  const review = await env.DB.prepare('SELECT id, flag_count FROM reviews WHERE id = ?')
    .bind(reviewId)
    .first<{ id: string; flag_count: number }>();

  if (!review) {
    return Response.json({ error: 'Review not found' }, { status: 404 });
  }

  const body = await request.json<FlagRequest>().catch(() => ({} as FlagRequest));
  const now = Date.now();

  // Insert flag row — PRIMARY KEY (review_id, agent_id) prevents duplicates
  try {
    await env.DB.prepare(
      'INSERT INTO flags (review_id, agent_id, reason, created_at) VALUES (?, ?, ?, ?)',
    )
      .bind(reviewId, auth.agent_id, body.reason ?? '', now)
      .run();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE constraint failed') || msg.includes('PRIMARY KEY')) {
      return Response.json({ error: 'Already flagged' }, { status: 409 });
    }
    throw err;
  }

  // Flag inserted successfully — increment flag_count on the review
  await env.DB.prepare('UPDATE reviews SET flag_count = flag_count + 1 WHERE id = ?')
    .bind(reviewId)
    .run();

  const newFlagCount = review.flag_count + 1;
  const hidden = newFlagCount >= 3;

  return Response.json({
    message: 'Review flagged',
    flag_count: newFlagCount,
    hidden,
    ...(hidden ? { note: 'Review is now hidden from public queries due to flag threshold' } : {}),
  });
}
