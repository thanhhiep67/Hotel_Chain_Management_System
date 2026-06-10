import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getMyPayments } from '../api/payments';
import { useNotifications } from '../context/NotificationContext';

/* ─── constants ─────────────────────────────────────────────────── */
const STATUS_META = {
  PAID:      { label:'Đã thanh toán', dot:'#10B981', bg:'rgba(16,185,129,0.10)',  text:'#059669', border:'rgba(16,185,129,0.25)'  },
  PENDING:   { label:'Đang chờ',      dot:'#F59E0B', bg:'rgba(245,158,11,0.10)',  text:'#D97706', border:'rgba(245,158,11,0.25)'   },
  FAILED:    { label:'Thất bại',      dot:'#EF4444', bg:'rgba(239,68,68,0.10)',   text:'#DC2626', border:'rgba(239,68,68,0.25)'    },
  REFUNDED:  { label:'Đã hoàn tiền',  dot:'#8B5CF6', bg:'rgba(139,92,246,0.10)', text:'#7C3AED', border:'rgba(139,92,246,0.25)'   },
  CANCELLED: { label:'Đã hủy',        dot:'#6B7280', bg:'rgba(107,114,128,0.10)',text:'#4B5563', border:'rgba(107,114,128,0.25)'  },
  UNPAID:    { label:'Chưa thanh toán',dot:'#F97316', bg:'rgba(249,115,22,0.10)', text:'#EA580C', border:'rgba(249,115,22,0.25)'   },
};

const STATUS_FILTERS = [
  { value: '',          label: 'Tất cả'         },
  { value: 'PAID',      label: 'Đã thanh toán'  },
  { value: 'PENDING',   label: 'Đang chờ'       },
  { value: 'FAILED',    label: 'Thất bại'        },
  { value: 'REFUNDED',  label: 'Đã hoàn tiền'   },
  { value: 'CANCELLED', label: 'Đã hủy'         },
];

const METHOD_META = {
  VNPAY:         { label:'VNPay',       bg:'linear-gradient(135deg,#0057A8,#009FE3)', color:'#fff' },
  CASH:          { label:'Tiền mặt',    bg:'linear-gradient(135deg,#6B7280,#9CA3AF)', color:'#fff' },
  MOMO:          { label:'MoMo',        bg:'#AE2070',                                  color:'#fff' },
  ZALOPAY:       { label:'ZaloPay',     bg:'linear-gradient(135deg,#0068FF,#00C4FF)', color:'#fff' },
  CREDIT_CARD:   { label:'Thẻ tín dụng',bg:'linear-gradient(135deg,#1C1B18,#3D3C39)', color:'#fff' },
  DEBIT_CARD:    { label:'Thẻ ghi nợ',  bg:'linear-gradient(135deg,#374151,#6B7280)', color:'#fff' },
  BANK_TRANSFER: { label:'Chuyển khoản',bg:'linear-gradient(135deg,#065F46,#10B981)', color:'#fff' },
};

const PAGE_SIZE = 8;

/* ─── helpers ───────────────────────────────────────────────────── */
const fmtVnd = n  => n != null ? n.toLocaleString('vi-VN') + ' ₫' : '—';
const fmtDate = s => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
};
const fmtDateTime = s => {
  if (!s) return null;
  const d = new Date(s);
  return d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
};

