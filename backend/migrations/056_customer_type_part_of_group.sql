-- Release P2-3b-2: the Customer Type value "Chain" (hotel-industry wording) becomes "Part of a group".
UPDATE `leads` SET `property_type` = 'Part of a group' WHERE `property_type` = 'Chain';
UPDATE `dropdown_options` SET `value` = 'Part of a group' WHERE `field_name` = 'property_type' AND `value` = 'Chain';
UPDATE `activity_log` SET `old_value` = 'Part of a group' WHERE `old_value` = 'Chain' AND `field_changed` = 'Customer Type';
UPDATE `activity_log` SET `new_value` = 'Part of a group' WHERE `new_value` = 'Chain' AND `field_changed` = 'Customer Type';
UPDATE `business_units`
SET `config` = CAST(REPLACE(CAST(`config` AS CHAR), '"Chain"', '"Part of a group"') AS JSON)
WHERE `config` IS NOT NULL;
