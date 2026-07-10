const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// --------------------------------------------------------------------------
// User — admins/PMOs and BDs live in the same table (role-based).
// Admins/PMOs have password_hash; BDs authenticate via the shared team
// password (settings.bd_default_password) and have password_hash = null.
// --------------------------------------------------------------------------
const User = sequelize.define('User', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:          { type: DataTypes.STRING(255), allowNull: false },
  // email is unique PER business unit (composite key email_business_unit — see migration 002), so
  // one corporate email may hold both a signage and a jhes account. NULL emails (BDs) are exempt.
  email:         { type: DataTypes.STRING(255), unique: 'email_business_unit', allowNull: true },
  // mobile contact number. Nullable in the DB so pre-existing rows are unaffected; the Settings
  // add/edit modal makes it mandatory for users created or edited through the app.
  mobile:        { type: DataTypes.STRING(32), allowNull: true },
  password_hash: { type: DataTypes.STRING(255), allowNull: true },
  role:          { type: DataTypes.ENUM('admin', 'pmo', 'bd'), allowNull: false, defaultValue: 'bd' },
  business_unit: { type: DataTypes.ENUM('signage', 'jhes'), unique: 'email_business_unit', allowNull: false, defaultValue: 'signage' },
  initials:      { type: DataTypes.STRING(8) },
  color:         { type: DataTypes.STRING(32), defaultValue: 'bg-indigo-500' },
  active:        { type: DataTypes.BOOLEAN, defaultValue: true },
  sort_order:    { type: DataTypes.INTEGER, defaultValue: 0 },
  last_seen:     { type: DataTypes.DATE },
}, { tableName: 'users', underscored: true });

// --------------------------------------------------------------------------
// Lead
// --------------------------------------------------------------------------
const Lead = sequelize.define('Lead', {
  id:                      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  // sr_no is a human-facing sequence number, set by the app (max+1) on create —
  // MySQL only allows one AUTO_INCREMENT column per table, and `id` already is it.
  sr_no:                   { type: DataTypes.INTEGER, unique: true },
  customer_name:           { type: DataTypes.STRING(255), allowNull: false },
  owner_id:                { type: DataTypes.INTEGER, allowNull: false },
  business_unit:           { type: DataTypes.ENUM('signage', 'jhes'), allowNull: false, defaultValue: 'signage' },
  city:                    { type: DataTypes.STRING(255) },
  state:                   { type: DataTypes.STRING(255) },
  lead_source:             { type: DataTypes.STRING(64) },
  channel_partner_name:    { type: DataTypes.STRING(255) },
  kam_name:                { type: DataTypes.STRING(255) },
  new_or_renewal:          { type: DataTypes.ENUM('New', 'Renewal', 'Expansion') },
  lead_temperature:        { type: DataTypes.ENUM('Hot', 'Warm', 'Cold') },
  competitor:              { type: DataTypes.STRING(255) },
  quantity:                { type: DataTypes.INTEGER, defaultValue: 0 },
  potential_tcv_lakhs:     { type: DataTypes.DECIMAL(12, 2) },
  contract_period_months:  { type: DataTypes.INTEGER },
  po_validity_months:      { type: DataTypes.INTEGER },
  acv_lakhs:               { type: DataTypes.DECIMAL(12, 2) },
  contract_value_lakhs:    { type: DataTypes.DECIMAL(12, 2) },
  phase:                   { type: DataTypes.STRING(32), defaultValue: 'New' },
  phase_changed_at:        { type: DataTypes.DATE },
  start_date:              { type: DataTypes.DATEONLY },
  qualified_date:          { type: DataTypes.DATEONLY },
  demo_date:               { type: DataTypes.DATEONLY },
  proposal_date:           { type: DataTypes.DATEONLY },
  negotiation_date:        { type: DataTypes.DATEONLY },
  po_received_date:        { type: DataTypes.DATEONLY },
  po_expected_date:        { type: DataTypes.DATEONLY },
  next_followup_date:      { type: DataTypes.DATEONLY },
  includes_platform:       { type: DataTypes.BOOLEAN, defaultValue: false },
  includes_cms:            { type: DataTypes.BOOLEAN, defaultValue: false },
  includes_connectivity:   { type: DataTypes.BOOLEAN, defaultValue: false },
  includes_display:        { type: DataTypes.BOOLEAN, defaultValue: false },
  includes_device:         { type: DataTypes.BOOLEAN, defaultValue: false },
  device_sku:              { type: DataTypes.STRING(64) },
  device_requested_date:   { type: DataTypes.DATEONLY },
  platform_rate:           { type: DataTypes.DECIMAL(12, 2) },
  cms_rate:                { type: DataTypes.DECIMAL(12, 2) },
  connectivity_rate:       { type: DataTypes.DECIMAL(12, 2) },
  display_rate:            { type: DataTypes.DECIMAL(12, 2) },
  device_rate:             { type: DataTypes.DECIMAL(12, 2) },
  platform_qty:            { type: DataTypes.INTEGER },
  cms_qty:                 { type: DataTypes.INTEGER },
  connectivity_qty:        { type: DataTypes.INTEGER },
  display_qty:             { type: DataTypes.INTEGER },
  device_qty:              { type: DataTypes.INTEGER },
  jhes_product:            { type: DataTypes.STRING(255) },
  additional_notes:        { type: DataTypes.TEXT },
  po_document_url:         { type: DataTypes.STRING(512) },
  lost_reason:             { type: DataTypes.STRING(255) },
  po_actual_value_lakhs:   { type: DataTypes.DECIMAL(12, 2) },
  created_by:              { type: DataTypes.INTEGER },
  updated_by:              { type: DataTypes.INTEGER },
}, { tableName: 'leads', underscored: true });

