import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getPaymentById } from '../api/payments';

// ── helpers ────────────────────────────────────────────────────────────────

const fmtVnd = n =>
  n != null ? Number(n).toLocaleString('vi-VN') + ' ₫' : null;

const fmtDt = s => {
  if (!s) return null;
  return new Date(s).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const METHOD_LABEL = {
  VNPAY: 'VNPay', MOMO: 'MoMo', ZALOPAY: 'ZaloPay',
  CASH: 'Tiền mặt', CREDIT_CARD: 'Thẻ tín dụng',
  DEBIT_CARD: 'Thẻ ghi nợ', BANK_TRANSFER: 'Chuyển khoản',
};

// ── variant config (thay đổi màu sắc theo status) ─────────────────────────

const VARIANTS = {
  SUCCESS: {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="#10B981" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    iconBg:   'bg-emerald-50 border border-emerald-200',
    title:    'Thanh toán thành công',
    titleCls: 'text-emerald-600',
    headerBg: 'bg-gradient-to-b from-emerald-50/60 to-white',
    badge:    { text: 'ĐÃ THANH TOÁN', cls: 'bg-emerald-50 border-emerald-200 text-emerald-600', dotCls: 'bg-emerald-400' },
    subtitle: 'Giao dịch của bạn đã được xác nhận. Booking đã được kích hoạt.',
    note:     '✅  Email xác nhận đặt phòng đã được gửi đến hộp thư của bạn. Vui lòng kiểm tra và xuất trình khi nhận phòng.',
    noteCls:  'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  FAILED: {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="#F87171" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    iconBg:   'bg-red-50 border border-red-200',
    title:    'Thanh toán thất bại',
    titleCls: 'text-red-600',
    headerBg: 'bg-gradient-to-b from-red-50/60 to-white',
    badge:    { text: 'THẤT BẠI', cls: 'bg-red-50 border-red-200 text-red-500', dotCls: 'bg-red-400' },
    subtitle: 'Giao dịch không được thực hiện. Vui lòng kiểm tra lại hoặc thử phương thức khác.',
    note:     '⚠️  Nếu tiền đã bị trừ nhưng giao dịch thất bại, số tiền sẽ được hoàn lại trong 3–5 ngày làm việc.',
    noteCls:  'bg-red-50 border-red-200 text-red-800',
  },
  PENDING: {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="#3B82F6" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    iconBg:   'bg-blue-50 border border-blue-200',
    title:    'Đặt phòng thành công',
    titleCls: 'text-blue-600',
    headerBg: 'bg-gradient-to-b from-blue-50/60 to-white',
    badge:    { text: 'CHỜ THU TIỀN', cls: 'bg-blue-50 border-blue-200 text-blue-600', dotCls: 'bg-blue-400 animate-pulse' },
    subtitle: 'Booking của bạn đã được xác nhận. Vui lòng thanh toán tiền mặt khi nhận phòng.',
    note:     '💵  Mang theo tiền mặt đúng số tiền khi đến nhận phòng. Nhân viên sẽ thu và cấp hóa đơn tại quầy lễ tân.',
    noteCls:  'bg-blue-50 border-blue-200 text-blue-800',
  },
};

// ── skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden shadow-lg">
      <div className="px-8 py-10 text-center border-b border-black/6 space-y-4 animate-pulse">
        <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto" />
        <div className="h-7 w-48 bg-gray-100 rounded-lg mx-auto" />
        <div className="h-4 w-64 bg-gray-100 rounded mx-auto" />
        <div className="h-10 w-36 bg-gray-100 rounded-xl mx-auto" />
        <div className="h-6 w-28 bg-gray-100 rounded-full mx-auto" />
      </div>
      <div className="px-7 py-5 space-y-3 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex justify-between py-2.5 border-b border-black/5">
            <div className="h-3.5 w-24 bg-gray-100 rounded" />
            <div className="h-3.5 w-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── detail row ──────────────────────────────────────────────────────────────

function Row({ label, value, mono, green }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-3 border-b border-black/5 last:border-0 text-sm gap-4">
      <span className="text-[#6B6860] shrink-0">{label}</span>
      <span className={`font-semibold text-right break-all max-w-[60%]
        ${mono ? 'font-mono text-xs text-[#C9A84C] bg-[#C9A84C]/8 px-2 py-0.5 rounded-md' : ''}
        ${green ? 'text-emerald-600' : 'text-[#1C1B18]'}`}>
        {value}
      </span>
    </div>
  );
}

