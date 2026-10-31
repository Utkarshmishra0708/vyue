-- Release P3-1: sign-in lockout. After 5 wrong passwords an account is locked for 30 minutes.
-- failed_login_count counts consecutive wrong passwords, and locked_until is when the lock ends.
ALTER TABLE `users`
  ADD COLUMN `failed_login_count` INT NOT NULL DEFAULT 0,
  ADD COLUMN `locked_until` DATETIME NULL
