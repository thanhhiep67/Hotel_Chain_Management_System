import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getMyHotels } from '../api/hotels';
import {
  getHotelBookings, confirmBooking, rejectBooking,
  checkInBooking, checkOutBooking, scanQr,
} from '../api/bookings';
import { useNotifications } from '../context/NotificationContext';

/* ─── constants (unchanged) ─────────────────────────────────── */
const PAGE_SIZE = 10;

const STATUS_META = {
  PENDING:     { label:'Chờ xác nhận', dot:'#F59E0B', bg:'rgba(245,158,11,0.1)',  text:'#D97706', border:'rgba(245,158,11,0.25)' },
  CONFIRMED:   { label:'Đã xác nhận',  dot:'#3B82F6', bg:'rgba(59,130,246,0.08)', text:'#2563EB', border:'rgba(59,130,246,0.2)'  },
  CHECKED_IN:  { label:'Đang lưu trú', dot:'#10B981', bg:'rgba(16,185,129,0.08)', text:'#059669', border:'rgba(16,185,129,0.2)'  },
  CHECKED_OUT: { label:'Đã trả phòng', dot:'#6B7280', bg:'rgba(107,114,128,0.08)',text:'#4B5563', border:'rgba(107,114,128,0.2)' },
  CANCELLED:   { label:'Đã hủy',       dot:'#EF4444', bg:'rgba(239,68,68,0.08)',  text:'#DC2626', border:'rgba(239,68,68,0.2)'   },
  REJECTED:    { label:'Từ chối',      dot:'#EF4444', bg:'rgba(239,68,68,0.08)',  text:'#DC2626', border:'rgba(239,68,68,0.2)'   },
};

const STATUS_FILTERS = [
  { value:'',            label:'Tất cả'       },
  { value:'PENDING',     label:'Chờ xác nhận' },
  { value:'CONFIRMED',   label:'Đã xác nhận'  },
  { value:'CHECKED_IN',  label:'Đang lưu trú' },
  { value:'CHECKED_OUT', label:'Đã trả phòng' },
  { value:'CANCELLED',   label:'Đã hủy'       },
  { value:'REJECTED',    label:'Từ chối'      },
];

const ROOM_TYPE_LABEL = {
  SINGLE:'Single', DOUBLE:'Double', TWIN:'Twin',
  SUITE:'Suite',   DELUXE:'Deluxe', FAMILY:'Family',
};

