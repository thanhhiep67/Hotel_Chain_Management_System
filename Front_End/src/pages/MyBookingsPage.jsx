import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getMyBookings, cancelBooking, getCheckInQr } from '../api/bookings';
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

const STATUS_FILTERS = [
  { value: '',           label: 'Tất cả' },
  { value: 'PENDING',    label: 'Chờ xác nhận' },
  { value: 'CONFIRMED',  label: 'Đã xác nhận' },
  { value: 'CHECKED_IN', label: 'Đang lưu trú' },
  { value: 'CHECKED_OUT',label: 'Đã trả phòng' },
  { value: 'CANCELLED',  label: 'Đã hủy' },
  { value: 'REJECTED',   label: 'Bị từ chối' },
];

const TYPE_LABEL = { STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite', FAMILY: 'Family' };
const PAGE_SIZE  = 4;

/* ── Helpers ── */
function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function nights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.round((new Date(checkOut + 'T00:00:00') - new Date(checkIn + 'T00:00:00')) / 86400000);
}

// Can cancel if PENDING/CONFIRMED AND checkIn is more than 1 day away
function canCancel(booking) {
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') return false;
  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const checkIn = new Date(booking.checkIn + 'T00:00:00');
  return (checkIn - today) / 86400000 > 1;
}

