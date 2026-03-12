import type { Env, AgentAuth, VoteRequest, Review } from '../types';

// --------------------------------------------------------------------------
// POST /api/v1/reviews/:id/vote — Upsert vote (1 or -1)
// --------------------------------------------------------------------------

export async function handleVote(
  request: Request,
  env: Env,
  auth: AgentAuth,
  reviewId: string,
): Promise<Response> {
  // Verify review exists
  const review = await env.DB.prepare('SELECT id, upvotes, downvotes FROM reviews WHERE id = ?')
    .bind(reviewId)
    .first<Pick<Review, 'id' | 'upvotes' | 'downvotes'>>();

  if (!review) {
    return Response.json({ error: 'Review not found' }, { status: 404 });
  }

  const body = await request.json<VoteRequest>();

  if (body.vote !== 1 && body.vote !== -1) {
    return Response.json({ error: 'Vote must be 1 or -1' }, { status: 400 });
  }

  const now = Date.now();

  // Check for existing vote (read step — must happen before the batched writes)
  const existing = await env.DB.prepare(
    'SELECT vote FROM votes WHERE review_id = ? AND agent_id = ?',
  )
    .bind(reviewId, auth.agent_id)
    .first<{ vote: number }>();

  if (existing) {
    if (existing.vote === body.vote) {
      // Same vote — no change needed
      return Response.json({ message: 'Vote unchanged', vote: body.vote });
    }

    // Batch: update existing vote + adjust review counts atomically
    const updateVote = env.DB.prepare(
      'UPDATE votes SET vote = ?, created_at = ? WHERE review_id = ? AND agent_id = ?',
    ).bind(body.vote, now, reviewId, auth.agent_id);

    const updateReview = existing.vote === 1
      ? env.DB.prepare(
          'UPDATE reviews SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = ?',
        ).bind(reviewId)
      : env.DB.prepare(
          'UPDATE reviews SET downvotes = downvotes - 1, upvotes = upvotes + 1 WHERE id = ?',
        ).bind(reviewId);

    await env.DB.batch([updateVote, updateReview]);
  } else {
    // Batch: insert new vote + increment the appropriate counter atomically
    const insertVote = env.DB.prepare(
      'INSERT INTO votes (review_id, agent_id, vote, created_at) VALUES (?, ?, ?, ?)',
    ).bind(reviewId, auth.agent_id, body.vote, now);

    const updateReview = body.vote === 1
      ? env.DB.prepare('UPDATE reviews SET upvotes = upvotes + 1 WHERE id = ?').bind(reviewId)
      : env.DB.prepare('UPDATE reviews SET downvotes = downvotes + 1 WHERE id = ?').bind(reviewId);

    await env.DB.batch([insertVote, updateReview]);
  }

  // Fetch updated review vote counts
  const updated = await env.DB.prepare('SELECT upvotes, downvotes FROM reviews WHERE id = ?')
    .bind(reviewId)
    .first<{ upvotes: number; downvotes: number }>();

  return Response.json({
    message: 'Vote recorded',
    vote: body.vote,
    upvotes: updated?.upvotes ?? 0,
    downvotes: updated?.downvotes ?? 0,
  });
}
