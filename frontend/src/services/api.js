import axios from 'axios';

// One axios instance for the whole app. In dev, the CRA `proxy` in
// package.json forwards /api → the Express server. In prod, set
// REACT_APP_API_BASE if the API sits on a different origin.
const api = axios.create({
  baseURL: (process.env.REACT_APP_API_BASE || '') + '/api',
});

// Request interceptor: attach Bearer token from localStorage.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('Token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: bounce to /login on 401 (let 403 through so
// the UI can render a "not allowed" state).
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('Token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// --------------------------------------------------------------------------
// Endpoints — named arrow functions grouped by resource. Pages import
// these; pages never call axios directly.
// --------------------------------------------------------------------------

// Auth
export const login          = (email, password)               => api.post('/auth/login', { email, password }).then(r => r.data);
export const bdLogin        = (userId, password)              => api.post('/auth/bd-login', { userId, password }).then(r => r.data);
export const getMe          = ()                              => api.get('/auth/me').then(r => r.data);
export const changePassword = (currentPassword, newPassword)  => api.post('/auth/change-password', { currentPassword, newPassword }).then(r => r.data);

// Users / BDs
export const getBds         = (businessUnit)                  => api.get('/users', { params: { role: 'bd', business_unit: businessUnit } }).then(r => r.data);
export const addBd          = (name, businessUnit)            => api.post('/users', { name, business_unit: businessUnit }).then(r => r.data);
export const removeBd       = (id)                            => api.delete(`/users/${id}`).then(r => r.data);
export const resetBdPassword= (id, newPassword)               => api.put(`/users/${id}/reset-password`, { newPassword }).then(r => r.data);

// Leads
export const getLeads       = (params)                        => api.get('/leads', { params }).then(r => r.data);
export const getLead        = (id)                            => api.get(`/leads/${id}`).then(r => r.data);
export const createLead     = (data)                          => api.post('/leads', data).then(r => r.data);
export const updateLead     = (id, data)                      => api.put(`/leads/${id}`, data).then(r => r.data);
export const deleteLead     = (id)                            => api.delete(`/leads/${id}`).then(r => r.data);
export const bulkUpdateLeads= (ids, patch)                    => api.put('/leads/bulk/update', { ids, ...patch }).then(r => r.data);

// Activity log / stage history
export const getActivityLog = (leadId)                        => api.get('/activity-log', { params: { lead_id: leadId } }).then(r => r.data);
export const getStageHistory= ()                              => api.get('/stage-history').then(r => r.data);

// Forecast (public, no auth)
export const getForecastDevices = ()                          => api.get('/forecast/devices').then(r => r.data);

// Settings
export const getSettings    = ()                              => api.get('/settings').then(r => r.data);
export const setSetting     = (key, value)                    => api.put(`/settings/${key}`, { value }).then(r => r.data);

// Dropdowns
export const getDropdowns   = ()                              => api.get('/dropdowns').then(r => r.data);

// Uploads
export const uploadPoDocument = (leadId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/uploads/po/${leadId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};

export const fileUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return (process.env.REACT_APP_API_BASE || '') + path;
};

export default api;
