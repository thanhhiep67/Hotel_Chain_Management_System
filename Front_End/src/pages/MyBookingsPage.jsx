import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getMyBookings, cancelBooking, getCheckInQr } from '../api/bookings';
import { useNotifications } from '../context/NotificationContext';

/* ─── constants (unchanged) ─────────────────────────────────── */
const STATUS_META = {
  PENDING:     { label:'Chờ xác nhận', dot:'#F59E0B', bg:'rgba(245,158,11,0.1)',  text:'#D97706', border:'rgba(245,158,11,0.25)' },
  CONFIRMED:   { label:'Đã xác nhận',  dot:'#3B82F6', bg:'rgba(59,130,246,0.08)', text:'#2563EB', border:'rgba(59,130,246,0.2)'  },
  CHECKED_IN:  { label:'Đang lưu trú', dot:'#10B981', bg:'rgba(16,185,129,0.08)', text:'#059669', border:'rgba(16,185,129,0.2)'  },
  CHECKED_OUT: { label:'Đã trả phòng', dot:'#6B7280', bg:'rgba(107,114,128,0.08)',text:'#4B5563', border:'rgba(107,114,128,0.2)' },
  CANCELLED:   { label:'Đã hủy',       dot:'#EF4444', bg:'rgba(239,68,68,0.08)',  text:'#DC2626', border:'rgba(239,68,68,0.2)'   },
  REJECTED:    { label:'Bị từ chối',   dot:'#F97316', bg:'rgba(249,115,22,0.08)', text:'#EA580C', border:'rgba(249,115,22,0.2)'  },
};

const STATUS_FILTERS = [
  { value:'',             label:'Tất cả'       },
  { value:'PENDING',      label:'Chờ xác nhận' },
  { value:'CONFIRMED',    label:'Đã xác nhận'  },
  { value:'CHECKED_IN',   label:'Đang lưu trú' },
  { value:'CHECKED_OUT',  label:'Đã trả phòng' },
  { value:'CANCELLED',    label:'Đã hủy'       },
  { value:'REJECTED',     label:'Bị từ chối'   },
];

const TYPE_LABEL = { STANDARD:'Standard', DELUXE:'Deluxe', SUITE:'Suite', FAMILY:'Family' };
const PAGE_SIZE  = 4;

