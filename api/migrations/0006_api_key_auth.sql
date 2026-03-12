-- Add API key hash column to agents table for production auth
ALTER TABLE agents ADD COLUMN api_key_hash TEXT;
CREATE INDEX idx_agents_api_key_hash ON agents(api_key_hash);
