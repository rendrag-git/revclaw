-- Trigger: update venue stats after review INSERT
CREATE TRIGGER trg_review_insert AFTER INSERT ON reviews
BEGIN
  UPDATE venues SET
    review_count = (SELECT COUNT(*) FROM reviews WHERE venue_id = NEW.venue_id),
    avg_rating = (SELECT AVG(CAST(rating AS REAL)) FROM reviews WHERE venue_id = NEW.venue_id)
  WHERE id = NEW.venue_id;
END;

-- Trigger: update venue stats after review UPDATE (rating might change)
CREATE TRIGGER trg_review_update AFTER UPDATE OF rating ON reviews
BEGIN
  UPDATE venues SET
    avg_rating = (SELECT AVG(CAST(rating AS REAL)) FROM reviews WHERE venue_id = NEW.venue_id)
  WHERE id = NEW.venue_id;
END;

-- Trigger: update venue stats after review DELETE
CREATE TRIGGER trg_review_delete AFTER DELETE ON reviews
BEGIN
  UPDATE venues SET
    review_count = (SELECT COUNT(*) FROM reviews WHERE venue_id = OLD.venue_id),
    avg_rating = COALESCE((SELECT AVG(CAST(rating AS REAL)) FROM reviews WHERE venue_id = OLD.venue_id), 0)
  WHERE id = OLD.venue_id;
END;