function fmt(d) {
  if (!d) return '—';
  return new Date(d+'T00:00:00').toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function nights(ci, co) {
  if (!ci||!co) return 0;
  return Math.round((new Date(co+'T00:00:00')-new Date(ci+'T00:00:00'))/86400000);
}
function canCancel(b) {
  if (b.status!=='PENDING' && b.status!=='CONFIRMED') return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return (new Date(b.checkIn+'T00:00:00')-today)/86400000 > 1;
}

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
  .mb-root { background:var(--c-bg); color:var(--c-text); font-family:var(--font-b); font-size:14px; min-height:100vh; }
  .mb-wrap { max-width:1000px; margin:0 auto; padding:32px 28px 72px; }

  /* header */
  .mb-title { font-family:var(--font-b); font-size:clamp(24px,3vw,32px); font-weight:600; color:var(--c-text); letter-spacing:-0.01em; margin-bottom:4px; }
  .mb-sub   { font-size:13px; color:var(--c-muted); margin-bottom:24px; }

  /* filter tabs */
  .mb-tabs { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:28px; }
  .mb-tab {
    padding:7px 15px; border-radius:8px; border:1px solid var(--c-bdr);
    background:rgba(255,255,255,0.03); color:var(--c-muted);
    font-size:12px; font-weight:500; cursor:pointer; transition:var(--t);
    font-family:var(--font-b);
  }
  .mb-tab:hover { color:var(--c-text); border-color:var(--c-bdr2); background:rgba(255,255,255,0.06); }
  .mb-tab.active { background:var(--c-gold); border-color:var(--c-gold); color:#0A0A0B; font-weight:700; }

  /* grid */
  .mb-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }

  /* booking card */
  .bk-card {
    background:var(--c-card); border:1px solid var(--c-bdr);
    border-radius:var(--r); overflow:hidden; transition:var(--t);
    display:flex; flex-direction:column;
  }
  .bk-card:hover { border-color:var(--c-bdr2); box-shadow:0 8px 32px rgba(0,0,0,0.4); transform:translateY(-2px); }
  .bk-card.dimmed { opacity:0.6; }
  .bk-card.dimmed:hover { opacity:0.8; transform:none; }

  /* accent bar on top */
  .bk-accent-bar { height:3px; width:100%; }

  /* card image */
  .bk-img { height:130px; background:#1a1a1e; overflow:hidden; position:relative; flex-shrink:0; }
  .bk-img img { width:100%; height:100%; object-fit:cover; transition:transform 0.5s cubic-bezier(0.4,0,0.2,1); }
  .bk-card:hover .bk-img img { transform:scale(1.05); }
  .bk-img-empty { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-family:var(--font-b); font-size:32px; color:rgba(255,255,255,0.06); }
  .bk-hotel-badge { position:absolute; bottom:8px; left:8px; right:8px; font-size:11px; font-weight:600; color:#fff; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px); padding:4px 10px; border-radius:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  /* card body */
  .bk-body { padding:14px 16px; flex:1; display:flex; flex-direction:column; gap:12px; }

  /* status row */
  .bk-status-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .bk-room-label { font-size:14px; font-weight:600; color:var(--c-text); }
  .bk-status-badge { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; border:1px solid; font-size:11px; font-weight:600; }
  .bk-status-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

  /* info cells */
  .bk-cells { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .bk-cell { background:rgba(255,255,255,0.03); border:1px solid var(--c-bdr); border-radius:10px; padding:10px 12px; }
  .bk-cell-label { font-size:10px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase; color:var(--c-gold); margin-bottom:3px; }
  .bk-cell-val { font-size:13px; font-weight:500; color:var(--c-text); line-height:1.3; }
  .bk-cell-sub { font-size:11px; color:var(--c-muted); margin-top:1px; }

  /* price row */
  .bk-price-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-top:1px solid var(--c-bdr); border-bottom:1px solid var(--c-bdr); }
  .bk-guests { font-size:12px; color:var(--c-muted); }
  .bk-price { font-family:var(--font-b); font-size:20px; font-weight:600; color:var(--c-gold); }

  /* notes */
  .bk-note { font-size:11px; color:var(--c-muted); background:rgba(255,255,255,0.03); border:1px solid var(--c-bdr); border-radius:8px; padding:8px 12px; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .bk-note-red { color:#f87171; border-color:rgba(248,113,113,0.2); background:rgba(248,113,113,0.05); }

  /* footer actions */
  .bk-footer { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:auto; padding-top:2px; }
  .bk-link {
    font-size:12px; color:var(--c-muted); border:1px solid var(--c-bdr);
    padding:6px 12px; border-radius:8px; text-decoration:none; transition:var(--t);
    background:rgba(255,255,255,0.03);
  }
  .bk-link:hover { color:var(--c-text); border-color:var(--c-bdr2); }
  .bk-actions { display:flex; gap:6px; }
  .bk-btn {
    font-size:12px; font-weight:600; padding:6px 13px; border-radius:8px;
    border:1px solid; cursor:pointer; transition:var(--t); font-family:var(--font-b);
    white-space:nowrap;
  }
  .bk-btn-qr { background:rgba(201,168,76,0.1); color:var(--c-gold); border-color:rgba(201,168,76,0.25); }
  .bk-btn-qr:hover { background:rgba(201,168,76,0.2); border-color:rgba(201,168,76,0.4); }
  .bk-btn-cancel { background:rgba(239,68,68,0.08); color:#f87171; border-color:rgba(239,68,68,0.2); }
  .bk-btn-cancel:hover { background:rgba(239,68,68,0.16); border-color:rgba(239,68,68,0.35); }
  .bk-expired { font-size:11px; color:var(--c-subtle); }

  /* skeleton */
  .sk-card { height:300px; background:linear-gradient(90deg,#1e1e22 25%,#252529 50%,#1e1e22 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:var(--r); border:1px solid var(--c-bdr); }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* empty */
  .mb-empty { text-align:center; padding:72px 20px; background:var(--c-card); border:1px solid var(--c-bdr); border-radius:var(--r); }
  .mb-empty-glyph { font-family:var(--font-b); font-size:52px; color:rgba(255,255,255,0.06); margin-bottom:14px; }
  .mb-empty-title { font-size:15px; font-weight:600; color:var(--c-text); margin-bottom:6px; }
  .mb-empty-sub { font-size:13px; color:var(--c-muted); margin-bottom:20px; }
  .mb-empty-btn { display:inline-flex; padding:11px 24px; background:var(--c-gold); color:#0A0A0B; font-size:13px; font-weight:700; border-radius:10px; text-decoration:none; transition:var(--t); font-family:var(--font-b); }
  .mb-empty-btn:hover { background:#e0bc5e; }

  /* pagination */
  .pagination { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:32px; }
  .page-btn { min-width:36px; height:36px; border-radius:8px; border:1px solid var(--c-bdr); background:none; color:var(--c-muted); font-size:13px; font-weight:500; cursor:pointer; transition:var(--t); padding:0 10px; font-family:var(--font-b); }
  .page-btn:hover:not(:disabled) { border-color:var(--c-bdr2); color:var(--c-text); }
  .page-btn.active { background:var(--c-gold); border-color:var(--c-gold); color:#0A0A0B; font-weight:700; }
  .page-btn:disabled { opacity:0.25; cursor:not-allowed; }

  /* modal */
  .modal-backdrop { position:fixed; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(0,0,0,0.75); backdrop-filter:blur(8px); }
  .modal-box { background:var(--c-surf); border:1px solid var(--c-bdr2); border-radius:16px; width:100%; max-width:380px; overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,0.65); }
  .modal-header { padding:20px 22px 16px; border-bottom:1px solid var(--c-bdr); display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .modal-title { font-family:var(--font-b); font-size:20px; font-weight:600; color:var(--c-text); }
  .modal-sub { font-size:12px; color:var(--c-muted); margin-top:4px; }
  .modal-close { width:30px; height:30px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid var(--c-bdr); color:var(--c-muted); font-size:14px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:var(--t); flex-shrink:0; }
  .modal-close:hover { color:var(--c-text); background:rgba(255,255,255,0.1); }
  .modal-body { padding:18px 22px; }
  .modal-label { font-size:10px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:var(--c-gold); margin-bottom:8px; }
  .modal-textarea { width:100%; background:rgba(255,255,255,0.04); border:1px solid var(--c-bdr); color:var(--c-text); font-family:var(--font-b); font-size:13px; border-radius:10px; padding:12px 14px; resize:none; outline:none; transition:var(--t); }
  .modal-textarea::placeholder { color:var(--c-subtle); }
  .modal-textarea:focus { border-color:rgba(239,68,68,0.35); background:rgba(239,68,68,0.04); }
  .modal-footer { display:flex; gap:8px; padding:14px 22px 20px; }
  .modal-btn { flex:1; padding:12px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; transition:var(--t); font-family:var(--font-b); border:none; }
  .modal-btn-secondary { background:rgba(255,255,255,0.05); border:1px solid var(--c-bdr); color:var(--c-muted); }
  .modal-btn-secondary:hover { color:var(--c-text); border-color:var(--c-bdr2); }
  .modal-btn-danger { background:rgba(239,68,68,0.8); color:#fff; }
  .modal-btn-danger:hover:not(:disabled) { background:rgba(239,68,68,1); }
  .modal-btn-danger:disabled { opacity:0.4; cursor:not-allowed; }

  /* QR modal */
  .qr-box { width:220px; height:220px; margin:0 auto; background:rgba(255,255,255,0.04); border:1px solid var(--c-bdr); border-radius:14px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; }
  .qr-box img { width:100%; height:100%; object-fit:contain; }
  .qr-spinner { width:32px; height:32px; border:2px solid var(--c-gold); border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; }
  @keyframes spin { to{transform:rotate(360deg)} }
  .qr-expired-msg { text-align:center; }
  .qr-expired-glyph { font-size:36px; color:rgba(255,255,255,0.1); font-family:var(--font-b); margin-bottom:8px; }
  .qr-expired-text { font-size:12px; color:var(--c-muted); margin-bottom:12px; }
  .qr-expired-btn { padding:8px 16px; background:var(--c-gold); color:#0A0A0B; border:none; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; transition:var(--t); font-family:var(--font-b); }
  .qr-expired-btn:hover { background:#e0bc5e; }
  .qr-timer-row { display:flex; justify-content:space-between; align-items:center; margin-top:12px; }
  .qr-timer { font-size:12px; font-weight:600; font-family:'Courier New',monospace; }
  .qr-refresh-btn { font-size:12px; color:var(--c-gold); background:none; border:none; cursor:pointer; transition:var(--t); font-family:var(--font-b); }
  .qr-refresh-btn:hover { color:#e0bc5e; }
  .qr-hint { font-size:12px; color:var(--c-muted); text-align:center; margin-top:14px; line-height:1.6; }

  /* toast */
  .mb-toast { position:fixed; top:20px; right:20px; z-index:60; padding:12px 20px; border-radius:12px; font-size:13px; font-weight:500; display:flex; align-items:center; gap:8px; box-shadow:0 8px 32px rgba(0,0,0,0.5); }
  .mb-toast-ok  { background:#111113; border:1px solid rgba(16,185,129,0.3); color:#34d399; }
  .mb-toast-err { background:#111113; border:1px solid rgba(248,113,113,0.3); color:#f87171; }
  .mb-toast-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }

  @media(max-width:640px) {
    .mb-wrap { padding:20px 16px 48px; }
    .mb-grid { grid-template-columns:1fr; }
    .bk-cells { grid-template-columns:1fr 1fr; }
  }
`;

/* ─── StatusBadge ────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label:status, dot:'#9CA3AF', bg:'rgba(156,163,175,0.1)', text:'#9CA3AF', border:'rgba(156,163,175,0.2)' };
  return (
    <span className="bk-status-badge" style={{background:m.bg,color:m.text,borderColor:m.border}}>
      <span className="bk-status-dot" style={{background:m.dot}} />
      {m.label}
    </span>
  );
}

/* ─── QrModal ────────────────────────────────────────────────── */
function QrModal({ booking, onClose }) {
  const [qrUrl,       setQrUrl]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [secondsLeft, setSecondsLeft] = useState(900);
  const blobRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getCheckInQr(booking.id);
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      const url = URL.createObjectURL(res.data);
      blobRef.current = url;
      setQrUrl(url); setSecondsLeft(900);
    } catch { setError('Không thể tải mã QR. Vui lòng thử lại.'); }
    finally  { setLoading(false); }
  }, [booking.id]);

  useEffect(() => {
    load();
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qrUrl || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => s-1), 1000);
    return () => clearInterval(t);
  }, [qrUrl, secondsLeft]);

  const expired = secondsLeft <= 0;
  const fmtTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const timerColor = secondsLeft < 60 ? '#f87171' : secondsLeft < 180 ? '#fb923c' : 'var(--c-muted)';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Mã QR nhận phòng</div>
            <div className="modal-sub">Phòng {booking.roomNumber} · {booking.hotelName}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="qr-box">
            {loading && <div className="qr-spinner" />}
            {!loading && error && <div style={{fontSize:'12px',color:'#f87171',textAlign:'center',padding:'16px'}}>{error}</div>}
            {!loading && qrUrl && !expired && <img src={qrUrl} alt="QR check-in" />}
            {!loading && expired && (
              <div className="qr-expired-msg">
                <div className="qr-expired-glyph">✦</div>
                <div className="qr-expired-text">Mã đã hết hạn</div>
                <button className="qr-expired-btn" onClick={load}>Tạo mã mới</button>
              </div>
            )}
          </div>

          {!loading && qrUrl && !expired && (
            <div className="qr-timer-row">
              <span className="qr-timer" style={{color:timerColor}}>⏱ {fmtTime(secondsLeft)} còn lại</span>
              <button className="qr-refresh-btn" onClick={load}>↺ Làm mới</button>
            </div>
          )}
          <div className="qr-hint">
            Xuất trình mã này cho nhân viên lễ tân<br />để nhận phòng không cần giấy tờ.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CancelModal ────────────────────────────────────────────── */
function CancelModal({ booking, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Hủy đặt phòng</div>
            <div className="modal-sub">
              Phòng {booking.roomNumber} · {booking.hotelName}<br />
              {fmt(booking.checkIn)} → {fmt(booking.checkOut)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-label">Lý do hủy <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--c-subtle)',fontSize:'11px'}}>(không bắt buộc)</span></div>
          <textarea className="modal-textarea" rows={3} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ví dụ: thay đổi kế hoạch..." />
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-secondary" onClick={onClose} disabled={loading}>
            Giữ đặt phòng
          </button>
          <button className="modal-btn modal-btn-danger" disabled={loading}
            onClick={() => onConfirm(reason)}>
            {loading ? 'Đang hủy...' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── BookingCard ────────────────────────────────────────────── */
function BookingCard({ booking, onCancelClick, onQrClick }) {
  const n        = nights(booking.checkIn, booking.checkOut);
  const meta     = STATUS_META[booking.status] ?? STATUS_META.PENDING;
  const eligible = canCancel(booking);
  const isDimmed = booking.status === 'CANCELLED' || booking.status === 'REJECTED';
  const img      = booking.roomImage || booking.hotelImage;

  return (
    <div className={`bk-card ${isDimmed ? 'dimmed' : ''}`}>
      {/* Accent bar */}
      <div className="bk-accent-bar" style={{background:meta.dot,opacity:0.7}} />

      {/* Image */}
      <div className="bk-img">
        {img
          ? <img src={img} alt={booking.hotelName} />
          : <div className="bk-img-empty">✦</div>
        }
        <div className="bk-hotel-badge">{booking.hotelName ?? '—'}</div>
      </div>

      {/* Body */}
      <div className="bk-body">
        {/* Status row */}
        <div className="bk-status-row">
          <span className="bk-room-label">
            Phòng {booking.roomNumber ?? '—'}
            {booking.roomType && (
              <span style={{fontWeight:400,fontSize:'12px',color:'var(--c-muted)',marginLeft:'6px'}}>
                · {TYPE_LABEL[booking.roomType] ?? booking.roomType}
              </span>
            )}
          </span>
          <StatusBadge status={booking.status} />
        </div>

        {/* Info cells */}
        <div className="bk-cells">
          <div className="bk-cell">
            <div className="bk-cell-label">Nhận phòng</div>
            <div className="bk-cell-val">{fmt(booking.checkIn)}</div>
          </div>
          <div className="bk-cell">
            <div className="bk-cell-label">Trả phòng</div>
            <div className="bk-cell-val">{fmt(booking.checkOut)}</div>
            <div className="bk-cell-sub">{n} đêm</div>
          </div>
        </div>

        {/* Price row */}
        <div className="bk-price-row">
          <span className="bk-guests">{booking.guestCount ?? 1} khách</span>
          <span className="bk-price">{(booking.totalPrice ?? 0).toLocaleString('vi-VN')} ₫</span>
        </div>

        {/* Notes */}
        {booking.cancelReason && (
          <div className={`bk-note bk-note-red`}>Lý do: {booking.cancelReason}</div>
        )}
        {booking.confirmedAt && booking.status === 'CONFIRMED' && (
          <div style={{fontSize:'11px',color:'var(--c-subtle)'}}>Xác nhận lúc: {fmtDateTime(booking.confirmedAt)}</div>
        )}

        {/* Footer */}
        <div className="bk-footer">
          <Link to={`/my-bookings/${booking.id}`} className="bk-link">Chi tiết</Link>
          <div className="bk-actions">
            {booking.status === 'CONFIRMED' && (
              <button className="bk-btn bk-btn-qr" onClick={() => onQrClick(booking)}>
                Mã QR
              </button>
            )}
            {eligible ? (
              <button className="bk-btn bk-btn-cancel" onClick={() => onCancelClick(booking)}>
                Hủy
              </button>
            ) : booking.status === 'PENDING' ? (
              <span className="bk-expired">Quá hạn hủy</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Pagination ─────────────────────────────────────────────── */
function Pagination({ page, totalPages, onChange }) {
  const start = Math.max(0, page-2);
  const end   = Math.min(totalPages-1, page+2);
  const pages = Array.from({length:end-start+1}, (_,i) => start+i);
  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => onChange(page-1)} disabled={page===0}>← Trước</button>
      {start > 0 && <><button className="page-btn" onClick={() => onChange(0)}>1</button>{start>1 && <span style={{color:'var(--c-subtle)',padding:'0 4px'}}>…</span>}</>}
      {pages.map(p => <button key={p} className={`page-btn ${p===page?'active':''}`} onClick={() => onChange(p)}>{p+1}</button>)}
      {end < totalPages-1 && <>{end<totalPages-2 && <span style={{color:'var(--c-subtle)',padding:'0 4px'}}>…</span>}<button className="page-btn" onClick={() => onChange(totalPages-1)}>{totalPages}</button></>}
      <button className="page-btn" onClick={() => onChange(page+1)} disabled={page>=totalPages-1}>Sau →</button>
    </div>
  );
}

/* ════════════════ Main Page ════════════════ */
export default function MyBookingsPage() {
  const [bookings,     setBookings]     = useState([]);
  const [totalPages,   setTotalPages]   = useState(0);
  const [totalItems,   setTotalItems]   = useState(0);
  const [page,         setPage]         = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading,      setLoading]      = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling,   setCancelling]   = useState(false);
  const [toast,        setToast]        = useState(null);
  const [qrTarget,     setQrTarget]     = useState(null);

  const { notifications } = useNotifications();

  const STATUS_MAP = { BOOKING_CONFIRMED:'CONFIRMED', BOOKING_REJECTED:'REJECTED', BOOKING_CHECKED_IN:'CHECKED_IN', BOOKING_CHECKED_OUT:'CHECKED_OUT' };
  useEffect(() => {
    const latest = notifications[0];
    if (!latest?.referenceId) return;
    const newStatus = STATUS_MAP[latest.type];
    if (!newStatus) return;
    setBookings(prev => prev.map(b => b.id===latest.referenceId ? {...b,status:newStatus} : b));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  const showToast = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size:PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      const res = await getMyBookings(params);
      const data = res.data.data;
      setBookings(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setTotalItems(data.totalElements ?? 0);
    } catch { showToast('Không thể tải danh sách đặt phòng.','err'); }
    finally  { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = val => { setStatusFilter(val); setPage(0); };

  const handleCancelConfirm = async (reason) => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelBooking(cancelTarget.id, reason || null);
      showToast('Đã hủy đặt phòng thành công.');
      setCancelTarget(null); load();
    } catch (err) { showToast(err.response?.data?.message ?? 'Hủy thất bại. Vui lòng thử lại.','err'); }
    finally       { setCancelling(false); }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="mb-root">
        <Navbar />

        {/* Toast */}
        {toast && (
          <div className={`mb-toast ${toast.type==='err'?'mb-toast-err':'mb-toast-ok'}`}>
            <span className="mb-toast-dot" style={{background:toast.type==='err'?'#f87171':'#34d399'}} />
            {toast.msg}
          </div>
        )}

        {qrTarget && <QrModal booking={qrTarget} onClose={() => setQrTarget(null)} />}
        {cancelTarget && (
          <CancelModal booking={cancelTarget} loading={cancelling}
            onConfirm={handleCancelConfirm} onClose={() => setCancelTarget(null)} />
        )}

        <div className="mb-wrap">
          <div className="mb-title">Lịch sử đặt phòng</div>
          {!loading && <div className="mb-sub">{totalItems} đặt phòng</div>}

          {/* Filter tabs */}
          <div className="mb-tabs">
            {STATUS_FILTERS.map(f => (
              <button key={f.value} className={`mb-tab ${statusFilter===f.value?'active':''}`}
                onClick={() => handleFilterChange(f.value)}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="mb-grid">
              {[...Array(4)].map((_,i) => <div key={i} className="sk-card" />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="mb-empty">
              <div className="mb-empty-glyph">✦</div>
              <div className="mb-empty-title">{statusFilter ? 'Không có đặt phòng nào với trạng thái này' : 'Bạn chưa có đặt phòng nào'}</div>
              <div className="mb-empty-sub">Khám phá khách sạn và đặt phòng ngay hôm nay</div>
              <Link to="/" className="mb-empty-btn">Tìm khách sạn ngay</Link>
            </div>
          ) : (
            <>
              <div className="mb-grid">
                {bookings.map(b => (
                  <BookingCard key={b.id} booking={b}
                    onCancelClick={setCancelTarget}
                    onQrClick={setQrTarget} />
                ))}
              </div>
              {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages}
                  onChange={p => { setPage(p); window.scrollTo({top:0,behavior:'smooth'}); }} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}