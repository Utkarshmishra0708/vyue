-- Per-customer grouping code and per-lead unique reference.
-- customer_code is shared by all leads of the same customer (normalized name) within a business unit.
-- lead_ref is unique per lead: customer_code plus a per-customer running PO sequence.
-- Existing rows are backfilled in JS on boot (see services/leadCodes.js backfillLeadCodes).
ALTER TABLE leads
  ADD COLUMN customer_code VARCHAR(20) NULL AFTER sr_no,
  ADD COLUMN lead_ref VARCHAR(30) NULL AFTER customer_code;

CREATE INDEX idx_leads_customer_code ON leads (customer_code);

CREATE INDEX idx_leads_lead_ref ON leads (lead_ref);
