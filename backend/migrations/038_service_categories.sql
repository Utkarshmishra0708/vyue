-- Migration 038 -- Services Offered v2: three categories + clean slate.
--
-- The Services Offered section is being rebuilt around three admin-defined catalog categories
--   hardware           -- devices / SKUs, flow into the Inventory Pipeline
--   software           -- recurring services, opex only
--   hardware_software  -- a combined line carrying both a hardware and a service component
--
-- Step 1 adds a `category` column to the service catalog and backfills it from the existing
-- `hardware` flag (hardware rows become 'hardware', the rest 'software'). The Global Admin can then
-- re-tag any as 'hardware_software' from the wizard / Edit Template.
--
-- Step 2 wipes the per-lead Services Offered VALUES on every lead (approved -- all current data is
-- test data). This clears both storage models (the signage/jhes columns and the json list) so every
-- business starts clean on the new line shape. Non-service fields (customer, phase, dates, TCV) are
-- left untouched -- TCV recomputes from the new services when a lead is next saved.
--
-- NOTE keep this file free of the semicolon character except the statement terminator, because the
-- migration runner splits statements on it.

ALTER TABLE `service_definitions`
  ADD COLUMN `category` VARCHAR(32) NOT NULL DEFAULT 'software' AFTER `hardware`;

UPDATE `service_definitions` SET `category` = 'hardware' WHERE `hardware` = 1;

UPDATE `leads` SET
  `services_json` = NULL,
  `includes_platform` = 0, `includes_cms` = 0, `includes_connectivity` = 0,
  `includes_display` = 0, `includes_device` = 0, `includes_amc` = 0,
  `includes_installation` = 0, `includes_iptv` = 0, `includes_jhes` = 0,
  `platform_rate` = NULL, `cms_rate` = NULL, `connectivity_rate` = NULL,
  `display_rate` = NULL, `device_rate` = NULL, `amc_rate` = NULL,
  `installation_rate` = NULL, `iptv_rate` = NULL, `jhes_rate` = NULL,
  `platform_qty` = NULL, `cms_qty` = NULL, `connectivity_qty` = NULL,
  `display_qty` = NULL, `device_qty` = NULL, `amc_qty` = NULL,
  `installation_qty` = NULL, `iptv_qty` = NULL, `jhes_qty` = NULL,
  `device_sku` = NULL, `device_cost_type` = NULL, `jhes_product` = NULL,
  `quantity` = 0
