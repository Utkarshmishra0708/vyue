ALTER TABLE global_pos
  ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'New'
  AFTER device_total;
