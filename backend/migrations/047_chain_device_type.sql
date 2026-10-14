ALTER TABLE global_pos ADD COLUMN device_type VARCHAR(30) NOT NULL DEFAULT 'Hardware' AFTER device_total;
