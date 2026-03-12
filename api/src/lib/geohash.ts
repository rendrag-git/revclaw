/**
 * Geohash encode/decode with neighbor expansion for spatial queries.
 * All spatial queries must hit 9 prefixes (target + 8 adjacent) to avoid
 * tile-boundary misses.
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encode(lat: number, lng: number, precision: number = 6): string {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';
  let isLng = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) {
        ch |= (1 << (4 - bit));
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch |= (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }
    isLng = !isLng;
    bit++;
    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function decode(hash: string): { lat: number; lng: number } {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let isLng = true;

  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    for (let bit = 4; bit >= 0; bit--) {
      if (isLng) {
        const mid = (minLng + maxLng) / 2;
        if (idx & (1 << bit)) { minLng = mid; } else { maxLng = mid; }
      } else {
        const mid = (minLat + maxLat) / 2;
        if (idx & (1 << bit)) { minLat = mid; } else { maxLat = mid; }
      }
      isLng = !isLng;
    }
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

type Direction = 'n' | 's' | 'e' | 'w';

// Neighbor/border tables for geohash adjacency computation
const NEIGHBOR_MAP: Record<Direction, [string, string]> = {
  n: ['p0r21436x8zb9dcf5h7kjnmqesgutwvy', 'bc01fg45238967deuvhjyznpkmstqrwx'],
  s: ['14365h7k9dcfesgujnmqp0r2twvyx8zb', '238967debc01fg45uvhjyznpkmstqrwx'],
  e: ['bc01fg45238967deuvhjyznpkmstqrwx', 'p0r21436x8zb9dcf5h7kjnmqesgutwvy'],
  w: ['238967debc01fg45uvhjyznpkmstqrwx', '14365h7k9dcfesgujnmqp0r2twvyx8zb'],
};

const BORDER_MAP: Record<Direction, [string, string]> = {
  n: ['prxz', 'bcfguvyz'],
  s: ['028b', '0145hjnp'],
  e: ['bcfguvyz', 'prxz'],
  w: ['0145hjnp', '028b'],
};

function adjacent(hash: string, dir: Direction): string {
  const lastChar = hash.slice(-1);
  const parent = hash.slice(0, -1);
  const type = hash.length % 2; // 0 = even, 1 = odd

  // Check if last character is on the border for this direction
  if (BORDER_MAP[dir][type].indexOf(lastChar) !== -1 && parent.length > 0) {
    // Recurse to get the neighbor of the parent
    const parentNeighbor = adjacent(parent, dir);
    const idx = NEIGHBOR_MAP[dir][type].indexOf(lastChar);
    return parentNeighbor + BASE32[idx];
  }
  const idx = NEIGHBOR_MAP[dir][type].indexOf(lastChar);
  return parent + BASE32[idx];
}

/**
 * Compute 8 adjacent geohashes + the target itself = 9 geohashes.
 * Used for spatial queries to avoid tile-boundary misses.
 */
export function neighbors(hash: string): string[] {
  const n = adjacent(hash, 'n');
  const s = adjacent(hash, 's');
  const e = adjacent(hash, 'e');
  const w = adjacent(hash, 'w');
  const ne = adjacent(n, 'e');
  const nw = adjacent(n, 'w');
  const se = adjacent(s, 'e');
  const sw = adjacent(s, 'w');
  return [hash, n, s, e, w, ne, nw, se, sw];
}

/**
 * Haversine distance in meters between two lat/lng pairs.
 */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Choose geohash precision based on search radius in km.
 * Returns precision that ensures 9 neighbor tiles cover the radius.
 */
export function precisionForRadius(radiusKm: number): number {
  if (radiusKm < 1) return 7;
  if (radiusKm < 5) return 6;
  if (radiusKm < 20) return 5;
  return 4;
}