// ── main page ───────────────────────────────────────────────────────────────

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const status    = searchParams.get('status')    ?? 'FAILED'; // SUCCESS | FAILED | PENDING
  const paymentId = searchParams.get('paymentId');
  const bookingId = searchParams.get('bookingId');

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(!!paymentId);

  useEffect(() => {
    if (!paymentId) { setLoading(false); return; }
    getPaymentById(paymentId)
      .then(res => setPayment(res.data?.data ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [paymentId]);

  const v         = VARIANTS[status] ?? VARIANTS.FAILED;
  const isSuccess = status === 'SUCCESS';
  const isPending = status === 'PENDING';
  const amountFmt = fmtVnd(payment?.amount);

  // bookingId: either from URL param directly (cash flow) or from payment record
  const resolvedBookingId = bookingId ?? payment?.bookingId;

  return (
    <div className="min-h-screen bg-[#F7F6F4]">
      <Navbar />

      <div className="max-w-lg mx-auto px-4 py-10 pb-20">

        {loading ? <Skeleton /> : (
          <div className="bg-white rounded-2xl border border-black/8 overflow-hidden shadow-lg">

            {/* ── header ──────────────────────────────────────────────── */}
            <div className={`${v.headerBg} px-8 py-10 text-center border-b border-black/6`}>

              {/* icon circle */}
              <div className={`w-16 h-16 rounded-full ${v.iconBg} flex items-center justify-center mx-auto mb-5`}>
                {v.icon}
              </div>

              {/* title */}
              <h1 className={`text-2xl font-bold ${v.titleCls} mb-2`}>
                {v.title}
              </h1>

              {/* subtitle */}
              <p className="text-sm text-[#6B6860] leading-relaxed mb-4">
                {v.subtitle}
              </p>

              {/* amount — only show if we have it and it's not cash pending */}
              {amountFmt && !isPending && (
                <p className="text-4xl font-bold text-[#C9A84C] tracking-tight mb-4">
                  {amountFmt}
                </p>
              )}

              {/* status badge */}
              <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wider border ${v.badge.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${v.badge.dotCls}`} />
                {v.badge.text}
              </span>
            </div>

            {/* ── details ─────────────────────────────────────────────── */}
            {(payment || resolvedBookingId) && (
              <div className="px-7 py-4">
                {payment?.transactionId && (
                  <Row label="Mã giao dịch"  value={payment.transactionId}  mono />
                )}
                {paymentId && (
                  <Row label="Mã thanh toán" value={paymentId}              mono />
                )}
                {resolvedBookingId && (
                  <Row label="Mã đặt phòng"  value={resolvedBookingId} />
                )}
                {payment?.method && (
                  <Row label="Phương thức"   value={METHOD_LABEL[payment.method] ?? payment.method} />
                )}
                {isSuccess && payment?.paidAt && (
                  <Row label="Thời gian"     value={fmtDt(payment.paidAt)} green />
                )}
              </div>
            )}

            {/* ── cash pending — hướng dẫn thu công ──────────────────── */}
            {isPending && (
              <div className="px-7 pb-2">
                <div className="bg-[#F7F6F4] rounded-xl p-4 border border-black/8">
                  <p className="text-xs font-semibold text-[#6B6860] uppercase tracking-wider mb-3">
                    Quy trình thu tiền mặt
                  </p>
                  <ol className="space-y-2">
                    {[
                      'Đến khách sạn đúng ngày nhận phòng',
                      'Xuất trình mã đặt phòng cho nhân viên',
                      'Thanh toán tiền mặt tại quầy lễ tân',
                      'Nhận hóa đơn và tiến hành nhận phòng',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[#6B6860]">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 border border-blue-200 text-blue-600 text-[10px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}

            {/* ── note box ────────────────────────────────────────────── */}
            <div className={`mx-7 my-4 px-4 py-3 rounded-xl text-xs leading-relaxed border ${v.noteCls}`}>
              {v.note}
            </div>

            {/* ── action buttons ───────────────────────────────────────── */}
            <div className="px-7 pb-7 pt-1 flex gap-3">
              {isSuccess || isPending ? (
                <>
                  {resolvedBookingId ? (
                    <Link
                      to={`/my-bookings/${resolvedBookingId}`}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#e0bc5e] text-[#0A0A0B] text-sm font-bold rounded-xl transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Xem đặt phòng
                    </Link>
                  ) : (
                    <Link
                      to="/my-bookings"
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#e0bc5e] text-[#0A0A0B] text-sm font-bold rounded-xl transition-colors">
                      Lịch sử đặt phòng
                    </Link>
                  )}
                  <Link
                    to="/"
                    className="flex-1 flex items-center justify-center py-3 border border-black/10 text-[#6B6860] hover:text-[#1C1B18] hover:border-black/20 text-sm font-medium rounded-xl transition-colors">
                    Về trang chủ
                  </Link>
                </>
              ) : (
                <>
                  {resolvedBookingId ? (
                    <Link
                      to={`/payment/${resolvedBookingId}`}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#0A0A0B] hover:bg-[#1C1B18] text-white text-sm font-bold rounded-xl transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Thử lại
                    </Link>
                  ) : (
                    <Link
                      to="/my-bookings"
                      className="flex-1 flex items-center justify-center py-3 bg-[#0A0A0B] hover:bg-[#1C1B18] text-white text-sm font-bold rounded-xl transition-colors">
                      Xem đặt phòng
                    </Link>
                  )}
                  <Link
                    to="/"
                    className="flex-1 flex items-center justify-center py-3 border border-black/10 text-[#6B6860] hover:text-[#1C1B18] hover:border-black/20 text-sm font-medium rounded-xl transition-colors">
                    Về trang chủ
                  </Link>
                </>
              )}
            </div>

          </div>
        )}

        {/* back link */}
        <div className="text-center mt-6">
          <button onClick={() => navigate(-1)}
            className="text-xs text-[#A09D96] hover:text-[#6B6860] transition-colors cursor-pointer">
            ← Quay lại
          </button>
        </div>

      </div>
    </div>
  );
}