const fmtDate   = d  => d ? new Date(d+'T00:00:00').toLocaleDateString('vi-VN') : '—';
const fmtPrice  = p  => p != null ? p.toLocaleString('vi-VN')+' ₫' : '—';
const fmtNights = (ci,co) => (!ci||!co) ? 0 : Math.round((new Date(co)-new Date(ci))/86400000);
const todayStr  = ()  => new Date().toISOString().slice(0,10);

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `

  :root {
    --c-bg:     #F7F6F4;
    --c-surf:   #FFFFFF;
    --c-card:   #FFFFFF;
    --c-bdr:    rgba(0,0,0,0.08);
    --c-bdr2:   rgba(0,0,0,0.13);
    --c-gold:   #C9A84C;
    --c-gold-d: #8A6E30;
    --c-text:   #1C1B18;
    --c-muted:  #6B6860;
    --c-subtle: #A09D96;
    --r:        14px;
    --t:        all 0.2s cubic-bezier(0.4,0,0.2,1);
    --font-d:   'Cormorant Garamond', Georgia, serif;
    --font-b:   'Outfit', system-ui, sans-serif;
  }
  .hb-root { background:var(--c-bg); color:var(--c-text); font-family:var(--font-b); font-size:14px; min-height:100vh; }
  .hb-wrap { max-width:1100px; margin:0 auto; padding:32px 28px 72px; }

  /* ── page header ── */
  .hb-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:28px; flex-wrap:wrap; }
  .hb-title { font-family:var(--font-b); font-size:clamp(24px,3vw,32px); font-weight:600; color:var(--c-text); letter-spacing:-0.01em; }
  .hb-sub { font-size:13px; color:var(--c-muted); margin-top:4px; }
  .hb-header-right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }

  /* ── buttons ── */
  .btn-gold {
    display:inline-flex; align-items:center; gap:7px;
    padding:9px 18px; background:var(--c-gold); color:#0A0A0B;
    font-size:13px; font-weight:700; border:none; border-radius:10px;
    cursor:pointer; transition:var(--t); font-family:var(--font-b); white-space:nowrap;
  }
  .btn-gold:hover { background:#e0bc5e; box-shadow:0 4px 16px rgba(201,168,76,0.3); }
  .btn-ghost {
    display:inline-flex; align-items:center; gap:7px;
    padding:9px 16px; background:rgba(255,255,255,0.04); color:var(--c-muted);
    font-size:13px; font-weight:500; border:1px solid var(--c-bdr); border-radius:10px;
    cursor:pointer; transition:var(--t); font-family:var(--font-b); white-space:nowrap;
  }
  .btn-ghost:hover { color:var(--c-text); border-color:var(--c-bdr2); background:rgba(255,255,255,0.07); }

  /* hotel selector */
  .hotel-select {
    padding:9px 14px; background:rgba(255,255,255,0.04); border:1px solid var(--c-bdr);
    color:var(--c-text); font-family:var(--font-b); font-size:13px;
    border-radius:10px; outline:none; cursor:pointer; transition:var(--t);
  }
  .hotel-select:focus { border-color:var(--c-gold-d); }
  .hotel-select option { background:#111113; }

  /* ── pending alert ── */
  .hb-alert {
    display:flex; align-items:center; gap:10px;
    padding:12px 18px; margin-bottom:20px;
    background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25);
    border-radius:12px; font-size:13px; color:#D97706;
  }
  .hb-alert-dot { width:8px; height:8px; border-radius:50%; background:#F59E0B; flex-shrink:0; animation:pulse-dot 1.5s ease-in-out infinite; }
  @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }

  /* ── filter tabs ── */
  .filter-tabs { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; align-items:center; }
  .filter-tab {
    padding:7px 14px; border-radius:8px; border:1px solid var(--c-bdr);
    background:rgba(255,255,255,0.03); color:var(--c-muted);
    font-size:12px; font-weight:500; cursor:pointer; transition:var(--t);
    font-family:var(--font-b);
  }
  .filter-tab:hover { color:var(--c-text); border-color:var(--c-bdr2); background:rgba(255,255,255,0.06); }
  .filter-tab.active { background:var(--c-gold); border-color:var(--c-gold); color:#0A0A0B; font-weight:700; }
  .filter-count { margin-left:auto; font-size:12px; color:var(--c-subtle); }

  /* ── date filter bar ── */
  .date-bar {
    display:flex; flex-wrap:wrap; align-items:center; gap:12px;
    padding:14px 18px; margin-bottom:24px;
    background:var(--c-card); border:1px solid var(--c-bdr); border-radius:12px;
  }
  .date-bar-label { font-size:11px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--c-muted); }
  .date-input {
    padding:7px 12px; background:rgba(255,255,255,0.04); border:1px solid var(--c-bdr);
    color:var(--c-text); font-size:13px; font-family:var(--font-b);
    border-radius:8px; outline:none; transition:var(--t); cursor:pointer;
  }
  .date-input:focus { border-color:var(--c-gold-d); background:rgba(201,168,76,0.04); }
  .date-input::-webkit-calendar-picker-indicator { filter:invert(0.5); cursor:pointer; }
  .date-sep { font-size:12px; color:var(--c-subtle); }

  /* ── booking card ── */
  .bk-card {
    background:var(--c-card); border:1px solid var(--c-bdr);
    border-radius:var(--r); overflow:hidden; margin-bottom:10px;
    transition:var(--t);
  }
  .bk-card:hover { border-color:var(--c-bdr2); box-shadow:0 4px 24px rgba(0,0,0,0.35); }
  .bk-card-inner { display:flex; gap:0; }

  /* left accent bar — color by status */
  .bk-accent { width:4px; flex-shrink:0; }

  /* main body */
  .bk-body { flex:1; min-width:0; padding:18px 20px; display:flex; gap:16px; flex-wrap:wrap; }
  .bk-left { flex:1; min-width:0; }
  .bk-right { flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; justify-content:space-between; gap:12px; }

  /* room + status row */
  .bk-top-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
  .bk-room-name { font-size:15px; font-weight:600; color:var(--c-text); }
  .bk-room-type { font-size:11px; padding:3px 9px; border-radius:6px; background:rgba(255,255,255,0.06); border:1px solid var(--c-bdr); color:var(--c-muted); font-weight:500; }
  .bk-status-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 11px; border-radius:20px; border:1px solid; font-size:11px; font-weight:600; }
  .bk-status-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

  /* info grid */
  .bk-info { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:12px; }
  .bk-info-item-label { font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--c-gold); margin-bottom:3px; }
  .bk-info-item-val { font-size:13px; font-weight:500; color:var(--c-text); }

  /* special requests / cancel reason */
  .bk-special { font-size:12px; color:var(--c-muted); font-style:italic; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:500px; }
  .bk-cancel-reason { font-size:12px; color:#f87171; margin-bottom:4px; }
  .bk-created { font-size:11px; color:var(--c-subtle); }

  /* price */
  .bk-price { font-family:var(--font-b); font-size:22px; font-weight:600; color:var(--c-gold); line-height:1; }
  .bk-price-sub { font-size:11px; color:var(--c-subtle); margin-top:2px; font-family:var(--font-b); font-weight:300; }

  /* action buttons */
  .bk-actions { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
  .bk-btn {
    padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600;
    cursor:pointer; transition:var(--t); font-family:var(--font-b); border:none; white-space:nowrap;
  }
  .bk-btn-confirm  { background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.25); }
  .bk-btn-confirm:hover  { background:rgba(16,185,129,0.25); border-color:rgba(16,185,129,0.4); }
  .bk-btn-reject   { background:rgba(239,68,68,0.1); color:#f87171; border:1px solid rgba(239,68,68,0.2); }
  .bk-btn-reject:hover   { background:rgba(239,68,68,0.2); border-color:rgba(239,68,68,0.35); }
  .bk-btn-checkin  { background:rgba(59,130,246,0.12); color:#60a5fa; border:1px solid rgba(59,130,246,0.25); }
  .bk-btn-checkin:hover  { background:rgba(59,130,246,0.22); }
  .bk-btn-checkout { background:rgba(139,92,246,0.12); color:#a78bfa; border:1px solid rgba(139,92,246,0.25); }
  .bk-btn-checkout:hover { background:rgba(139,92,246,0.22); }
  .bk-btn-chat     { background:rgba(255,255,255,0.04); color:var(--c-muted); border:1px solid var(--c-bdr); }
  .bk-btn-chat:hover     { color:var(--c-gold); border-color:rgba(201,168,76,0.3); background:rgba(201,168,76,0.06); }

  /* ── empty / no-hotel ── */
  .hb-empty { text-align:center; padding:72px 20px; background:var(--c-card); border:1px solid var(--c-bdr); border-radius:var(--r); }
  .hb-empty-glyph { font-family:var(--font-b); font-size:52px; color:rgba(255,255,255,0.06); margin-bottom:14px; }
  .hb-empty-title { font-size:15px; font-weight:600; color:var(--c-text); margin-bottom:6px; }
  .hb-empty-sub { font-size:13px; color:var(--c-muted); }

  /* ── skeleton ── */
  .sk-card { height:120px; background:var(--c-card); border:1px solid var(--c-bdr); border-radius:var(--r); margin-bottom:10px; background:linear-gradient(90deg,#1e1e22 25%,#252529 50%,#1e1e22 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* ── pagination ── */
  .pagination { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:32px; }
  .page-btn { min-width:36px; height:36px; border-radius:8px; border:1px solid var(--c-bdr); background:none; color:var(--c-muted); font-size:13px; font-weight:500; cursor:pointer; transition:var(--t); padding:0 10px; font-family:var(--font-b); }
  .page-btn:hover:not(:disabled) { border-color:var(--c-bdr2); color:var(--c-text); }
  .page-btn.active { background:var(--c-gold); border-color:var(--c-gold); color:#0A0A0B; font-weight:700; }
  .page-btn:disabled { opacity:0.25; cursor:not-allowed; }

  /* ── modal backdrop ── */
  .modal-backdrop { position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(0,0,0,0.7); backdrop-filter:blur(6px); }
  .modal-box { background:var(--c-surf); border:1px solid var(--c-bdr2); border-radius:16px; width:100%; max-width:400px; overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,0.6); }
  .modal-header { padding:20px 22px 18px; border-bottom:1px solid var(--c-bdr); }
  .modal-title { font-family:var(--font-b); font-size:20px; font-weight:600; color:var(--c-text); }
  .modal-desc { font-size:13px; color:var(--c-muted); margin-top:4px; }
  .modal-body { padding:20px 22px; }
  .modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 22px; border-top:1px solid var(--c-bdr); }
  .modal-textarea {
    width:100%; background:rgba(255,255,255,0.04); border:1px solid var(--c-bdr);
    color:var(--c-text); font-family:var(--font-b); font-size:13px;
    border-radius:10px; padding:12px 14px; resize:none; outline:none; transition:var(--t);
  }
  .modal-textarea::placeholder { color:var(--c-subtle); }
  .modal-textarea:focus { border-color:rgba(239,68,68,0.4); background:rgba(239,68,68,0.04); }
  .modal-btn-cancel { padding:9px 18px; background:rgba(255,255,255,0.04); border:1px solid var(--c-bdr); color:var(--c-muted); border-radius:9px; font-size:13px; font-weight:500; cursor:pointer; transition:var(--t); font-family:var(--font-b); }
  .modal-btn-cancel:hover { color:var(--c-text); border-color:var(--c-bdr2); }
  .modal-btn-confirm { padding:9px 20px; border:none; border-radius:9px; font-size:13px; font-weight:700; cursor:pointer; transition:var(--t); font-family:var(--font-b); }
  .modal-btn-confirm:disabled { opacity:0.35; cursor:not-allowed; }

  /* QR modal */
  .qr-result { background:rgba(16,185,129,0.07); border:1px solid rgba(16,185,129,0.2); border-radius:12px; padding:16px; }
  .qr-result-ok { font-size:13px; font-weight:600; color:#34d399; margin-bottom:12px; display:flex; align-items:center; gap:6px; }
  .qr-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .qr-cell-label { font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--c-gold); margin-bottom:3px; }
  .qr-cell-val { font-size:13px; font-weight:500; color:var(--c-text); }
  .qr-input {
    flex:1; background:rgba(255,255,255,0.04); border:1px solid var(--c-bdr);
    color:var(--c-text); font-family:'Courier New',monospace; font-size:13px;
    border-radius:10px; padding:10px 14px; outline:none; transition:var(--t);
  }
  .qr-input::placeholder { font-family:var(--font-b); color:var(--c-subtle); }
  .qr-input:focus { border-color:var(--c-gold-d); }
  .qr-error { display:flex; align-items:center; gap:8px; padding:10px 14px; background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.2); border-radius:10px; font-size:13px; color:#f87171; }
  .qr-checkin-btn { width:100%; padding:12px; background:var(--c-gold); color:#0A0A0B; border:none; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; transition:var(--t); font-family:var(--font-b); margin-top:12px; }
  .qr-checkin-btn:hover:not(:disabled) { background:#e0bc5e; }
  .qr-checkin-btn:disabled { opacity:0.4; cursor:not-allowed; }
  .qr-warn { padding:10px 14px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); border-radius:10px; font-size:12px; color:#D97706; margin-top:10px; }

  /* ── toast ── */
  .hb-toast { position:fixed; bottom:28px; left:50%; transform:translateX(-50%); z-index:60; padding:12px 22px; background:#111113; border:1px solid var(--c-bdr2); color:var(--c-text); font-size:13px; font-weight:500; border-radius:50px; box-shadow:0 8px 32px rgba(0,0,0,0.5); display:flex; align-items:center; gap:8px; white-space:nowrap; }
  .hb-toast-dot { width:6px; height:6px; border-radius:50%; background:var(--c-gold); flex-shrink:0; }

  @media(max-width:700px) {
    .hb-wrap { padding:20px 16px 48px; }
    .bk-info { grid-template-columns:repeat(2,1fr); }
    .bk-body { flex-direction:column; }
    .bk-right { flex-direction:row; flex-wrap:wrap; align-items:center; }
    .bk-actions { justify-content:flex-start; }
  }
`;

