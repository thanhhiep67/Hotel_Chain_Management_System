import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getMyHotels } from '../api/hotels';
import {
  getHotelBookings,
  confirmBooking,
  rejectBooking,
  checkInBooking,
  checkOutBooking,
  scanQr,
} from '../api/bookings';
import { useNotifications } from '../context/NotificationContext';

const PAGE_SIZE = 10;

const STATUS_META = {
  PENDING:     { label: 'Chờ xác nhận',  dot: 'bg-yellow-400', style: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  CONFIRMED:   { label: 'Đã xác nhận',   dot: 'bg-blue-400',   style: 'bg-blue-50   text-blue-700   border-blue-200'   },
  CHECKED_IN:  { label: 'Đang lưu trú',  dot: 'bg-green-500',  style: 'bg-green-50  text-green-700  border-green-200'  },
  CHECKED_OUT: { label: 'Đã trả phòng',  dot: 'bg-gray-400',   style: 'bg-gray-100  text-gray-500   border-gray-200'   },
  CANCELLED:   { label: 'Đã hủy',        dot: 'bg-red-400',    style: 'bg-red-50    text-red-700    border-red-200'     },
  REJECTED:    { label: 'Từ chối',        dot: 'bg-red-500',    style: 'bg-red-50    text-red-700    border-red-200'     },
};

const STATUS_FILTERS = [
  { value: '',            label: 'Tất cả'       },
  { value: 'PENDING',     label: 'Chờ xác nhận' },
  { value: 'CONFIRMED',   label: 'Đã xác nhận'  },
  { value: 'CHECKED_IN',  label: 'Đang lưu trú' },
  { value: 'CHECKED_OUT', label: 'Đã trả phòng' },
  { value: 'CANCELLED',   label: 'Đã hủy'       },
  { value: 'REJECTED',    label: 'Từ chối'       },
];

const ROOM_TYPE_LABEL = {
  SINGLE: 'Single', DOUBLE: 'Double', TWIN: 'Twin',
  SUITE: 'Suite',   DELUXE: 'Deluxe', FAMILY: 'Family',
};

const fmtDate  = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('vi-VN') : '—';
const fmtPrice = (p) => p != null ? p.toLocaleString('vi-VN') + ' ₫' : '—';
const fmtNights = (ci, co) => {
  if (!ci || !co) return 0;
  return Math.round((new Date(co) - new Date(ci)) / 86_400_000);
};
const todayStr = () => new Date().toISOString().slice(0, 10);

/* ── Status badge ── */
function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', style: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${m.style}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

/* ── Reject modal (needs reason text) ── */
function RejectModal({ booking, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-gray-900">Từ chối đặt phòng</h3>
        <p className="mt-1 text-sm text-gray-500">
          Phòng <strong>{booking.roomNumber ?? '—'}</strong>
          {' '}— {fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)}
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lý do từ chối (bắt buộc)..."
          rows={3}
          className="mt-3 w-full px-3 py-2 text-sm border border-gray-200 rounded-xl
            outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 resize-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition cursor-pointer">
            Hủy
          </button>
          <button onClick={() => onConfirm(reason)} disabled={loading || !reason.trim()}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700
              disabled:opacity-50 text-white rounded-xl transition cursor-pointer">
            {loading ? 'Đang xử lý...' : 'Từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Generic confirm modal ── */
function ActionModal({ title, desc, confirmLabel, confirmClass, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">{desc}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition cursor-pointer">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-4 py-2 text-sm text-white rounded-xl transition cursor-pointer disabled:opacity-50 ${confirmClass}`}>
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Booking card ── */
function BookingCard({ booking, isStaff, onAction }) {
  const n           = fmtNights(booking.checkIn, booking.checkOut);
  const canConfirm  = booking.status === 'PENDING';
  const canReject   = booking.status === 'PENDING';
  const canCheckIn  = booking.status === 'CONFIRMED' && isStaff;
  const canCheckOut = booking.status === 'CHECKED_IN' && isStaff;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Card body */}
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">

          {/* Left: main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900">
                Phòng {booking.roomNumber ?? '—'}
              </span>
              {booking.roomType && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {ROOM_TYPE_LABEL[booking.roomType] ?? booking.roomType}
                </span>
              )}
              <StatusBadge status={booking.status} />
            </div>

            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm text-gray-700">
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Check-in</span>
                {fmtDate(booking.checkIn)}
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Check-out</span>
                {fmtDate(booking.checkOut)}
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Số đêm</span>
                {n} đêm
              </div>
              <div>
                <span className="text-xs text-gray-400 block mb-0.5">Số khách</span>
                {booking.guestCount} khách
              </div>
            </div>

            {booking.specialRequests && (
              <p className="mt-2 text-xs text-gray-400 italic line-clamp-1">
                Yêu cầu đặc biệt: {booking.specialRequests}
              </p>
            )}
            {booking.cancelReason && (
              <p className="mt-1.5 text-xs text-red-500">
                Lý do từ chối/hủy: {booking.cancelReason}
              </p>
            )}

            <p className="mt-2 text-xs text-gray-400">
              Đặt lúc: {booking.createdAt
                ? new Date(booking.createdAt).toLocaleString('vi-VN')
                : '—'}
            </p>
          </div>

          {/* Right: price + actions */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 shrink-0">
            <div className="text-right">
              <p className="text-lg font-bold text-gray-900">{fmtPrice(booking.totalPrice)}</p>
              {booking.pricePerNight && (
                <p className="text-xs text-gray-400">{fmtPrice(booking.pricePerNight)}/đêm</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              {canConfirm && (
                <button onClick={() => onAction('confirm', booking)}
                  className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700
                    text-white rounded-xl transition cursor-pointer font-medium">
                  ✓ Xác nhận
                </button>
              )}
              {canReject && (
                <button onClick={() => onAction('reject', booking)}
                  className="px-3 py-1.5 text-xs border border-red-200 text-red-600
                    hover:bg-red-50 rounded-xl transition cursor-pointer font-medium">
                  ✕ Từ chối
                </button>
              )}
              {canCheckIn && (
                <button onClick={() => onAction('checkin', booking)}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700
                    text-white rounded-xl transition cursor-pointer font-medium">
                  Nhận phòng
                </button>
              )}
              {canCheckOut && (
                <button onClick={() => onAction('checkout', booking)}
                  className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700
                    text-white rounded-xl transition cursor-pointer font-medium">
                  Trả phòng
                </button>
              )}

              <Link to={`/chat/${booking.userId}_${booking.hotelId}`}
                className="px-3 py-1.5 text-xs rounded-xl border border-gray-200
                  text-gray-600 hover:border-blue-300 hover:text-blue-600
                  transition font-medium">
                💬 Nhắn tin
              </Link>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ── QR Scan Modal (STAFF / OWNER) ── */
function QrScanModal({ onClose, onCheckInSuccess }) {
  const [payload,     setPayload]     = useState('');
  const [verifying,   setVerifying]   = useState(false);
  const [checkingIn,  setCheckingIn]  = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const verify = async () => {
    const trimmed = payload.trim();
    if (!trimmed) return;
    setVerifying(true);
    setError('');
    setResult(null);
    try {
      const res = await scanQr(trimmed);
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Mã QR không hợp lệ hoặc đã hết hạn.');
    } finally {
      setVerifying(false);
    }
  };

  const handleCheckIn = async () => {
    if (!result) return;
    setCheckingIn(true);
    setError('');
    try {
      const res = await checkInBooking(result.id);
      onCheckInSuccess(res.data.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message ?? 'Không thể nhận phòng. Vui lòng thử lại.');
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900">Quét mã QR</p>
            <p className="text-xs text-gray-400 mt-0.5">Xác minh khách không cần giấy tờ</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg
              hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer">
            ✕
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Input — hardware QR scanner types here directly */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Đặt máy quét vào ô dưới và quét mã QR
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={payload}
                onChange={e => { setPayload(e.target.value); setError(''); setResult(null); }}
                onKeyDown={e => e.key === 'Enter' && verify()}
                placeholder="Mã QR tự điền khi quét..."
                className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none
                  focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono min-w-0"
              />
              <button onClick={verify}
                disabled={!payload.trim() || verifying}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                  text-white text-sm rounded-xl transition cursor-pointer font-medium shrink-0">
                {verifying ? '...' : 'Xác minh'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
              <span className="text-red-500 text-sm shrink-0">✕</span>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                <span>✓</span> Mã hợp lệ
              </p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Phòng</p>
                  <p className="font-semibold text-gray-900">{result.roomNumber ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Loại phòng</p>
                  <p className="font-medium text-gray-700">
                    {ROOM_TYPE_LABEL[result.roomType] ?? result.roomType ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Check-in</p>
                  <p className="font-medium text-gray-700">{fmtDate(result.checkIn)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Check-out</p>
                  <p className="font-medium text-gray-700">{fmtDate(result.checkOut)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Số khách</p>
                  <p className="font-medium text-gray-700">{result.guestCount ?? '—'} người</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Trạng thái</p>
                  <StatusBadge status={result.status} />
                </div>
              </div>

              {result.status === 'CONFIRMED' ? (
                <button onClick={handleCheckIn} disabled={checkingIn}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                    text-white text-sm rounded-xl transition cursor-pointer font-semibold">
                  {checkingIn ? 'Đang xử lý...' : '✓ Nhận phòng ngay'}
                </button>
              ) : (
                <p className="text-xs text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200">
                  Booking không ở trạng thái Đã xác nhận — không thể nhận phòng.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button onClick={() => onChange(page - 1)} disabled={page === 0}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl
          disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer">
        ← Trước
      </button>
      {start > 0 && <span className="px-2 text-gray-400">…</span>}
      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={`w-9 h-9 text-sm rounded-xl transition cursor-pointer
            ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
          {p + 1}
        </button>
      ))}
      {end < totalPages - 1 && <span className="px-2 text-gray-400">…</span>}
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl
          disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer">
        Sau →
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main page — dùng chung cho OWNER và STAFF
══════════════════════════════════════════════ */
export default function HotelBookingsPage() {
  const user    = JSON.parse(localStorage.getItem('user') ?? 'null');
  const isOwner = user?.role === 'OWNER';
  const isStaff = user?.role === 'STAFF';

  // STAFF dùng hotelId gán sẵn; OWNER chọn từ danh sách
  const [hotels,          setHotels]          = useState([]);
  const [selectedHotelId, setSelectedHotelId] = useState(isStaff ? (user?.hotelId ?? '') : '');
  const [statusFilter,    setStatusFilter]    = useState('');
  const [checkInFilter,   setCheckInFilter]   = useState('');
  const [checkOutFilter,  setCheckOutFilter]  = useState('');
  const [bookings,        setBookings]        = useState([]);
  const [page,            setPage]            = useState(0);
  const [totalPages,      setTotalPages]      = useState(0);
  const [totalElements,   setTotalElements]   = useState(0);
  const [loading,         setLoading]         = useState(false);
  const [modal,           setModal]           = useState(null); // { type, booking }
  const [actionLoading,   setActionLoading]   = useState(false);
  const [toast,           setToast]           = useState('');
  const [qrScanOpen,      setQrScanOpen]      = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const { notifications } = useNotifications();

  /* React to global WebSocket notifications — reload list when relevant */
  useEffect(() => {
    const latest = notifications[0];
    if (!latest || latest.hotelId !== selectedHotelId) return;

    const { type } = latest;
    const onPage0NoDate = page === 0 && !checkInFilter && !checkOutFilter;

    if (type === 'BOOKING_CREATED') {
      const canSee = statusFilter === '' || statusFilter === 'PENDING';
      if (canSee && onPage0NoDate) {
        loadBookings(selectedHotelId, statusFilter, checkInFilter, checkOutFilter, 0);
      }
    }

    if (type === 'BOOKING_CANCELLED') {
      const canSee = statusFilter === '' || statusFilter === 'CANCELLED';
      if (canSee && onPage0NoDate) {
        loadBookings(selectedHotelId, statusFilter, checkInFilter, checkOutFilter, 0);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  /* Load danh sách hotel cho OWNER */
  useEffect(() => {
    if (!isOwner) return;
    getMyHotels()
      .then((res) => {
        const list = res.data.data ?? [];
        setHotels(list);
        if (list.length > 0) setSelectedHotelId(list[0].id);
      })
      .catch(() => {});
  }, [isOwner]);

  /* Load bookings */
  const loadBookings = useCallback(async (hotelId, status, ci, co, p) => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const params = { page: p, size: PAGE_SIZE };
      if (status) params.status   = status;
      if (ci)     params.checkIn  = ci;
      if (co)     params.checkOut = co;
      const res = await getHotelBookings(hotelId, params);
      const d   = res.data.data;
      setBookings(d.content ?? []);
      setTotalPages(d.totalPages ?? 0);
      setTotalElements(d.totalElements ?? 0);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings(selectedHotelId, statusFilter, checkInFilter, checkOutFilter, page);
  }, [selectedHotelId, statusFilter, checkInFilter, checkOutFilter, page, loadBookings]);

  const changeFilter = (field, val) => {
    if (field === 'status')   setStatusFilter(val);
    if (field === 'checkIn')  setCheckInFilter(val);
    if (field === 'checkOut') setCheckOutFilter(val);
    setPage(0);
  };

  const applyTodayFilter = () => {
    setCheckInFilter(todayStr());
    setCheckOutFilter('');
    setPage(0);
  };

  const clearDates = () => {
    setCheckInFilter('');
    setCheckOutFilter('');
    setPage(0);
  };

  /* Actions */
  const handleAction = (type, booking) => setModal({ type, booking });

  const executeAction = async (reason) => {
    if (!modal) return;
    setActionLoading(true);
    const { type, booking } = modal;

    const MSG = {
      confirm:  'Đã xác nhận đặt phòng!',
      reject:   'Đã từ chối đặt phòng.',
      checkin:  'Khách đã nhận phòng!',
      checkout: 'Khách đã trả phòng!',
    };

    try {
      let res;
      if (type === 'confirm')  res = await confirmBooking(booking.id);
      if (type === 'reject')   res = await rejectBooking(booking.id, reason);
      if (type === 'checkin')  res = await checkInBooking(booking.id);
      if (type === 'checkout') res = await checkOutBooking(booking.id);

      // Dùng data thực từ server response để update — không reload, không phụ thuộc cache
      const updated = res?.data?.data;
      if (updated) {
        setBookings((prev) =>
          prev.map((b) => b.id === booking.id ? { ...b, ...updated } : b)
        );
      }

      showToast(MSG[type] ?? 'Thành công!');
      setModal(null);
    } catch (err) {
      showToast(err.response?.data?.message ?? 'Có lỗi xảy ra');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = bookings.filter((b) => b.status === 'PENDING').length;

  const handleQrCheckInSuccess = (updatedBooking) => {
    setBookings((prev) =>
      prev.map((b) => b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b)
    );
    showToast('Khách đã nhận phòng thành công!');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Booking</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isStaff
                ? 'Xác nhận, nhận phòng và trả phòng cho khách'
                : 'Theo dõi và xử lý các đặt phòng'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* QR scan — STAFF & OWNER */}
            {(isStaff || isOwner) && (
              <button onClick={() => setQrScanOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                  bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition cursor-pointer">
                📷 Quét QR
              </button>
            )}

          {/* Hotel selector — OWNER nhiều khách sạn */}
          {isOwner && hotels.length > 1 && (
            <select
              value={selectedHotelId}
              onChange={(e) => { setSelectedHotelId(e.target.value); setPage(0); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-xl outline-none
                focus:border-blue-500 bg-white cursor-pointer min-w-50">
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          )}
          {isOwner && hotels.length === 1 && (
            <span className="text-sm font-medium text-gray-700 bg-white px-3 py-2
              border border-gray-200 rounded-xl">
              🏨 {hotels[0]?.name}
            </span>
          )}
          </div> {/* flex items-center gap-2 */}
        </div>   {/* header row */}

        {/* ── Pending alert ── */}
        {statusFilter === '' && pendingCount > 0 && !loading && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-yellow-50 border
            border-yellow-200 rounded-xl text-sm text-yellow-800">
            <span className="text-base">⚠️</span>
            <span>Có <strong>{pendingCount}</strong> booking đang chờ xác nhận trên trang này.</span>
          </div>
        )}

        {/* ── Status filter tabs ── */}
        <div className="flex flex-wrap gap-2 mb-4">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value} onClick={() => changeFilter('status', f.value)}
              className={`px-3 py-1.5 text-sm rounded-xl border transition cursor-pointer font-medium
                ${statusFilter === f.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-400 self-center">
            {totalElements} booking
          </span>
        </div>

        {/* ── Date filters ── */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-white
          rounded-xl border border-gray-100 shadow-sm">
          <span className="text-xs font-medium text-gray-500">Lọc theo ngày:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Check-in từ</label>
            <input type="date" value={checkInFilter}
              onChange={(e) => changeFilter('checkIn', e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none
                focus:border-blue-500 bg-white cursor-pointer" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">đến</label>
            <input type="date" value={checkOutFilter}
              onChange={(e) => changeFilter('checkOut', e.target.value)}
              className="px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none
                focus:border-blue-500 bg-white cursor-pointer" />
          </div>
          <button onClick={applyTodayFilter}
            className="px-3 py-1.5 text-xs font-medium border border-blue-300 text-blue-600
              hover:bg-blue-50 rounded-lg transition cursor-pointer">
            📅 Hôm nay
          </button>
          {(checkInFilter || checkOutFilter) && (
            <button onClick={clearDates}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700
                border border-gray-200 rounded-lg transition cursor-pointer">
              ✕ Xóa ngày
            </button>
          )}
        </div>

        {/* ── Booking list ── */}
        {!selectedHotelId ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-3">🏨</div>
            <p className="text-gray-500 font-medium">Chưa có khách sạn nào được gán</p>
            <p className="text-sm text-gray-400 mt-1">Liên hệ quản trị viên để được hỗ trợ</p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i}
                className="bg-white rounded-2xl border border-gray-100 h-28 animate-pulse" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-gray-500 font-medium">Không có booking nào</p>
            <p className="text-sm text-gray-400 mt-1">Thử thay đổi bộ lọc</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                isStaff={isStaff}
                onAction={handleAction}
              />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }} />
      </main>

      {/* ── Modals ── */}
      {modal?.type === 'reject' && (
        <RejectModal
          booking={modal.booking}
          onConfirm={(reason) => executeAction(reason)}
          onCancel={() => setModal(null)}
          loading={actionLoading}
        />
      )}
      {modal?.type === 'confirm' && (
        <ActionModal
          title="Xác nhận đặt phòng"
          desc={`Xác nhận booking phòng ${modal.booking.roomNumber ?? '—'} — ${fmtDate(modal.booking.checkIn)} → ${fmtDate(modal.booking.checkOut)}?`}
          confirmLabel="Xác nhận"
          confirmClass="bg-green-600 hover:bg-green-700"
          onConfirm={() => executeAction()}
          onCancel={() => setModal(null)}
          loading={actionLoading}
        />
      )}
      {modal?.type === 'checkin' && (
        <ActionModal
          title="Check-in khách"
          desc={`Xác nhận khách nhận phòng ${modal.booking.roomNumber ?? '—'}?`}
          confirmLabel="Nhận phòng"
          confirmClass="bg-blue-600 hover:bg-blue-700"
          onConfirm={() => executeAction()}
          onCancel={() => setModal(null)}
          loading={actionLoading}
        />
      )}
      {modal?.type === 'checkout' && (
        <ActionModal
          title="Check-out khách"
          desc={`Xác nhận khách trả phòng ${modal.booking.roomNumber ?? '—'}?`}
          confirmLabel="Trả phòng"
          confirmClass="bg-indigo-600 hover:bg-indigo-700"
          onConfirm={() => executeAction()}
          onCancel={() => setModal(null)}
          loading={actionLoading}
        />
      )}

      {/* ── QR Scan Modal ── */}
      {qrScanOpen && (
        <QrScanModal
          onClose={() => setQrScanOpen(false)}
          onCheckInSuccess={handleQrCheckInSuccess}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3
          bg-gray-900 text-white text-sm rounded-2xl shadow-xl animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
