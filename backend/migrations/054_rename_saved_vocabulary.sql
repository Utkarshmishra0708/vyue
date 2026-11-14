-- Release P2-1b: rename saved vocabulary values to the approved generic words.
--   Stages:        PO Expected -> Order Expected, PO Received -> Won
--   Lead sources:  KAM -> Account Manager, Lead Affiliate -> Referral Partner
--   Dashboards:    PMO -> Manager (business template catalog)
--   Module label:  Voice of Customer (VOC) -> Customer Feedback (business templates)
-- The code is changed in the same release to use the new values.

UPDATE `leads` SET `phase` = 'Order Expected' WHERE `phase` = 'PO Expected';
UPDATE `leads` SET `phase` = 'Won' WHERE `phase` = 'PO Received';
UPDATE `leads` SET `pre_hold_stage` = 'Order Expected' WHERE `pre_hold_stage` = 'PO Expected';
UPDATE `leads` SET `pre_hold_stage` = 'Won' WHERE `pre_hold_stage` = 'PO Received';
UPDATE `leads` SET `lead_source` = 'Account Manager' WHERE `lead_source` = 'KAM';
UPDATE `leads` SET `lead_source` = 'Referral Partner' WHERE `lead_source` = 'Lead Affiliate';

UPDATE `stage_history` SET `from_stage` = 'Order Expected' WHERE `from_stage` = 'PO Expected';
UPDATE `stage_history` SET `from_stage` = 'Won' WHERE `from_stage` = 'PO Received';
UPDATE `stage_history` SET `to_stage` = 'Order Expected' WHERE `to_stage` = 'PO Expected';
UPDATE `stage_history` SET `to_stage` = 'Won' WHERE `to_stage` = 'PO Received';

UPDATE `sla_config` SET `stage` = 'Order Expected' WHERE `stage` = 'PO Expected';
UPDATE `sla_config` SET `stage` = 'Won' WHERE `stage` = 'PO Received';

UPDATE `dropdown_options` SET `value` = 'Order Expected' WHERE `value` = 'PO Expected';
UPDATE `dropdown_options` SET `value` = 'Won' WHERE `value` = 'PO Received';
UPDATE `dropdown_options` SET `value` = 'Account Manager' WHERE `value` = 'KAM' AND `field_name` = 'lead_source';
UPDATE `dropdown_options` SET `value` = 'Referral Partner' WHERE `value` = 'Lead Affiliate' AND `field_name` = 'lead_source';

UPDATE `activity_log` SET `old_value` = 'Order Expected' WHERE `old_value` = 'PO Expected';
UPDATE `activity_log` SET `old_value` = 'Won' WHERE `old_value` = 'PO Received';
UPDATE `activity_log` SET `new_value` = 'Order Expected' WHERE `new_value` = 'PO Expected';
UPDATE `activity_log` SET `new_value` = 'Won' WHERE `new_value` = 'PO Received';
UPDATE `activity_log` SET `old_value` = 'Account Manager' WHERE `old_value` = 'KAM';
UPDATE `activity_log` SET `old_value` = 'Referral Partner' WHERE `old_value` = 'Lead Affiliate';
UPDATE `activity_log` SET `new_value` = 'Account Manager' WHERE `new_value` = 'KAM';
UPDATE `activity_log` SET `new_value` = 'Referral Partner' WHERE `new_value` = 'Lead Affiliate';

UPDATE `business_units`
SET `config` = CAST(
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CAST(`config` AS CHAR),
    '"PO Expected"', '"Order Expected"'),
    '"PO Received"', '"Won"'),
    '"KAM"', '"Account Manager"'),
    '"Lead Affiliate"', '"Referral Partner"'),
    '"PMO"', '"Manager"'),
    'Voice of Customer (VOC)', 'Customer Feedback')
  AS JSON)
WHERE `config` IS NOT NULL;

UPDATE `notifications`
SET `title` = REPLACE(REPLACE(`title`, 'PO Expected', 'Order Expected'), 'PO Received', 'Won'),
    `body` = REPLACE(REPLACE(`body`, 'PO Expected', 'Order Expected'), 'PO Received', 'Won'),
    `dedupe_key` = REPLACE(REPLACE(`dedupe_key`, 'PO Expected', 'Order Expected'), 'PO Received', 'Won')
WHERE `title` LIKE '%PO Expected%' OR `title` LIKE '%PO Received%'
   OR `body` LIKE '%PO Expected%' OR `body` LIKE '%PO Received%'
   OR `dedupe_key` LIKE '%PO Expected%' OR `dedupe_key` LIKE '%PO Received%';