/* ─── StatusBadge ────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label:status, dot:'#9CA3AF', bg:'rgba(156,163,175,0.1)', text:'#9CA3AF', border:'rgba(156,163,175,0.2)' };
  return (
    <span className="bk-status-badge" style={{background:m.bg, color:m.text, borderColor:m.border}}>
      <span className="bk-status-dot" style={{background:m.dot}} />
      {m.label}
    </span>
  );
}

/* ─── RejectModal ────────────────────────────────────────────── */
function RejectModal({ booking, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Từ chối đặt phòng</div>
          <div className="modal-desc">Phòng {booking.roomNumber ?? '—'} — {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}</div>
        </div>
        <div className="modal-body">
          <textarea className="modal-textarea" rows={3} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Lý do từ chối (bắt buộc)..." />
        </div>
        <div className="modal-footer">
          <button className="modal-btn-cancel" onClick={onCancel}>Hủy</button>
          <button className="modal-btn-confirm" disabled={loading || !reason.trim()}
            onClick={() => onConfirm(reason)}
            style={{background:'rgba(239,68,68,0.85)',color:'#fff'}}>
            {loading ? 'Đang xử lý...' : 'Từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ActionModal ────────────────────────────────────────────── */
function ActionModal({ title, desc, confirmLabel, confirmBg, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <div className="modal-desc">{desc}</div>
        </div>
        <div className="modal-footer" style={{borderTop:'none',paddingTop:'20px'}}>
          <button className="modal-btn-cancel" onClick={onCancel}>Hủy</button>
          <button className="modal-btn-confirm" disabled={loading}
            onClick={onConfirm} style={{background:confirmBg,color:'#fff'}}>
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── BookingCard ────────────────────────────────────────────── */
function BookingCard({ booking, isStaff, onAction }) {
  const n = fmtNights(booking.checkIn, booking.checkOut);
  const canConfirm  = booking.status === 'PENDING';
  const canReject   = booking.status === 'PENDING';
  const canCheckIn  = booking.status === 'CONFIRMED' && isStaff;
  const canCheckOut = booking.status === 'CHECKED_IN' && isStaff;
  const meta = STATUS_META[booking.status] ?? { dot:'#9CA3AF' };

  return (
    <div className="bk-card">
      <div className="bk-card-inner">
        {/* Status accent bar */}
        <div className="bk-accent" style={{background:meta.dot, opacity:0.7}} />

        <div className="bk-body">
          {/* Left */}
          <div className="bk-left">
            <div className="bk-top-row">
              <span className="bk-room-name">Phòng {booking.roomNumber ?? '—'}</span>
              {booking.roomType && (
                <span className="bk-room-type">{ROOM_TYPE_LABEL[booking.roomType] ?? booking.roomType}</span>
              )}
              <StatusBadge status={booking.status} />
            </div>

            <div className="bk-info">
              <div>
                <div className="bk-info-item-label">Check-in</div>
                <div className="bk-info-item-val">{fmtDate(booking.checkIn)}</div>
              </div>
              <div>
                <div className="bk-info-item-label">Check-out</div>
                <div className="bk-info-item-val">{fmtDate(booking.checkOut)}</div>
              </div>
              <div>
                <div className="bk-info-item-label">Số đêm</div>
                <div className="bk-info-item-val">{n} đêm</div>
              </div>
              <div>
                <div className="bk-info-item-label">Số khách</div>
                <div className="bk-info-item-val">{booking.guestCount} người</div>
              </div>
            </div>

            {booking.specialRequests && (
              <div className="bk-special">Yêu cầu: {booking.specialRequests}</div>
            )}
            {booking.cancelReason && (
              <div className="bk-cancel-reason">Lý do: {booking.cancelReason}</div>
            )}
            <div className="bk-created">
              Đặt lúc: {booking.createdAt ? new Date(booking.createdAt).toLocaleString('vi-VN') : '—'}
            </div>
          </div>

          {/* Right */}
          <div className="bk-right">
            <div style={{textAlign:'right'}}>
              <div className="bk-price">{fmtPrice(booking.totalPrice)}</div>
              {booking.pricePerNight && (
                <div className="bk-price-sub">{fmtPrice(booking.pricePerNight)}/đêm</div>
              )}
            </div>

            <div className="bk-actions">
              {canConfirm && (
                <button className="bk-btn bk-btn-confirm" onClick={() => onAction('confirm', booking)}>
                  ✓ Xác nhận
                </button>
              )}
              {canReject && (
                <button className="bk-btn bk-btn-reject" onClick={() => onAction('reject', booking)}>
                  ✕ Từ chối
                </button>
              )}
              {canCheckIn && (
                <button className="bk-btn bk-btn-checkin" onClick={() => onAction('checkin', booking)}>
                  Nhận phòng
                </button>
              )}
              {canCheckOut && (
                <button className="bk-btn bk-btn-checkout" onClick={() => onAction('checkout', booking)}>
                  Trả phòng
                </button>
              )}
              <Link to={`/chat/${booking.userId}_${booking.hotelId}`} className="bk-btn bk-btn-chat"
                style={{textDecoration:'none',display:'inline-flex',alignItems:'center',gap:'5px'}}>
                Nhắn tin
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── QrScanModal ────────────────────────────────────────────── */
function QrScanModal({ onClose, onCheckInSuccess }) {
  const [payload,    setPayload]    = useState('');
  const [verifying,  setVerifying]  = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const verify = async () => {
    const trimmed = payload.trim();
    if (!trimmed) return;
    setVerifying(true); setError(''); setResult(null);
    try {
      const res = await scanQr(trimmed);
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Mã QR không hợp lệ hoặc đã hết hạn.');
    } finally { setVerifying(false); }
  };

  const handleCheckIn = async () => {
    if (!result) return;
    setCheckingIn(true); setError('');
    try {
      const res = await checkInBooking(result.id);
      onCheckInSuccess(res.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Không thể nhận phòng. Vui lòng thử lại.');
    } finally { setCheckingIn(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" style={{maxWidth:'420px'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div className="modal-title">Quét mã QR</div>
            <div className="modal-desc">Xác minh khách không cần giấy tờ</div>
          </div>
          <button className="modal-btn-cancel" onClick={onClose}
            style={{padding:'6px 10px',border:'1px solid var(--c-bdr)',fontSize:'16px'}}>✕</button>
        </div>
        <div className="modal-body" style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          <div>
            <div style={{fontSize:'11px',fontWeight:'600',letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--c-muted)',marginBottom:'8px'}}>
              Đặt máy quét vào ô dưới và quét mã QR
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <input ref={inputRef} type="text" className="qr-input" value={payload}
                onChange={e => { setPayload(e.target.value); setError(''); setResult(null); }}
                onKeyDown={e => e.key === 'Enter' && verify()}
                placeholder="Mã QR tự điền khi quét..." />
              <button className="btn-gold" onClick={verify}
                disabled={!payload.trim() || verifying}
                style={{opacity:(!payload.trim()||verifying)?0.4:1}}>
                {verifying ? '...' : 'Xác minh'}
              </button>
            </div>
          </div>

          {error && (
            <div className="qr-error">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              {error}
            </div>
          )}

          {result && (
            <div className="qr-result">
              <div className="qr-result-ok">
                <svg width="16" height="16" fill="none" stroke="#34d399" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                Mã hợp lệ
              </div>
              <div className="qr-grid">
                {[
                  ['Phòng',     result.roomNumber ?? '—'],
                  ['Loại',      ROOM_TYPE_LABEL[result.roomType] ?? result.roomType ?? '—'],
                  ['Check-in',  fmtDate(result.checkIn)],
                  ['Check-out', fmtDate(result.checkOut)],
                  ['Số khách',  `${result.guestCount ?? '—'} người`],
                  ['Trạng thái',result.status],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="qr-cell-label">{label}</div>
                    <div className="qr-cell-val">{val}</div>
                  </div>
                ))}
              </div>
              {result.status === 'CONFIRMED' ? (
                <button className="qr-checkin-btn" onClick={handleCheckIn} disabled={checkingIn}>
                  {checkingIn ? 'Đang xử lý...' : '✓ Nhận phòng ngay'}
                </button>
              ) : (
                <div className="qr-warn">Booking không ở trạng thái Đã xác nhận — không thể nhận phòng.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Pagination ─────────────────────────────────────────────── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => onChange(page-1)} disabled={page===0}>← Trước</button>
      {start > 0 && <span style={{color:'var(--c-subtle)',padding:'0 4px'}}>…</span>}
      {pages.map(p => (
        <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={() => onChange(p)}>{p+1}</button>
      ))}
      {end < totalPages-1 && <span style={{color:'var(--c-subtle)',padding:'0 4px'}}>…</span>}
      <button className="page-btn" onClick={() => onChange(page+1)} disabled={page>=totalPages-1}>Sau →</button>
    </div>
  );
}

/* ════════════════ Main Page ════════════════ */
export default function HotelBookingsPage() {
  const user    = JSON.parse(localStorage.getItem('user') ?? 'null');
  const isOwner = user?.role === 'OWNER';
  const isStaff = user?.role === 'STAFF';

  const [hotels,          setHotels]          = useState([]);
  const [selectedHotelId, setSelectedHotelId] = useState(isStaff ? (user?.hotelId ?? '') : '');
  const [statusFilter,    setStatusFilter]    = useState('');
  const [checkInFilter,   setCheckInFilter]   = useState('');
  const [checkOutFilter,  setCheckOutFilter]  = useState('');
  const [bookings,        setBookings]        = useState([]);
  const [page,            setPage]            = useState(0);
  const [totalPages,      setTotalPages]      = useState(0);
  const [totalElements,   setTotalElements]   = useState(0);
  const [loading,         setLoading]         = useState(false);
  const [modal,           setModal]           = useState(null);
  const [actionLoading,   setActionLoading]   = useState(false);
  const [toast,           setToast]           = useState('');
  const [qrScanOpen,      setQrScanOpen]      = useState(false);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const { notifications } = useNotifications();

  useEffect(() => {
    const latest = notifications[0];
    if (!latest || latest.hotelId !== selectedHotelId) return;
    const { type } = latest;
    const onPage0 = page === 0 && !checkInFilter && !checkOutFilter;
    if (type === 'BOOKING_CREATED' && (statusFilter===''||statusFilter==='PENDING') && onPage0)
      loadBookings(selectedHotelId, statusFilter, checkInFilter, checkOutFilter, 0);
    if (type === 'BOOKING_CANCELLED' && (statusFilter===''||statusFilter==='CANCELLED') && onPage0)
      loadBookings(selectedHotelId, statusFilter, checkInFilter, checkOutFilter, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  useEffect(() => {
    if (!isOwner) return;
    getMyHotels().then(res => {
      const list = res.data.data ?? [];
      setHotels(list);
      if (list.length > 0) setSelectedHotelId(list[0].id);
    }).catch(() => {});
  }, [isOwner]);

  const loadBookings = useCallback(async (hotelId, status, ci, co, p) => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const params = { page:p, size:PAGE_SIZE };
      if (status) params.status   = status;
      if (ci)     params.checkIn  = ci;
      if (co)     params.checkOut = co;
      const res = await getHotelBookings(hotelId, params);
      const d   = res.data.data;
      setBookings(d.content ?? []);
      setTotalPages(d.totalPages ?? 0);
      setTotalElements(d.totalElements ?? 0);
    } catch { setBookings([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => {
    loadBookings(selectedHotelId, statusFilter, checkInFilter, checkOutFilter, page);
  }, [selectedHotelId, statusFilter, checkInFilter, checkOutFilter, page, loadBookings]);

  const changeFilter = (field, val) => {
    if (field==='status')   setStatusFilter(val);
    if (field==='checkIn')  setCheckInFilter(val);
    if (field==='checkOut') setCheckOutFilter(val);
    setPage(0);
  };

  const handleAction    = (type, booking) => setModal({ type, booking });
  const executeAction   = async (reason) => {
    if (!modal) return;
    setActionLoading(true);
    const { type, booking } = modal;
    const MSG = { confirm:'Đã xác nhận!', reject:'Đã từ chối.', checkin:'Khách đã nhận phòng!', checkout:'Khách đã trả phòng!' };
    try {
      let res;
      if (type==='confirm')  res = await confirmBooking(booking.id);
      if (type==='reject')   res = await rejectBooking(booking.id, reason);
      if (type==='checkin')  res = await checkInBooking(booking.id);
      if (type==='checkout') res = await checkOutBooking(booking.id);
      const updated = res?.data?.data;
      if (updated) setBookings(prev => prev.map(b => b.id===booking.id ? {...b,...updated} : b));
      showToast(MSG[type] ?? 'Thành công!');
      setModal(null);
    } catch (err) { showToast(err.response?.data?.message ?? 'Có lỗi xảy ra'); }
    finally       { setActionLoading(false); }
  };

  const pendingCount = bookings.filter(b => b.status==='PENDING').length;
  const handleQrCheckInSuccess = updated => {
    setBookings(prev => prev.map(b => b.id===updated.id ? {...b,...updated} : b));
    showToast('Khách đã nhận phòng thành công!');
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="hb-root">
        <Navbar />
        <div className="hb-wrap">

          {/* ── Header ── */}
          <div className="hb-header">
            <div>
              <div className="hb-title">Quản lý Booking</div>
              <div className="hb-sub">{isStaff ? 'Xác nhận, nhận phòng và trả phòng cho khách' : 'Theo dõi và xử lý các đặt phòng'}</div>
            </div>
            <div className="hb-header-right">
              {(isStaff||isOwner) && (
                <button className="btn-gold" onClick={() => setQrScanOpen(true)}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 4h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                  </svg>
                  Quét QR
                </button>
              )}
              {isOwner && hotels.length > 1 && (
                <select className="hotel-select" value={selectedHotelId}
                  onChange={e => { setSelectedHotelId(e.target.value); setPage(0); }}>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              )}
              {isOwner && hotels.length === 1 && (
                <div className="btn-ghost" style={{cursor:'default'}}>{hotels[0]?.name}</div>
              )}
            </div>
          </div>

          {/* ── Pending alert ── */}
          {statusFilter==='' && pendingCount>0 && !loading && (
            <div className="hb-alert">
              <span className="hb-alert-dot" />
              Có <strong style={{color:'var(--c-gold)',margin:'0 3px'}}>{pendingCount}</strong> booking đang chờ xác nhận trên trang này
            </div>
          )}

          {/* ── Status tabs ── */}
          <div className="filter-tabs">
            {STATUS_FILTERS.map(f => (
              <button key={f.value} className={`filter-tab ${statusFilter===f.value?'active':''}`}
                onClick={() => changeFilter('status', f.value)}>
                {f.label}
              </button>
            ))}
            <span className="filter-count">{totalElements} booking</span>
          </div>

          {/* ── Date filter bar ── */}
          <div className="date-bar">
            <span className="date-bar-label">Lọc ngày</span>
            <span style={{fontSize:'12px',color:'var(--c-subtle)'}}>Từ</span>
            <input type="date" className="date-input" value={checkInFilter}
              onChange={e => changeFilter('checkIn', e.target.value)} />
            <span className="date-sep">→</span>
            <input type="date" className="date-input" value={checkOutFilter}
              onChange={e => changeFilter('checkOut', e.target.value)} />
            <button className="btn-ghost" onClick={() => { setCheckInFilter(todayStr()); setCheckOutFilter(''); setPage(0); }}
              style={{padding:'7px 14px',fontSize:'12px'}}>
              Hôm nay
            </button>
            {(checkInFilter||checkOutFilter) && (
              <button className="btn-ghost" onClick={() => { setCheckInFilter(''); setCheckOutFilter(''); setPage(0); }}
                style={{padding:'7px 12px',fontSize:'12px',color:'#f87171',borderColor:'rgba(248,113,113,0.2)'}}>
                ✕ Xóa
              </button>
            )}
          </div>

          {/* ── Booking list ── */}
          {!selectedHotelId ? (
            <div className="hb-empty">
              <div className="hb-empty-glyph">✦</div>
              <div className="hb-empty-title">Chưa có khách sạn nào được gán</div>
              <div className="hb-empty-sub">Liên hệ quản trị viên để được hỗ trợ</div>
            </div>
          ) : loading ? (
            <>
              {[...Array(5)].map((_,i) => <div key={i} className="sk-card" />)}
            </>
          ) : bookings.length === 0 ? (
            <div className="hb-empty">
              <div className="hb-empty-glyph">✦</div>
              <div className="hb-empty-title">Không có booking nào</div>
              <div className="hb-empty-sub">Thử thay đổi bộ lọc trạng thái hoặc ngày</div>
            </div>
          ) : (
            bookings.map(b => (
              <BookingCard key={b.id} booking={b} isStaff={isStaff} onAction={handleAction} />
            ))
          )}

          <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); window.scrollTo({top:0,behavior:'smooth'}); }} />
        </div>

        {/* ── Modals ── */}
        {modal?.type==='reject' && (
          <RejectModal booking={modal.booking} onConfirm={executeAction} onCancel={() => setModal(null)} loading={actionLoading} />
        )}
        {modal?.type==='confirm' && (
          <ActionModal title="Xác nhận đặt phòng"
            desc={`Phòng ${modal.booking.roomNumber??'—'} — ${fmtDate(modal.booking.checkIn)} → ${fmtDate(modal.booking.checkOut)}`}
            confirmLabel="Xác nhận" confirmBg="rgba(16,185,129,0.85)"
            onConfirm={executeAction} onCancel={() => setModal(null)} loading={actionLoading} />
        )}
        {modal?.type==='checkin' && (
          <ActionModal title="Check-in khách"
            desc={`Xác nhận khách nhận phòng ${modal.booking.roomNumber??'—'}?`}
            confirmLabel="Nhận phòng" confirmBg="rgba(59,130,246,0.85)"
            onConfirm={executeAction} onCancel={() => setModal(null)} loading={actionLoading} />
        )}
        {modal?.type==='checkout' && (
          <ActionModal title="Check-out khách"
            desc={`Xác nhận khách trả phòng ${modal.booking.roomNumber??'—'}?`}
            confirmLabel="Trả phòng" confirmBg="rgba(139,92,246,0.85)"
            onConfirm={executeAction} onCancel={() => setModal(null)} loading={actionLoading} />
        )}
        {qrScanOpen && <QrScanModal onClose={() => setQrScanOpen(false)} onCheckInSuccess={handleQrCheckInSuccess} />}

        {/* ── Toast ── */}
        {toast && (
          <div className="hb-toast">
            <span className="hb-toast-dot" />
            {toast}
          </div>
        )}
      </div>
    </>
  );
}