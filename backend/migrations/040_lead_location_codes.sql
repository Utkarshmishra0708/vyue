-- Location sub-code for each lead, so a single customer with POs in multiple cities can be
-- grouped Customer then Location then POs. Derived from lead.city and backfilled on boot by
-- services/leadCodes.js. Nullable because the city itself can be empty (we fall back to UNK).
ALTER TABLE leads ADD COLUMN location_code VARCHAR(10) NULL AFTER customer_code;

CREATE INDEX idx_leads_location_code ON leads (location_code);
