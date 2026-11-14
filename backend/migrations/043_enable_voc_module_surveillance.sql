UPDATE business_units
SET config = JSON_SET(
  COALESCE(config, '{}'),
  '$.modules',
  JSON_MERGE_PRESERVE(
    COALESCE(JSON_EXTRACT(config, '$.modules'), '[]'),
    '[{"slug":"voc","label":"Voice of Customer (VOC)","enabled":true}]'
  )
)
WHERE slug = 'surveillance'
  AND (config IS NULL OR JSON_SEARCH(config, 'one', 'voc', NULL, '$.modules[*].slug') IS NULL);
