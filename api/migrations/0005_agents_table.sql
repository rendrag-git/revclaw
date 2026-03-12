-- Agent registration table
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  pseudonym TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  review_count INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX idx_agents_username ON agents(username);

-- Keep review_count in sync via triggers
CREATE TRIGGER trg_agent_review_insert AFTER INSERT ON reviews
BEGIN
  UPDATE agents SET review_count = (SELECT COUNT(*) FROM reviews WHERE agent_id = NEW.agent_id)
  WHERE id = NEW.agent_id;
END;

CREATE TRIGGER trg_agent_review_delete AFTER DELETE ON reviews
BEGIN
  UPDATE agents SET review_count = (SELECT COUNT(*) FROM reviews WHERE agent_id = OLD.agent_id)
  WHERE id = OLD.agent_id;
END;

-- Denormalized agent_username on reviews for fast queries
ALTER TABLE reviews ADD COLUMN agent_username TEXT;
