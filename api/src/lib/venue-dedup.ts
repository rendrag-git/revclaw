/**
 * Venue resolution logic:
 * 1. Check for existing venue by external_id (exact match)
 * 2. Fall back to proximity check (50m radius via geohash neighbors + haversine)
 * 3. Create new venue if no match
 * Returns { venue_id, matched_existing_venue }
 */

import type { Env, Venue } from '../types';
import { encode, neighbors, haversineMeters } from './geohash';
import { ulid } from './ulid';

const DEDUP_RADIUS_METERS = 50;
// Use 6-char geohash for dedup (~1.2km tiles) so that the 9 neighbors
// cover the 50m radius. Must match the precision used for storage (line 83).
const DEDUP_GEOHASH_PRECISION = 6;

export interface VenueResolution {
  venue_id: string;
  venue_name: string;
  geo_hash: string;
  matched_existing_venue: boolean;
}

export interface VenueResolutionOptions {
  venue_name: string;
  lat: number;
  lng: number;
  external_id?: string;
  city?: string;
  region?: string;
  country?: string;
  google_rating?: number;
  google_review_count?: number;
  yelp_rating?: number;
  yelp_review_count?: number;
}

export async function resolveVenue(
  env: Env,
  opts: VenueResolutionOptions,
): Promise<VenueResolution> {
  // Step 1: exact match on external_id
  if (opts.external_id) {
    const existing = await env.DB.prepare(
      'SELECT id, name, geo_hash FROM venues WHERE external_id = ? LIMIT 1',
    )
      .bind(opts.external_id)
      .first<Pick<Venue, 'id' | 'name' | 'geo_hash'>>();

    if (existing) {
      // Opportunistic refresh of external ratings
      await updateExternalRatings(env, existing.id, opts);
      return {
        venue_id: existing.id,
        venue_name: existing.name,
        geo_hash: existing.geo_hash,
        matched_existing_venue: true,
      };
    }
  }

  // Step 2: proximity fallback — check 50m radius via geohash neighbors
  const dedupHash = encode(opts.lat, opts.lng, DEDUP_GEOHASH_PRECISION);
  const hashes = neighbors(dedupHash);
  const placeholders = hashes.map(() => 'geo_hash LIKE ?').join(' OR ');
  const binds = hashes.map(h => h.slice(0, DEDUP_GEOHASH_PRECISION) + '%');

  const nearby = await env.DB.prepare(
    `SELECT id, name, lat, lng, geo_hash FROM venues WHERE ${placeholders}`,
  )
    .bind(...binds)
    .all<Pick<Venue, 'id' | 'name' | 'lat' | 'lng' | 'geo_hash'>>();

  if (nearby.results) {
    for (const v of nearby.results) {
      const dist = haversineMeters(opts.lat, opts.lng, v.lat, v.lng);
      if (dist <= DEDUP_RADIUS_METERS) {
        // Opportunistic refresh of external ratings
        await updateExternalRatings(env, v.id, opts);
        return {
          venue_id: v.id,
          venue_name: v.name,
          geo_hash: v.geo_hash,
          matched_existing_venue: true,
        };
      }
    }
  }

  // Step 3: create new venue
  const venueId = ulid();
  const geoHash = encode(opts.lat, opts.lng, 6); // 6-char for storage
  const now = Date.now();

  await env.DB.prepare(
    `INSERT INTO venues (id, name, lat, lng, geo_hash, city, region, country, external_id, created_at,
       google_rating, google_review_count, yelp_rating, yelp_review_count, external_ratings_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      venueId,
      opts.venue_name,
      opts.lat,
      opts.lng,
      geoHash,
      opts.city ?? null,
      opts.region ?? null,
      opts.country ?? null,
      opts.external_id ?? null,
      now,
      opts.google_rating ?? null,
      opts.google_review_count ?? null,
      opts.yelp_rating ?? null,
      opts.yelp_review_count ?? null,
      hasExternalRatings(opts) ? now : null,
    )
    .run();

  return {
    venue_id: venueId,
    venue_name: opts.venue_name,
    geo_hash: geoHash,
    matched_existing_venue: false,
  };
}

function hasExternalRatings(opts: VenueResolutionOptions): boolean {
  return (
    opts.google_rating != null ||
    opts.google_review_count != null ||
    opts.yelp_rating != null ||
    opts.yelp_review_count != null
  );
}

async function updateExternalRatings(
  env: Env,
  venueId: string,
  opts: VenueResolutionOptions,
): Promise<void> {
  if (!hasExternalRatings(opts)) return;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (opts.google_rating != null) { fields.push('google_rating = ?'); values.push(opts.google_rating); }
  if (opts.google_review_count != null) { fields.push('google_review_count = ?'); values.push(opts.google_review_count); }
  if (opts.yelp_rating != null) { fields.push('yelp_rating = ?'); values.push(opts.yelp_rating); }
  if (opts.yelp_review_count != null) { fields.push('yelp_review_count = ?'); values.push(opts.yelp_review_count); }

  fields.push('external_ratings_updated_at = ?');
  values.push(Date.now());
  values.push(venueId);

  await env.DB.prepare(
    `UPDATE venues SET ${fields.join(', ')} WHERE id = ?`,
  )
    .bind(...values)
    .run();
}
