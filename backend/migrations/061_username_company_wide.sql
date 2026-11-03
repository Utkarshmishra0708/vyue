-- Release P3-2b (update): people now sign in with an email or username and no business is named, so a
-- username must belong to ONE person in the whole company, not just within one business.
-- Where two people share a username, the earliest account keeps it and the others are cleared. The
-- server gives them a new one (for example Priya1.Nair) the next time it starts.
UPDATE `users` u
JOIN (
  SELECT LOWER(`username`) AS k, MIN(`id`) AS keep_id
  FROM `users`
  WHERE `username` IS NOT NULL
  GROUP BY LOWER(`username`)
  HAVING COUNT(*) > 1
) d ON LOWER(u.`username`) = d.k
SET u.`username` = NULL
WHERE u.`id` <> d.keep_id;
ALTER TABLE `users`
  ADD INDEX `idx_users_business_unit` (`business_unit`),
  ADD UNIQUE KEY `uniq_users_username` (`username`),
  DROP INDEX `uniq_users_business_username`
