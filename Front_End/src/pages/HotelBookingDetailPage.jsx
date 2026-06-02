import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  getBookingById, confirmBooking, rejectBooking,
  checkInBooking, checkOutBooking,
} from '../api/bookings';
import { useNotifications } from '../context/NotificationContext';

/* ── Constants ── */
const STATUS_META = {
  PENDING:     { label: 'Chờ xác nhận', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
  CONFIRMED:   { label: 'Đã xác nhận',  bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  CHECKED_IN:  { label: 'Đang lưu trú', bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500'  },
  CHECKED_OUT: { label: 'Đã trả phòng', bg: 'bg-gray-50',   text: 'text-gray-500',   border: 'border-gray-200',   dot: 'bg-gray-400'   },
  CANCELLED:   { label: 'Đã hủy',       bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-200',    dot: 'bg-red-400'    },
  REJECTED:    { label: 'Bị từ chối',   bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', dot: 'bg-orange-400' },
};

const PAYMENT_META = {
  UNPAID:   { label: 'Chưa thanh toán', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  PAID:     { label: 'Đã thanh toán',   bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
  REFUNDED: { label: 'Đã hoàn tiền',    bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200'   },
};

const TYPE_LABEL = { STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite', FAMILY: 'Family', SINGLE: 'Single', DOUBLE: 'Double', TWIN: 'Twin' };

const STATUS_ORDER  = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'];
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
const fmt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtDt = (iso) => iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const nights = (ci, co) => !ci || !co ? 0 : Math.round((new Date(co + 'T00:00:00') - new Date(ci + 'T00:00:00')) / 86400000);

/* ── Sub-components ── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
      text-xs font-medium border ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function StatusTimeline({ status }) {
  const isCancelled = status === 'CANCELLED';
  const isRejected  = status === 'REJECTED';
  if (isCancelled || isRejected) {
    return (
      <div className="flex items-start gap-1">
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">📋</div>
          <span className="text-xs text-blue-700 font-medium">Đặt phòng</span>
        </div>
        <div className="flex-1 h-0.5 bg-red-200 mt-4 mx-1" />
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm">
            {isCancelled ? '❌' : '🚫'}
          </div>
          <span className="text-xs text-red-600">{isCancelled ? 'Đã hủy' : 'Từ chối'}</span>
        </div>
      </div>
    );
  }
  const currentIdx = STATUS_ORDER.indexOf(status);
  return (
    <div className="flex items-start">
      {TIMELINE_STEPS.map((step, i) => {
        const isDone = STATUS_ORDER.indexOf(step.key) <= currentIdx;
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
              <div className={`flex-1 h-0.5 mt-4 mx-1
                ${i < currentIdx ? 'bg-blue-200' : 'bg-gray-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Reject modal ── */
function RejectModal({ booking, onConfirm, onClose, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">Từ chối đặt phòng</h3>
        <p className="text-sm text-gray-500 mb-4">
          Phòng <span className="font-medium text-gray-800">{booking.roomNumber}</span>
          {' · '}{fmt(booking.checkIn)} — {fmt(booking.checkOut)}
        </p>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Lý do từ chối <span className="text-xs font-normal text-gray-400">(bắt buộc)</span>
        </label>
        <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Ví dụ: phòng đã hết chỗ, sai thông tin..."
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none
            focus:border-red-400 focus:ring-2 focus:ring-red-100 resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2 border border-gray-300 text-gray-600 text-sm
              rounded-xl hover:bg-gray-50 transition cursor-pointer">
            Hủy
          </button>
          <button onClick={() => onConfirm(reason)} disabled={loading || !reason.trim()}
            className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300
              text-white text-sm rounded-xl transition cursor-pointer font-medium">
            {loading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Confirm action modal ── */
function ConfirmModal({ title, desc, confirmLabel, confirmCls, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-5">{desc}</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2 border border-gray-300 text-gray-600 text-sm
              rounded-xl hover:bg-gray-50 transition cursor-pointer">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2 text-white text-sm rounded-xl transition cursor-pointer
              font-medium disabled:opacity-50 ${confirmCls}`}>
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function HotelBookingDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const user       = JSON.parse(localStorage.getItem('user') ?? 'null');
  const backPath   = user?.role === 'OWNER' ? '/owner/bookings' : '/staff/bookings';

  const [booking,    setBooking]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [toast,      setToast]      = useState(null);
  const [modal,      setModal]      = useState(null); // 'confirm'|'reject'|'checkin'|'checkout'
  const [acting,     setActing]     = useState(false);

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

  // Real-time status update via notification
  useEffect(() => {
    const latest = notifications[0];
    if (!latest?.referenceId || latest.referenceId !== id) return;
    if (latest.receivedAt && new Date(latest.receivedAt).getTime() < mountTime.current) return;
    const newStatus = STATUS_MAP[latest.type];
    if (!newStatus) return;
    setBooking(prev => prev ? { ...prev, status: newStatus } : prev);
    showToast(`Trạng thái: ${STATUS_META[newStatus]?.label ?? newStatus}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const runAction = async (fn, successMsg) => {
    setActing(true);
    try {
      await fn();
      showToast(successMsg);
      setModal(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.message ?? 'Thao tác thất bại.', 'error');
    } finally {
      setActing(false);
    }
  };

  /* ── Loading ── */
  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-28 animate-pulse" />
        ))}
      </div>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 mb-4">{error}</p>
        <button onClick={() => navigate(backPath)}
          className="text-blue-600 hover:underline text-sm cursor-pointer">
          ← Quay lại danh sách
        </button>
      </div>
    </div>
  );

  if (!booking) return null;

  const n        = nights(booking.checkIn, booking.checkOut);
  const payMeta  = PAYMENT_META[booking.paymentStatus] ?? PAYMENT_META.UNPAID;
  const threadId = `${booking.userId}_${booking.hotelId}`;

  const canConfirm  = booking.status === 'PENDING';
  const canReject   = booking.status === 'PENDING';
  const canCheckIn  = booking.status === 'CONFIRMED';
  const canCheckOut = booking.status === 'CHECKED_IN';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Modals */}
      {modal === 'confirm' && (
        <ConfirmModal
          title="Xác nhận đặt phòng"
          desc={`Phòng ${booking.roomNumber} · ${fmt(booking.checkIn)} — ${fmt(booking.checkOut)}`}
          confirmLabel="Xác nhận"
          confirmCls="bg-blue-600 hover:bg-blue-700"
          loading={acting}
          onConfirm={() => runAction(() => confirmBooking(id), 'Đã xác nhận đặt phòng')}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'reject' && (
        <RejectModal
          booking={booking}
          loading={acting}
          onConfirm={(reason) => runAction(() => rejectBooking(id, reason), 'Đã từ chối đặt phòng')}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'checkin' && (
        <ConfirmModal
          title="Check-in cho khách"
          desc={`Xác nhận khách ${booking.guestName ?? 'này'} đã nhận phòng ${booking.roomNumber}?`}
          confirmLabel="Check-in"
          confirmCls="bg-green-600 hover:bg-green-700"
          loading={acting}
          onConfirm={() => runAction(() => checkInBooking(id), 'Check-in thành công')}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'checkout' && (
        <ConfirmModal
          title="Check-out cho khách"
          desc={`Xác nhận khách ${booking.guestName ?? 'này'} đã trả phòng ${booking.roomNumber}?`}
          confirmLabel="Check-out"
          confirmCls="bg-gray-700 hover:bg-gray-800"
          loading={acting}
          onConfirm={() => runAction(() => checkOutBooking(id), 'Check-out thành công')}
          onClose={() => setModal(null)}
        />
      )}

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* Back */}
        <button onClick={() => navigate(backPath)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition cursor-pointer">
          ← Danh sách đặt phòng
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

        {/* Guest info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <span className="text-base">👤</span>
            <p className="text-sm font-semibold text-gray-700">Thông tin khách</p>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Họ tên</span>
              <span className="text-sm font-semibold text-gray-900">
                {booking.guestName ?? '—'}
              </span>
            </div>
            {booking.guestEmail && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <a href={`mailto:${booking.guestEmail}`}
                  className="text-sm text-blue-600 hover:underline">
                  {booking.guestEmail}
                </a>
              </div>
            )}
            <div className="pt-2 border-t border-gray-50">
              <button
                onClick={() => navigate(`/chat/${threadId}?bookingId=${booking.id}`)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-blue-50
                  hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium
                  transition cursor-pointer">
                <span className="flex items-center gap-2">
                  <span>💬</span> Nhắn tin với khách
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor"
                  strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Booking info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-700">Thông tin đặt phòng</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">#{id.slice(-8).toUpperCase()}</p>
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
                <span className="font-medium text-gray-800">{fmtDt(booking.confirmedAt)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Ngày đặt</span>
              <span className="font-medium text-gray-800">{fmtDt(booking.createdAt)}</span>
            </div>
            {booking.specialRequests && (
              <div className="pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-1.5">Yêu cầu đặc biệt</p>
                <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100
                  rounded-xl px-3 py-2 leading-relaxed">
                  {booking.specialRequests}
                </p>
              </div>
            )}
            {booking.cancelReason && (
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
          <p className="text-sm font-semibold text-gray-700 mb-5">Tiến trình</p>
          <StatusTimeline status={booking.status} />
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Thanh toán</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full
              text-xs font-medium border ${payMeta.bg} ${payMeta.text} ${payMeta.border}`}>
              {payMeta.label}
            </span>
          </div>
          <div className="p-5 space-y-3">
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
          </div>
        </div>

        {/* Staff actions */}
        {(canConfirm || canCheckIn || canCheckOut) && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <span className="text-base">⚡</span>
              <p className="text-sm font-semibold text-gray-700">Thao tác</p>
            </div>
            <div className="p-5 space-y-3">

              {canConfirm && (
                <div className="flex gap-3">
                  <button onClick={() => setModal('confirm')}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white
                      rounded-xl text-sm font-medium transition cursor-pointer">
                    ✅ Xác nhận đặt phòng
                  </button>
                  <button onClick={() => setModal('reject')}
                    className="flex-1 py-3 border border-red-200 text-red-500
                      hover:bg-red-50 rounded-xl text-sm font-medium transition cursor-pointer">
                    ❌ Từ chối
                  </button>
                </div>
              )}

              {canCheckIn && (
                <div className="space-y-2">
                  <button onClick={() => setModal('checkin')}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white
                      rounded-xl text-sm font-medium transition cursor-pointer">
                    🏠 Check-in cho khách
                  </button>
                  <p className="text-xs text-center text-gray-400">
                    Hoặc dùng{' '}
                    <button onClick={() => navigate('/staff/check-in')}
                      className="text-blue-500 hover:underline cursor-pointer">
                      trang quét QR
                    </button>
                    {' '}để xác minh mã của khách
                  </p>
                </div>
              )}

              {canCheckOut && (
                <button onClick={() => setModal('checkout')}
                  className="w-full py-3 bg-gray-700 hover:bg-gray-800 text-white
                    rounded-xl text-sm font-medium transition cursor-pointer">
                  🧳 Check-out
                </button>
              )}
            </div>
          </div>
        )}

        <div className="text-center pb-4">
          <span className="text-xs text-gray-300 font-mono">Mã đặt phòng: {id}</span>
        </div>
      </main>
    </div>
  );
}
