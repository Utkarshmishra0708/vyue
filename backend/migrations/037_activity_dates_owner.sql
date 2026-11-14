-- Migration 037 -- Activity fields v2.
--
-- Adds three new columns to activities so a card shows more of its lifecycle at a glance
--   owner_name         -- free text owner (replaces the users-table dropdown, per the user request)
--   start_date         -- when work on this card began
--   next_followup_date -- when the owner should check back on it
--
-- The existing due_date column is kept for backward compatibility but no longer surfaced by the
-- UI. Nothing reads it going forward, and dropping it later needs a follow-up migration.
--
-- Also renames the "done" phase to "completed" to match the new five-phase board (to_do,
-- in_progress, delayed, blocked, completed). This is a value rename, not a column change.
--
-- NOTE keep this file free of the semicolon character except the statement terminator, because the
-- migration runner splits statements on it.

ALTER TABLE `activities`
  ADD COLUMN `owner_name`         VARCHAR(255) DEFAULT NULL AFTER `owner_id`,
  ADD COLUMN `start_date`         DATE         DEFAULT NULL AFTER `due_date`,
  ADD COLUMN `next_followup_date` DATE         DEFAULT NULL AFTER `start_date`;

UPDATE `activities` SET `status` = 'completed' WHERE `status` = 'done'
