import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SuperAdminsPanel from '../components/SuperAdminsPanel';
import { useAuth } from '../context/AuthContext';
import { getBusinessUnits } from '../services/api';

// Company-wide settings, for the Owner only: the businesses (open the list to create, rename, disable
// or delete) and the Owners. Everything that belongs to ONE business (its people, lists and stage
// targets) stays under that business's own Settings.
const TEXT = {
  title: 'Organization Settings',
  subtitle: 'Settings for the whole company',
  businesses: 'Businesses',
  count: (n) => `${n} active business${n === 1 ? '' : 'es'}`,
  manage: 'Manage businesses',
  create: 'Create business',
};

export default function OrganizationSettingsPage() {
  const navigate = useNavigate();
  const { canAct } = useAuth();
  const [count, setCount] = useState(null);

  useEffect(() => {
    getBusinessUnits('active').then(l => setCount(Array.isArray(l) ? l.length : null)).catch(() => setCount(null));
  }, []);

  return (
    <Layout>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 24px' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{TEXT.title}</h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{TEXT.subtitle}</p>
      </div>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card">
          <p className="section-title">{TEXT.businesses}</p>
          {count !== null && <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>{TEXT.count(count)}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/business-units')}>{TEXT.manage}</button>
            {canAct && <button className="btn" onClick={() => navigate('/business-units?new=1')}>{TEXT.create}</button>}
          </div>
        </div>
        <SuperAdminsPanel />
      </div>
    </Layout>
  );
}
