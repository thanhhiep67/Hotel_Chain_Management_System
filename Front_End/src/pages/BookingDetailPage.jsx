import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getBookingById, cancelBooking, getCheckInQr } from '../api/bookings';
import { useNotifications } from '../context/NotificationContext';

/* ─── constants (unchanged) ─────────────────────────────────── */
const STATUS_META = {
  PENDING:     { label:'Chờ xác nhận', dot:'#F59E0B', bg:'#FFFBEB', text:'#D97706', border:'#FDE68A' },
  CONFIRMED:   { label:'Đã xác nhận',  dot:'#3B82F6', bg:'#EFF6FF', text:'#2563EB', border:'#BFDBFE' },
  CHECKED_IN:  { label:'Đang lưu trú', dot:'#10B981', bg:'#ECFDF5', text:'#059669', border:'#A7F3D0' },
  CHECKED_OUT: { label:'Đã trả phòng', dot:'#9CA3AF', bg:'#F9FAFB', text:'#6B7280', border:'#E5E7EB' },
  CANCELLED:   { label:'Đã hủy',       dot:'#EF4444', bg:'#FEF2F2', text:'#DC2626', border:'#FECACA' },
  REJECTED:    { label:'Bị từ chối',   dot:'#F97316', bg:'#FFF7ED', text:'#EA580C', border:'#FED7AA' },
};
const PAYMENT_META = {
  UNPAID:   { label:'Chưa thanh toán', dot:'#F59E0B', bg:'#FFFBEB', text:'#D97706', border:'#FDE68A' },
  PAID:     { label:'Đã thanh toán',   dot:'#10B981', bg:'#ECFDF5', text:'#059669', border:'#A7F3D0' },
  REFUNDED: { label:'Đã hoàn tiền',    dot:'#3B82F6', bg:'#EFF6FF', text:'#2563EB', border:'#BFDBFE' },
};
const TYPE_LABEL = { STANDARD:'Standard', DELUXE:'Deluxe', SUITE:'Suite', FAMILY:'Family' };
const STATUS_ORDER   = ['PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT'];
const TIMELINE_STEPS = [
  { key:'PENDING',     label:'Đặt phòng'  },
  { key:'CONFIRMED',   label:'Xác nhận'   },
  { key:'CHECKED_IN',  label:'Nhận phòng' },
  { key:'CHECKED_OUT', label:'Trả phòng'  },
];
const STATUS_MAP = {
  BOOKING_CONFIRMED:'CONFIRMED', BOOKING_REJECTED:'REJECTED',
  BOOKING_CHECKED_IN:'CHECKED_IN', BOOKING_CHECKED_OUT:'CHECKED_OUT',
};
const fmt   = d   => d   ? new Date(d+'T00:00:00').toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
const fmtDt = iso => iso ? new Date(iso).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const nights= (ci,co) => !ci||!co ? 0 : Math.round((new Date(co+'T00:00:00')-new Date(ci+'T00:00:00'))/86400000);
function canCancel(b) {
  if (b.status!=='PENDING'&&b.status!=='CONFIRMED') return false;
  const today=new Date(); today.setHours(0,0,0,0);
  return (new Date(b.checkIn+'T00:00:00')-today)/86400000>1;
}

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
  :root{
    --c-bg:#F7F6F4; --c-white:#FFFFFF; --c-border:rgba(0,0,0,0.08);
    --c-border2:rgba(0,0,0,0.13); --c-gold:#C9A84C; --c-gold-d:#8A6E30;
    --c-dark:#0A0A0B; --c-text:#1C1B18; --c-muted:#6B6860;
    --c-subtle:#A09D96; --r:14px; --t:all 0.2s cubic-bezier(0.4,0,0.2,1);
    --font-d:'Cormorant Garamond',Georgia,serif; --font-b:'Outfit',system-ui,sans-serif;
    --shadow:0 1px 4px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04);
  }
  .bd-root{background:var(--c-bg);color:var(--c-text);font-family:var(--font-b);font-size:14px;min-height:100vh;}
  .bd-wrap{max-width:640px;margin:0 auto;padding:28px 20px 72px;}

  /* back */
  .bd-back{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--c-muted);background:none;border:none;cursor:pointer;transition:var(--t);margin-bottom:20px;font-family:var(--font-b);padding:0;}
  .bd-back:hover{color:var(--c-gold);}

  /* page header */
  .bd-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px;}
  .bd-hotel-name{font-family:var(--font-b);font-size:clamp(22px,3vw,28px);font-weight:600;color:var(--c-text);letter-spacing:-0.01em;line-height:1.2;}
  .bd-hotel-addr{font-size:12px;color:var(--c-muted);margin-top:4px;}
  .bd-status-badge{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1px solid;font-size:11px;font-weight:600;white-space:nowrap;flex-shrink:0;}
  .bd-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}

  /* panels */
  .bd-panel{background:var(--c-white);border:1px solid var(--c-border);border-radius:var(--r);overflow:hidden;margin-bottom:10px;box-shadow:var(--shadow);}
  .bd-panel-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid var(--c-border);}
  .bd-panel-title{font-size:13px;font-weight:600;color:var(--c-text);}
  .bd-panel-body{padding:16px 18px;}

  /* rows */
  .bd-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--c-border);}
  .bd-row:last-child{border-bottom:none;padding-bottom:0;}
  .bd-row:first-child{padding-top:0;}
  .bd-row-label{font-size:12px;color:var(--c-muted);}
  .bd-row-val{font-size:13px;font-weight:500;color:var(--c-text);text-align:right;}

  /* date cells */
  .bd-date-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0;}
  .bd-date-cell{background:var(--c-bg);border:1px solid var(--c-border);border-radius:10px;padding:12px;}
  .bd-date-label{font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--c-gold);margin-bottom:4px;}
  .bd-date-val{font-size:14px;font-weight:600;color:var(--c-text);}

  /* note boxes */
  .bd-note{font-size:12px;line-height:1.6;border-radius:9px;padding:10px 14px;margin-top:12px;}
  .bd-note-amber{background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);color:#D4A843;}
  .bd-note-red{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);color:#f87171;}

  /* timeline */
  .bd-timeline{display:flex;align-items:flex-start;}
  .bd-tl-step{display:flex;flex-direction:column;align-items:center;gap:6px;flex:0;min-width:52px;}
  .bd-tl-node{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid;transition:var(--t);}
  .bd-tl-node.done{background:rgba(201,168,76,0.15);border-color:#C9A84C;}
  .bd-tl-node.active{background:#C9A84C;border-color:#C9A84C;}
  .bd-tl-node.future{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.12);}
  .bd-tl-inner{width:10px;height:10px;border-radius:50%;}
  .bd-tl-inner.done{background:#C9A84C;}
  .bd-tl-inner.active{background:#1C1917;}
  .bd-tl-inner.future{background:rgba(255,255,255,0.2);}
  .bd-tl-label{font-size:10px;font-weight:600;text-align:center;line-height:1.3;letter-spacing:0.04em;}
  .bd-tl-label.done,.bd-tl-label.active{color:var(--c-gold);}
  .bd-tl-label.future{color:var(--c-subtle);}
  .bd-tl-line{flex:1;height:1.5px;margin-top:16px;}
  .bd-tl-line.done{background:linear-gradient(90deg,#C9A84C,#D4A843);}
  .bd-tl-line.future{background:rgba(255,255,255,0.08);}

  /* cancelled timeline */
  .bd-tl-c{display:flex;align-items:flex-start;}
  .bd-tl-c-node{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid #C9A84C;background:rgba(201,168,76,0.15);flex-shrink:0;}
  .bd-tl-c-inner{width:10px;height:10px;border-radius:50%;background:#C9A84C;}
  .bd-tl-c-line{flex:1;height:1.5px;margin-top:16px;background:linear-gradient(90deg,#C9A84C,rgba(239,68,68,0.4));}
  .bd-tl-c-end{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.1);flex-shrink:0;}
  .bd-tl-c-end-inner{width:10px;height:10px;border-radius:50%;background:#EF4444;}
  .bd-tl-c-labels{display:flex;justify-content:space-between;margin-top:6px;}

  /* payment badge */
  .bd-pay-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;border:1px solid;font-size:11px;font-weight:600;}
  .bd-pay-dot{width:5px;height:5px;border-radius:50%;}

  /* price total */
  .bd-price-total{font-family:var(--font-b);font-size:26px;font-weight:600;color:var(--c-gold);}

  /* payment timeline */
  .bd-pay-timeline{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--c-border);}
  .bd-pay-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}
  .bd-pay-dot-sm{width:6px;height:6px;border-radius:50%;flex-shrink:0;}

  /* QR card */
  .bd-qr-panel{background:var(--c-white);border:1px solid var(--c-border);border-radius:var(--r);overflow:hidden;margin-bottom:10px;box-shadow:var(--shadow);}
  .bd-qr-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid var(--c-border);}
  .bd-qr-title{font-size:13px;font-weight:600;color:var(--c-text);}
  .bd-qr-sub{font-size:11px;color:var(--c-muted);margin-top:2px;}
  .bd-qr-body{padding:20px;display:flex;flex-direction:column;align-items:center;gap:14px;}
  .bd-qr-box{width:200px;height:200px;background:var(--c-bg);border:1px solid var(--c-border);border-radius:12px;display:flex;align-items:center;justify-content:center;overflow:hidden;}
  .bd-qr-box img{width:100%;height:100%;object-fit:contain;padding:12px;}
  .bd-qr-spinner{width:28px;height:28px;border:2px solid var(--c-gold);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .bd-qr-expired{text-align:center;}
  .bd-qr-expired-glyph{font-size:28px;color:var(--c-subtle);margin-bottom:6px;}
  .bd-qr-expired-text{font-size:12px;color:var(--c-muted);margin-bottom:10px;}
  .bd-qr-expired-btn{padding:7px 16px;background:var(--c-gold);color:#0A0A0B;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:var(--t);font-family:var(--font-b);}
  .bd-qr-expired-btn:hover{background:#e0bc5e;}
  .bd-qr-timer-row{display:flex;justify-content:space-between;align-items:center;width:100%;}
  .bd-qr-timer{font-size:12px;font-weight:600;font-family:'Courier New',monospace;}
  .bd-qr-actions{display:flex;gap:12px;}
  .bd-qr-btn{font-size:12px;background:none;border:none;cursor:pointer;transition:var(--t);font-family:var(--font-b);}
  .bd-qr-btn-download{color:var(--c-muted);}
  .bd-qr-btn-download:hover{color:var(--c-text);}
  .bd-qr-btn-refresh{color:var(--c-gold);}
  .bd-qr-btn-refresh:hover{color:#e0bc5e;}
  .bd-qr-hint{font-size:12px;color:var(--c-muted);text-align:center;line-height:1.6;}

  /* buttons */
  .bd-btn-pay{width:100%;padding:14px;background:var(--c-dark);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;transition:var(--t);font-family:var(--font-b);margin-bottom:10px;}
  .bd-btn-pay:hover:not(:disabled){background:var(--c-gold);color:var(--c-dark);}
  .bd-btn-pay:disabled{opacity:0.4;cursor:not-allowed;}
  .bd-btn-chat{display:flex;align-items:center;justify-content:space-between;width:100%;padding:14px 18px;background:var(--c-white);border:1px solid var(--c-border);border-radius:12px;cursor:pointer;transition:var(--t);font-family:var(--font-b);margin-bottom:10px;box-shadow:var(--shadow);text-decoration:none;}
  .bd-btn-chat:hover{border-color:var(--c-gold);background:#FFFBEB;}
  .bd-btn-chat-left{display:flex;flex-direction:column;gap:2px;text-align:left;}
  .bd-btn-chat-title{font-size:13px;font-weight:600;color:var(--c-text);}
  .bd-btn-chat-sub{font-size:11px;color:var(--c-muted);}
  .bd-btn-cancel{width:100%;padding:13px;background:none;border:1px solid #FECACA;color:#DC2626;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer;transition:var(--t);font-family:var(--font-b);margin-bottom:10px;}
  .bd-btn-cancel:hover{background:#FEF2F2;}
  .bd-booking-id{text-align:center;font-size:11px;color:var(--c-subtle);font-family:'Courier New',monospace;padding-top:8px;}

  /* modal */
  .modal-bd{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);}
  .modal-box{background:var(--c-white);border:1px solid var(--c-border);border-radius:16px;width:100%;max-width:400px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.15);}
  .modal-header{padding:20px 22px 14px;}
  .modal-title{font-family:var(--font-b);font-size:20px;font-weight:600;color:var(--c-text);}
  .modal-desc{font-size:13px;color:var(--c-muted);margin-top:4px;line-height:1.5;}
  .modal-body{padding:4px 22px 16px;}
  .modal-label{font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--c-gold);margin-bottom:6px;}
  .modal-textarea{width:100%;background:var(--c-bg);border:1px solid var(--c-border);color:var(--c-text);font-family:var(--font-b);font-size:13px;border-radius:10px;padding:12px 14px;resize:none;outline:none;transition:var(--t);}
  .modal-textarea::placeholder{color:var(--c-subtle);}
  .modal-textarea:focus{border-color:var(--c-gold);}
  .modal-footer{display:flex;gap:8px;padding:12px 22px 20px;}
  .modal-btn{flex:1;padding:12px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:var(--t);font-family:var(--font-b);border:none;}
  .modal-btn-keep{background:var(--c-bg);border:1px solid var(--c-border);color:var(--c-muted);}
  .modal-btn-keep:hover{color:var(--c-text);border-color:var(--c-border2);}
  .modal-btn-keep:disabled{opacity:0.4;cursor:not-allowed;}
  .modal-btn-cancel-ok{background:#EF4444;color:#fff;}
  .modal-btn-cancel-ok:hover:not(:disabled){background:#DC2626;}
  .modal-btn-cancel-ok:disabled{opacity:0.4;cursor:not-allowed;}

  /* skeleton */
  .sk{background:linear-gradient(90deg,#ECEAE4 25%,#F4F2EC 50%,#ECEAE4 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:var(--r);border:1px solid var(--c-border);}
  @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

  /* toast */
  .bd-toast{position:fixed;top:20px;right:20px;z-index:60;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);}
  .bd-toast-ok{background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46;}
  .bd-toast-err{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;}
  .bd-toast-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}

  @media(max-width:500px){.bd-wrap{padding:20px 14px 48px;}}
`;

/* ─── StatusBadge ────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span className="bd-status-badge" style={{background:m.bg,color:m.text,borderColor:m.border}}>
      <span className="bd-status-dot" style={{background:m.dot}} />
      {m.label}
    </span>
  );
}

/* ─── Timeline ───────────────────────────────────────────────── */
function Timeline({ status }) {
  const isCancelled = status === 'CANCELLED';
  const isRejected  = status === 'REJECTED';

  if (isCancelled || isRejected) return (
    <div>
      <div className="bd-tl-c">
        <div className="bd-tl-c-node"><div className="bd-tl-c-inner" /></div>
        <div className="bd-tl-c-line" />
        <div className="bd-tl-c-end"><div className="bd-tl-c-end-inner" /></div>
      </div>
      <div className="bd-tl-c-labels">
        <span style={{fontSize:'10px',fontWeight:600,color:'var(--c-gold)'}}>Đặt phòng</span>
        <span style={{fontSize:'10px',fontWeight:600,color:'#DC2626'}}>{isCancelled?'Đã hủy':'Bị từ chối'}</span>
      </div>
    </div>
  );

  const currentIdx = STATUS_ORDER.indexOf(status);
  return (
    <div className="bd-timeline">
      {TIMELINE_STEPS.map((step, i) => {
        const idx     = STATUS_ORDER.indexOf(step.key);
        const isDone  = idx < currentIdx;
        const isActive= idx === currentIdx;
        const state   = isDone ? 'done' : isActive ? 'active' : 'future';
        return (
          <div key={step.key} style={{display:'flex',alignItems:'flex-start',flex: i < TIMELINE_STEPS.length-1 ? 1 : 0}}>
            <div className="bd-tl-step">
              <div className={`bd-tl-node ${state}`}><div className={`bd-tl-inner ${state}`} /></div>
              <span className={`bd-tl-label ${state}`}>{step.label}</span>
            </div>
            {i < TIMELINE_STEPS.length-1 && (
              <div className={`bd-tl-line ${isDone ? 'done' : 'future'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── QrCard ─────────────────────────────────────────────────── */
function QrCard({ bookingId }) {
  const [qrUrl,       setQrUrl]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [secondsLeft, setSecondsLeft] = useState(900);
  const blobRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getCheckInQr(bookingId);
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      const url = URL.createObjectURL(res.data);
      blobRef.current = url;
      setQrUrl(url); setSecondsLeft(900);
    } catch { setError('Không thể tải mã QR. Vui lòng thử lại.'); }
    finally  { setLoading(false); }
  }, [bookingId]);

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
  const timerColor = secondsLeft < 60 ? '#DC2626' : secondsLeft < 180 ? '#D97706' : 'var(--c-muted)';

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl; a.download = `qr-checkin-${bookingId}.png`; a.click();
  };

  return (
    <div className="bd-qr-panel">
      <div className="bd-qr-header">
        <div>
          <div className="bd-qr-title">Mã QR nhận phòng</div>
          <div className="bd-qr-sub">Xuất trình cho nhân viên lễ tân khi đến</div>
        </div>
        <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'#FFFBEB',border:'1px solid #FDE68A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px'}}>
          📱
        </div>
      </div>
      <div className="bd-qr-body">
        <div className="bd-qr-box">
          {loading && <div className="bd-qr-spinner" />}
          {!loading && error && <p style={{fontSize:'11px',color:'#DC2626',textAlign:'center',padding:'12px'}}>{error}</p>}
          {!loading && qrUrl && !expired && <img src={qrUrl} alt="QR check-in" />}
          {!loading && expired && (
            <div className="bd-qr-expired">
              <div className="bd-qr-expired-glyph">⏱</div>
              <div className="bd-qr-expired-text">Mã đã hết hạn</div>
              <button className="bd-qr-expired-btn" onClick={load}>Tạo mã mới</button>
            </div>
          )}
        </div>

        {!loading && qrUrl && !expired && (
          <div className="bd-qr-timer-row">
            <span className="bd-qr-timer" style={{color:timerColor}}>⏱ {fmtTime(secondsLeft)} còn lại</span>
            <div className="bd-qr-actions">
              <button className="bd-qr-btn bd-qr-btn-download" onClick={handleDownload}>↓ Tải xuống</button>
              <button className="bd-qr-btn bd-qr-btn-refresh" onClick={load}>↺ Làm mới</button>
            </div>
          </div>
        )}

        <div className="bd-qr-hint">Xuất trình mã này cho nhân viên lễ tân<br />để nhận phòng không cần giấy tờ.</div>
      </div>
    </div>
  );
}

/* ─── CancelModal ────────────────────────────────────────────── */
function CancelModal({ booking, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="modal-bd" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Hủy đặt phòng</div>
          <div className="modal-desc">
            Phòng {booking.roomNumber} tại {booking.hotelName}<br />
            {fmt(booking.checkIn)} → {fmt(booking.checkOut)}
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-label">Lý do <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'var(--c-subtle)',fontSize:'11px'}}>(không bắt buộc)</span></div>
          <textarea className="modal-textarea" rows={3} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ví dụ: thay đổi kế hoạch..." />
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-keep" onClick={onClose} disabled={loading}>Giữ đặt phòng</button>
          <button className="modal-btn modal-btn-cancel-ok" disabled={loading} onClick={() => onConfirm(reason)}>
            {loading ? 'Đang hủy...' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════ Main Page ════════════════ */
export default function BookingDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { state }    = useLocation();

  const [booking,    setBooking]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [toast,      setToast]      = useState(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

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
    if (latest.type === 'BOOKING_PAID' || latest.type === 'PAYMENT_SUCCESS') {
      setBooking(prev => prev ? {...prev, paymentStatus:'PAID'} : prev);
      showToast('Thanh toán thành công! Email xác nhận đã được gửi.'); return;
    }
    if (latest.type === 'PAYMENT_FAILED') {
      showToast('Thanh toán thất bại. Vui lòng thử lại.', 'err'); return;
    }
    const newStatus = STATUS_MAP[latest.type];
    if (!newStatus) return;
    setBooking(prev => prev ? {...prev, status:newStatus} : prev);
    showToast(`Trạng thái cập nhật: ${STATUS_META[newStatus]?.label ?? newStatus}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  const showToast = (msg, type='ok') => { setToast({msg,type}); setTimeout(()=>setToast(null),4000); };

  // Show toast passed back from PaymentPage (cash flow)
  useEffect(() => {
    if (state?.successToast) {
      showToast(state.successToast);
      window.history.replaceState({}, '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelConfirm = async (reason) => {
    setCancelling(true);
    try { await cancelBooking(id, reason||null); showToast('Đã hủy đặt phòng thành công.'); setShowCancel(false); load(); }
    catch (err) { showToast(err.response?.data?.message ?? 'Hủy thất bại.','err'); }
    finally     { setCancelling(false); }
  };

  /* ── Loading ── */
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="bd-root"><Navbar />
        <div className="bd-wrap">
          {[...Array(4)].map((_,i) => <div key={i} className="sk" style={{height:'120px',marginBottom:'10px'}} />)}
        </div>
      </div>
    </>
  );

  /* ── Error ── */
  if (error || !booking) return (
    <>
      <style>{CSS}</style>
      <div className="bd-root"><Navbar />
        <div className="bd-wrap" style={{paddingTop:'48px',textAlign:'center'}}>
          <p style={{color:'var(--c-muted)',marginBottom:'16px'}}>{error || 'Không tìm thấy đặt phòng'}</p>
          <Link to="/my-bookings" style={{color:'var(--c-gold)',fontSize:'13px'}}>← Quay lại lịch sử</Link>
        </div>
      </div>
    </>
  );

  const n        = nights(booking.checkIn, booking.checkOut);
  const eligible = canCancel(booking);
  const payMeta  = PAYMENT_META[booking.paymentStatus] ?? PAYMENT_META.UNPAID;

  return (
    <>
      <style>{CSS}</style>
      <div className="bd-root">
        <Navbar />

        {toast && (
          <div className={`bd-toast ${toast.type==='err'?'bd-toast-err':'bd-toast-ok'}`}>
            <span className="bd-toast-dot" style={{background:toast.type==='err'?'#EF4444':'#10B981'}} />
            {toast.msg}
          </div>
        )}
        {showCancel && <CancelModal booking={booking} loading={cancelling} onConfirm={handleCancelConfirm} onClose={() => setShowCancel(false)} />}

        <div className="bd-wrap">
          {/* Back */}
          <button className="bd-back" onClick={() => navigate('/my-bookings')}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Lịch sử đặt phòng
          </button>

          {/* Header */}
          <div className="bd-header">
            <div>
              <div className="bd-hotel-name">{booking.hotelName ?? '—'}</div>
              <div className="bd-hotel-addr">{booking.hotelAddress}{booking.hotelCity ? `, ${booking.hotelCity}` : ''}</div>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          {/* ── Booking info ── */}
          <div className="bd-panel">
            <div className="bd-panel-header">
              <div className="bd-panel-title">Thông tin đặt phòng</div>
              <span style={{fontSize:'11px',color:'var(--c-subtle)',fontFamily:"'Courier New',monospace"}}>
                #{booking.id?.slice(-8).toUpperCase()}
              </span>
            </div>
            <div className="bd-panel-body">
              <div className="bd-row">
                <span className="bd-row-label">Phòng</span>
                <span className="bd-row-val">
                  {booking.roomNumber ?? '—'}
                  {booking.roomType && <span style={{fontWeight:400,color:'var(--c-muted)',marginLeft:'5px'}}>· {TYPE_LABEL[booking.roomType] ?? booking.roomType}</span>}
                </span>
              </div>
              <div className="bd-date-grid">
                <div className="bd-date-cell">
                  <div className="bd-date-label">Nhận phòng</div>
                  <div className="bd-date-val">{fmt(booking.checkIn)}</div>
                </div>
                <div className="bd-date-cell">
                  <div className="bd-date-label">Trả phòng</div>
                  <div className="bd-date-val">{fmt(booking.checkOut)}</div>
                </div>
              </div>
              <div className="bd-row" style={{borderTop:'1px solid var(--c-border)',marginTop:'4px',paddingTop:'10px'}}>
                <span className="bd-row-label">Số đêm</span>
                <span className="bd-row-val">{n} đêm</span>
              </div>
              <div className="bd-row">
                <span className="bd-row-label">Số khách</span>
                <span className="bd-row-val">{booking.guestCount ?? 1} khách</span>
              </div>
              {booking.confirmedAt && (
                <div className="bd-row">
                  <span className="bd-row-label">Xác nhận lúc</span>
                  <span className="bd-row-val">{fmtDt(booking.confirmedAt)}</span>
                </div>
              )}
              <div className="bd-row">
                <span className="bd-row-label">Ngày đặt</span>
                <span className="bd-row-val">{fmtDt(booking.createdAt)}</span>
              </div>
              {booking.specialRequests && (
                <div className="bd-note bd-note-amber" style={{marginTop:'12px'}}>
                  <div style={{fontSize:'10px',fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--c-gold)',marginBottom:'5px'}}>Yêu cầu đặc biệt</div>
                  {booking.specialRequests}
                </div>
              )}
              {booking.cancelReason && (
                <div className="bd-note bd-note-red" style={{marginTop:'8px'}}>
                  <div style={{fontSize:'10px',fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',color:'#DC2626',marginBottom:'5px'}}>
                    Lý do {booking.status==='REJECTED'?'từ chối':'hủy'}
                  </div>
                  {booking.cancelReason}
                </div>
              )}
            </div>
          </div>

          {/* ── Timeline ── */}
          <div className="bd-panel">
            <div className="bd-panel-header"><div className="bd-panel-title">Tiến trình đặt phòng</div></div>
            <div className="bd-panel-body"><Timeline status={booking.status} /></div>
          </div>

          {/* ── Payment ── */}
          <div className="bd-panel">
            <div className="bd-panel-header">
              <div className="bd-panel-title">Thanh toán</div>
              <span className="bd-pay-badge" style={{background:payMeta.bg,color:payMeta.text,borderColor:payMeta.border}}>
                <span className="bd-pay-dot" style={{background:payMeta.dot}} />
                {payMeta.label}
              </span>
            </div>
            <div className="bd-panel-body">
              {booking.pricePerNight != null && (
                <div className="bd-row">
                  <span className="bd-row-label">{(booking.pricePerNight??0).toLocaleString('vi-VN')} ₫ × {n} đêm</span>
                  <span className="bd-row-val">{(booking.originalPrice??0).toLocaleString('vi-VN')} ₫</span>
                </div>
              )}
              {(booking.discountAmount??0) > 0 && (
                <div className="bd-row">
                  <span className="bd-row-label">Giảm giá</span>
                  <span style={{fontSize:'13px',fontWeight:500,color:'#059669'}}>− {(booking.discountAmount??0).toLocaleString('vi-VN')} ₫</span>
                </div>
              )}
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'12px',marginTop:'4px',borderTop:'1px solid var(--c-border)'}}>
                <span style={{fontSize:'13px',fontWeight:600,color:'var(--c-text)'}}>Tổng cộng</span>
                <span className="bd-price-total">{(booking.totalPrice??0).toLocaleString('vi-VN')} ₫</span>
              </div>

              {/* Payment timeline */}
              <div className="bd-pay-timeline" style={{marginTop:'14px'}}>
                <div style={{fontSize:'10px',fontWeight:600,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--c-muted)',marginBottom:'4px'}}>Lịch sử giao dịch</div>
                <div className="bd-pay-row">
                  <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                    <span className="bd-pay-dot-sm" style={{background:'var(--c-gold)'}} />
                    <span style={{fontSize:'12px',color:'var(--c-muted)'}}>Tạo đặt phòng</span>
                  </div>
                  <span style={{fontSize:'11px',color:'var(--c-subtle)'}}>{fmtDt(booking.createdAt)}</span>
                </div>
                {booking.paymentStatus === 'PAID' && (
                  <div className="bd-pay-row">
                    <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                      <span className="bd-pay-dot-sm" style={{background:'#10B981'}} />
                      <span style={{fontSize:'12px',color:'var(--c-muted)'}}>Thanh toán thành công</span>
                    </div>
                    <span style={{fontSize:'11px',color:'#059669',fontWeight:600}}>{(booking.totalPrice??0).toLocaleString('vi-VN')} ₫</span>
                  </div>
                )}
                {booking.paymentStatus === 'REFUNDED' && (
                  <div className="bd-pay-row">
                    <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                      <span className="bd-pay-dot-sm" style={{background:'#3B82F6'}} />
                      <span style={{fontSize:'12px',color:'var(--c-muted)'}}>Hoàn tiền</span>
                    </div>
                    <span style={{fontSize:'11px',color:'#2563EB',fontWeight:600}}>+ {(booking.totalPrice??0).toLocaleString('vi-VN')} ₫</span>
                  </div>
                )}
                {booking.paymentStatus === 'UNPAID' && (
                  <div className="bd-pay-row">
                    <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
                      <span className="bd-pay-dot-sm" style={{background:'#F59E0B'}} />
                      <span style={{fontSize:'12px',color:'var(--c-muted)'}}>Chờ thanh toán</span>
                    </div>
                    <span style={{fontSize:'11px',color:'#D97706',fontWeight:600}}>{(booking.totalPrice??0).toLocaleString('vi-VN')} ₫</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── QR Card ── */}
          {booking.status === 'CONFIRMED' && <QrCard bookingId={booking.id} />}

          {/* ── Pay button ── */}
          {booking.paymentStatus === 'UNPAID' && (booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
            <button className="bd-btn-pay" onClick={() => navigate(`/payment/${id}`)}>
              Thanh toán ngay
            </button>
          )}

          {/* ── Chat ── */}
          <Link to={`/chat/${booking.userId}_${booking.hotelId}?bookingId=${booking.id}`} className="bd-btn-chat">
            <div className="bd-btn-chat-left">
              <span className="bd-btn-chat-title">Nhắn tin với khách sạn</span>
              <span className="bd-btn-chat-sub">Hỏi về đặt phòng #{booking.id?.slice(-6).toUpperCase()}, yêu cầu đặc biệt...</span>
            </div>
            <svg width="16" height="16" fill="none" stroke="var(--c-gold)" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </Link>

          {/* ── Cancel ── */}
          {eligible && (
            <button className="bd-btn-cancel" onClick={() => setShowCancel(true)}>Hủy đặt phòng</button>
          )}

          <div className="bd-booking-id">Mã đặt phòng: {booking.id}</div>
        </div>
      </div>
    </>
  );
}