-- Release P2-3a: the database no longer assumes a business. Every user, lead, master order and
-- feedback entry must be given its business explicitly (the code always does).
ALTER TABLE `users`      ALTER COLUMN `business_unit` DROP DEFAULT;
ALTER TABLE `leads`      ALTER COLUMN `business_unit` DROP DEFAULT;
ALTER TABLE `global_pos` ALTER COLUMN `business_unit` DROP DEFAULT;
ALTER TABLE `vocs`       ALTER COLUMN `business_unit` DROP DEFAULT;
