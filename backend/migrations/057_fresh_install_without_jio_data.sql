-- Release P2-4: a brand-new install no longer starts with Jio's businesses.
-- Earlier setup files create Signage, JHES and Surveillance, with Jio product catalogs, Jio device
-- codes, partner names and stage targets. On a brand-new database (no users and no leads in those
-- businesses yet) this removes them, so the seed can create a neutral starter business instead.
-- A database already in use (any user or lead in those businesses) is left exactly as it is.
-- (COLLATE: older tables use a different text collation, so comparisons name one explicitly.)
DELETE FROM `service_definitions`
WHERE `business_unit` IN ('signage', 'jhes', 'surveillance')
  AND NOT EXISTS (SELECT 1 FROM `users` u WHERE u.`business_unit` COLLATE utf8mb4_unicode_ci = `service_definitions`.`business_unit` COLLATE utf8mb4_unicode_ci)
  AND NOT EXISTS (SELECT 1 FROM `leads` l WHERE l.`business_unit` COLLATE utf8mb4_unicode_ci = `service_definitions`.`business_unit` COLLATE utf8mb4_unicode_ci);
DELETE FROM `dropdown_options`
WHERE `business_unit` IN ('signage', 'jhes', 'surveillance')
  AND NOT EXISTS (SELECT 1 FROM `users` u WHERE u.`business_unit` COLLATE utf8mb4_unicode_ci = `dropdown_options`.`business_unit` COLLATE utf8mb4_unicode_ci)
  AND NOT EXISTS (SELECT 1 FROM `leads` l WHERE l.`business_unit` COLLATE utf8mb4_unicode_ci = `dropdown_options`.`business_unit` COLLATE utf8mb4_unicode_ci);
DELETE FROM `sla_config`
WHERE `business_unit` IN ('signage', 'jhes', 'surveillance')
  AND NOT EXISTS (SELECT 1 FROM `users` u WHERE u.`business_unit` COLLATE utf8mb4_unicode_ci = `sla_config`.`business_unit` COLLATE utf8mb4_unicode_ci)
  AND NOT EXISTS (SELECT 1 FROM `leads` l WHERE l.`business_unit` COLLATE utf8mb4_unicode_ci = `sla_config`.`business_unit` COLLATE utf8mb4_unicode_ci);
DELETE FROM `activity_tabs`
WHERE `business_unit` IN ('signage', 'jhes', 'surveillance')
  AND NOT EXISTS (SELECT 1 FROM `users` u WHERE u.`business_unit` COLLATE utf8mb4_unicode_ci = `activity_tabs`.`business_unit` COLLATE utf8mb4_unicode_ci)
  AND NOT EXISTS (SELECT 1 FROM `leads` l WHERE l.`business_unit` COLLATE utf8mb4_unicode_ci = `activity_tabs`.`business_unit` COLLATE utf8mb4_unicode_ci);
DELETE FROM `business_units`
WHERE `slug` IN ('signage', 'jhes', 'surveillance')
  AND NOT EXISTS (SELECT 1 FROM `users` u WHERE u.`business_unit` COLLATE utf8mb4_unicode_ci = `business_units`.`slug` COLLATE utf8mb4_unicode_ci)
  AND NOT EXISTS (SELECT 1 FROM `leads` l WHERE l.`business_unit` COLLATE utf8mb4_unicode_ci = `business_units`.`slug` COLLATE utf8mb4_unicode_ci)
