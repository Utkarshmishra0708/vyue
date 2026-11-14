-- Migration 035 -- Activities module.
--
-- The Activities module is a kanban-style board where a business tracks its follow-ups, calls,
-- tasks and internal actions. Every row is one card that lives in exactly one column (to_do,
-- in_progress, blocked, done). The module is opt-in per business (see business_units.config.modules)
-- so it can be turned on for Surveillance today and offered to other businesses on request. It is
-- also gated by the user's per-module permission (see users.module_permissions).
--
-- Kanban columns are FIXED constants for now (to_do, in_progress, blocked, done) rather than a
-- per-BU config row - keeps the UI simple. A future migration can turn them into a table if the
-- business asks for custom lanes.
--
-- The seed at the bottom turns Activities ON for Surveillance out of the box (the user's request).
-- Other business units default to OFF and admins can enable it via Edit Template.
--
-- NOTE keep this file free of the semicolon character except the statement terminator, because the
-- migration runner splits statements on it.

CREATE TABLE IF NOT EXISTS `activities` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `business_unit` VARCHAR(32) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'to_do',
  `priority` VARCHAR(16) DEFAULT NULL,
  `owner_id` INT UNSIGNED DEFAULT NULL,
  `due_date` DATE DEFAULT NULL,
  `lead_id` INT UNSIGNED DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_by_name` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_activities_bu` (`business_unit`),
  KEY `idx_activities_bu_status` (`business_unit`, `status`),
  KEY `idx_activities_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the module ON for Surveillance. business_units.config is JSON so we JSON_SET a modules key.
-- If config is null we start with an empty object. If config.modules is not an array we replace it.
UPDATE `business_units`
   SET `config` = JSON_SET(
     COALESCE(`config`, JSON_OBJECT()),
     '$.modules',
     JSON_ARRAY(JSON_OBJECT('slug', 'activities', 'enabled', true))
   )
 WHERE `slug` = 'surveillance'
   AND (`config` IS NULL OR JSON_EXTRACT(`config`, '$.modules') IS NULL)
