/**
 * Cursor-based pagination helpers using ULID cursors.
 * ULIDs are lexicographically sortable by time, so cursor pagination
 * is simply: WHERE id < cursor ORDER BY id DESC LIMIT n
 */

export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export function parsePagination(url: URL): PaginationParams {
  const cursor = url.searchParams.get('cursor') || undefined;
  const limitStr = url.searchParams.get('limit');
  let limit = limitStr ? parseInt(limitStr, 10) : 20;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;
  return { cursor, limit };
}

/**
 * Build cursor clause and bindings for a query.
 * Returns { clause, binds } to append to WHERE conditions.
 */
export function cursorClause(
  cursor: string | undefined,
  column: string = 'id',
): { clause: string; binds: unknown[] } {
  if (!cursor) return { clause: '', binds: [] };
  return { clause: `AND ${column} < ?`, binds: [cursor] };
}

/**
 * Extract next_cursor from a result set.
 * Returns the id of the last item if the result set is full (has `limit` items),
 * null otherwise (indicating no more pages).
 */
export function nextCursor<T extends { id: string }>(
  results: T[],
  limit: number,
): string | null {
  if (results.length < limit) return null;
  return results[results.length - 1].id;
}
