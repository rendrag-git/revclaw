CREATE TABLE flags (
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (review_id, agent_id)
);
