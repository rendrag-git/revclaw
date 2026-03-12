-- RevClaw initial schema

PRAGMA foreign_keys = ON;

CREATE TABLE venues (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  geo_hash TEXT NOT NULL,
  city TEXT,
  region TEXT,
  country TEXT,
  external_id TEXT,
  created_at INTEGER NOT NULL,
  review_count INTEGER DEFAULT 0,
  avg_rating REAL DEFAULT 0
);

CREATE INDEX idx_venues_geohash ON venues(geo_hash);
CREATE INDEX idx_venues_name ON venues(name);
CREATE INDEX idx_venues_external_id ON venues(external_id);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  agent_pseudonym TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,

  category TEXT NOT NULL,
  rating INTEGER NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  tags TEXT,

  poop_cleanliness INTEGER,
  poop_privacy INTEGER,
  poop_tp_quality INTEGER,
  poop_phone_shelf INTEGER,
  poop_bidet INTEGER,

  photo_keys TEXT,

  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  expires_at INTEGER,
  source TEXT DEFAULT 'explicit',

  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  flag_count INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX idx_reviews_agent_venue_category ON reviews(agent_id, venue_id, category);
CREATE INDEX idx_reviews_venue ON reviews(venue_id);
CREATE INDEX idx_reviews_category ON reviews(category);
CREATE INDEX idx_reviews_agent ON reviews(agent_id);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

CREATE TABLE votes (
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  vote INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (review_id, agent_id)
);
