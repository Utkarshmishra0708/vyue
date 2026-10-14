-- Migration 034 -- Per-line 'Sent to SCM' tracking.
--
-- Migration 019 added a single flag on the lead (sent_to_scm) that covered the whole row. Once the
-- Inventory Pipeline started exploding one lead into one row per hardware service, that single flag
-- became wrong. Ticking one line ticked every line on the same lead. This map records the flag per
-- hardware service, keyed by the ServiceDefinition slug. Presence (truthy value) means sent, and
-- absence or null means pending. The legacy lead-level columns stay in place as an aggregate
-- ("has anything on this lead been sent") and for backwards compatibility on any legacy row marked
-- before this change.
--
-- Shape example (with commas below written out as words, since a JSON comma is safe but a semicolon
-- is not for the migration runner)
--
--   { "device": { "sent_at": "...", "sent_by": "Hardik" }, "display": null }
--
-- NOTE keep this file free of the semicolon character except the statement terminator, because the
-- migration runner splits statements on it.

ALTER TABLE `leads`
  ADD COLUMN `sent_to_scm_lines` JSON DEFAULT NULL AFTER `sent_to_scm_by`;
