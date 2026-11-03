-- P3-4: temporary passwords and forced password change on first sign-in.
ALTER TABLE `users` ADD COLUMN `must_change_password` TINYINT(1) NOT NULL DEFAULT 0 AFTER `password_hash`;
