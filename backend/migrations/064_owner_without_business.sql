-- P3-3: an Owner registers the company before any business exists.
-- Allow users.business_unit to be NULL so the Owner can exist without a business.
ALTER TABLE `users` DROP FOREIGN KEY `fk_users_bu`;
ALTER TABLE `users` MODIFY COLUMN `business_unit` VARCHAR(32) NULL DEFAULT NULL;
ALTER TABLE `users` ADD CONSTRAINT `fk_users_bu` FOREIGN KEY (`business_unit`) REFERENCES `business_units` (`slug`) ON UPDATE CASCADE ON DELETE SET NULL;
