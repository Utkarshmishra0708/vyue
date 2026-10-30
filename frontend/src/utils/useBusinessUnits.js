import { useEffect, useState } from 'react';
import { getBusinessUnits } from '../services/api';

// The list of businesses always comes from the database (GET /api/business-units); the code itself
// knows no business names. The list is loaded once and shared by every screen that asks for it.
export const DEFAULT_BUSINESS_COLOR = '#4f46e5';
let cache = null;      // the loaded list
let pending = null;    // the request in flight
const listeners = new Set(); // screens showing the list, told when it is reloaded

export function loadBusinessUnits() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = getBusinessUnits()
      .then(list => { cache = Array.isArray(list) ? list : []; return cache; })
      .catch(err => { pending = null; throw err; });
  }
  return pending;
}

// Reload the list (after a business is created, renamed, disabled or deleted) and update every screen.
export function refreshBusinessUnits() {
  cache = null; pending = null;
  return loadBusinessUnits().then(l => { listeners.forEach(fn => fn(l)); return l; }).catch(() => []);
}

// Name, colour and description for one business. Until the list loads (or if a business is missing
// from it), the slug itself is shown with the default colour.
export function businessMeta(list, slug) {
  return (list || []).find(b => b.slug === slug) || { slug, name: slug || '', color: DEFAULT_BUSINESS_COLOR, description: '' };
}

export default function useBusinessUnits() {
  const [list, setList] = useState(cache || []);
  useEffect(() => {
    let alive = true;
    listeners.add(setList);
    loadBusinessUnits().then(l => { if (alive) setList(l); }).catch(() => {});
    return () => { alive = false; listeners.delete(setList); };
  }, []);
  return { list, meta: (slug) => businessMeta(list, slug) };
}