/* ─── CSS ────────────────────────────────────────────────────────── */
const CSS = `
  :root {
    --c-bg:#F7F6F4; --c-card:#FFFFFF; --c-border:rgba(0,0,0,0.08);
    --c-border2:rgba(0,0,0,0.13); --c-gold:#C9A84C; --c-gold-d:#8A6E30;
    --c-text:#1C1B18; --c-muted:#6B6860; --c-subtle:#A09D96;
    --r:14px; --t:all 0.22s cubic-bezier(0.4,0,0.2,1);
    --font-d:'Cormorant Garamond',Georgia,serif;
    --font-b:'Outfit',system-ui,sans-serif;
  }
  .ph-root { background:var(--c-bg); color:var(--c-text); font-family:var(--font-b); font-size:14px; min-height:100vh; }
  .ph-wrap { max-width:860px; margin:0 auto; padding:32px 24px 80px; }

  /* header */
  .ph-header { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
  .ph-title { font-family:var(--font-b); font-size:clamp(22px,3vw,30px); font-weight:700; letter-spacing:-0.01em; color:var(--c-text); }
  .ph-title-sub { font-size:13px; color:var(--c-muted); margin-top:4px; }
  .ph-total-badge { font-size:12px; color:var(--c-subtle); background:var(--c-card); border:1px solid var(--c-border); padding:5px 14px; border-radius:20px; white-space:nowrap; }

  /* filter tabs */
  .ph-filters { display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap; }
  .ph-filter-btn {
    padding:7px 16px; border-radius:20px; border:1px solid var(--c-border);
    background:var(--c-card); color:var(--c-muted); font-size:12px;
    font-weight:500; cursor:pointer; transition:var(--t); font-family:var(--font-b);
    white-space:nowrap;
  }
  .ph-filter-btn:hover { border-color:rgba(201,168,76,0.4); color:var(--c-text); }
  .ph-filter-btn.active { background:var(--c-gold); color:#0A0A0B; border-color:var(--c-gold); font-weight:700; }

  /* list */
  .ph-list { display:flex; flex-direction:column; gap:8px; }

  /* payment card */
  .ph-card {
    background:var(--c-card); border:1px solid var(--c-border); border-radius:var(--r);
    padding:18px 20px; display:grid;
    grid-template-columns:auto 1fr auto;
    gap:16px; align-items:center;
    transition:var(--t);
  }
  .ph-card:hover { border-color:rgba(201,168,76,0.35); box-shadow:0 4px 20px rgba(0,0,0,0.06); transform:translateY(-1px); }

  /* method badge */
  .ph-method { display:flex; flex-direction:column; align-items:center; gap:6px; min-width:64px; }
  .ph-method-logo {
    padding:5px 12px; border-radius:8px; font-size:11px; font-weight:800;
    letter-spacing:0.3px; white-space:nowrap;
  }

  /* status badge */
  .ph-status { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; letter-spacing:0.06em; white-space:nowrap; }
  .ph-status-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }

  /* center info */
  .ph-info { min-width:0; }
  .ph-info-top { display:flex; align-items:center; gap:8px; margin-bottom:5px; flex-wrap:wrap; }
  .ph-booking-id {
    font-family:'Courier New',monospace; font-size:12px; color:var(--c-gold);
    background:rgba(201,168,76,0.1); padding:2px 8px; border-radius:5px;
    text-decoration:none; transition:var(--t);
  }
  .ph-booking-id:hover { background:rgba(201,168,76,0.2); }
  .ph-txn-id { font-family:'Courier New',monospace; font-size:11px; color:var(--c-subtle); }
  .ph-dates { display:flex; gap:12px; flex-wrap:wrap; }
  .ph-date-item { font-size:11px; color:var(--c-muted); display:flex; align-items:center; gap:4px; }
  .ph-date-label { font-size:10px; font-weight:600; letter-spacing:0.08em; color:var(--c-subtle); text-transform:uppercase; }

  /* right side */
  .ph-right { display:flex; flex-direction:column; align-items:flex-end; gap:8px; }
  .ph-amount { font-family:var(--font-b); font-size:20px; font-weight:700; color:var(--c-gold); letter-spacing:-0.01em; white-space:nowrap; }
  .ph-amount-refunded { color:#7C3AED; }
  .ph-amount-failed   { color:var(--c-subtle); text-decoration:line-through; }
  .ph-view-btn {
    font-size:12px; font-weight:600; color:var(--c-muted); text-decoration:none;
    padding:5px 12px; border:1px solid var(--c-border); border-radius:8px;
    transition:var(--t); white-space:nowrap; font-family:var(--font-b);
    background:var(--c-card);
  }
  .ph-view-btn:hover { border-color:var(--c-gold); color:var(--c-gold); }

  /* refund info */
  .ph-refund-note { font-size:11px; color:#7C3AED; margin-top:4px; }

  /* empty */
  .ph-empty { text-align:center; padding:64px 20px; }
  .ph-empty-icon { font-size:40px; margin-bottom:16px; }
  .ph-empty-title { font-size:18px; font-weight:600; color:var(--c-text); margin-bottom:8px; }
  .ph-empty-sub { font-size:13px; color:var(--c-muted); }

  /* pagination */
  .ph-pagination { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:24px; }
  .ph-page-btn {
    width:36px; height:36px; border-radius:8px; border:1px solid var(--c-border);
    background:var(--c-card); color:var(--c-muted); font-size:13px; font-weight:500;
    cursor:pointer; transition:var(--t); display:flex; align-items:center; justify-content:center;
    font-family:var(--font-b);
  }
  .ph-page-btn:hover:not(:disabled) { border-color:var(--c-gold); color:var(--c-gold); }
  .ph-page-btn:disabled { opacity:0.35; cursor:not-allowed; }
  .ph-page-btn.current { background:var(--c-gold); color:#0A0A0B; border-color:var(--c-gold); font-weight:700; }
  .ph-page-info { font-size:12px; color:var(--c-subtle); padding:0 8px; }

  /* realtime flash highlight */
  .ph-card-updated { animation: phFlash 1.8s ease-out forwards; }
  @keyframes phFlash {
    0%   { border-color:var(--c-gold); box-shadow:0 0 0 3px rgba(201,168,76,0.25); }
    60%  { border-color:var(--c-gold); box-shadow:0 0 0 3px rgba(201,168,76,0.1); }
    100% { border-color:rgba(0,0,0,0.08); box-shadow:none; }
  }

  /* skeleton */
  .sk { background:linear-gradient(90deg,#edece8 25%,#f5f4f0 50%,#edece8 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:10px; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  @media(max-width:640px) {
    .ph-card { grid-template-columns:1fr; gap:12px; }
    .ph-method { flex-direction:row; min-width:0; align-items:center; }
    .ph-right { align-items:flex-start; flex-direction:row; justify-content:space-between; align-items:center; }
    .ph-amount { font-size:18px; }
  }
`;

