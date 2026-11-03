-- Release P3-2b (update): the same email means the same person, and one person has ONE username in every
-- business where they have an account. Two different people still never share a username (the server
-- checks this, because a database index cannot tell people apart).
-- Step 1: the username no longer has to be unique per account.
ALTER TABLE `users`
  DROP INDEX `uniq_users_username`,
  ADD INDEX `idx_users_username` (`username`);
-- Step 2: accounts that share an email get the username of the earliest of them.
UPDATE `users` u
JOIN (
  SELECT `email`, MIN(`id`) AS keep_id
  FROM `users`
  WHERE `email` IS NOT NULL AND `username` IS NOT NULL
  GROUP BY `email`
  HAVING COUNT(*) > 1
) d ON u.`email` = d.`email`
JOIN `users` k ON k.`id` = d.keep_id
SET u.`username` = k.`username`
WHERE u.`id` <> d.keep_id AND u.`username` IS NOT NULL
