UPDATE `users`
SET `module_permissions` = JSON_SET(
  COALESCE(`module_permissions`, '{}'),
  '$.voc',       CASE WHEN `role` IN ('super_admin','business_admin','pmo') THEN 'full' ELSE 'read' END,
  '$.campaigns', CASE WHEN `role` IN ('super_admin','business_admin','pmo') THEN 'full' ELSE 'read' END,
  '$.customers', 'full'
)
WHERE `module_permissions` IS NOT NULL
  AND JSON_EXTRACT(`module_permissions`, '$.campaigns') IS NULL