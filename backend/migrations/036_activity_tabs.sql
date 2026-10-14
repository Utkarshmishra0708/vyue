-- Migration 036 -- Activity Tabs + richer card fields.
--
-- The Activities board grew two capabilities:
--   1. TABS: a business can organise its cards into several boards ("Prospecting", "Post-Sale",
--      "Renewals" ...). Each tab is its own kanban with the same four columns. Users can add and
--      remove tabs from the UI, so this becomes a small table rather than a fixed constant.
--   2. Richer cards: instead of one description, a card now captures Previous Steps, Recent Updates
--      and Next Steps so the board tells the story at a glance. Recent Updates and Next Steps are
--      rendered on the card face so a reader does not have to open the card to see current state.
--
-- Every existing card gets migrated onto a default "General" tab per BU so nothing falls off the
-- board when this ships.
--
-- NOTE keep this file free of the semicolon character except the statement terminator, because the
-- migration runner splits statements on it.

CREATE TABLE IF NOT EXISTS `activity_tabs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `business_unit` VARCHAR(32) NOT NULL,
  `label` VARCHAR(64) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_activity_tabs_bu` (`business_unit`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `activities`
  ADD COLUMN `tab_id`          INT UNSIGNED DEFAULT NULL AFTER `business_unit`,
  ADD COLUMN `previous_steps`  TEXT DEFAULT NULL AFTER `description`,
  ADD COLUMN `recent_updates`  TEXT DEFAULT NULL AFTER `previous_steps`,
  ADD COLUMN `next_steps`      TEXT DEFAULT NULL AFTER `recent_updates`,
  ADD KEY `idx_activities_tab` (`tab_id`);

-- Seed one default tab per BU that currently has any activity rows, then attach the existing rows
-- to it. Businesses without any cards get their default tab on first use from the app.
INSERT INTO `activity_tabs` (`business_unit`, `label`, `sort_order`)
  SELECT DISTINCT `business_unit`, 'General', 0 FROM `activities` WHERE `tab_id` IS NULL;

UPDATE `activities` a
   JOIN `activity_tabs` t ON t.`business_unit` = a.`business_unit` AND t.`label` = 'General' AND t.`sort_order` = 0
    SET a.`tab_id` = t.`id`
  WHERE a.`tab_id` IS NULL
