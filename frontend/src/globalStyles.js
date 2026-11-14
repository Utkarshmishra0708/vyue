// Material 3 Design System — global CSS tokens and utility classes.
// Injected once in App.jsx via <style>{GLOBAL_CSS}</style>.
export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');

  /* ── M3 Design Tokens ── */
  :root {
    /* Primary — vivid violet */
    --m3-primary: #7C3AED;
    --m3-on-primary: #FFFFFF;
    --m3-primary-container: #DDD6FE;
    --m3-on-primary-container: #2E1065;

    /* Secondary — richer purple-gray */
    --m3-secondary: #6D5D8A;
    --m3-on-secondary: #FFFFFF;
    --m3-secondary-container: #E2D8F0;
    --m3-on-secondary-container: #251740;

    /* Tertiary — warmer rose */
    --m3-tertiary: #9D4564;
    --m3-tertiary-container: #FFD9E3;

    /* Error */
    --m3-error: #DC2626;
    --m3-error-container: #FEE2E2;
    --m3-on-error-container: #450A0A;

    /* Surface system — slightly warmer, less gray */
    --m3-surface: #FEFBFF;
    --m3-surface-dim: #DDD6E1;
    --m3-surface-bright: #FEFBFF;
    --m3-surface-container-lowest: #FFFFFF;
    --m3-surface-container-low: #F8F5FC;
    --m3-surface-container: #F3F0F9;
    --m3-surface-container-high: #EDEAF4;
    --m3-surface-container-highest: #E5E1EE;
    --m3-on-surface: #1C1B22;
    --m3-on-surface-variant: #46424F;
    --m3-outline: #6E6A78;
    --m3-outline-variant: #C4BFCC;

    /* Success — richer green */
    --m3-success: #16A34A;
    --m3-success-container: #BBF7D0;

    /* Semantic aliases used by components */
    --color-primary: var(--m3-primary);
    --color-primary-hover: #6D28D9;
    --color-primary-container: var(--m3-primary-container);
    --color-on-primary-container: var(--m3-on-primary-container);
    --color-bg: var(--m3-surface-container-low);
    --color-text: var(--m3-on-surface);
    --color-text-muted: var(--m3-on-surface-variant);
    --color-text-faint: var(--m3-outline);
    --color-border: var(--m3-outline-variant);
    --color-border-light: var(--m3-surface-container-high);
    --color-card: var(--m3-surface-container-lowest);
    --color-surface: var(--m3-surface-container);
    --color-success: var(--m3-success);
    --color-danger: var(--m3-error);
    --color-warning: #7D5700;

    /* Sidebar (deep indigo) */
    --color-sidebar: #1E1B4B;
    --color-sidebar-hover: rgba(167,139,250,.1);
    --color-sidebar-active: rgba(167,139,250,.2);
    --color-sidebar-text: #C4B5FD;
    --color-sidebar-text-active: #EDE9FE;
    --color-sidebar-glow: #A78BFA;

    /* Typography */
    --font-body: 'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-heading: 'DM Sans', 'Inter', sans-serif;

    /* M3 Shape scale */
    --radius-xs: 4px;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --radius-xl: 28px;

    /* M3 Elevation */
    --elevation-1: 0 1px 3px 1px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.3);
    --elevation-2: 0 2px 6px 2px rgba(0,0,0,.15), 0 1px 2px rgba(0,0,0,.3);
    --elevation-3: 0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.3);
    --shadow-card: 0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.1);
    --shadow-elevated: 0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.06);
  }

  /* ── Base reset ── */
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--color-bg); color: var(--color-text);
    font-family: var(--font-body); -webkit-font-smoothing: antialiased;
    font-size: 13px; line-height: 1.45; letter-spacing: 0.01em;
  }
  a { color: inherit; text-decoration: none; }
  h1, h2, h3, h4, h5 { font-family: var(--font-heading); letter-spacing: -0.02em; }

  /* ── M3 Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 18px; border-radius: 18px;
    border: 1px solid var(--color-border); background: var(--color-card);
    color: var(--color-primary); font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all .2s ease; font-family: var(--font-body);
    letter-spacing: 0.01em; position: relative; overflow: hidden;
  }
  .btn:hover { background: var(--m3-surface-container); }
  .btn:disabled { opacity: .38; cursor: not-allowed; }
  .btn:active { transform: scale(0.98); }

  /* Filled button (M3 primary) */
  .btn-primary {
    background: var(--color-primary); border-color: var(--color-primary); color: var(--m3-on-primary);
    box-shadow: var(--elevation-1);
  }
  .btn-primary:hover { background: var(--color-primary-hover); box-shadow: var(--elevation-2); }

  /* Tonal button (M3 secondary container) */
  .btn-tonal { background: var(--m3-secondary-container); border-color: transparent; color: var(--m3-on-secondary-container); }
  .btn-tonal:hover { background: #D4CAFE; }

  /* Danger */
  .btn-danger { background: var(--m3-error-container); border-color: transparent; color: var(--m3-on-error-container); }
  .btn-danger:hover { background: #FECACA; }

  /* Success */
  .btn-success { background: var(--m3-success); border-color: var(--m3-success); color: #fff; }
  .btn-success:hover { background: #15803D; }

  /* Small */
  .btn-sm { padding: 4px 12px; font-size: 11px; border-radius: 14px; }

  /* ── M3 Cards ── */
  .card {
    background: var(--color-card); border: 1px solid var(--color-border);
    border-radius: var(--radius-sm); padding: 14px;
    box-shadow: none; transition: box-shadow .2s, border-color .2s;
  }
  .card:hover { }
  .card-sm {
    background: var(--color-card); border: 1px solid var(--color-border);
    border-radius: var(--radius-sm); padding: 10px;
  }
  .card-elevated {
    background: var(--m3-surface-container-low); border: none;
    border-radius: var(--radius-sm); padding: 14px;
    box-shadow: var(--shadow-card);
  }
  .card-filled {
    background: var(--m3-surface-container-highest); border: none;
    border-radius: var(--radius-sm); padding: 14px;
  }

  /* ── M3 Text fields (outlined variant) ── */
  .input, select.input, textarea.input {
    width: 100%; padding: 8px 12px;
    border: 1px solid var(--m3-outline); border-radius: var(--radius-xs);
    font-size: 13px; outline: none; background: transparent;
    color: var(--color-text); font-family: var(--font-body);
    transition: border-color .2s, box-shadow .2s;
    letter-spacing: 0.01em;
  }
  .input:focus { border-color: var(--color-primary); border-width: 2px; padding: 7px 11px; }
  .input::placeholder { color: var(--m3-outline); }
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  input[type=number] { -moz-appearance: textfield; }
  label.field-label {
    font-size: 12px; font-weight: 500; color: var(--color-text-muted);
    display: block; margin-bottom: 6px; letter-spacing: 0.02em;
  }

  /* ── M3 Chips (used as badges) ── */
  .badge {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 2px 8px; border-radius: var(--radius-sm);
    font-size: 11px; font-weight: 600; letter-spacing: 0.01em;
  }
  .badge-red { background: var(--m3-error-container); color: var(--m3-on-error-container); }
  .badge-amber { background: #FFDDB3; color: #452B00; }
  .badge-green { background: var(--m3-success-container); color: #0D2000; }
  .badge-blue { background: #D3E4FF; color: #001C38; }
  .badge-purple { background: var(--m3-primary-container); color: var(--m3-on-primary-container); }
  .badge-gray { background: var(--m3-surface-container-highest); color: var(--m3-on-surface-variant); }
  .badge-orange { background: #FFDCC8; color: #351000; }
  .badge-teal { background: #C8F5E5; color: #002117; }

  /* ── M3 Data tables ── */
  table.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.data-table th {
    text-align: left; padding: 8px 12px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.03em;
    color: var(--m3-on-surface-variant); border-bottom: 1px solid var(--color-border);
    background: transparent; white-space: nowrap;
  }
  table.data-table td {
    padding: 8px 12px; border-bottom: 1px solid var(--m3-surface-container-high);
    vertical-align: middle; color: var(--m3-on-surface-variant);
  }
  table.data-table tbody tr { transition: background .15s; }
  table.data-table tbody tr:hover { background: var(--m3-surface-container); cursor: pointer; }

  /* ── M3 Dialogs ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.32);
    display: flex; align-items: flex-start; justify-content: center;
    z-index: 100; overflow-y: auto; padding: 32px 16px;
  }
  .modal {
    background: var(--m3-surface-container-high); border-radius: var(--radius-lg);
    width: 100%; max-width: 720px;
    box-shadow: var(--elevation-3); animation: modal-rise .25s ease-out;
  }
  .modal-header {
    padding: 16px 20px 12px; display: flex; align-items: center; justify-content: space-between;
  }
  .modal-header h3, .modal-header h2 { font-family: var(--font-heading); font-size: 20px; font-weight: 700; margin: 0; }
  .modal-body { padding: 0 20px 20px; max-height: 72vh; overflow-y: auto; }
  @keyframes modal-rise { from { opacity: 0; transform: translateY(16px) scale(.96); } }

  /* ── M3 KPI cards ── */
  .kpi-card {
    background: var(--color-card); border: 1px solid var(--color-border);
    border-radius: var(--radius-sm); padding: 14px;
    transition: all .2s;
  }
  .kpi-card.clickable { cursor: pointer; }
  .kpi-card.clickable:hover {
    box-shadow: var(--shadow-elevated); border-color: var(--m3-primary-container);
    transform: translateY(-2px);
  }

  /* ── Section headings ── */
  .section-title {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--m3-on-surface-variant);
    margin: 0 0 8px; font-family: var(--font-body);
  }

  /* ── M3 Tabs (pill-shaped) ── */
  .tab {
    padding: 6px 16px; border-radius: 16px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    color: var(--m3-on-surface-variant); transition: all .2s;
    border: none; background: transparent;
  }
  .tab:hover { background: var(--m3-surface-container); }
  .tab.active { background: var(--m3-secondary-container); color: var(--m3-on-secondary-container); }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: var(--m3-outline-variant); border-radius: 99px; }
  ::-webkit-scrollbar-track { background: transparent; }

  /* ── Marquee ── */
  .marquee { overflow: hidden; white-space: nowrap; }
  .marquee__track { display: inline-flex; white-space: nowrap; will-change: transform; animation: crm-marquee linear infinite; }
  .marquee:hover .marquee__track { animation-play-state: paused; }
  @keyframes crm-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @media (prefers-reduced-motion: reduce) { .marquee__track { animation: none; } }

  /* ── Funnel ── */
  .funnel-band { transition: filter .15s ease, transform .15s ease; }
  .funnel-band:hover { filter: brightness(1.06) saturate(1.08); transform: translateY(-1px); }

  /* ── M3 utility classes ── */
  .m3-surface { background: var(--m3-surface-container); }
  .m3-surface-low { background: var(--m3-surface-container-low); }
  .m3-surface-high { background: var(--m3-surface-container-high); }
  .m3-label-large { font-size: 14px; font-weight: 500; letter-spacing: 0.01em; }
  .m3-label-medium { font-size: 12px; font-weight: 500; letter-spacing: 0.05em; }
  .m3-label-small { font-size: 11px; font-weight: 500; letter-spacing: 0.05em; }
  .m3-title-large { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .m3-title-medium { font-size: 16px; font-weight: 600; letter-spacing: 0.01em; }
  .m3-body-large { font-size: 16px; font-weight: 400; letter-spacing: 0.03em; }
  .m3-body-medium { font-size: 14px; font-weight: 400; letter-spacing: 0.025em; }
  .m3-body-small { font-size: 12px; font-weight: 400; letter-spacing: 0.04em; }
`;
