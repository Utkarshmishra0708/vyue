-- P3-2c: marker for the bd_weekly_targets name-to-id conversion.
-- The actual remapping is done in JavaScript (server.js post-migration hook)
-- because MySQL JSON_TABLE cannot iterate dynamic object keys.
SELECT 1
