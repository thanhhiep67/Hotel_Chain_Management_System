import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  getBookingById, confirmBooking, rejectBooking,
  checkInBooking, checkOutBooking,
} from '../api/bookings';
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
const PAYMENT_META = {
  UNPAID:   { label:'Chưa thanh toán', dot:'#F59E0B' },
  PAID:     { label:'Đã thanh toán',   dot:'#10B981' },
  REFUNDED: { label:'Đã hoàn tiền',    dot:'#3B82F6' },
};
const TYPE_LABEL    = { STANDARD:'Standard', DELUXE:'Deluxe', SUITE:'Suite', FAMILY:'Family', SINGLE:'Single', DOUBLE:'Double', TWIN:'Twin' };
const STATUS_ORDER  = ['PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT'];
const TIMELINE_STEPS= [
  { key:'PENDING',     label:'Đặt phòng'  },
  { key:'CONFIRMED',   label:'Xác nhận'   },
  { key:'CHECKED_IN',  label:'Nhận phòng' },
  { key:'CHECKED_OUT', label:'Trả phòng'  },
];
const STATUS_MAP = {
  BOOKING_CONFIRMED:'CONFIRMED', BOOKING_REJECTED:'REJECTED',
  BOOKING_CHECKED_IN:'CHECKED_IN', BOOKING_CHECKED_OUT:'CHECKED_OUT',
};
const fmt   = d   => d ? new Date(d+'T00:00:00').toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
const fmtDt = iso => iso ? new Date(iso).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const nights= (ci,co) => !ci||!co ? 0 : Math.round((new Date(co+'T00:00:00')-new Date(ci+'T00:00:00'))/86400000);

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
  :root{
    --c-bg:#F7F6F4; --c-surf:#FFFFFF; --c-card:#FFFFFF;
    --c-bdr:rgba(0,0,0,0.08); --c-bdr2:rgba(0,0,0,0.13);
    --c-gold:#C9A84C; --c-gold-d:#8A6E30;
    --c-text:#1C1B18; --c-muted:#6B6860; --c-subtle:#A09D96;
    --r:14px; --t:all 0.2s cubic-bezier(0.4,0,0.2,1);
    --font-d:'Cormorant Garamond',Georgia,serif; --font-b:'Outfit',system-ui,sans-serif;
  }
  .hbd-root{background:var(--c-bg);color:var(--c-text);font-family:var(--font-b);min-height:100vh;}
  .hbd-wrap{max-width:680px;margin:0 auto;padding:28px 20px 72px;}

  /* back btn */
  .hbd-back{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--c-muted);background:none;border:none;cursor:pointer;transition:var(--t);margin-bottom:20px;font-family:var(--font-b);padding:0;}
  .hbd-back:hover{color:var(--c-gold);}

  /* page header */
  .hbd-page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px;}
  .hbd-hotel-name{font-family:var(--font-b);font-size:clamp(22px,3vw,30px);font-weight:600;color:var(--c-text);letter-spacing:-0.01em;line-height:1.2;}
  .hbd-hotel-addr{font-size:12px;color:var(--c-muted);margin-top:4px;}
  .hbd-status-badge{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1px solid;font-size:12px;font-weight:600;white-space:nowrap;flex-shrink:0;}
  .hbd-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}

  /* panels */
  .hbd-panel{background:var(--c-card);border:1px solid var(--c-bdr);border-radius:var(--r);overflow:hidden;margin-bottom:12px;}
  .hbd-panel-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--c-bdr);}
  .hbd-panel-title{font-size:13px;font-weight:600;color:var(--c-text);}
  .hbd-panel-sub{font-size:11px;color:var(--c-subtle);font-family:'Courier New',monospace;margin-top:1px;}
  .hbd-panel-body{padding:18px;}

  /* info rows */
  .hbd-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--c-bdr);}
  .hbd-row:last-child{border-bottom:none;padding-bottom:0;}
  .hbd-row:first-child{padding-top:0;}
  .hbd-row-label{font-size:12px;color:var(--c-muted);}
  .hbd-row-val{font-size:13px;font-weight:500;color:var(--c-text);text-align:right;}

  /* date cells */
  .hbd-date-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;}
  .hbd-date-cell{background:rgba(255,255,255,0.03);border:1px solid var(--c-bdr);border-radius:10px;padding:12px;}
  .hbd-date-label{font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--c-gold);margin-bottom:4px;}
  .hbd-date-val{font-size:14px;font-weight:600;color:var(--c-text);}

  /* note box */
  .hbd-note{font-size:12px;color:var(--c-muted);background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.18);border-radius:9px;padding:10px 14px;line-height:1.6;margin-top:12px;}
  .hbd-note-red{background:rgba(239,68,68,0.06);border-color:rgba(239,68,68,0.2);color:#f87171;}

  /* chat button */
  .hbd-chat-btn{display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 14px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:10px;color:var(--c-gold);font-size:13px;font-weight:600;cursor:pointer;transition:var(--t);font-family:var(--font-b);margin-top:12px;}
  .hbd-chat-btn:hover{background:rgba(201,168,76,0.15);border-color:rgba(201,168,76,0.35);}

  /* timeline */
  .hbd-timeline{display:flex;align-items:flex-start;gap:0;padding:4px 0;}
  .hbd-tl-step{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;}
  .hbd-tl-step:last-child{flex:0;min-width:48px;}
  .hbd-tl-node{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid;transition:var(--t);flex-shrink:0;}
  .hbd-tl-node.done{background:rgba(201,168,76,0.15);border-color:var(--c-gold);}
  .hbd-tl-node.active{background:var(--c-gold);border-color:var(--c-gold);}
  .hbd-tl-node.future{background:rgba(255,255,255,0.04);border-color:var(--c-bdr);}
  .hbd-tl-node-inner{width:10px;height:10px;border-radius:50%;}
  .hbd-tl-node-inner.done{background:var(--c-gold);}
  .hbd-tl-node-inner.active{background:#0A0A0B;}
  .hbd-tl-node-inner.future{background:rgba(255,255,255,0.15);}
  .hbd-tl-label{font-size:11px;text-align:center;line-height:1.3;font-weight:500;}
  .hbd-tl-label.done{color:var(--c-gold);}
  .hbd-tl-label.active{color:var(--c-gold);font-weight:700;}
  .hbd-tl-label.future{color:var(--c-subtle);}
  .hbd-tl-line{flex:1;height:1.5px;margin-top:17px;transition:var(--t);}
  .hbd-tl-line.done{background:linear-gradient(90deg,var(--c-gold),var(--c-gold-d));}
  .hbd-tl-line.future{background:var(--c-bdr);}

  /* cancelled timeline */
  .hbd-tl-cancelled{display:flex;align-items:flex-start;gap:0;}
  .hbd-tl-c-node{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid var(--c-gold);background:rgba(201,168,76,0.1);flex-shrink:0;}
  .hbd-tl-c-inner{width:10px;height:10px;border-radius:50%;background:var(--c-gold);}
  .hbd-tl-c-line{flex:1;height:1.5px;margin-top:17px;background:linear-gradient(90deg,var(--c-gold-d),rgba(239,68,68,0.4));}
  .hbd-tl-c-end-node{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.1);flex-shrink:0;}
  .hbd-tl-c-end-inner{width:10px;height:10px;border-radius:50%;background:#f87171;}
  .hbd-tl-cancelled-labels{display:flex;justify-content:space-between;margin-top:6px;}
  .hbd-tl-cancelled-label{font-size:11px;font-weight:500;}

  /* payment */
  .hbd-payment-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.05);border:1px solid var(--c-bdr);font-size:11px;font-weight:600;color:var(--c-muted);}
  .hbd-payment-dot{width:5px;height:5px;border-radius:50%;}
  .hbd-price-total{font-family:var(--font-b);font-size:28px;font-weight:600;color:var(--c-gold);}
  .hbd-discount-row{color:#4ade80;}

  /* action buttons */
  .hbd-actions{display:flex;flex-direction:column;gap:10px;}
  .hbd-action-row{display:flex;gap:8px;}
  .hbd-btn{flex:1;padding:13px;border-radius:11px;font-size:13px;font-weight:700;cursor:pointer;transition:var(--t);font-family:var(--font-b);border:none;white-space:nowrap;}
  .hbd-btn-confirm{background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.25);}
  .hbd-btn-confirm:hover{background:rgba(16,185,129,0.25);border-color:rgba(16,185,129,0.4);}
  .hbd-btn-reject{background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2);}
  .hbd-btn-reject:hover{background:rgba(239,68,68,0.2);}
  .hbd-btn-checkin{background:var(--c-gold);color:#0A0A0B;border:1px solid var(--c-gold);}
  .hbd-btn-checkin:hover{background:#e0bc5e;box-shadow:0 4px 16px rgba(201,168,76,0.3);}
  .hbd-btn-checkout{background:rgba(139,92,246,0.12);color:#a78bfa;border:1px solid rgba(139,92,246,0.25);}
  .hbd-btn-checkout:hover{background:rgba(139,92,246,0.22);}
  .hbd-qr-hint{font-size:12px;color:var(--c-subtle);text-align:center;margin-top:4px;}
  .hbd-qr-hint button{background:none;border:none;color:var(--c-gold);cursor:pointer;font-size:12px;font-family:var(--font-b);transition:var(--t);}
  .hbd-qr-hint button:hover{color:#e0bc5e;}

  /* booking id */
  .hbd-booking-id{text-align:center;padding-top:8px;font-size:11px;color:var(--c-subtle);font-family:'Courier New',monospace;}

  /* skeleton */
  .sk{background:linear-gradient(90deg,#1e1e22 25%,#252529 50%,#1e1e22 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:var(--r);border:1px solid var(--c-bdr);}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

  /* error */
  .hbd-error{text-align:center;padding:72px 20px;background:var(--c-card);border:1px solid var(--c-bdr);border-radius:var(--r);}
  .hbd-error-glyph{font-family:var(--font-b);font-size:48px;color:rgba(255,255,255,0.06);margin-bottom:12px;}
  .hbd-error-text{font-size:14px;color:var(--c-muted);margin-bottom:16px;}

  /* modal */
  .modal-bd{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);}
  .modal-box{background:var(--c-surf);border:1px solid var(--c-bdr2);border-radius:16px;width:100%;max-width:400px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.65);}
  .modal-header{padding:20px 22px 16px;border-bottom:1px solid var(--c-bdr);}
  .modal-title{font-family:var(--font-b);font-size:20px;font-weight:600;color:var(--c-text);}
  .modal-desc{font-size:13px;color:var(--c-muted);margin-top:4px;}
  .modal-body{padding:18px 22px;}
  .modal-label{font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--c-gold);margin-bottom:8px;}
  .modal-textarea{width:100%;background:rgba(255,255,255,0.04);border:1px solid var(--c-bdr);color:var(--c-text);font-family:var(--font-b);font-size:13px;border-radius:10px;padding:12px 14px;resize:none;outline:none;transition:var(--t);}
  .modal-textarea::placeholder{color:var(--c-subtle);}
  .modal-textarea:focus{border-color:rgba(239,68,68,0.4);background:rgba(239,68,68,0.04);}
  .modal-footer{display:flex;gap:8px;padding:14px 22px 20px;}
  .modal-btn{flex:1;padding:12px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:var(--t);font-family:var(--font-b);border:none;}
  .modal-btn-cancel{background:rgba(255,255,255,0.05);border:1px solid var(--c-bdr);color:var(--c-muted);}
  .modal-btn-cancel:hover{color:var(--c-text);border-color:var(--c-bdr2);}
  .modal-btn-cancel:disabled{opacity:0.4;cursor:not-allowed;}
  .modal-btn-action{color:#fff;}
  .modal-btn-action:disabled{opacity:0.4;cursor:not-allowed;}

  /* toast */
  .hbd-toast{position:fixed;top:20px;right:20px;z-index:60;padding:12px 20px;background:#111113;border-radius:12px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);}
  .hbd-toast-ok{border:1px solid rgba(74,222,128,0.3);color:#4ade80;}
  .hbd-toast-err{border:1px solid rgba(248,113,113,0.3);color:#f87171;}
  .hbd-toast-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}

  @media(max-width:500px){.hbd-wrap{padding:20px 14px 48px;}.hbd-action-row{flex-direction:column;}}
`;

/* ─── StatusBadge ────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span className="hbd-status-badge" style={{background:m.bg,color:m.text,borderColor:m.border}}>
      <span className="hbd-status-dot" style={{background:m.dot}} />
      {m.label}
    </span>
  );
}

/* ─── Timeline ───────────────────────────────────────────────── */
function Timeline({ status }) {
  const isCancelled = status === 'CANCELLED';
  const isRejected  = status === 'REJECTED';

  if (isCancelled || isRejected) {
    return (
      <div>
        <div className="hbd-tl-cancelled">
          <div className="hbd-tl-c-node"><div className="hbd-tl-c-inner" /></div>
          <div className="hbd-tl-c-line" />
          <div className="hbd-tl-c-end-node"><div className="hbd-tl-c-end-inner" /></div>
        </div>
        <div className="hbd-tl-cancelled-labels">
          <span className="hbd-tl-cancelled-label" style={{color:'var(--c-gold)'}}>Đặt phòng</span>
          <span className="hbd-tl-cancelled-label" style={{color:'#f87171'}}>
            {isCancelled ? 'Đã hủy' : 'Bị từ chối'}
          </span>
        </div>
      </div>
    );
  }

  const currentIdx = STATUS_ORDER.indexOf(status);
  return (
    <div>
      <div className="hbd-timeline">
        {TIMELINE_STEPS.map((step, i) => {
          const idx     = STATUS_ORDER.indexOf(step.key);
          const isDone  = idx < currentIdx;
          const isActive= idx === currentIdx;
          const state   = isDone ? 'done' : isActive ? 'active' : 'future';
          return (
            <div key={step.key} style={{display:'flex',alignItems:'flex-start',flex: i < TIMELINE_STEPS.length-1 ? 1 : 0}}>
              <div className="hbd-tl-step" style={{minWidth:'48px'}}>
                <div className={`hbd-tl-node ${state}`}>
                  <div className={`hbd-tl-node-inner ${state}`} />
                </div>
                <span className={`hbd-tl-label ${state}`}>{step.label}</span>
              </div>
              {i < TIMELINE_STEPS.length - 1 && (
                <div className={`hbd-tl-line ${isDone ? 'done' : 'future'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── RejectModal ────────────────────────────────────────────── */
function RejectModal({ booking, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-bd" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Từ chối đặt phòng</div>
          <div className="modal-desc">Phòng {booking.roomNumber} · {fmt(booking.checkIn)} → {fmt(booking.checkOut)}</div>
        </div>
        <div className="modal-body">
          <div className="modal-label">Lý do từ chối <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--c-subtle)',fontSize:'11px'}}>(bắt buộc)</span></div>
          <textarea className="modal-textarea" rows={3} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ví dụ: phòng đã hết, sai thông tin..." />
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-cancel" onClick={onClose} disabled={loading}>Hủy</button>
          <button className="modal-btn modal-btn-action" disabled={loading||!reason.trim()}
            onClick={() => onConfirm(reason)} style={{background:'rgba(239,68,68,0.8)'}}>
            {loading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ConfirmModal ───────────────────────────────────────────── */
function ConfirmModal({ title, desc, confirmLabel, confirmBg, onConfirm, onClose, loading }) {
  return (
    <div className="modal-bd" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <div className="modal-desc">{desc}</div>
        </div>
        <div className="modal-footer" style={{borderTop:'none',paddingTop:'20px'}}>
          <button className="modal-btn modal-btn-cancel" onClick={onClose} disabled={loading}>Hủy</button>
          <button className="modal-btn modal-btn-action" disabled={loading}
            onClick={onConfirm} style={{background:confirmBg}}>
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════ Main Page ════════════════ */
export default function HotelBookingDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const user     = JSON.parse(localStorage.getItem('user') ?? 'null');
  const backPath = user?.role === 'OWNER' ? '/owner/bookings' : '/staff/bookings';

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [toast,   setToast]   = useState(null);
  const [modal,   setModal]   = useState(null);
  const [acting,  setActing]  = useState(false);

  const { notifications } = useNotifications();
  const mountTime = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await getBookingById(id);
      setBooking(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Không thể tải thông tin đặt phòng');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const latest = notifications[0];
    if (!latest?.referenceId || latest.referenceId !== id) return;
    if (latest.receivedAt && new Date(latest.receivedAt).getTime() < mountTime.current) return;
    const newStatus = STATUS_MAP[latest.type];
    if (!newStatus) return;
    setBooking(prev => prev ? {...prev, status:newStatus} : prev);
    showToast(`Trạng thái: ${STATUS_META[newStatus]?.label ?? newStatus}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  const showToast = (msg, type='ok') => {
    setToast({msg,type}); setTimeout(() => setToast(null), 3000);
  };
  const runAction = async (fn, successMsg) => {
    setActing(true);
    try { await fn(); showToast(successMsg); setModal(null); load(); }
    catch (err) { showToast(err.response?.data?.message ?? 'Thao tác thất bại.', 'err'); }
    finally     { setActing(false); }
  };

  /* ── Loading ── */
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="hbd-root">
        <Navbar />
        <div className="hbd-wrap">
          {[...Array(4)].map((_,i) => <div key={i} className="sk" style={{height:'120px',marginBottom:'12px'}} />)}
        </div>
      </div>
    </>
  );

  /* ── Error ── */
  if (error || !booking) return (
    <>
      <style>{CSS}</style>
      <div className="hbd-root">
        <Navbar />
        <div className="hbd-wrap">
          <div className="hbd-error">
            <div className="hbd-error-glyph">✦</div>
            <div className="hbd-error-text">{error || 'Không tìm thấy đặt phòng'}</div>
            <button className="hbd-back" onClick={() => navigate(backPath)}>← Quay lại danh sách</button>
          </div>
        </div>
      </div>
    </>
  );

  const n           = nights(booking.checkIn, booking.checkOut);
  const payMeta     = PAYMENT_META[booking.paymentStatus] ?? PAYMENT_META.UNPAID;
  const threadId    = `${booking.userId}_${booking.hotelId}`;
  const canConfirm  = booking.status === 'PENDING';
  const canReject   = booking.status === 'PENDING';
  const canCheckIn  = booking.status === 'CONFIRMED';
  const canCheckOut = booking.status === 'CHECKED_IN';

  return (
    <>
      <style>{CSS}</style>
      <div className="hbd-root">
        <Navbar />

        {/* Toast */}
        {toast && (
          <div className={`hbd-toast ${toast.type==='err' ? 'hbd-toast-err' : 'hbd-toast-ok'}`}>
            <span className="hbd-toast-dot" style={{background:toast.type==='err'?'#f87171':'#4ade80'}} />
            {toast.msg}
          </div>
        )}

        {/* Modals */}
        {modal==='reject' && (
          <RejectModal booking={booking} loading={acting} onClose={() => setModal(null)}
            onConfirm={reason => runAction(() => rejectBooking(id, reason), 'Đã từ chối đặt phòng')} />
        )}
        {modal==='confirm' && (
          <ConfirmModal title="Xác nhận đặt phòng"
            desc={`Phòng ${booking.roomNumber} · ${fmt(booking.checkIn)} → ${fmt(booking.checkOut)}`}
            confirmLabel="Xác nhận" confirmBg="rgba(16,185,129,0.85)"
            loading={acting} onClose={() => setModal(null)}
            onConfirm={() => runAction(() => confirmBooking(id), 'Đã xác nhận đặt phòng')} />
        )}
        {modal==='checkin' && (
          <ConfirmModal title="Check-in cho khách"
            desc={`Xác nhận khách ${booking.guestName ?? 'này'} đã nhận phòng ${booking.roomNumber}?`}
            confirmLabel="Check-in" confirmBg="var(--c-gold)"
            loading={acting} onClose={() => setModal(null)}
            onConfirm={() => runAction(() => checkInBooking(id), 'Check-in thành công')} />
        )}
        {modal==='checkout' && (
          <ConfirmModal title="Check-out cho khách"
            desc={`Xác nhận khách ${booking.guestName ?? 'này'} đã trả phòng ${booking.roomNumber}?`}
            confirmLabel="Check-out" confirmBg="rgba(139,92,246,0.85)"
            loading={acting} onClose={() => setModal(null)}
            onConfirm={() => runAction(() => checkOutBooking(id), 'Check-out thành công')} />
        )}

        <div className="hbd-wrap">
          {/* Back */}
          <button className="hbd-back" onClick={() => navigate(backPath)}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Danh sách đặt phòng
          </button>

          {/* Page header */}
          <div className="hbd-page-header">
            <div>
              <div className="hbd-hotel-name">{booking.hotelName ?? '—'}</div>
              <div className="hbd-hotel-addr">{booking.hotelAddress}{booking.hotelCity ? `, ${booking.hotelCity}` : ''}</div>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          {/* ── Guest info ── */}
          <div className="hbd-panel">
            <div className="hbd-panel-header">
              <div className="hbd-panel-title">Thông tin khách</div>
            </div>
            <div className="hbd-panel-body">
              <div className="hbd-row">
                <span className="hbd-row-label">Họ tên</span>
                <span className="hbd-row-val">{booking.guestName ?? '—'}</span>
              </div>
              {booking.guestEmail && (
                <div className="hbd-row">
                  <span className="hbd-row-label">Email</span>
                  <a href={`mailto:${booking.guestEmail}`}
                    style={{fontSize:'13px',fontWeight:500,color:'var(--c-gold)',textDecoration:'none'}}>
                    {booking.guestEmail}
                  </a>
                </div>
              )}
              <button className="hbd-chat-btn" onClick={() => navigate(`/chat/${threadId}?bookingId=${booking.id}`)}>
                <span>Nhắn tin với khách</span>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ── Booking info ── */}
          <div className="hbd-panel">
            <div className="hbd-panel-header">
              <div>
                <div className="hbd-panel-title">Thông tin đặt phòng</div>
                <div className="hbd-panel-sub">#{id.slice(-8).toUpperCase()}</div>
              </div>
            </div>
            <div className="hbd-panel-body">
              <div className="hbd-row">
                <span className="hbd-row-label">Phòng</span>
                <span className="hbd-row-val">
                  {booking.roomNumber ?? '—'}
                  {booking.roomType && (
                    <span style={{fontWeight:400,color:'var(--c-muted)',marginLeft:'6px'}}>
                      · {TYPE_LABEL[booking.roomType] ?? booking.roomType}
                    </span>
                  )}
                </span>
              </div>

              <div className="hbd-date-grid">
                <div className="hbd-date-cell">
                  <div className="hbd-date-label">Nhận phòng</div>
                  <div className="hbd-date-val">{fmt(booking.checkIn)}</div>
                </div>
                <div className="hbd-date-cell">
                  <div className="hbd-date-label">Trả phòng</div>
                  <div className="hbd-date-val">{fmt(booking.checkOut)}</div>
                </div>
              </div>

              <div className="hbd-row" style={{borderTop:'1px solid var(--c-bdr)',paddingTop:'10px',marginTop:'4px'}}>
                <span className="hbd-row-label">Số đêm</span>
                <span className="hbd-row-val">{n} đêm</span>
              </div>
              <div className="hbd-row">
                <span className="hbd-row-label">Số khách</span>
                <span className="hbd-row-val">{booking.guestCount ?? 1} người</span>
              </div>
              {booking.confirmedAt && (
                <div className="hbd-row">
                  <span className="hbd-row-label">Xác nhận lúc</span>
                  <span className="hbd-row-val">{fmtDt(booking.confirmedAt)}</span>
                </div>
              )}
              <div className="hbd-row">
                <span className="hbd-row-label">Ngày đặt</span>
                <span className="hbd-row-val">{fmtDt(booking.createdAt)}</span>
              </div>
              {booking.specialRequests && (
                <div className="hbd-note" style={{marginTop:'14px'}}>
                  <div style={{fontSize:'10px',fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--c-gold)',marginBottom:'5px'}}>Yêu cầu đặc biệt</div>
                  {booking.specialRequests}
                </div>
              )}
              {booking.cancelReason && (
                <div className="hbd-note hbd-note-red" style={{marginTop:'10px'}}>
                  <div style={{fontSize:'10px',fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',color:'#f87171',marginBottom:'5px'}}>
                    Lý do {booking.status==='REJECTED'?'từ chối':'hủy'}
                  </div>
                  {booking.cancelReason}
                </div>
              )}
            </div>
          </div>

          {/* ── Timeline ── */}
          <div className="hbd-panel">
            <div className="hbd-panel-header">
              <div className="hbd-panel-title">Tiến trình</div>
            </div>
            <div className="hbd-panel-body">
              <Timeline status={booking.status} />
            </div>
          </div>

          {/* ── Payment ── */}
          <div className="hbd-panel">
            <div className="hbd-panel-header">
              <div className="hbd-panel-title">Thanh toán</div>
              <div className="hbd-payment-badge">
                <span className="hbd-payment-dot" style={{background:payMeta.dot}} />
                {payMeta.label}
              </div>
            </div>
            <div className="hbd-panel-body">
              {booking.pricePerNight != null && (
                <div className="hbd-row">
                  <span className="hbd-row-label">{(booking.pricePerNight??0).toLocaleString('vi-VN')} ₫ × {n} đêm</span>
                  <span className="hbd-row-val">{(booking.originalPrice??0).toLocaleString('vi-VN')} ₫</span>
                </div>
              )}
              {(booking.discountAmount??0) > 0 && (
                <div className="hbd-row hbd-discount-row">
                  <span style={{fontSize:'12px',color:'#4ade80'}}>Giảm giá</span>
                  <span style={{fontSize:'13px',fontWeight:500,color:'#4ade80'}}>− {(booking.discountAmount??0).toLocaleString('vi-VN')} ₫</span>
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'14px',marginTop:'4px',borderTop:'1px solid var(--c-bdr)'}}>
                <span style={{fontSize:'13px',fontWeight:600,color:'var(--c-text)'}}>Tổng cộng</span>
                <span className="hbd-price-total">{(booking.totalPrice??0).toLocaleString('vi-VN')} ₫</span>
              </div>
            </div>
          </div>

          {/* ── Actions ── */}
          {(canConfirm || canCheckIn || canCheckOut) && (
            <div className="hbd-panel">
              <div className="hbd-panel-header">
                <div className="hbd-panel-title">Thao tác</div>
              </div>
              <div className="hbd-panel-body">
                <div className="hbd-actions">
                  {canConfirm && (
                    <div className="hbd-action-row">
                      <button className="hbd-btn hbd-btn-confirm" onClick={() => setModal('confirm')}>
                        ✓ Xác nhận đặt phòng
                      </button>
                      {canReject && (
                        <button className="hbd-btn hbd-btn-reject" onClick={() => setModal('reject')}>
                          ✕ Từ chối
                        </button>
                      )}
                    </div>
                  )}
                  {canCheckIn && (
                    <>
                      <button className="hbd-btn hbd-btn-checkin" onClick={() => setModal('checkin')}>
                        Check-in cho khách
                      </button>
                      <div className="hbd-qr-hint">
                        Hoặc dùng{' '}
                        <button onClick={() => navigate('/staff/check-in')}>trang quét QR</button>
                        {' '}để xác minh mã của khách
                      </div>
                    </>
                  )}
                  {canCheckOut && (
                    <button className="hbd-btn hbd-btn-checkout" onClick={() => setModal('checkout')}>
                      Check-out cho khách
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="hbd-booking-id">Mã đặt phòng: {id}</div>
        </div>
      </div>
    </>
  );
}