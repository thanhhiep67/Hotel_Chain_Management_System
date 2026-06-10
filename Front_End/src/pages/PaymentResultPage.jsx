import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getPaymentById } from '../api/payments';

/* ─── helpers ───────────────────────────────────────────────────── */
const fmtVnd = n => n != null ? n.toLocaleString('vi-VN') + ' ₫' : '—';
const fmtDt  = s => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const METHOD_LABEL = { VNPAY: 'VNPay', CASH: 'Tiền mặt', MOMO: 'MoMo', ZALOPAY: 'ZaloPay', CREDIT_CARD: 'Thẻ tín dụng', DEBIT_CARD: 'Thẻ ghi nợ', BANK_TRANSFER: 'Chuyển khoản' };

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
  .pr-root { background:var(--c-bg); color:var(--c-text); font-family:var(--font-b); font-size:14px; min-height:100vh; }
  .pr-wrap { max-width:520px; margin:0 auto; padding:48px 20px 80px; }

  /* card */
  .pr-card { background:var(--c-card); border:1px solid var(--c-border); border-radius:20px; overflow:hidden; box-shadow:0 8px 40px rgba(0,0,0,0.07); }

  /* header */
  .pr-header { padding:40px 32px 32px; text-align:center; border-bottom:1px solid var(--c-border); }
  .pr-header-success { background:linear-gradient(160deg,rgba(16,185,129,0.10) 0%,rgba(16,185,129,0.03) 100%); }
  .pr-header-failed  { background:linear-gradient(160deg,rgba(248,113,113,0.10) 0%,rgba(248,113,113,0.03) 100%); }

  .pr-icon { width:68px; height:68px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 18px; }
  .pr-icon-success { background:rgba(16,185,129,0.12); border:1.5px solid rgba(16,185,129,0.3); }
  .pr-icon-failed  { background:rgba(248,113,113,0.12); border:1.5px solid rgba(248,113,113,0.3); }

  .pr-title { font-family:var(--font-b); font-size:26px; font-weight:700; letter-spacing:-0.01em; margin-bottom:6px; }
  .pr-title-success { color:#059669; }
  .pr-title-failed  { color:#DC2626; }

  .pr-subtitle { font-size:13px; color:var(--c-muted); line-height:1.6; }

  /* amount hero */
  .pr-amount { font-family:var(--font-b); font-size:36px; font-weight:700; color:var(--c-gold); letter-spacing:-0.02em; margin-top:14px; }

  /* status badge */
  .pr-badge { display:inline-flex; align-items:center; gap:6px; padding:4px 14px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:0.04em; margin-top:10px; }
  .pr-badge-success { background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); color:#059669; }
  .pr-badge-failed  { background:rgba(248,113,113,0.10); border:1px solid rgba(248,113,113,0.25); color:#DC2626; }
  .pr-badge-dot { width:5px; height:5px; border-radius:50%; }
  .pr-badge-dot-success { background:#10B981; }
  .pr-badge-dot-failed  { background:#F87171; }

  /* details */
  .pr-details { padding:24px 28px; display:flex; flex-direction:column; gap:0; }
  .pr-row { display:flex; justify-content:space-between; align-items:center; padding:11px 0; border-bottom:1px solid var(--c-border); font-size:13px; }
  .pr-row:last-child { border-bottom:none; }
  .pr-row-label { color:var(--c-muted); }
  .pr-row-val { font-weight:600; color:var(--c-text); text-align:right; max-width:60%; word-break:break-all; }
  .pr-row-val-mono { font-family:'Courier New',monospace; font-size:12px; color:var(--c-gold); background:rgba(201,168,76,0.1); padding:2px 8px; border-radius:5px; }
  .pr-row-val-green { color:#059669; }

  /* note box */
  .pr-note { margin:0 28px 20px; padding:12px 16px; border-radius:10px; font-size:12px; line-height:1.65; }
  .pr-note-success { background:rgba(16,185,129,0.07); border:1px solid rgba(16,185,129,0.2); color:#065F46; }
  .pr-note-failed  { background:rgba(248,113,113,0.07); border:1px solid rgba(248,113,113,0.2); color:#991B1B; }

  /* actions */
  .pr-actions { display:flex; gap:10px; padding:20px 28px; border-top:1px solid var(--c-border); }
  .pr-btn-primary {
    flex:1; padding:13px; background:var(--c-gold); color:#0A0A0B;
    font-size:13px; font-weight:700; border:none; border-radius:10px;
    cursor:pointer; transition:var(--t); text-decoration:none;
    display:flex; align-items:center; justify-content:center; gap:6px;
    font-family:var(--font-b);
  }
  .pr-btn-primary:hover { background:#e0bc5e; box-shadow:0 4px 16px rgba(201,168,76,0.3); }
  .pr-btn-secondary {
    flex:1; padding:13px; background:rgba(255,255,255,0.04);
    border:1px solid var(--c-border); color:var(--c-muted);
    font-size:13px; font-weight:500; border-radius:10px;
    cursor:pointer; transition:var(--t); text-decoration:none;
    display:flex; align-items:center; justify-content:center;
    font-family:var(--font-b);
  }
  .pr-btn-secondary:hover { color:var(--c-text); border-color:var(--c-border2); }
  .pr-btn-dark {
    flex:1; padding:13px; background:#1C1B18; color:#fff;
    font-size:13px; font-weight:700; border:none; border-radius:10px;
    cursor:pointer; transition:var(--t); text-decoration:none;
    display:flex; align-items:center; justify-content:center; gap:6px;
    font-family:var(--font-b);
  }
  .pr-btn-dark:hover { background:#333; }

  /* skeleton */
  .sk { background:linear-gradient(90deg,#e8e7e4 25%,#f0efe9 50%,#e8e7e4 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:10px; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* spin */
  @keyframes spin { to{transform:rotate(360deg)} }
  .spin { animation:spin 0.8s linear infinite; }

  @media(max-width:500px) {
    .pr-wrap { padding:24px 12px 60px; }
    .pr-header { padding:28px 20px 24px; }
    .pr-details { padding:16px 20px; }
    .pr-actions { padding:16px 20px; }
    .pr-note { margin:0 20px 16px; }
    .pr-amount { font-size:28px; }
  }
`;

/* ─── icon components ─────────────────────────────────────────── */
function IconSuccess() {
  return (
    <svg width="32" height="32" fill="none" stroke="#10B981" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
    </svg>
  );
}
function IconFailed() {
  return (
    <svg width="32" height="32" fill="none" stroke="#F87171" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
    </svg>
  );
}

/* ─── skeleton ────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="pr-card">
      <div style={{padding:'40px 32px 32px', textAlign:'center', borderBottom:'1px solid rgba(0,0,0,0.08)'}}>
        <div className="sk" style={{width:'68px',height:'68px',borderRadius:'50%',margin:'0 auto 18px'}}/>
        <div className="sk" style={{height:'28px',width:'200px',margin:'0 auto 8px'}}/>
        <div className="sk" style={{height:'16px',width:'260px',margin:'0 auto 14px'}}/>
        <div className="sk" style={{height:'40px',width:'160px',margin:'0 auto'}}/>
      </div>
      <div style={{padding:'24px 28px'}}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'11px 0',borderBottom:'1px solid rgba(0,0,0,0.06)'}}>
            <div className="sk" style={{height:'14px',width:'100px'}}/>
            <div className="sk" style={{height:'14px',width:'120px'}}/>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────── */
export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const status    = searchParams.get('status');    // SUCCESS | FAILED
  const paymentId = searchParams.get('paymentId');

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paymentId) { setLoading(false); return; }
    getPaymentById(paymentId)
      .then(res => setPayment(res.data?.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [paymentId]);

  const isSuccess = status === 'SUCCESS';

  return (
    <>
      <style>{CSS}</style>
      <div className="pr-root">
        <Navbar />
        <div className="pr-wrap">

          {loading ? (
            <Skeleton />
          ) : (
            <div className="pr-card">

              {/* ── Header ── */}
              <div className={`pr-header ${isSuccess ? 'pr-header-success' : 'pr-header-failed'}`}>
                <div className={`pr-icon ${isSuccess ? 'pr-icon-success' : 'pr-icon-failed'}`}>
                  {isSuccess ? <IconSuccess /> : <IconFailed />}
                </div>

                <div className={`pr-title ${isSuccess ? 'pr-title-success' : 'pr-title-failed'}`}>
                  {isSuccess ? 'Thanh toán thành công' : 'Thanh toán thất bại'}
                </div>

                <div className="pr-subtitle">
                  {isSuccess
                    ? 'Giao dịch của bạn đã được xác nhận. Booking đã được kích hoạt.'
                    : 'Giao dịch không được thực hiện. Vui lòng kiểm tra lại thông tin hoặc thử phương thức khác.'
                  }
                </div>

                {payment?.amount != null && (
                  <div className="pr-amount">{fmtVnd(payment.amount)}</div>
                )}

                <div>
                  <span className={`pr-badge ${isSuccess ? 'pr-badge-success' : 'pr-badge-failed'}`}>
                    <span className={`pr-badge-dot ${isSuccess ? 'pr-badge-dot-success' : 'pr-badge-dot-failed'}`}/>
                    {isSuccess ? 'ĐÃ THANH TOÁN' : 'THẤT BẠI'}
                  </span>
                </div>
              </div>

              {/* ── Details ── */}
              {payment && (
                <div className="pr-details">
                  {payment.transactionId && (
                    <div className="pr-row">
                      <span className="pr-row-label">Mã giao dịch</span>
                      <span className="pr-row-val pr-row-val-mono">{payment.transactionId}</span>
                    </div>
                  )}
                  {paymentId && (
                    <div className="pr-row">
                      <span className="pr-row-label">Mã thanh toán</span>
                      <span className="pr-row-val pr-row-val-mono">{paymentId}</span>
                    </div>
                  )}
                  {payment.bookingId && (
                    <div className="pr-row">
                      <span className="pr-row-label">Mã đặt phòng</span>
                      <span className="pr-row-val" style={{fontFamily:"'Courier New',monospace",fontSize:'12px'}}>{payment.bookingId}</span>
                    </div>
                  )}
                  {payment.method && (
                    <div className="pr-row">
                      <span className="pr-row-label">Phương thức</span>
                      <span className="pr-row-val">{METHOD_LABEL[payment.method] ?? payment.method}</span>
                    </div>
                  )}
                  {payment.paidAt && isSuccess && (
                    <div className="pr-row">
                      <span className="pr-row-label">Thời gian</span>
                      <span className="pr-row-val pr-row-val-green">{fmtDt(payment.paidAt)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Note ── */}
              <div className={`pr-note ${isSuccess ? 'pr-note-success' : 'pr-note-failed'}`}>
                {isSuccess
                  ? '✅ Email xác nhận đặt phòng đã được gửi đến hộp thư của bạn. Vui lòng kiểm tra và xuất trình khi nhận phòng.'
                  : '⚠️ Nếu tiền đã bị trừ nhưng giao dịch thất bại, số tiền sẽ được hoàn lại trong vòng 3–5 ngày làm việc. Liên hệ hotrovnpay@vnpay.vn nếu cần hỗ trợ.'
                }
              </div>

              {/* ── Actions ── */}
              <div className="pr-actions">
                {isSuccess ? (
                  <>
                    {payment?.bookingId
                      ? <Link to={`/my-bookings/${payment.bookingId}`} className="pr-btn-primary">Xem đặt phòng</Link>
                      : <Link to="/my-bookings" className="pr-btn-primary">Lịch sử đặt phòng</Link>
                    }
                    <Link to="/" className="pr-btn-secondary">Về trang chủ</Link>
                  </>
                ) : (
                  <>
                    {payment?.bookingId
                      ? <Link to={`/payment/${payment.bookingId}`} className="pr-btn-dark">Thử lại</Link>
                      : <Link to="/my-bookings" className="pr-btn-dark">Xem đặt phòng</Link>
                    }
                    <Link to="/" className="pr-btn-secondary">Về trang chủ</Link>
                  </>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  );
}