// --------------------------------------------------------------------------
// LeadContact
// --------------------------------------------------------------------------
const LeadContact = sequelize.define('LeadContact', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  lead_id:     { type: DataTypes.INTEGER, allowNull: false },
  name:        { type: DataTypes.STRING(255), allowNull: false },
  phone:       { type: DataTypes.STRING(64) },
  email:       { type: DataTypes.STRING(255) },
  designation: { type: DataTypes.STRING(128) },
}, { tableName: 'lead_contacts', underscored: true });

// --------------------------------------------------------------------------
// ActivityLog — every save/edit
// --------------------------------------------------------------------------
const ActivityLog = sequelize.define('ActivityLog', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  lead_id:        { type: DataTypes.INTEGER, allowNull: false },
  lead_sr_no:     { type: DataTypes.INTEGER },
  customer_name:  { type: DataTypes.STRING(255) },
  user_name:      { type: DataTypes.STRING(255) },
  action_type:    { type: DataTypes.STRING(64) },
  field_changed: { type: DataTypes.STRING(64) },
  old_value:      { type: DataTypes.TEXT },
  new_value:      { type: DataTypes.TEXT },
  note:           { type: DataTypes.TEXT },
}, { tableName: 'activity_log', underscored: true, updatedAt: false });

// --------------------------------------------------------------------------
// StageHistory — every phase move (powers funnel + rotting analytics)
// --------------------------------------------------------------------------
const StageHistory = sequelize.define('StageHistory', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  lead_id:    { type: DataTypes.INTEGER, allowNull: false },
  from_stage: { type: DataTypes.STRING(32) },
  to_stage:   { type: DataTypes.STRING(32), allowNull: false },
  changed_by: { type: DataTypes.STRING(255), allowNull: false },
  changed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  notes:      { type: DataTypes.TEXT },
}, { tableName: 'stage_history', underscored: true, updatedAt: false, createdAt: false });

// --------------------------------------------------------------------------
// Setting — key/value config (weekly target, per-BD targets, bd_default_password…)
// --------------------------------------------------------------------------
const Setting = sequelize.define('Setting', {
  key_name: { type: DataTypes.STRING(64), primaryKey: true },
  value:    { type: DataTypes.TEXT, allowNull: false },
}, { tableName: 'settings', underscored: true, createdAt: false });

// --------------------------------------------------------------------------
// DropdownOption — extensible dropdowns (phases, sources, ratings…)
// --------------------------------------------------------------------------
const DropdownOption = sequelize.define('DropdownOption', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  field_name: { type: DataTypes.STRING(64), allowNull: false },
  value:      { type: DataTypes.STRING(128), allowNull: false },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  active:     { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'dropdown_options', underscored: true, timestamps: false });

// --------------------------------------------------------------------------
// Associations
// --------------------------------------------------------------------------
Lead.belongsTo(User,          { foreignKey: 'owner_id',   as: 'owner' });
User.hasMany(Lead,             { foreignKey: 'owner_id',   as: 'leads' });

Lead.hasMany(LeadContact,      { foreignKey: 'lead_id',    as: 'contacts', onDelete: 'CASCADE' });
LeadContact.belongsTo(Lead,    { foreignKey: 'lead_id' });

Lead.hasMany(ActivityLog,      { foreignKey: 'lead_id',    as: 'activity', onDelete: 'CASCADE' });
ActivityLog.belongsTo(Lead,    { foreignKey: 'lead_id' });

Lead.hasMany(StageHistory,     { foreignKey: 'lead_id',    as: 'stageHistory', onDelete: 'CASCADE' });
StageHistory.belongsTo(Lead,   { foreignKey: 'lead_id' });

module.exports = {
  sequelize,
  User,
  Lead,
  LeadContact,
  ActivityLog,
  StageHistory,
  Setting,
  DropdownOption,
};
