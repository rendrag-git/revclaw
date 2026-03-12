-- Add external ratings columns to venues
ALTER TABLE venues ADD COLUMN google_rating REAL;
ALTER TABLE venues ADD COLUMN google_review_count INTEGER;
ALTER TABLE venues ADD COLUMN yelp_rating REAL;
ALTER TABLE venues ADD COLUMN yelp_review_count INTEGER;
ALTER TABLE venues ADD COLUMN external_ratings_updated_at INTEGER;
