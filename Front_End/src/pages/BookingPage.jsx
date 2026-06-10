import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import DateRangePicker from '../components/DateRangePicker';
import { getRoomById, createBooking, getRoomBookedDates } from '../api/bookings';
import { getHotelById } from '../api/hotels';
import { validateDiscount } from '../api/discounts';
import { createPayment, getPaymentById } from '../api/payments';

/* ─── constants (unchanged) ─────────────────────────────────── */
const TYPE_LABEL = { STANDARD:'Standard', DELUXE:'Deluxe', SUITE:'Suite', FAMILY:'Family' };

function nights(a, b) {
  if (!a || !b) return 0;
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));
}
function fmt(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN',
    { day:'2-digit', month:'2-digit', year:'numeric' });
}

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `

  :root {
    --c-bg:      #F7F6F4;
    --c-surface: #FFFFFF;
    --c-card:    #FFFFFF;
    --c-border:  rgba(0,0,0,0.08);
    --c-border2: rgba(0,0,0,0.13);
    --c-gold:    #C9A84C;
    --c-gold-d:  #8A6E30;
    --c-text:    #1C1B18;
    --c-muted:   #6B6860;
    --c-subtle:  #A09D96;
    --r:         14px;
    --t:         all 0.22s cubic-bezier(0.4,0,0.2,1);
    --font-d:    'Cormorant Garamond', Georgia, serif;
    --font-b:    'Outfit', system-ui, sans-serif;
  }

  .bk-root {
    background: var(--c-bg); color: var(--c-text);
    font-family: var(--font-b); font-size: 14px;
    line-height: 1.6; min-height: 100vh;
  }

  /* layout */
  .bk-wrap { max-width: 1080px; margin: 0 auto; padding: 28px 28px 72px; }
  .bk-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }

  /* breadcrumb */
  .bk-bread { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--c-subtle); margin-bottom:20px; }
  .bk-bread a { color:var(--c-muted); text-decoration:none; transition:var(--t); }
  .bk-bread a:hover { color:var(--c-gold); }

  /* page title */
  .bk-title { font-family:var(--font-b); font-size:clamp(26px,3vw,34px); font-weight:600; color:var(--c-text); letter-spacing:-0.01em; margin-bottom:24px; }

  /* section panels */
  .bk-panel { background:var(--c-card); border:1px solid var(--c-border); border-radius:var(--r); padding:22px; margin-bottom:12px; }
  .bk-panel:last-child { margin-bottom:0; }

  /* step label */
  .bk-step { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
  .bk-step-num {
    width:26px; height:26px; border-radius:50%; flex-shrink:0;
    background:var(--c-gold); color:#0A0A0B;
    font-size:12px; font-weight:700; font-family:var(--font-b);
    display:flex; align-items:center; justify-content:center;
  }
  .bk-step-label { font-size:14px; font-weight:600; color:var(--c-text); }
  .bk-step-opt { font-size:12px; color:var(--c-subtle); font-weight:400; margin-left:4px; }

  /* user info cells */
  .bk-info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .bk-info-label { font-size:10px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:var(--c-gold); margin-bottom:5px; }
  .bk-info-val { background:rgba(255,255,255,0.04); border:1px solid var(--c-border); border-radius:10px; padding:10px 14px; font-size:13px; color:var(--c-text); font-weight:500; }

  /* date display chips */
  .bk-dates { display:flex; gap:10px; margin-bottom:16px; }
  .bk-date-chip { flex:1; background:rgba(201,168,76,0.07); border:1px solid rgba(201,168,76,0.2); border-radius:10px; padding:10px 14px; }
  .bk-date-chip-label { font-size:10px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:var(--c-gold); margin-bottom:3px; }
  .bk-date-chip-val { font-size:13px; font-weight:600; color:var(--c-text); }
  .bk-nights-badge { display:flex; align-items:center; justify-content:center; padding:0 16px; background:var(--c-gold); color:#0A0A0B; border-radius:10px; font-size:13px; font-weight:700; white-space:nowrap; }

  /* guest counter */
  .bk-counter { display:flex; align-items:center; gap:16px; }
  .bk-counter-btn {
    width:38px; height:38px; border-radius:50%; border:1px solid var(--c-border2);
    background:rgba(255,255,255,0.04); color:var(--c-text);
    font-size:20px; font-weight:300; display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:var(--t); line-height:1; font-family:var(--font-b);
  }
  .bk-counter-btn:hover { border-color:var(--c-gold-d); background:rgba(201,168,76,0.08); color:var(--c-gold); }
  .bk-counter-val { font-family:var(--font-b); font-size:28px; font-weight:600; color:var(--c-text); width:40px; text-align:center; line-height:1; }
  .bk-counter-max { font-size:12px; color:var(--c-subtle); }

  /* textarea */
  .bk-textarea {
    width:100%; background:rgba(255,255,255,0.04); border:1px solid var(--c-border);
    border-radius:10px; padding:12px 14px; font-size:13px; color:var(--c-text);
    font-family:var(--font-b); resize:none; outline:none; transition:var(--t);
  }
  .bk-textarea::placeholder { color:var(--c-subtle); }
  .bk-textarea:focus { border-color:var(--c-gold-d); background:rgba(201,168,76,0.04); }

  /* discount input */
  .bk-discount-row { display:flex; gap:8px; }
  .bk-discount-input {
    flex:1; background:rgba(255,255,255,0.04); border:1px solid var(--c-border);
    border-radius:10px; padding:12px 14px; font-size:13px; color:var(--c-text);
    font-family:'Courier New', monospace; letter-spacing:0.12em; text-transform:uppercase;
    outline:none; transition:var(--t);
  }
  .bk-discount-input::placeholder { font-family:var(--font-b); letter-spacing:normal; text-transform:none; color:var(--c-subtle); }
  .bk-discount-input:focus { border-color:var(--c-gold-d); background:rgba(201,168,76,0.04); }
  .bk-discount-input:disabled { opacity:0.4; cursor:not-allowed; }
  .bk-discount-btn {
    padding:12px 20px; background:var(--c-gold); color:#0A0A0B;
    font-size:13px; font-weight:700; border:none; border-radius:10px;
    cursor:pointer; transition:var(--t); white-space:nowrap; font-family:var(--font-b);
  }
  .bk-discount-btn:hover:not(:disabled) { background:#e0bc5e; }
  .bk-discount-btn:disabled { background:rgba(255,255,255,0.08); color:var(--c-subtle); cursor:not-allowed; }
  .bk-discount-ok { display:flex; align-items:center; gap:8px; margin-top:10px; padding:10px 14px; background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.2); border-radius:10px; }
  .bk-discount-ok-text { font-size:13px; color:#4ade80; font-weight:500; flex:1; }
  .bk-discount-badge { background:#4ade80; color:#0A0A0B; font-size:11px; font-weight:700; padding:2px 10px; border-radius:20px; font-family:var(--font-b); }
  .bk-discount-err { margin-top:8px; font-size:12px; color:#f87171; display:flex; align-items:center; gap:6px; }

  /* payment method cards */
  .bk-pm-cards { display:flex; flex-direction:column; gap:8px; }
  .bk-pm-card { display:flex; align-items:flex-start; gap:14px; padding:16px 18px; border:2px solid var(--c-border); border-radius:12px; cursor:pointer; transition:var(--t); background:var(--c-card); }
  .bk-pm-card:hover:not(.bk-pm-sel) { border-color:rgba(201,168,76,0.35); }
  .bk-pm-card.bk-pm-sel { border-color:var(--c-gold); background:rgba(201,168,76,0.05); box-shadow:0 0 0 1px var(--c-gold); }
  .bk-pm-radio { width:20px; height:20px; border-radius:50%; border:2px solid var(--c-border2); flex-shrink:0; margin-top:2px; display:flex; align-items:center; justify-content:center; transition:var(--t); }
  .bk-pm-card.bk-pm-sel .bk-pm-radio { border-color:var(--c-gold); background:var(--c-gold); }
  .bk-pm-radio-dot { width:7px; height:7px; border-radius:50%; background:#0A0A0B; }
  .bk-pm-body { flex:1; min-width:0; }
  .bk-pm-top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:3px; }
  .bk-pm-name { font-size:14px; font-weight:600; color:var(--c-text); }
  .bk-pm-badge { font-size:10px; font-weight:700; letter-spacing:0.04em; padding:2px 9px; border-radius:20px; white-space:nowrap; flex-shrink:0; }
  .bk-pm-badge-amber { background:rgba(201,168,76,0.15); color:var(--c-gold-d); border:1px solid rgba(201,168,76,0.3); }
  .bk-pm-badge-green { background:rgba(16,185,129,0.12); color:#059669; border:1px solid rgba(16,185,129,0.3); }
  .bk-pm-desc { font-size:12px; color:var(--c-muted); line-height:1.5; }
  .bk-pm-logos { display:flex; align-items:center; gap:6px; margin-top:8px; }
  .bk-pm-logo { font-size:11px; font-weight:800; padding:3px 10px; border-radius:6px; color:#fff; letter-spacing:0.3px; }
  .bk-pm-logo-vnp  { background:linear-gradient(135deg,#0057A8,#009FE3); }
  .bk-pm-logo-momo { background:#AE2070; }
  .bk-pm-infobox { margin-top:10px; padding:10px 14px; border-radius:9px; font-size:12px; line-height:1.65; }
  .bk-pm-infobox-amber { background:rgba(201,168,76,0.09); border:1px solid rgba(201,168,76,0.28); color:#78400A; }
  .bk-pm-infobox-blue  { background:#EFF6FF; border:1px solid #BFDBFE; color:#1D4ED8; }

  /* submit dark variant (CASH) */
  .bk-submit-dark { width:100%; padding:16px; font-size:14px; font-weight:700; background:#1C1B18; color:#fff; border:none; border-radius:12px; cursor:pointer; font-family:var(--font-b); transition:var(--t); display:flex; align-items:center; justify-content:center; gap:8px; }
  .bk-submit-dark:hover:not(:disabled) { background:#333; }
  .bk-submit-dark:disabled { opacity:0.4; cursor:not-allowed; }

  /* success confirmed badge */
  .bk-success-status-confirmed { display:inline-flex; align-items:center; gap:6px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); color:#059669; font-size:11px; font-weight:600; padding:3px 12px; border-radius:20px; }
  .bk-success-dot-green { width:5px; height:5px; border-radius:50%; background:#10B981; }
  .bk-success-note { font-size:12px; color:var(--c-muted); padding:12px 28px; border-top:1px solid var(--c-border); line-height:1.6; }

  /* ── RIGHT COLUMN ── */
  .bk-summary { position:sticky; top:24px; display:flex; flex-direction:column; gap:12px; }

  .bk-room-card { background:var(--c-card); border:1px solid var(--c-border); border-radius:var(--r); overflow:hidden; }
  .bk-room-img { height:160px; background:#1a1a1e; overflow:hidden; }
  .bk-room-img img { width:100%; height:100%; object-fit:cover; }
  .bk-room-img-empty { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-family:var(--font-b); font-size:40px; color:rgba(255,255,255,0.06); }
  .bk-room-info { padding:16px; }
  .bk-room-hotel { font-size:11px; color:var(--c-muted); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }
  .bk-room-name { font-size:14px; font-weight:600; color:var(--c-text); margin-bottom:2px; }
  .bk-room-addr { font-size:11px; color:var(--c-subtle); }
  .bk-room-meta { display:flex; align-items:center; gap:10px; margin-top:10px; }
  .bk-room-cap { font-size:11px; color:var(--c-muted); background:rgba(255,255,255,0.05); border:1px solid var(--c-border); padding:3px 10px; border-radius:20px; }
  .bk-room-price { font-family:var(--font-b); font-size:18px; font-weight:600; color:var(--c-gold); }
  .bk-room-price span { font-size:11px; color:var(--c-muted); font-family:var(--font-b); font-weight:300; }
  .bk-room-dates { display:grid; grid-template-columns:1fr 1fr; border-top:1px solid var(--c-border); }
  .bk-room-date-cell { padding:12px 16px; }
  .bk-room-date-cell:first-child { border-right:1px solid var(--c-border); }
  .bk-room-date-label { font-size:10px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:var(--c-gold); margin-bottom:3px; }
  .bk-room-date-val { font-size:13px; font-weight:600; color:var(--c-text); }

  /* price breakdown */
  .bk-breakdown { background:var(--c-card); border:1px solid var(--c-border); border-radius:var(--r); padding:20px; }
  .bk-breakdown-title { font-size:13px; font-weight:600; color:var(--c-text); margin-bottom:14px; }
  .bk-breakdown-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--c-muted); margin-bottom:10px; }
  .bk-breakdown-discount { color:#4ade80; font-weight:500; }
  .bk-breakdown-total { display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--c-border); }
  .bk-breakdown-total-label { font-size:14px; font-weight:600; color:var(--c-text); }
  .bk-breakdown-total-val { font-family:var(--font-b); font-size:24px; font-weight:600; color:var(--c-gold); }
  .bk-trust { display:flex; flex-direction:column; gap:7px; margin-top:14px; padding-top:14px; border-top:1px solid var(--c-border); }
  .bk-trust-item { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--c-muted); }
  .bk-trust-dot { width:5px; height:5px; border-radius:50%; background:var(--c-gold); flex-shrink:0; }

  /* error alert */
  .bk-error { display:flex; align-items:center; gap:10px; padding:12px 16px; background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.2); border-radius:12px; font-size:13px; color:#f87171; }

  /* submit btn */
  .bk-submit {
    width:100%; padding:16px; font-size:14px; font-weight:700;
    background:var(--c-gold); color:#0A0A0B; border:none;
    border-radius:12px; cursor:pointer; font-family:var(--font-b);
    transition:var(--t); display:flex; align-items:center; justify-content:center; gap:8px;
  }
  .bk-submit:hover:not(:disabled) { background:#e0bc5e; box-shadow:0 6px 24px rgba(201,168,76,0.35); transform:translateY(-1px); }
  .bk-submit:disabled { opacity:0.4; cursor:not-allowed; transform:none; box-shadow:none; }
  .bk-back {
    width:100%; padding:13px; font-size:13px; font-weight:500;
    background:rgba(255,255,255,0.04); border:1px solid var(--c-border);
    color:var(--c-muted); border-radius:12px; cursor:pointer;
    font-family:var(--font-b); transition:var(--t); margin-top:8px;
  }
  .bk-back:hover { border-color:var(--c-border2); color:var(--c-text); }

  /* success */
  .bk-success-wrap { max-width:520px; margin:0 auto; padding:48px 20px; }
  .bk-success-card { background:var(--c-card); border:1px solid var(--c-border); border-radius:var(--r); overflow:hidden; }
  .bk-success-header { background:linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.04)); padding:36px 32px; text-align:center; border-bottom:1px solid var(--c-border); }
  .bk-success-check { width:60px; height:60px; border-radius:50%; background:rgba(74,222,128,0.12); border:1px solid rgba(74,222,128,0.25); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; }
  .bk-success-title { font-family:var(--font-b); font-size:28px; font-weight:600; color:var(--c-text); margin-bottom:6px; }
  .bk-success-id { font-size:12px; color:var(--c-muted); }
  .bk-success-id code { font-family:'Courier New',monospace; color:var(--c-gold); background:rgba(201,168,76,0.1); padding:2px 8px; border-radius:5px; }
  .bk-success-body { padding:24px 28px; }
  .bk-success-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--c-border); font-size:13px; }
  .bk-success-row:last-child { border-bottom:none; }
  .bk-success-row-label { color:var(--c-muted); }
  .bk-success-row-val { font-weight:600; color:var(--c-text); }
  .bk-success-row-disc { color:#4ade80; }
  .bk-success-status { display:inline-flex; align-items:center; gap:6px; background:rgba(201,168,76,0.12); border:1px solid rgba(201,168,76,0.25); color:var(--c-gold); font-size:11px; font-weight:600; padding:3px 12px; border-radius:20px; }
  .bk-success-dot { width:5px; height:5px; border-radius:50%; background:var(--c-gold); }
  .bk-success-actions { display:flex; gap:10px; padding:20px 28px; border-top:1px solid var(--c-border); }
  .bk-success-btn-primary { flex:1; padding:12px; background:var(--c-gold); color:#0A0A0B; font-size:13px; font-weight:700; border:none; border-radius:10px; cursor:pointer; transition:var(--t); text-decoration:none; display:flex; align-items:center; justify-content:center; font-family:var(--font-b); }
  .bk-success-btn-primary:hover { background:#e0bc5e; }
  .bk-success-btn-secondary { flex:1; padding:12px; background:rgba(255,255,255,0.04); border:1px solid var(--c-border); color:var(--c-muted); font-size:13px; font-weight:500; border-radius:10px; cursor:pointer; transition:var(--t); text-decoration:none; display:flex; align-items:center; justify-content:center; font-family:var(--font-b); }
  .bk-success-btn-secondary:hover { color:var(--c-text); border-color:var(--c-border2); }

  /* QR payment modal */
  .bk-qr-overlay { position:fixed; inset:0; z-index:60; background:rgba(0,0,0,0.55); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:16px; }
  .bk-qr-modal { background:var(--c-card); border:1px solid var(--c-border); border-radius:20px; width:100%; max-width:380px; overflow:hidden; box-shadow:0 32px 80px rgba(0,0,0,0.25); }
  .bk-qr-modal-header { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 22px 16px; border-bottom:1px solid var(--c-border); }
  .bk-qr-modal-title { font-size:16px; font-weight:700; color:var(--c-text); }
  .bk-qr-modal-sub { font-size:12px; color:var(--c-muted); margin-top:3px; }
  .bk-qr-close { background:none; border:none; cursor:pointer; font-size:16px; color:var(--c-subtle); padding:4px 6px; border-radius:6px; transition:var(--t); }
  .bk-qr-close:hover { color:var(--c-text); background:rgba(0,0,0,0.05); }
  .bk-qr-modal-body { padding:20px 22px 24px; display:flex; flex-direction:column; align-items:center; gap:14px; }
  .bk-qr-amount { font-family:var(--font-b); font-size:28px; font-weight:700; color:var(--c-gold); letter-spacing:-0.02em; }
  .bk-qr-box { width:220px; height:220px; background:#fff; border:1px solid var(--c-border); border-radius:16px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
  .bk-qr-expired { display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; }
  .bk-qr-expired-btn { padding:8px 18px; background:var(--c-gold); color:#0A0A0B; border:none; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; transition:var(--t); font-family:var(--font-b); }
  .bk-qr-expired-btn:hover { background:#e0bc5e; }
  .bk-qr-timer-row { display:flex; align-items:center; justify-content:space-between; width:100%; }
  .bk-qr-timer { font-size:13px; font-weight:600; font-family:'Courier New',monospace; }
  .bk-qr-status-dot { display:inline-flex; align-items:center; gap:6px; font-size:11px; color:var(--c-muted); }
  .bk-qr-pulse { width:8px; height:8px; border-radius:50%; background:#10B981; flex-shrink:0; animation:qrPulse 1.5s infinite; }
  @keyframes qrPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
  .bk-qr-logos { display:flex; align-items:center; gap:8px; }
  .bk-qr-fallback { font-size:12px; color:var(--c-gold); text-decoration:none; transition:var(--t); }
  .bk-qr-fallback:hover { text-decoration:underline; }

  /* skeleton */
  .sk { background:linear-gradient(90deg,#1e1e22 25%,#252529 50%,#1e1e22 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:12px; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* spin */
  @keyframes spin { to{transform:rotate(360deg)} }
  .spin { animation:spin 0.8s linear infinite; }

  @media(max-width:800px) {
    .bk-grid { grid-template-columns:1fr; }
    .bk-info-grid { grid-template-columns:1fr; }
    .bk-summary { position:static; }
  }
  @media(max-width:500px) {
    .bk-wrap { padding:16px 16px 48px; }
    .bk-dates { flex-direction:column; }
  }
`;


