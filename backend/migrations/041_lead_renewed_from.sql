-- Links a Renewal lead back to the specific PO it renews (set by the + Additional PO Renewal flow).
-- Lets the renewal radar know a PO has been renewed so it stops nagging, and preserves traceability.
ALTER TABLE leads ADD COLUMN renewed_from_lead_id INT NULL AFTER new_or_renewal;

CREATE INDEX idx_leads_renewed_from ON leads (renewed_from_lead_id);
