import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getBookingById, cancelBooking, getCheckInQr, payBooking } from '../api/bookings';
import { useNotifications } from '../context/NotificationContext';

/* ── Constants ── */
const STATUS_META = {
  PENDING:     { label: 'Chờ xác nhận', bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200', dot: 'bg-yellow-400' },
  CONFIRMED:   { label: 'Đã xác nhận',  bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',   dot: 'bg-blue-500'   },
  CHECKED_IN:  { label: 'Đang lưu trú', bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',  dot: 'bg-green-500'  },
  CHECKED_OUT: { label: 'Đã trả phòng', bg: 'bg-gray-50',    text: 'text-gray-500',    border: 'border-gray-200',   dot: 'bg-gray-400'   },
  CANCELLED:   { label: 'Đã hủy',       bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200',    dot: 'bg-red-400'    },
  REJECTED:    { label: 'Bị từ chối',   bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-200', dot: 'bg-orange-400' },
};

const PAYMENT_META = {
  UNPAID:   { label: 'Chưa thanh toán', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  PAID:     { label: 'Đã thanh toán',   bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
  REFUNDED: { label: 'Đã hoàn tiền',    bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
};

const TYPE_LABEL = { STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite', FAMILY: 'Family' };

const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'];
const TIMELINE_STEPS = [
  { key: 'PENDING',     label: 'Đặt phòng',  icon: '📋' },
  { key: 'CONFIRMED',   label: 'Xác nhận',   icon: '✅' },
  { key: 'CHECKED_IN',  label: 'Nhận phòng', icon: '🏠' },
  { key: 'CHECKED_OUT', label: 'Trả phòng',  icon: '🧳' },
];

const STATUS_MAP = {
  BOOKING_CONFIRMED:   'CONFIRMED',
  BOOKING_REJECTED:    'REJECTED',
  BOOKING_CHECKED_IN:  'CHECKED_IN',
  BOOKING_CHECKED_OUT: 'CHECKED_OUT',
};

/* ── Helpers ── */
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function nights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.round((new Date(checkOut + 'T00:00:00') - new Date(checkIn + 'T00:00:00')) / 86400000);
}

function canCancel(booking) {
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') return false;
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const checkIn = new Date(booking.checkIn + 'T00:00:00');
  return (checkIn - today) / 86400000 > 1;
}

/* ── Sub-components ── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function StatusTimeline({ status }) {
  const isCancelled = status === 'CANCELLED';
  const isRejected  = status === 'REJECTED';

  if (isCancelled || isRejected) {
    const label = isCancelled ? 'Đã hủy' : 'Bị từ chối';
    const icon  = isCancelled ? '❌' : '🚫';
    return (
      <div className="flex items-start gap-1">
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">📋</div>
          <span className="text-xs text-blue-700 font-medium">Đặt phòng</span>
        </div>
        <div className="flex-1 h-0.5 bg-red-200 mt-4 mx-1" />
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm">{icon}</div>
          <span className="text-xs text-red-600">{label}</span>
        </div>
      </div>
    );
  }

  const currentIdx = STATUS_ORDER.indexOf(status);

  return (
    <div className="flex items-start">
      {TIMELINE_STEPS.map((step, i) => {
        const stepIdx = STATUS_ORDER.indexOf(step.key);
        const isDone  = stepIdx <= currentIdx;
        return (
          <div key={step.key} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                ${isDone ? 'bg-blue-100' : 'bg-gray-100'}`}>
                {step.icon}
              </div>
              <span className={`text-xs text-center leading-tight px-0.5
                ${isDone ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < TIMELINE_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-4 mx-1 ${i < currentIdx ? 'bg-blue-200' : 'bg-gray-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── QR inline card ── */
function QrCard({ bookingId }) {
  const [qrUrl,      setQrUrl]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [secondsLeft,setSecondsLeft]= useState(900);
  const blobRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getCheckInQr(bookingId);
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      const url = URL.createObjectURL(res.data);
      blobRef.current = url;
      setQrUrl(url);
      setSecondsLeft(900);
    } catch {
      setError('Không thể tải mã QR. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qrUrl || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [qrUrl, secondsLeft]);

  const expired = secondsLeft <= 0;
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `qr-checkin-${bookingId}.png`;
    a.click();
  };

  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Mã QR nhận phòng</p>
          <p className="text-xs text-gray-400 mt-0.5">Xuất trình cho nhân viên lễ tân khi đến</p>
        </div>
        <span className="text-xl">📱</span>
      </div>

      <div className="p-5 flex flex-col items-center gap-4">
        <div className="relative w-56 h-56 bg-gray-50 rounded-2xl border border-gray-100
                        flex items-center justify-center overflow-hidden">
          {loading && (
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          {!loading && error && (
            <p className="text-xs text-red-500 text-center px-4">{error}</p>
          )}
          {!loading && qrUrl && !expired && (
            <img src={qrUrl} alt="QR check-in" className="w-full h-full object-contain p-3" />
          )}
          {!loading && expired && (
            <div className="text-center px-4">
              <p className="text-3xl mb-2">⏱</p>
              <p className="text-xs text-gray-500 mb-3">Mã đã hết hạn</p>
              <button onClick={load}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700
                  text-white rounded-lg transition cursor-pointer">
                Tạo mã mới
              </button>
            </div>
          )}
        </div>

        {!loading && qrUrl && !expired && (
          <div className="w-full flex items-center justify-between">
            <span className={`text-xs font-mono font-semibold tabular-nums
              ${secondsLeft < 60 ? 'text-red-500' : secondsLeft < 180 ? 'text-orange-500' : 'text-gray-500'}`}>
              ⏱ {fmtTime(secondsLeft)} còn lại
            </span>
            <div className="flex items-center gap-3">
              <button onClick={handleDownload}
                className="text-xs text-gray-600 hover:text-gray-800 font-medium transition cursor-pointer">
                ↓ Tải xuống
              </button>
              <button onClick={load} disabled={loading}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium
                  transition cursor-pointer disabled:opacity-50">
                ↺ Làm mới
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-center text-gray-400 leading-relaxed">
          Xuất trình mã này cho nhân viên lễ tân<br />để nhận phòng không cần giấy tờ.
        </p>
      </div>
    </div>
  );
}

/* ── Cancel modal ── */
function CancelModal({ booking, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">Hủy đặt phòng</h3>
        <p className="text-sm text-gray-500 mb-4">
          Phòng <span className="font-medium text-gray-800">{booking.roomNumber}</span> tại{' '}
          <span className="font-medium text-gray-800">{booking.hotelName}</span>
          <br />
          {fmt(booking.checkIn)} — {fmt(booking.checkOut)}
        </p>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Lý do hủy <span className="text-xs font-normal text-gray-400">(không bắt buộc)</span>
        </label>
        <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Ví dụ: thay đổi kế hoạch..."
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none
            focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2 border border-gray-300 text-gray-600 text-sm rounded-xl
              hover:bg-gray-50 transition cursor-pointer">
            Giữ đặt phòng
          </button>
          <button onClick={() => onConfirm(reason)} disabled={loading}
            className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300
              text-white text-sm rounded-xl transition cursor-pointer font-medium">
            {loading ? 'Đang hủy...' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function BookingDetailPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [booking,   setBooking]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [toast,     setToast]     = useState(null);
  const [showCancel,setShowCancel]= useState(false);
  const [cancelling,setCancelling]= useState(false);
  const [paying,    setPaying]    = useState(false);

  const { notifications } = useNotifications();
  const mountTime = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await getBookingById(id);
      setBooking(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Không thể tải thông tin đặt phòng');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Real-time update — bỏ qua notification đến trước khi trang mount
  useEffect(() => {
    const latest = notifications[0];
    if (!latest?.referenceId || latest.referenceId !== id) return;
    if (latest.receivedAt && new Date(latest.receivedAt).getTime() < mountTime.current) return;

    if (latest.type === 'BOOKING_PAID') {
      setBooking(prev => prev ? { ...prev, paymentStatus: 'PAID' } : prev);
      showToast('Thanh toán thành công! Email xác nhận đã được gửi.');
      return;
    }

    const newStatus = STATUS_MAP[latest.type];
    if (!newStatus) return;
    setBooking(prev => prev ? { ...prev, status: newStatus } : prev);
    const label = STATUS_META[newStatus]?.label ?? newStatus;
    showToast(`Trạng thái cập nhật: ${label}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePay = async () => {
    setPaying(true);
    try {
      await payBooking(id);
      showToast('Thanh toán thành công! Email xác nhận đã được gửi.');
      load();
    } catch (err) {
      showToast(err.response?.data?.message ?? 'Thanh toán thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setPaying(false);
    }
  };

  const handleCancelConfirm = async (reason) => {
    setCancelling(true);
    try {
      await cancelBooking(id, reason || null);
      showToast('Đã hủy đặt phòng thành công.');
      setShowCancel(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.message ?? 'Hủy thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  /* Loading skeleton */
  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-32 animate-pulse" />
        ))}
      </div>
    </div>
  );

  /* Error state */
  if (error) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">{error}</p>
        <Link to="/my-bookings" className="text-blue-600 hover:underline text-sm">
          ← Quay lại lịch sử đặt phòng
        </Link>
      </div>
    </div>
  );

  if (!booking) return null;

  const n        = nights(booking.checkIn, booking.checkOut);
  const eligible = canCancel(booking);
  const payMeta  = PAYMENT_META[booking.paymentStatus] ?? PAYMENT_META.UNPAID;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition
          ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {showCancel && (
        <CancelModal
          booking={booking}
          loading={cancelling}
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancel(false)}
        />
      )}

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* Back navigation */}
        <button onClick={() => navigate('/my-bookings')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer">
          ← Lịch sử đặt phòng
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{booking.hotelName ?? '—'}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {booking.hotelAddress}{booking.hotelCity ? `, ${booking.hotelCity}` : ''}
            </p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Booking info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-700">Thông tin đặt phòng</p>
          </div>
          <div className="p-5 space-y-4">

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Phòng</span>
              <span className="text-sm font-semibold text-gray-900">
                {booking.roomNumber ?? '—'} · {TYPE_LABEL[booking.roomType] ?? booking.roomType ?? '—'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Nhận phòng</p>
                <p className="text-sm font-semibold text-gray-900">{fmt(booking.checkIn)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">Trả phòng</p>
                <p className="text-sm font-semibold text-gray-900">{fmt(booking.checkOut)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Thời gian lưu trú</span>
              <span className="font-medium text-gray-800">{n} đêm</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Số khách</span>
              <span className="font-medium text-gray-800">{booking.guestCount ?? 1} khách</span>
            </div>

            {booking.confirmedAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Xác nhận lúc</span>
                <span className="font-medium text-gray-800">{fmtDateTime(booking.confirmedAt)}</span>
              </div>
            )}

            {booking.createdAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Ngày đặt</span>
                <span className="font-medium text-gray-800">{fmtDateTime(booking.createdAt)}</span>
              </div>
            )}

            {booking.specialRequests && (
              <div className="pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-1.5">Yêu cầu đặc biệt</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
                  {booking.specialRequests}
                </p>
              </div>
            )}

            {(booking.cancelReason) && (
              <div className="pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-1.5">
                  Lý do {booking.status === 'REJECTED' ? 'từ chối' : 'hủy'}
                </p>
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 leading-relaxed">
                  {booking.cancelReason}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Status timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-700 mb-5">Tiến trình đặt phòng</p>
          <StatusTimeline status={booking.status} />
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Thanh toán</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
              ${payMeta.bg} ${payMeta.text} ${payMeta.border}`}>
              {payMeta.label}
            </span>
          </div>
          <div className="p-5 space-y-3">

            {/* Price breakdown */}
            {booking.pricePerNight != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {(booking.pricePerNight ?? 0).toLocaleString('vi-VN')}đ × {n} đêm
                </span>
                <span className="text-gray-700">{(booking.originalPrice ?? 0).toLocaleString('vi-VN')}đ</span>
              </div>
            )}

            {booking.discountAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Giảm giá</span>
                <span className="text-green-600 font-medium">
                  − {(booking.discountAmount ?? 0).toLocaleString('vi-VN')}đ
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className="text-sm font-semibold text-gray-800">Tổng cộng</span>
              <span className="text-lg font-bold text-blue-600">
                {(booking.totalPrice ?? 0).toLocaleString('vi-VN')}đ
              </span>
            </div>

            {/* Payment history */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3">Lịch sử thanh toán</p>
              <div className="space-y-2.5">

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    <span className="text-xs text-gray-600">Tạo đặt phòng</span>
                  </div>
                  <span className="text-xs text-gray-400">{fmtDateTime(booking.createdAt)}</span>
                </div>

                {booking.paymentStatus === 'PAID' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-xs text-gray-600">Thanh toán thành công</span>
                    </div>
                    <span className="text-xs text-green-600 font-medium">
                      {(booking.totalPrice ?? 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}

                {booking.paymentStatus === 'REFUNDED' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      <span className="text-xs text-gray-600">Hoàn tiền</span>
                    </div>
                    <span className="text-xs text-blue-600 font-medium">
                      + {(booking.totalPrice ?? 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}

                {booking.paymentStatus === 'UNPAID' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                      <span className="text-xs text-gray-600">Chờ thanh toán</span>
                    </div>
                    <span className="text-xs text-yellow-600 font-medium">
                      {(booking.totalPrice ?? 0).toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* QR code — CONFIRMED only */}
        {booking.status === 'CONFIRMED' && (
          <QrCard bookingId={booking.id} />
        )}

        {/* Payment action */}
        {booking.paymentStatus === 'UNPAID' &&
         (booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
          <button onClick={handlePay} disabled={paying}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
              text-white rounded-2xl text-sm font-medium transition cursor-pointer">
            {paying ? 'Đang xử lý...' : '💳 Thanh toán ngay'}
          </button>
        )}

        {/* Chat — kèm bookingId để staff biết đang hỏi về đơn nào */}
        <Link
          to={`/chat/${booking.userId}_${booking.hotelId}?bookingId=${booking.id}`}
          className="flex items-center justify-between px-5 py-4 bg-white
            rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200
            hover:bg-blue-50 transition group">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">💬</span>
            <div>
              <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">
                Nhắn tin với khách sạn
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Hỏi về đặt phòng #{booking.id?.slice(-6).toUpperCase()}, yêu cầu đặc biệt...
              </p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* Cancel action */}
        {eligible && (
          <div className="pb-2">
            <button onClick={() => setShowCancel(true)}
              className="w-full py-3 border border-red-200 text-red-500 hover:bg-red-50
                hover:text-red-600 rounded-2xl text-sm font-medium transition cursor-pointer">
              Hủy đặt phòng
            </button>
          </div>
        )}

        {/* Booking ID footer */}
        <div className="text-center pb-4">
          <span className="text-xs text-gray-300 font-mono">Mã đặt phòng: {booking.id}</span>
        </div>

      </main>
    </div>
  );
}
