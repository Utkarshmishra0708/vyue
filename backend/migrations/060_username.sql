-- Release P3-2a (update 3): every person gets a username, unique within a business. People sign in with their
-- email or username, never with their full name. Existing people are given a username when the server starts.
ALTER TABLE `users`
  ADD COLUMN `username` VARCHAR(64) NULL,
  ADD UNIQUE KEY `uniq_users_business_username` (`business_unit`, `username`)