/* ─── sub-components ─────────────────────────────────────────────── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status, dot:'#9CA3AF', bg:'rgba(156,163,175,0.1)', text:'#6B7280', border:'rgba(156,163,175,0.25)' };
  return (
    <span className="ph-status" style={{ background: m.bg, color: m.text, border: `1px solid ${m.border}` }}>
      <span className="ph-status-dot" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function MethodLogo({ method }) {
  const m = METHOD_META[method] ?? { label: method ?? '—', bg: '#6B7280', color: '#fff' };
  return (
    <span className="ph-method-logo" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background:'#fff', border:'1px solid rgba(0,0,0,0.08)', borderRadius:'14px', padding:'18px 20px', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:'16px', alignItems:'center' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px', minWidth:'64px' }}>
        <div className="sk" style={{ height:'24px', width:'60px', borderRadius:'8px' }} />
        <div className="sk" style={{ height:'18px', width:'52px', borderRadius:'20px' }} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        <div className="sk" style={{ height:'14px', width:'160px' }} />
        <div className="sk" style={{ height:'12px', width:'120px' }} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'8px', alignItems:'flex-end' }}>
        <div className="sk" style={{ height:'22px', width:'90px' }} />
        <div className="sk" style={{ height:'26px', width:'80px', borderRadius:'8px' }} />
      </div>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────── */
