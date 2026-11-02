-- Release P3-2a: an Owner has ONE account for the whole company and can enter any business.
-- Earlier versions copied each Owner into every business as a Business Admin. Those copies are no longer
-- needed, so they are disabled (not deleted, so no record is lost) and lose the Owner grant. The Owner's
-- own account is the lowest-numbered one that holds the grant.
UPDATE `users` c
JOIN (
  SELECT `email`, MIN(`id`) AS `primary_id`
  FROM `users`
  WHERE `super_admin_scope` IS NOT NULL AND `email` IS NOT NULL
  GROUP BY `email`
) p ON p.`email` = c.`email`
SET c.`active` = 0, c.`super_admin_scope` = NULL
WHERE c.`id` <> p.`primary_id`
