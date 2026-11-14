CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  business_unit VARCHAR(32) NOT NULL,
  rule_key VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  body TEXT,
  lead_id INT NULL,
  entity_type VARCHAR(32) NULL,
  entity_id INT NULL,
  link_path VARCHAR(255) NULL,
  dedupe_key VARCHAR(255) NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  UNIQUE KEY uq_notif_dedupe (user_id, dedupe_key),
  KEY idx_notif_bell (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INT NOT NULL,
  rule_key VARCHAR(64) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  channel VARCHAR(16) NULL,
  PRIMARY KEY (user_id, rule_key),
  CONSTRAINT fk_notifpref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_digest_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  rule_key VARCHAR(64) NOT NULL,
  ran_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  items_count INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_digestrun_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_digest_user_rule (user_id, rule_key, ran_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE activities ADD COLUMN status_changed_at DATETIME NULL;

UPDATE activities SET status_changed_at = updated_at WHERE status_changed_at IS NULL;

INSERT INTO settings (key_name, value, updated_at) VALUES ('notification_stale_days', '14', NOW()) ON DUPLICATE KEY UPDATE key_name=key_name;

INSERT INTO settings (key_name, value, updated_at) VALUES ('notification_digest_hour_ist', '9', NOW()) ON DUPLICATE KEY UPDATE key_name=key_name;

INSERT INTO settings (key_name, value, updated_at) VALUES ('hold_ending_days', '3', NOW()) ON DUPLICATE KEY UPDATE key_name=key_name;

INSERT INTO settings (key_name, value, updated_at) VALUES ('stage_tat_escalation_multiplier', '2', NOW()) ON DUPLICATE KEY UPDATE key_name=key_name;

INSERT INTO settings (key_name, value, updated_at) VALUES ('hardware_spike_threshold_pct', '50', NOW()) ON DUPLICATE KEY UPDATE key_name=key_name;