export default function PaymentHistoryPage() {
  const [statusFilter,    setStatusFilter]    = useState('');
  const [page,            setPage]            = useState(0);
  const [data,            setData]            = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [flashPaymentId,  setFlashPaymentId]  = useState(null);

  const { notifications } = useNotifications();
  const lastNotifRef = useRef(null);

  /* ── realtime: patch status khi nhận PAYMENT_SUCCESS / PAYMENT_FAILED ── */
  useEffect(() => {
    const latest = notifications.find(n => n.referenceType === 'PAYMENT');
    if (!latest || latest.receivedAt === lastNotifRef.current) return;
    lastNotifRef.current = latest.receivedAt;

    if (!latest.paymentId || !latest.paymentStatus) return;

    setData(prev => {
      if (!prev) return prev;
      const inList = prev.content.some(p => p.paymentId === latest.paymentId);
      if (!inList) return prev;
      return {
        ...prev,
        content: prev.content.map(p =>
          p.paymentId === latest.paymentId
            ? { ...p, status: latest.paymentStatus, paidAt: p.paidAt ?? latest.createdAt }
            : p
        ),
      };
    });

    setFlashPaymentId(latest.paymentId);
    setTimeout(() => setFlashPaymentId(null), 2000);
  }, [notifications]);

  const load = useCallback(async (status, pg) => {
    setLoading(true);
    try {
      const params = { page: pg, size: PAGE_SIZE };
      if (status) params.status = status;
      const res = await getMyPayments(params);
      setData(res.data?.data ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(statusFilter, page); }, [load, statusFilter, page]);

  const handleFilter = v => { setStatusFilter(v); setPage(0); };

  const payments    = data?.content ?? [];
  const totalPages  = data?.totalPages ?? 0;
  const totalItems  = data?.totalElements ?? 0;

  /* pagination range */
  const pageRange = () => {
    const range = [];
    const delta = 2;
    for (let i = Math.max(0, page - delta); i <= Math.min(totalPages - 1, page + delta); i++) {
      range.push(i);
    }
    return range;
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="ph-root">
        <Navbar />
        <div className="ph-wrap">

          {/* Header */}
          <div className="ph-header">
            <div>
              <div className="ph-title">Lịch sử giao dịch</div>
              <div className="ph-title-sub">Tất cả thanh toán liên kết với tài khoản của bạn</div>
            </div>
            {!loading && totalItems > 0 && (
              <span className="ph-total-badge">{totalItems} giao dịch</span>
            )}
          </div>

          {/* Filter tabs */}
          <div className="ph-filters">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                className={`ph-filter-btn${statusFilter === f.value ? ' active' : ''}`}
                onClick={() => handleFilter(f.value)}
                type="button"
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <div className="ph-list">
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : payments.length === 0 ? (
            <div className="ph-empty">
              <div className="ph-empty-icon">🧾</div>
              <div className="ph-empty-title">
                {statusFilter ? 'Không có giao dịch nào' : 'Chưa có giao dịch'}
              </div>
              <div className="ph-empty-sub">
                {statusFilter
                  ? `Bạn không có giao dịch nào với trạng thái "${STATUS_META[statusFilter]?.label ?? statusFilter}".`
                  : 'Các giao dịch của bạn sẽ xuất hiện tại đây sau khi đặt phòng.'}
              </div>
            </div>
          ) : (
            <div className="ph-list">
              {payments.map(p => {
                const isFailed   = p.status === 'FAILED'   || p.status === 'CANCELLED';
                const isRefunded = p.status === 'REFUNDED';
                return (
                  <div key={p.paymentId} className={`ph-card${flashPaymentId === p.paymentId ? ' ph-card-updated' : ''}`}>

                    {/* Left — method + status */}
                    <div className="ph-method">
                      <MethodLogo method={p.method} />
                      <StatusBadge status={p.status} />
                    </div>

                    {/* Center — IDs + dates */}
                    <div className="ph-info">
                      <div className="ph-info-top">
                        {p.bookingId && (
                          <Link to={`/my-bookings/${p.bookingId}`} className="ph-booking-id">
                            #{p.bookingId.slice(-8).toUpperCase()}
                          </Link>
                        )}
                        {p.transactionId && (
                          <span className="ph-txn-id">TXN: {p.transactionId}</span>
                        )}
                      </div>
                      <div className="ph-dates">
                        <span className="ph-date-item">
                          <span className="ph-date-label">Tạo</span>
                          {fmtDate(p.createdAt)}
                        </span>
                        {p.paidAt && (
                          <span className="ph-date-item">
                            <span className="ph-date-label">Thanh toán</span>
                            {fmtDateTime(p.paidAt)}
                          </span>
                        )}
                        {p.refundedAt && (
                          <span className="ph-date-item" style={{ color:'#7C3AED' }}>
                            <span className="ph-date-label" style={{ color:'#7C3AED' }}>Hoàn</span>
                            {fmtDate(p.refundedAt)}
                          </span>
                        )}
                      </div>
                      {isRefunded && p.refundReason && (
                        <div className="ph-refund-note">Lý do: {p.refundReason}</div>
                      )}
                    </div>

                    {/* Right — amount + action */}
                    <div className="ph-right">
                      <span className={`ph-amount${isRefunded ? ' ph-amount-refunded' : isFailed ? ' ph-amount-failed' : ''}`}>
                        {fmtVnd(p.amount)}
                      </span>
                      {p.bookingId && (
                        <Link to={`/my-bookings/${p.bookingId}`} className="ph-view-btn">
                          Xem booking →
                        </Link>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ph-pagination">
              <button
                className="ph-page-btn"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                type="button"
              >‹</button>

              {pageRange().map(i => (
                <button
                  key={i}
                  className={`ph-page-btn${i === page ? ' current' : ''}`}
                  onClick={() => setPage(i)}
                  type="button"
                >
                  {i + 1}
                </button>
              ))}

              <button
                className="ph-page-btn"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                type="button"
              >›</button>

              <span className="ph-page-info">Trang {page + 1} / {totalPages}</span>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
