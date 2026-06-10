import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getBookingById } from '../api/bookings';
import { createPayment } from '../api/payments';

/* ─── helpers ───────────────────────────────────────────────────── */
const fmt   = d   => d   ? new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtVnd = n  => n != null ? n.toLocaleString('vi-VN') + ' ₫' : '—';
const nights = (ci, co) => !ci || !co ? 0 : Math.round((new Date(co + 'T00:00:00') - new Date(ci + 'T00:00:00')) / 86400000);
const TYPE_LABEL = { STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite', FAMILY: 'Family' };

/* ─── CSS ────────────────────────────────────────────────────────── */
const CSS = `
  :root {
    --c-bg:#F7F6F4; --c-white:#FFFFFF; --c-border:rgba(0,0,0,0.08);
    --c-border2:rgba(0,0,0,0.13); --c-gold:#C9A84C; --c-gold-d:#8A6E30;
    --c-dark:#0A0A0B; --c-text:#1C1B18; --c-muted:#6B6860;
    --c-subtle:#A09D96; --r:14px; --t:all 0.2s cubic-bezier(0.4,0,0.2,1);
    --font-d:'Cormorant Garamond',Georgia,serif; --font-b:'Outfit',system-ui,sans-serif;
    --shadow:0 1px 4px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04);
  }
  .pp-root { background:var(--c-bg); color:var(--c-text); font-family:var(--font-b); font-size:14px; min-height:100vh; }
  .pp-wrap { max-width:560px; margin:0 auto; padding:28px 20px 96px; }

  /* back */
  .pp-back { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--c-muted); background:none; border:none; cursor:pointer; transition:var(--t); margin-bottom:20px; font-family:var(--font-b); padding:0; }
  .pp-back:hover { color:var(--c-gold); }

  /* page title */
  .pp-title { font-family:var(--font-b); font-size:clamp(22px,3vw,28px); font-weight:600; color:var(--c-text); letter-spacing:-0.01em; line-height:1.2; }
  .pp-subtitle { font-size:12px; color:var(--c-muted); margin-top:4px; margin-bottom:24px; }

  /* panel */
  .pp-panel { background:var(--c-white); border:1px solid var(--c-border); border-radius:var(--r); overflow:hidden; margin-bottom:10px; box-shadow:var(--shadow); }
  .pp-panel-header { padding:14px 18px 12px; border-bottom:1px solid var(--c-border); }
  .pp-panel-title { font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--c-subtle); }
  .pp-panel-body { padding:16px 18px; }

  /* order summary rows */
  .pp-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:7px 0; }
  .pp-row + .pp-row { border-top:1px solid var(--c-border); }
  .pp-row-label { font-size:12px; color:var(--c-muted); }
  .pp-row-val { font-size:13px; font-weight:500; color:var(--c-text); text-align:right; }
  .pp-row-total { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0 0; margin-top:4px; border-top:2px solid var(--c-border2); }
  .pp-total-label { font-size:13px; font-weight:600; color:var(--c-text); }
  .pp-total-amount { font-family:var(--font-b); font-size:28px; font-weight:700; color:var(--c-gold); letter-spacing:-0.02em; }

  /* booking meta chips */
  .pp-meta { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 14px; }
  .pp-chip { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:500; color:var(--c-muted); background:var(--c-bg); border:1px solid var(--c-border); border-radius:20px; padding:3px 10px; }

  /* payment method grid */
  .pp-methods { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .pp-method-card { position:relative; border:2px solid var(--c-border2); border-radius:14px; padding:18px 16px 16px; cursor:pointer; transition:var(--t); background:var(--c-white); user-select:none; -webkit-tap-highlight-color:transparent; }
  .pp-method-card:hover:not(.pm-sel) { border-color:rgba(201,168,76,0.45); background:rgba(201,168,76,0.02); }
  .pp-method-card.pm-sel { border-color:var(--c-gold); background:rgba(201,168,76,0.06); box-shadow:0 0 0 1px var(--c-gold); }

  /* radio dot */
  .pp-radio { position:absolute; top:14px; right:14px; width:18px; height:18px; border-radius:50%; border:2px solid var(--c-border2); display:flex; align-items:center; justify-content:center; transition:var(--t); background:var(--c-white); }
  .pp-method-card.pm-sel .pp-radio { border-color:var(--c-gold); background:var(--c-gold); }
  .pp-radio-inner { width:7px; height:7px; border-radius:50%; background:var(--c-white); opacity:0; transition:var(--t); }
  .pp-method-card.pm-sel .pp-radio-inner { opacity:1; }

  /* method icon */
  .pp-method-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; font-size:20px; }
  .pp-method-icon-vnpay { background:linear-gradient(135deg,#0057A8,#009FE3); }
  .pp-method-icon-cash  { background:linear-gradient(135deg,#059669,#34d399); }

  /* vnpay logo text */
  .pp-vnpay-logo { font-size:13px; font-weight:800; color:#fff; letter-spacing:0.5px; }

  /* method name + desc */
  .pp-method-name { font-size:14px; font-weight:600; color:var(--c-text); margin-bottom:3px; }
  .pp-method-desc { font-size:11px; color:var(--c-muted); line-height:1.4; }
  .pp-method-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
  .pp-method-tag { font-size:10px; color:var(--c-subtle); background:var(--c-bg); border:1px solid var(--c-border); border-radius:6px; padding:2px 7px; }

  /* discount badge */
  .pp-discount-badge { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:600; color:#059669; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:20px; padding:3px 10px; margin-top:8px; }

  /* confirm bar */
  .pp-confirm-bar { position:fixed; bottom:0; left:0; right:0; background:var(--c-white); border-top:1px solid var(--c-border); padding:14px 20px; z-index:40; }
  .pp-confirm-inner { max-width:560px; margin:0 auto; }
  .pp-confirm-btn { width:100%; padding:15px; background:var(--c-dark); color:#fff; border:none; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer; transition:var(--t); font-family:var(--font-b); display:flex; align-items:center; justify-content:center; gap:8px; }
  .pp-confirm-btn:hover:not(:disabled) { background:var(--c-gold); color:var(--c-dark); }
  .pp-confirm-btn:disabled { opacity:0.45; cursor:not-allowed; }

  /* error */
  .pp-error { background:#FEF2F2; border:1px solid #FECACA; color:#991B1B; border-radius:10px; padding:12px 16px; font-size:13px; margin-bottom:12px; }

  /* skeleton */
  .sk { background:linear-gradient(90deg,#ECEAE4 25%,#F4F2EC 50%,#ECEAE4 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:var(--r); border:1px solid var(--c-border); }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  @media(max-width:420px) {
    .pp-wrap { padding:20px 14px 88px; }
    .pp-methods { grid-template-columns:1fr; }
  }
`;

/* ════════════════ Main Page ════════════════ */
export default function PaymentPage() {
  const { bookingId } = useParams();
  const navigate      = useNavigate();

  const [booking,    setBooking]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [method,     setMethod]     = useState('VNPAY');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => {
    getBookingById(bookingId)
      .then(res => {
        const b = res.data.data;
        if (b.paymentStatus === 'PAID') {
          navigate(`/my-bookings/${bookingId}`, { replace: true });
          return;
        }
        setBooking(b);
      })
      .catch(() => setError('Không thể tải thông tin đặt phòng.'))
      .finally(() => setLoading(false));
  }, [bookingId, navigate]);

  const n           = booking ? nights(booking.checkIn, booking.checkOut) : 0;
  const total       = booking?.totalPrice ?? 0;
  const original    = booking?.originalPrice ?? total;
  const discount    = booking?.discountAmount ?? 0;
  const pricePerN   = booking?.pricePerNight ?? 0;
  const hasDiscount = discount > 0;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await createPayment({ bookingId, method });
      const payment = res.data.data;
      if (method === 'VNPAY' && payment.paymentUrl) {
        window.location.href = payment.paymentUrl;
      } else {
        navigate(`/my-bookings/${bookingId}`, {
          state: { successToast: 'Đặt chỗ thành công! Vui lòng thanh toán tại quầy lễ tân khi nhận phòng.' },
        });
      }
    } catch (err) {
      setError(err.response?.data?.message ?? 'Có lỗi xảy ra. Vui lòng thử lại.');
      setSubmitting(false);
    }
  };

  /* ── Loading ── */
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="pp-root"><Navbar />
        <div className="pp-wrap">
          {[160, 220, 180].map((h, i) => (
            <div key={i} className="sk" style={{ height: h + 'px', marginBottom: '10px' }} />
          ))}
        </div>
      </div>
    </>
  );

  /* ── Error / not found ── */
  if (error && !booking) return (
    <>
      <style>{CSS}</style>
      <div className="pp-root"><Navbar />
        <div className="pp-wrap" style={{ paddingTop: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--c-muted)', marginBottom: '16px' }}>{error}</p>
          <button className="pp-back" onClick={() => navigate(-1)}>← Quay lại</button>
        </div>
      </div>
    </>
  );

  const methodName = method === 'VNPAY' ? 'VNPay' : 'tiền mặt';

  return (
    <>
      <style>{CSS}</style>
      <div className="pp-root">
        <Navbar />
        <div className="pp-wrap">

          {/* ── Back ── */}
          <button className="pp-back" onClick={() => navigate(`/my-bookings/${bookingId}`)}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Chi tiết đặt phòng
          </button>

          {/* ── Title ── */}
          <div className="pp-title">Thanh toán</div>
          <div className="pp-subtitle">
            {booking?.hotelName ?? '—'}
            {booking?.hotelCity ? ` · ${booking.hotelCity}` : ''}
          </div>

          {/* ── Order summary ── */}
          <div className="pp-panel">
            <div className="pp-panel-header">
              <div className="pp-panel-title">Tóm tắt đơn hàng</div>
            </div>
            <div className="pp-panel-body">

              {/* Room + meta chips */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--c-text)' }}>
                    {booking?.roomNumber ? `Phòng ${booking.roomNumber}` : '—'}
                    {booking?.roomType && (
                      <span style={{ fontWeight: 400, color: 'var(--c-muted)', marginLeft: '6px' }}>
                        · {TYPE_LABEL[booking.roomType] ?? booking.roomType}
                      </span>
                    )}
                  </div>
                  <div className="pp-meta">
                    <span className="pp-chip">
                      <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                      </svg>
                      {fmt(booking?.checkIn)} → {fmt(booking?.checkOut)}
                    </span>
                    <span className="pp-chip">
                      <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a4 4 0 100 8 4 4 0 000-8zM4 20a8 8 0 0116 0"/>
                      </svg>
                      {booking?.guestCount ?? 1} khách
                    </span>
                    <span className="pp-chip">🌙 {n} đêm</span>
                  </div>
                </div>
              </div>

              {/* Price rows */}
              {pricePerN > 0 && (
                <div className="pp-row">
                  <span className="pp-row-label">{fmtVnd(pricePerN)} × {n} đêm</span>
                  <span className="pp-row-val">{fmtVnd(original)}</span>
                </div>
              )}
              {hasDiscount && (
                <div className="pp-row">
                  <span className="pp-row-label" style={{ color: '#059669' }}>Giảm giá</span>
                  <span className="pp-row-val" style={{ color: '#059669' }}>− {fmtVnd(discount)}</span>
                </div>
              )}

              {/* Total */}
              <div className="pp-row-total">
                <div>
                  <div className="pp-total-label">Tổng thanh toán</div>
                  {hasDiscount && (
                    <div className="pp-discount-badge">
                      🏷 Tiết kiệm {fmtVnd(discount)}
                    </div>
                  )}
                </div>
                <div className="pp-total-amount">{fmtVnd(total)}</div>
              </div>
            </div>
          </div>

          {/* ── Payment methods ── */}
          <div className="pp-panel">
            <div className="pp-panel-header">
              <div className="pp-panel-title">Phương thức thanh toán</div>
            </div>
            <div className="pp-panel-body">
              <div className="pp-methods">

                {/* VNPay */}
                <div
                  className={`pp-method-card${method === 'VNPAY' ? ' pm-sel' : ''}`}
                  onClick={() => setMethod('VNPAY')}
                >
                  <div className="pp-radio"><div className="pp-radio-inner" /></div>
                  <div className="pp-method-icon pp-method-icon-vnpay">
                    <span className="pp-vnpay-logo">VNP</span>
                  </div>
                  <div className="pp-method-name">VNPay</div>
                  <div className="pp-method-desc">Thanh toán trực tuyến qua cổng VNPay</div>
                  <div className="pp-method-tags">
                    <span className="pp-method-tag">QR Code</span>
                    <span className="pp-method-tag">ATM</span>
                    <span className="pp-method-tag">Thẻ tín dụng</span>
                  </div>
                </div>

                {/* Cash */}
                <div
                  className={`pp-method-card${method === 'CASH' ? ' pm-sel' : ''}`}
                  onClick={() => setMethod('CASH')}
                >
                  <div className="pp-radio"><div className="pp-radio-inner" /></div>
                  <div className="pp-method-icon pp-method-icon-cash">
                    <span style={{ fontSize: '20px' }}>💵</span>
                  </div>
                  <div className="pp-method-name">Tiền mặt</div>
                  <div className="pp-method-desc">Thanh toán tại quầy lễ tân khi nhận phòng</div>
                  <div className="pp-method-tags">
                    <span className="pp-method-tag">Tại quầy</span>
                    <span className="pp-method-tag">Khi nhận phòng</span>
                  </div>
                </div>

              </div>

              {method === 'VNPAY' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', padding: '10px 12px', background: '#EFF6FF', borderRadius: '9px', border: '1px solid #BFDBFE' }}>
                  <svg width="14" height="14" fill="none" stroke="#2563EB" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span style={{ fontSize: '12px', color: '#1D4ED8', lineHeight: 1.5 }}>
                    Bạn sẽ được chuyển đến trang thanh toán VNPay để hoàn tất giao dịch.
                  </span>
                </div>
              )}
              {method === 'CASH' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', padding: '10px 12px', background: '#ECFDF5', borderRadius: '9px', border: '1px solid #A7F3D0' }}>
                  <svg width="14" height="14" fill="none" stroke="#059669" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span style={{ fontSize: '12px', color: '#065F46', lineHeight: 1.5 }}>
                    Đặt chỗ sẽ được giữ. Vui lòng thanh toán tại quầy lễ tân khi đến nhận phòng.
                  </span>
                </div>
              )}
            </div>
          </div>

          {error && <div className="pp-error">{error}</div>}

          {/* spacer for fixed bar */}
          <div style={{ height: '16px' }} />
        </div>

        {/* ── Fixed confirm bar ── */}
        <div className="pp-confirm-bar">
          <div className="pp-confirm-inner">
            <button className="pp-confirm-btn" onClick={handleConfirm} disabled={submitting}>
              {submitting ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                    style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path strokeLinecap="round" d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  {method === 'VNPAY'
                    ? `Thanh toán ${fmtVnd(total)} qua VNPay →`
                    : `Xác nhận đặt chỗ · Thanh toán tại quầy`
                  }
                </>
              )}
            </button>
          </div>
        </div>

        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );
}
