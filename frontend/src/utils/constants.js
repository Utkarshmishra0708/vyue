export const PHASE_DATE_MAP = {
  New: 'start_date', Qualified: 'qualified_date', Demo: 'demo_date',
  Proposal: 'proposal_date', Negotiation: 'negotiation_date', 'Won': 'po_received_date',
};

export const STAGE_ORDER = ['New', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Order Expected', 'Won', 'Lost', 'On Hold'];

export const STAGE_WIN_PCT = {
  New: 5, Qualified: 15, Demo: 30, Proposal: 45, Negotiation: 60,
  'Order Expected': 80, 'Won': 100, Lost: 0, 'On Hold': 0,
};

export const PHASE_BADGE = {
  New: 'badge-gray', Qualified: 'badge-purple', Demo: 'badge-amber', Proposal: 'badge-blue',
  Negotiation: 'badge-orange', 'Order Expected': 'badge-teal', 'Won': 'badge-green',
  Lost: 'badge-red', 'On Hold': 'badge-gray',
};

export const TEMP_BADGE = { Hot: 'badge-red', Warm: 'badge-amber', Cold: 'badge-blue' };


export const LOST_REASONS = ['Pricing', 'Competition', 'No Budget', 'No Decision', 'Timing', 'Product Fit', 'Other'];
export const TAT_DAYS = 14;

// Human-readable role labels (roles are stored lowercase/snake_case).
export const ROLE_LABEL = {
  super_admin: 'Owner', business_admin: 'Business Admin', pmo: 'Manager', bd: 'Sales Rep', forecast: 'Inventory Pipeline',
};

// Indian States and Union Territories. Most CRMs present these in one "State / UT" dropdown, grouped
// so the 8 UTs are distinguishable from the 28 states — that's the approach used here.
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];
export const UNION_TERRITORIES = [
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// --- Account Mix (all businesses) ---
export const PROPERTY_TYPES = ['Part of a group', 'Standalone', 'Other'];
export const PROPERTY_CATEGORIES = [
  'Hospital', 'Hotels', 'BFSI', 'Retail', 'Real Estate', 'Manufacturing',
  'IT/ITES', 'Education', 'Bank', 'Corporate Office', 'Restaurants', 'Other',
];

// --- VOC (Voice of Customer) — Surveillance only ---
export const VOC_SEGMENTS = ['Enterprise', 'SMB', 'Government', 'Residential', 'Other'];
export const VOC_PRODUCTS = ['Camera', 'VMS', 'Cloud Storage', 'Analytics', 'NVR', 'Other'];
export const VOC_TYPES = ['Feature Gap', 'Configuration Mismatch', 'Integration Requirement', 'Performance Issue', 'Enhancement Request', 'Commercial Gap', 'Other'];
export const VOC_IMPACTS = ['Deal Blocker', 'Deal Delay', 'Competitive Gap', 'Nice to Have'];
export const VOC_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
export const VOC_STATUSES = ['New', 'Under Review', 'Accepted', 'Planned', 'In Development', 'Released', 'Rejected', 'Closed'];
export const VOC_OPEN_STATUSES = ['New', 'Under Review', 'Accepted', 'Planned', 'In Development'];
// Status badge colours.
export const VOC_STATUS_BADGE = {
  New: 'badge-blue', 'Under Review': 'badge-amber', Accepted: 'badge-purple', Planned: 'badge-purple',
  'In Development': 'badge-amber', Released: 'badge-green', Rejected: 'badge-red', Closed: 'badge-gray',
};
export const VOC_PRIORITY_BADGE = { Critical: 'badge-red', High: 'badge-amber', Medium: 'badge-blue', Low: 'badge-gray' };
