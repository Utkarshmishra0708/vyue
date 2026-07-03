export const BU_CONFIG = {
  signage: { label: 'Signage', color: '#4f46e5', description: 'Digital Signage Solutions' },
  jhes:    { label: 'JHES',    color: '#ea580c', description: 'AV & Communication Systems' },
};

export const PHASE_DATE_MAP = {
  New: 'start_date', Qualified: 'qualified_date', Demo: 'demo_date',
  Proposal: 'proposal_date', Negotiation: 'negotiation_date', 'PO Received': 'po_received_date',
};

export const STAGE_ORDER = ['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'PO Expected', 'PO Received'];

export const STAGE_WIN_PCT = {
  New: 5, Qualified: 15, Demo: 30, Proposal: 45, Negotiation: 60,
  'PO Expected': 80, 'PO Received': 100, Lost: 0, 'On Hold': 0,
};

export const PHASE_BADGE = {
  New: 'badge-gray', Qualified: 'badge-purple', Demo: 'badge-amber', Proposal: 'badge-blue',
  Negotiation: 'badge-orange', 'PO Expected': 'badge-teal', 'PO Received': 'badge-green',
  Lost: 'badge-red', 'On Hold': 'badge-gray',
};

export const TEMP_BADGE = { Hot: 'badge-red', Warm: 'badge-amber', Cold: 'badge-blue' };

export const DEVICE_SKU_MAP = {
  MCM3000: 'Media Player', JSB210: 'Media Player', J100: 'Media Player', M2S: 'Dongle',
};

export const LOST_REASONS = ['Pricing', 'Competition', 'No Budget', 'No Decision', 'Timing', 'Product Fit', 'Other'];
export const TAT_DAYS = 14;