/* ── Sub-components ── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${m.bg} ${m.text} ${m.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

/* ── QR Modal ── */
function QrModal({ booking, onClose }) {
  const [qrUrl,      setQrUrl]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [secondsLeft,setSecondsLeft]= useState(900); // 15 min
  const blobRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCheckInQr(booking.id);
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
  }, [booking.id]);

  useEffect(() => {
    load();
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown — chạy khi QR đã load và chưa hết hạn
  useEffect(() => {
    if (!qrUrl || secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(t);
  }, [qrUrl, secondsLeft]);

  const expired = secondsLeft <= 0;
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="min-w-0 pr-3">
            <p className="font-semibold text-gray-900 text-sm">Mã QR nhận phòng</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              Phòng {booking.roomNumber} · {booking.hotelName}
            </p>
          </div>
          <button onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg
              hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer">
            ✕
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col items-center gap-4">
          {/* QR image / states */}
          <div className="relative w-56 h-56 bg-gray-50 rounded-2xl border border-gray-100
                          flex items-center justify-center overflow-hidden">
            {loading && (
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {!loading && error && (
              <p className="text-xs text-red-500 text-center px-4">{error}</p>
            )}
            {!loading && qrUrl && !expired && (
              <img src={qrUrl} alt="QR check-in" className="w-full h-full object-contain" />
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

          {/* Countdown + refresh row */}
          {!loading && qrUrl && !expired && (
            <div className="w-full flex items-center justify-between">
              <span className={`text-xs font-mono font-semibold tabular-nums
                ${secondsLeft < 60 ? 'text-red-500' : secondsLeft < 180 ? 'text-orange-500' : 'text-gray-500'}`}>
                ⏱ {fmtTime(secondsLeft)} còn lại
              </span>
              <button onClick={load} disabled={loading}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium
                  transition cursor-pointer disabled:opacity-50">
                ↺ Làm mới
              </button>
            </div>
          )}

          <p className="text-xs text-center text-gray-400 leading-relaxed">
            Xuất trình mã này cho nhân viên lễ tân<br />để nhận phòng không cần giấy tờ.
          </p>
        </div>
      </div>
    </div>
  );
}

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

function BookingCard({ booking, onCancelClick, onQrClick }) {
  const n = nights(booking.checkIn, booking.checkOut);
  const meta = STATUS_META[booking.status] ?? STATUS_META.PENDING;
  const eligible = canCancel(booking);

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition
      ${booking.status === 'CANCELLED' || booking.status === 'REJECTED' ? 'opacity-70' : ''}
      ${meta.border}`}>

      {/* Header strip */}
      <div className={`h-1 w-full ${meta.dot}`} />

      <div className="p-4">
        {/* Top row: hotel + status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{booking.hotelName ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{booking.hotelAddress ?? ''}{booking.hotelCity ? `, ${booking.hotelCity}` : ''}</p>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        {/* Room + dates */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Phòng</p>
            <p className="text-sm font-semibold text-gray-900">
              {booking.roomNumber ?? '—'}
            </p>
            <p className="text-xs text-gray-500">{TYPE_LABEL[booking.roomType] ?? booking.roomType}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">Thời gian</p>
            <p className="text-sm font-medium text-gray-900">{fmt(booking.checkIn)}</p>
            <p className="text-xs text-gray-500">→ {fmt(booking.checkOut)} · {n} đêm</p>
          </div>
        </div>

        {/* Price + guests */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">{booking.guestCount ?? 1} khách</span>
          <span className="font-bold text-blue-600">
            {(booking.totalPrice ?? 0).toLocaleString('vi-VN')}đ
          </span>
        </div>

        {/* Cancel reason / confirmed info */}
        {booking.cancelReason && (
          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 mb-3 line-clamp-2">
            Lý do: {booking.cancelReason}
          </p>
        )}
        {booking.confirmedAt && booking.status === 'CONFIRMED' && (
          <p className="text-xs text-gray-400 mb-3">
            Xác nhận lúc: {fmtDateTime(booking.confirmedAt)}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <Link to={`/my-bookings/${booking.id}`}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300
              px-3 py-1 rounded-lg transition bg-white hover:bg-gray-50">
            Chi tiết
          </Link>
          <div className="flex items-center gap-2">
            {booking.status === 'CONFIRMED' && (
              <button onClick={() => onQrClick(booking)}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-300
                  px-3 py-1 rounded-lg transition cursor-pointer bg-blue-50 hover:bg-blue-100 font-medium">
                📱 Mã QR
              </button>
            )}
            {eligible && (
              <button onClick={() => onCancelClick(booking)}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300
                  px-3 py-1 rounded-lg transition cursor-pointer bg-red-50 hover:bg-red-100 font-medium">
                Hủy đặt phòng
              </button>
            )}
            {!eligible && booking.status === 'PENDING' && (
              <span className="text-xs text-gray-400">Quá hạn hủy</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ── */
function Pagination({ page, totalPages, onChange }) {
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="flex items-center justify-center gap-1 mt-8">
      <button onClick={() => onChange(page - 1)} disabled={page === 0}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl
          hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer">
        ← Trước
      </button>

      {start > 0 && (
        <>
          <button onClick={() => onChange(0)}
            className="w-9 h-9 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer">
            1
          </button>
          {start > 1 && <span className="px-1 text-gray-400">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={`w-9 h-9 text-sm rounded-xl transition cursor-pointer
            ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
          {p + 1}
        </button>
      ))}

      {end < totalPages - 1 && (
        <>
          {end < totalPages - 2 && <span className="px-1 text-gray-400">…</span>}
          <button onClick={() => onChange(totalPages - 1)}
            className="w-9 h-9 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 transition cursor-pointer">
            {totalPages}
          </button>
        </>
      )}

      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl
          hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer">
        Sau →
      </button>
    </div>
  );
}

/* ── Main page ── */
export default function MyBookingsPage() {
  const [bookings,    setBookings]    = useState([]);
  const [totalPages,  setTotalPages]  = useState(0);
  const [totalItems,  setTotalItems]  = useState(0);
  const [page,        setPage]        = useState(0);
  const [statusFilter,setStatusFilter]= useState('');
  const [loading,     setLoading]     = useState(true);
  const [cancelTarget,setCancelTarget]= useState(null);
  const [cancelling,  setCancelling]  = useState(false);
  const [toast,       setToast]       = useState(null);
  const [qrTarget,    setQrTarget]    = useState(null);

  const { notifications } = useNotifications();

  /* Update booking status in-place when a WebSocket event arrives */
  const STATUS_MAP = {
    BOOKING_CONFIRMED:   'CONFIRMED',
    BOOKING_REJECTED:    'REJECTED',
    BOOKING_CHECKED_IN:  'CHECKED_IN',
    BOOKING_CHECKED_OUT: 'CHECKED_OUT',
  };
  useEffect(() => {
    const latest = notifications[0];
    if (!latest?.referenceId) return;
    const newStatus = STATUS_MAP[latest.type];
    if (!newStatus) return;
    setBookings((prev) =>
      prev.map((b) => b.id === latest.referenceId ? { ...b, status: newStatus } : b)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      const res = await getMyBookings(params);
      const data = res.data.data;
      setBookings(data.content ?? []);
      setTotalPages(data.totalPages ?? 0);
      setTotalItems(data.totalElements ?? 0);
    } catch {
      showToast('Không thể tải danh sách đặt phòng.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = (val) => {
    setStatusFilter(val);
    setPage(0);
  };

  const handleCancelConfirm = async (reason) => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelBooking(cancelTarget.id, reason || null);
      showToast('Đã hủy đặt phòng thành công.');
      setCancelTarget(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.message ?? 'Hủy thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setCancelling(false);
    }
  };

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

      {/* QR modal */}
      {qrTarget && (
        <QrModal booking={qrTarget} onClose={() => setQrTarget(null)} />
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          loading={cancelling}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
        />
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Lịch sử đặt phòng</h1>
          {!loading && (
            <p className="text-sm text-gray-400 mt-1">{totalItems} đặt phòng</p>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_FILTERS.map(f => (
            <button key={f.value} onClick={() => handleFilterChange(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition cursor-pointer
                ${statusFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
                }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-52 animate-pulse" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              🏨
            </div>
            <p className="text-gray-500 text-sm mb-4">
              {statusFilter ? 'Không có đặt phòng nào với trạng thái này.' : 'Bạn chưa có đặt phòng nào.'}
            </p>
            <Link to="/" className="inline-block px-4 py-2 bg-blue-600 text-white text-sm
              rounded-xl hover:bg-blue-700 transition font-medium">
              Tìm khách sạn ngay
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {bookings.map(b => (
                <BookingCard key={b.id} booking={b}
                  onCancelClick={setCancelTarget}
                  onQrClick={setQrTarget} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages}
                onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