/* ─── VNPay QR modal ─────────────────────────────────────────── */
function VNPayQRModal({ data, onClose, onPaid }) {
  const [secondsLeft, setSecondsLeft] = useState(900);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  useEffect(() => {
    if (!data.paymentId) return;
    const iv = setInterval(async () => {
      try {
        const res = await getPaymentById(data.paymentId);
        if (res.data?.data?.status === 'PAID') {
          clearInterval(iv);
          onPaidRef.current();
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(iv);
  }, [data.paymentId]);

  const expired = secondsLeft <= 0;
  const fmtTime = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const timerColor = secondsLeft < 60 ? '#DC2626' : secondsLeft < 180 ? '#D97706' : 'var(--c-muted)';
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data.paymentUrl)}`;

  return (
    <div className="bk-qr-overlay" onClick={onClose}>
      <div className="bk-qr-modal" onClick={e => e.stopPropagation()}>

        <div className="bk-qr-modal-header">
          <div>
            <div className="bk-qr-modal-title">Quét mã QR để thanh toán</div>
            <div className="bk-qr-modal-sub">Sử dụng app ngân hàng hoặc ví điện tử</div>
          </div>
          <button className="bk-qr-close" onClick={onClose} type="button">✕</button>
        </div>

        <div className="bk-qr-modal-body">
          <div className="bk-qr-amount">
            {data.amount != null ? data.amount.toLocaleString('vi-VN') + ' ₫' : '—'}
          </div>

          <div className="bk-qr-box">
            {expired ? (
              <div className="bk-qr-expired">
                <span style={{fontSize:'28px'}}>⏱</span>
                <div style={{fontSize:'12px',color:'var(--c-muted)'}}>Mã QR đã hết hạn</div>
                <button className="bk-qr-expired-btn" onClick={onClose} type="button">Tạo lại</button>
              </div>
            ) : (
              <img
                src={qrSrc}
                alt="QR thanh toán VNPay"
                style={{width:'100%',height:'100%',objectFit:'contain',padding:'8px'}}
              />
            )}
          </div>

          {!expired && (
            <div className="bk-qr-timer-row">
              <span className="bk-qr-timer" style={{color: timerColor}}>⏱ {fmtTime(secondsLeft)}</span>
              <span className="bk-qr-status-dot">
                <span className="bk-qr-pulse" />
                Đang chờ thanh toán
              </span>
            </div>
          )}

          <div className="bk-qr-logos">
            <span className="bk-pm-logo bk-pm-logo-vnp" style={{fontSize:'11px',padding:'3px 10px'}}>VNPay</span>
            <span style={{fontSize:'11px',color:'var(--c-subtle)'}}>·</span>
            <span className="bk-pm-logo bk-pm-logo-momo" style={{fontSize:'11px',padding:'3px 10px'}}>MoMo</span>
            <span style={{fontSize:'11px',color:'var(--c-subtle)'}}>·</span>
            <span style={{fontSize:'11px',color:'var(--c-muted)'}}>ATM · Thẻ tín dụng</span>
          </div>

          <a href={data.paymentUrl} target="_blank" rel="noreferrer" className="bk-qr-fallback">
            Không quét được? Mở trang VNPay →
          </a>
        </div>

      </div>
    </div>
  );
}

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const roomId         = searchParams.get('roomId') ?? '';

  const [checkIn,          setCheckIn]          = useState(searchParams.get('checkIn')  ?? '');
  const [checkOut,         setCheckOut]         = useState(searchParams.get('checkOut') ?? '');
  const [guestCount,       setGuestCount]       = useState(1);
  const [specialRequests,  setSpecialRequests]  = useState('');
  const [discountCode,     setDiscountCode]     = useState('');
  const [discountResult,   setDiscountResult]   = useState(null);
  const [discountError,    setDiscountError]    = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [room,             setRoom]             = useState(null);
  const [hotel,            setHotel]            = useState(null);
  const [bookedRanges,     setBookedRanges]     = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [submitting,       setSubmitting]       = useState(false);
  const [error,            setError]            = useState('');
  const [done,             setDone]             = useState(null);
  const [paymentMethod,    setPaymentMethod]    = useState('CASH');
  const [vnpayModal,       setVnpayModal]       = useState(null);
  useEffect(() => {
    if (!roomId) { setLoading(false); return; }
    (async () => {
      try {
        const [roomRes, datesRes] = await Promise.all([getRoomById(roomId), getRoomBookedDates(roomId)]);
        const r = roomRes.data.data;
        setRoom(r);
        setBookedRanges(datesRes.data.data ?? []);
        const hotelRes = await getHotelById(r.hotelId);
        setHotel(hotelRes.data.data);
      } catch { setError('Không tìm thấy thông tin phòng.'); }
      finally  { setLoading(false); }
    })();
  }, [roomId]);

  const totalNights    = nights(checkIn, checkOut);
  const originalPrice  = room ? totalNights * room.pricePerNight : 0;
  const discountAmount = discountResult?.discountAmount ?? 0;
  const finalPrice     = originalPrice - discountAmount;

  const handleDateChange = (from, to) => {
    setCheckIn(from ?? ''); setCheckOut(to ?? '');
    setError(''); setDiscountResult(null); setDiscountError('');
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim() || !room) return;
    setApplyingDiscount(true); setDiscountError(''); setDiscountResult(null);
    try {
      const res = await validateDiscount({ code: discountCode, hotelId: hotel?.id, orderAmount: originalPrice });
      setDiscountResult(res.data.data);
    } catch (err) {
      setDiscountError(err.response?.data?.message ?? 'Mã giảm giá không hợp lệ.');
    } finally { setApplyingDiscount(false); }
  };

  const handleSubmit = async () => {
    if (!checkIn || !checkOut) { setError('Vui lòng chọn ngày nhận và trả phòng.'); return; }
    if (totalNights <= 0)      { setError('Ngày trả phòng phải sau ngày nhận phòng.'); return; }
    setError(''); setSubmitting(true);
    try {
      const res = await createBooking({ roomId, checkIn, checkOut, guestCount, specialRequests: specialRequests || null, discountCode: discountResult ? discountCode : null, paymentMethod });
      const booking = res.data.data;
      if (paymentMethod === 'VNPAY') {
        const payRes = await createPayment({ bookingId: booking.id, method: 'VNPAY' });
        const payment = payRes.data?.data;
        if (payment?.paymentUrl) {
          setVnpayModal({ paymentUrl: payment.paymentUrl, paymentId: payment.paymentId, bookingId: booking.id, amount: booking.totalPrice });
          return;
        }
      }
      setDone(booking);
    } catch (err) { setError(err.response?.data?.message ?? 'Đặt phòng thất bại. Vui lòng thử lại.'); }
    finally       { setSubmitting(false); }
  };

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();

  /* ══ Success ══ */
  if (done) {
    const hasDisc = (done.discountAmount ?? 0) > 0;
    return (
      <>
        <style>{CSS}</style>
        <div className="bk-root">
          <Navbar />
          <div className="bk-success-wrap">
            <div className="bk-success-card">
              <div className="bk-success-header">
                <div className="bk-success-check">
                  <svg width="28" height="28" fill="none" stroke="#4ade80" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>
                <div className="bk-success-title">Đặt phòng thành công</div>
                <div className="bk-success-id">Mã đặt phòng: <code>{done.id}</code></div>
              </div>

              <div className="bk-success-body">
                {[
                  ['Khách sạn',  done.hotelName],
                  ['Phòng',      `${done.roomNumber} (${TYPE_LABEL[done.roomType] ?? done.roomType})`],
                  ['Nhận phòng', fmt(done.checkIn)],
                  ['Trả phòng',  fmt(done.checkOut)],
                  ...(hasDisc ? [
                    ['Giá gốc',  `${(done.originalPrice ?? originalPrice).toLocaleString('vi-VN')} ₫`, false],
                    ['Giảm giá', `−${done.discountAmount.toLocaleString('vi-VN')} ₫`, true],
                  ] : []),
                  ['Tổng tiền',  `${(done.totalPrice ?? finalPrice).toLocaleString('vi-VN')} ₫`, false],
                ].map(([label, val, isDisc]) => (
                  <div key={label} className="bk-success-row">
                    <span className="bk-success-row-label">{label}</span>
                    <span className={`bk-success-row-val ${isDisc ? 'bk-success-row-disc' : ''}`}>{val}</span>
                  </div>
                ))}
                <div className="bk-success-row">
                  <span className="bk-success-row-label">Trạng thái</span>
                  {done.status === 'CONFIRMED'
                    ? <span className="bk-success-status-confirmed"><span className="bk-success-dot-green"/>Đã xác nhận — Sẵn sàng nhận phòng</span>
                    : <span className="bk-success-status"><span className="bk-success-dot"/>Chờ khách sạn xác nhận</span>
                  }
                </div>
              </div>

              <div className="bk-success-note">
                {done.status === 'CONFIRMED'
                  ? '✅ Thanh toán đã xác nhận. Email xác nhận đã được gửi đến hộp thư của bạn.'
                  : '⏳ Khách sạn sẽ xác nhận trong vòng 24 giờ. Bạn sẽ nhận được thông báo qua email.'
                }
              </div>

              <div className="bk-success-actions">
                <Link to="/my-bookings" className="bk-success-btn-primary">Xem lịch sử</Link>
                <Link to="/" className="bk-success-btn-secondary">Về trang chủ</Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ══ Main ══ */
  return (
    <>
      <style>{CSS}</style>
      <div className="bk-root">
        <Navbar />
        <div className="bk-wrap">

          {/* Breadcrumb */}
          <nav className="bk-bread">
            <Link to="/">Trang chủ</Link>
            <span>›</span>
            {hotel && (
              <>
                <Link to={`/hotels/${hotel.id}`}
                  style={{maxWidth:'160px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {hotel.name}
                </Link>
                <span>›</span>
              </>
            )}
            <span style={{color:'var(--c-muted)'}}>Đặt phòng</span>
          </nav>

          <div className="bk-title">Xác nhận đặt phòng</div>

          {/* Loading */}
          {loading && (
            <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
              <div className="sk" style={{height:'120px'}} />
              <div className="sk" style={{height:'200px'}} />
              <div className="sk" style={{height:'120px'}} />
            </div>
          )}

          {/* Error no-room */}
          {!loading && error && !room && (
            <div className="bk-error">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {error}
            </div>
          )}

          {/* Content */}
          {!loading && room && (
            <div className="bk-grid">

              {/* ── LEFT: Form ── */}
              <div>

                {/* 1. Thông tin khách */}
                {currentUser && (
                  <div className="bk-panel">
                    <div className="bk-step">
                      <span className="bk-step-num">1</span>
                      <span className="bk-step-label">Thông tin khách hàng</span>
                    </div>
                    <div className="bk-info-grid">
                      <div>
                        <div className="bk-info-label">Họ và tên</div>
                        <div className="bk-info-val">{currentUser.fullName}</div>
                      </div>
                      <div>
                        <div className="bk-info-label">Email</div>
                        <div className="bk-info-val">{currentUser.email ?? '—'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Ngày lưu trú */}
                <div className="bk-panel">
                  <div className="bk-step">
                    <span className="bk-step-num">2</span>
                    <span className="bk-step-label">Chọn ngày lưu trú</span>
                  </div>
                  {(checkIn || checkOut) && (
                    <div className="bk-dates">
                      <div className="bk-date-chip">
                        <div className="bk-date-chip-label">Nhận phòng</div>
                        <div className="bk-date-chip-val">{checkIn ? fmt(checkIn) : '—'}</div>
                      </div>
                      <div className="bk-date-chip">
                        <div className="bk-date-chip-label">Trả phòng</div>
                        <div className="bk-date-chip-val">{checkOut ? fmt(checkOut) : '—'}</div>
                      </div>
                      {totalNights > 0 && (
                        <div className="bk-nights-badge">{totalNights} đêm</div>
                      )}
                    </div>
                  )}
                  <DateRangePicker bookedRanges={bookedRanges} from={checkIn} to={checkOut} onChange={handleDateChange} />
                </div>

                {/* 3. Số khách */}
                <div className="bk-panel">
                  <div className="bk-step">
                    <span className="bk-step-num">3</span>
                    <span className="bk-step-label">Số khách</span>
                  </div>
                  <div className="bk-counter">
                    <button type="button" className="bk-counter-btn"
                      onClick={() => setGuestCount(g => Math.max(1, g - 1))}>−</button>
                    <span className="bk-counter-val">{guestCount}</span>
                    <button type="button" className="bk-counter-btn"
                      onClick={() => setGuestCount(g => Math.min(room?.capacity ?? 10, g + 1))}>+</button>
                    {room?.capacity && (
                      <span className="bk-counter-max">tối đa {room.capacity} khách</span>
                    )}
                  </div>
                </div>

                {/* 4. Yêu cầu đặc biệt */}
                <div className="bk-panel">
                  <div className="bk-step">
                    <span className="bk-step-num">4</span>
                    <span className="bk-step-label">
                      Yêu cầu đặc biệt
                      <span className="bk-step-opt"> (không bắt buộc)</span>
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={specialRequests}
                    onChange={e => setSpecialRequests(e.target.value)}
                    placeholder="Ví dụ: phòng tầng cao, crib cho trẻ em, đến muộn..."
                    className="bk-textarea"
                  />
                </div>

                {/* 5. Mã giảm giá */}
                <div className="bk-panel">
                  <div className="bk-step">
                    <span className="bk-step-num">5</span>
                    <span className="bk-step-label">
                      Mã giảm giá
                      <span className="bk-step-opt"> (không bắt buộc)</span>
                    </span>
                  </div>
                  <div className="bk-discount-row">
                    <input
                      type="text"
                      className="bk-discount-input"
                      value={discountCode}
                      onChange={e => {
                        setDiscountCode(e.target.value.toUpperCase());
                        setDiscountResult(null); setDiscountError('');
                      }}
                      onKeyDown={e => e.key === 'Enter' && handleApplyDiscount()}
                      placeholder="VD: SUMMER20"
                      disabled={!totalNights || !room}
                    />
                    <button
                      type="button"
                      className="bk-discount-btn"
                      onClick={handleApplyDiscount}
                      disabled={!discountCode.trim() || applyingDiscount || !totalNights}
                    >
                      {applyingDiscount ? '...' : 'Áp dụng'}
                    </button>
                  </div>
                  {discountResult && (
                    <div className="bk-discount-ok">
                      <svg width="16" height="16" fill="none" stroke="#4ade80" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                      </svg>
                      <span className="bk-discount-ok-text">
                        Giảm <strong>{discountResult.discountAmount.toLocaleString('vi-VN')} ₫</strong>
                      </span>
                      <span className="bk-discount-badge">{discountCode}</span>
                    </div>
                  )}
                  {discountError && (
                    <div className="bk-discount-err">
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                      </svg>
                      {discountError}
                    </div>
                  )}
                </div>

                {/* 6. Phương thức thanh toán */}
                <div className="bk-panel">
                  <div className="bk-step">
                    <span className="bk-step-num">6</span>
                    <span className="bk-step-label">Phương thức thanh toán</span>
                  </div>
                  <div className="bk-pm-cards">

                    {/* CASH */}
                    <div
                      className={`bk-pm-card${paymentMethod === 'CASH' ? ' bk-pm-sel' : ''}`}
                      onClick={() => setPaymentMethod('CASH')}
                    >
                      <div className="bk-pm-radio">
                        {paymentMethod === 'CASH' && <div className="bk-pm-radio-dot" />}
                      </div>
                      <div className="bk-pm-body">
                        <div className="bk-pm-top">
                          <span className="bk-pm-name">Thanh toán tại khách sạn</span>
                          <span className="bk-pm-badge bk-pm-badge-amber">Miễn phí hủy</span>
                        </div>
                        <div className="bk-pm-desc">Trả tiền mặt hoặc chuyển khoản khi nhận phòng</div>
                        {paymentMethod === 'CASH' && (
                          <div className="bk-pm-infobox bk-pm-infobox-amber">
                            ⏳ Booking sẽ ở trạng thái <strong>Chờ xác nhận</strong> — nhân viên khách sạn sẽ xác nhận trong vòng 24 giờ.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* VNPAY */}
                    <div
                      className={`bk-pm-card${paymentMethod === 'VNPAY' ? ' bk-pm-sel' : ''}`}
                      onClick={() => setPaymentMethod('VNPAY')}
                    >
                      <div className="bk-pm-radio">
                        {paymentMethod === 'VNPAY' && <div className="bk-pm-radio-dot" />}
                      </div>
                      <div className="bk-pm-body">
                        <div className="bk-pm-top">
                          <span className="bk-pm-name">Thanh toán online</span>
                          <span className="bk-pm-badge bk-pm-badge-green">Xác nhận ngay</span>
                        </div>
                        <div className="bk-pm-desc">Xác nhận tức thì sau khi thanh toán thành công</div>
                        <div className="bk-pm-logos">
                          <span className="bk-pm-logo bk-pm-logo-vnp">VNPay</span>
                          <span className="bk-pm-logo bk-pm-logo-momo">MoMo</span>
                        </div>
                        {paymentMethod === 'VNPAY' && (
                          <div className="bk-pm-infobox bk-pm-infobox-blue">
                            ✓ Sau khi thanh toán thành công, booking sẽ được <strong>xác nhận tự động</strong> — không cần chờ nhân viên duyệt.
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* ── RIGHT: Summary ── */}
              <div className="bk-summary">

                {/* Room card */}
                <div className="bk-room-card">
                  <div className="bk-room-img">
                    {room?.images?.[0]
                      ? <img src={room.images[0]} alt="" />
                      : <div className="bk-room-img-empty">✦</div>
                    }
                  </div>
                  <div className="bk-room-info">
                    <div className="bk-room-hotel">{hotel?.name}</div>
                    <div className="bk-room-name">
                      Phòng {room?.roomNumber} — {TYPE_LABEL[room?.type] ?? room?.type}
                    </div>
                    <div className="bk-room-addr">{hotel?.address}, {hotel?.city}</div>
                    <div className="bk-room-meta">
                      <span className="bk-room-cap">{room?.capacity} khách</span>
                      <span className="bk-room-price">
                        {room?.pricePerNight?.toLocaleString('vi-VN')}₫
                        <span>/đêm</span>
                      </span>
                    </div>
                  </div>
                  {(checkIn || checkOut) && (
                    <div className="bk-room-dates">
                      <div className="bk-room-date-cell">
                        <div className="bk-room-date-label">Nhận phòng</div>
                        <div className="bk-room-date-val">{checkIn ? fmt(checkIn) : '—'}</div>
                      </div>
                      <div className="bk-room-date-cell">
                        <div className="bk-room-date-label">Trả phòng</div>
                        <div className="bk-room-date-val">{checkOut ? fmt(checkOut) : '—'}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Price breakdown */}
                {totalNights > 0 && room && (
                  <div className="bk-breakdown">
                    <div className="bk-breakdown-title">Tóm tắt chi phí</div>
                    <div className="bk-breakdown-row">
                      <span>{room.pricePerNight?.toLocaleString('vi-VN')}₫ × {totalNights} đêm</span>
                      <span>{originalPrice.toLocaleString('vi-VN')}₫</span>
                    </div>
                    {discountResult && (
                      <div className="bk-breakdown-row bk-breakdown-discount">
                        <span>Mã {discountCode}</span>
                        <span>−{discountAmount.toLocaleString('vi-VN')}₫</span>
                      </div>
                    )}
                    <div className="bk-breakdown-total">
                      <span className="bk-breakdown-total-label">Tổng cộng</span>
                      <span className="bk-breakdown-total-val">{finalPrice.toLocaleString('vi-VN')}₫</span>
                    </div>
                    <div className="bk-trust">
                      {['Hủy miễn phí trước 24h nhận phòng','Thanh toán an toàn – bảo mật tuyệt đối','Xác nhận ngay lập tức'].map(t => (
                        <div key={t} className="bk-trust-item">
                          <span className="bk-trust-dot" />
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="bk-error">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div>
                  <button
                    type="button"
                    className={paymentMethod === 'VNPAY' ? 'bk-submit' : 'bk-submit-dark'}
                    onClick={handleSubmit}
                    disabled={submitting || !checkIn || !checkOut}
                  >
                    {submitting ? (
                      <>
                        <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                          <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        Đang xử lý...
                      </>
                    ) : paymentMethod === 'VNPAY' ? (
                      <>
                        Thanh toán ngay qua VNPay
                        {finalPrice > 0 && <span style={{opacity:0.85}}>— {finalPrice.toLocaleString('vi-VN')} ₫</span>}
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                      </>
                    ) : (
                      <>
                        Xác nhận đặt phòng — Trả sau
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                        </svg>
                      </>
                    )}
                  </button>
                  <button type="button" className="bk-back" onClick={() => navigate(-1)}>
                    ← Quay lại
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>

      {vnpayModal && (
        <VNPayQRModal
          data={vnpayModal}
          onClose={() => setVnpayModal(null)}
          onPaid={() => navigate(`/my-bookings/${vnpayModal.bookingId}`, {
            state: { successToast: 'Thanh toán VNPay thành công! Email xác nhận đã được gửi.' }
          })}
        />
      )}
    </>
  );
}