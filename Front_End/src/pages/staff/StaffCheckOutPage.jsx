import { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { getBookingById, checkOutBooking } from '../../api/bookings';
import useBookingSocket from '../../hooks/useBookingSocket';

const STATUS_META = {
  PENDING:     { label: 'Chờ xác nhận', dot: 'bg-yellow-400', style: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  CONFIRMED:   { label: 'Đã xác nhận',  dot: 'bg-blue-400',   style: 'bg-blue-50   text-blue-700   border-blue-200'   },
  CHECKED_IN:  { label: 'Đang lưu trú', dot: 'bg-green-500',  style: 'bg-green-50  text-green-700  border-green-200'  },
  CHECKED_OUT: { label: 'Đã trả phòng', dot: 'bg-gray-400',   style: 'bg-gray-100  text-gray-500   border-gray-200'   },
  CANCELLED:   { label: 'Đã hủy',       dot: 'bg-red-400',    style: 'bg-red-50    text-red-700    border-red-200'     },
  REJECTED:    { label: 'Từ chối',       dot: 'bg-red-500',    style: 'bg-red-50    text-red-700    border-red-200'     },
};

const ROOM_TYPE_LABEL = {
  SINGLE: 'Single', DOUBLE: 'Double', TWIN: 'Twin',
  SUITE: 'Suite', DELUXE: 'Deluxe', FAMILY: 'Family',
};

const fmtDate   = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('vi-VN') : '—';
const fmtPrice  = (p) => p != null ? p.toLocaleString('vi-VN') + ' ₫' : '—';
const fmtNights = (ci, co) => ci && co
  ? Math.round((new Date(co) - new Date(ci)) / 86_400_000)
  : 0;

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', style: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${m.style}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

/* ── Multi-toast stack ──────────────────────────────────────────────────── */
function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div key={t.id}
          className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-lg
            max-w-xs text-sm font-medium animate-fade-in
            ${t.color === 'green'  ? 'bg-green-700  text-white' :
              t.color === 'indigo' ? 'bg-indigo-600 text-white' :
              t.color === 'yellow' ? 'bg-yellow-500 text-white' :
              t.color === 'red'    ? 'bg-red-600    text-white' :
                                     'bg-gray-900   text-white'}`}>
          <span className="shrink-0">{t.icon}</span>
          <span className="flex-1 leading-snug">{t.msg}</span>
          <button onClick={() => onDismiss(t.id)}
            className="ml-1 opacity-70 hover:opacity-100 cursor-pointer shrink-0">✕</button>
        </div>
      ))}
    </div>
  );
}

/* ── Live feed — guests currently checked in (need check-out) ─────────── */
function LiveFeed({ events }) {
  if (events.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-indigo-50 bg-indigo-50">
        <span className="text-indigo-500 text-sm">🏠</span>
        <span className="text-xs font-semibold text-indigo-700">Khách vừa nhận phòng</span>
        <span className="ml-auto w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
      </div>
      <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center
              text-indigo-600 font-bold text-xs shrink-0">
              {e.roomNumber ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                Phòng {e.roomNumber ?? '—'} · check-out {fmtDate(e.checkOut)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Nhận phòng lúc {e.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Main page
════════════════════════════════════════════ */
export default function StaffCheckOutPage() {
  const user    = JSON.parse(localStorage.getItem('user') ?? 'null');
  const hotelId = user?.hotelId;

  const [bookingId,   setBookingId]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [booking,     setBooking]     = useState(null);
  const [notes,       setNotes]       = useState('');
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Multi-toast
  const [toasts,   setToasts]   = useState([]);
  const addToast = useCallback((msg, icon = '🔔', color = 'indigo') => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-2), { id, msg, icon, color }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Live feed of recently checked-in guests
  const [liveFeed, setLiveFeed] = useState([]);

  const inputRef = useRef(null);
  const bookingIdRef = useRef(null);
  useEffect(() => { bookingIdRef.current = booking?.id ?? null; }, [booking]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const reset = () => {
    setBookingId('');
    setBooking(null);
    setNotes('');
    setError('');
    setSuccess(false);
    setShowConfirm(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  /* ── WebSocket ──────────────────────────────────────────────────────────── */
  useBookingSocket(hotelId, (event) => {
    const { eventType, bookingId: evId, roomNumber, checkOut: evCheckOut } = event;

    // Someone just checked in → push to live feed + toast
    if (eventType === 'BOOKING_CHECKED_IN') {
      const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      setLiveFeed((prev) => [
        { id: Date.now(), roomNumber, checkOut: evCheckOut, time },
        ...prev,
      ].slice(0, 5));
      addToast(
        `Phòng ${roomNumber ?? '?'} nhận phòng · check-out ${fmtDate(evCheckOut)}`,
        '🏠', 'indigo',
      );
    }

    // New confirmed booking (might need check-in first, but good to know)
    if (eventType === 'BOOKING_CONFIRMED') {
      addToast(`Phòng ${roomNumber ?? '?'} xác nhận · cần nhận phòng`, '🔔', 'green');
    }

    // Refresh if the currently displayed booking was updated
    if (evId && evId === bookingIdRef.current) {
      getBookingById(evId)
        .then((res) => setBooking(res.data.data))
        .catch(() => {});

      if (eventType === 'BOOKING_CHECKED_OUT') {
        addToast(`Phòng ${roomNumber ?? '?'} đã trả phòng thành công`, '🧳', 'green');
      }
      if (eventType === 'BOOKING_CANCELLED' || eventType === 'BOOKING_REJECTED') {
        addToast(`Booking phòng ${roomNumber ?? '?'} vừa bị hủy`, '⚠️', 'red');
      }
    }
  });

  /* ── Handlers ──────────────────────────────────────────────────────────── */
  const handleSearch = async () => {
    const trimmed = bookingId.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setBooking(null);
    setSuccess(false);
    setShowConfirm(false);
    try {
      const res = await getBookingById(trimmed);
      setBooking(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Không tìm thấy booking.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!booking) return;
    setCheckingOut(true);
    setError('');
    try {
      const res = await checkOutBooking(booking.id);
      setBooking(res.data.data);
      setSuccess(true);
      setShowConfirm(false);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Không thể trả phòng. Vui lòng thử lại.');
      setShowConfirm(false);
    } finally {
      setCheckingOut(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Check-out Khách</h1>
            {hotelId && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100
                border border-indigo-200 rounded-full text-xs text-indigo-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Xác nhận trả phòng · Email đánh giá gửi tự động
          </p>
        </div>

        {/* Live feed */}
        <LiveFeed events={liveFeed} />

        {/* Search card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <label className="text-xs font-medium text-gray-500 block mb-2">
            Nhập mã booking
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={bookingId}
              onChange={(e) => { setBookingId(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Mã booking..."
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none
                focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-mono min-w-0"
            />
            <button onClick={handleSearch}
              disabled={!bookingId.trim() || loading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300
                text-white text-sm rounded-xl transition cursor-pointer font-medium shrink-0">
              {loading ? '...' : 'Tìm kiếm'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200
            rounded-xl mb-4">
            <span className="text-red-500 shrink-0">✕</span>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Success banner */}
        {success && (
          <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200
            rounded-xl mb-4">
            <span className="text-green-600 text-lg">✓</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-700">Trả phòng thành công!</p>
              <p className="text-xs text-green-600 mt-0.5">
                Email đánh giá đã được gửi tới khách.
              </p>
            </div>
            <button onClick={reset}
              className="text-xs text-green-600 underline cursor-pointer shrink-0">
              Check-out tiếp
            </button>
          </div>
        )}

        {/* Booking info card */}
        {booking && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <span className="text-sm font-semibold text-gray-900">Thông tin booking</span>
              <StatusBadge status={booking.status} />
            </div>

            <div className="p-5 space-y-4">

              {/* Guest identity */}
              {booking.guestName && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50
                  border border-indigo-100 rounded-xl">
                  <span className="text-indigo-500">👤</span>
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">{booking.guestName}</p>
                    {booking.guestEmail && (
                      <p className="text-xs text-indigo-500 mt-0.5">{booking.guestEmail}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Room + price */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Phòng</p>
                  <p className="text-lg font-bold text-gray-900">{booking.roomNumber ?? '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {ROOM_TYPE_LABEL[booking.roomType] ?? booking.roomType ?? '—'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Tổng tiền</p>
                  <p className="text-base font-bold text-indigo-600">{fmtPrice(booking.totalPrice)}</p>
                  {booking.pricePerNight && (
                    <p className="text-xs text-gray-400 mt-0.5">{fmtPrice(booking.pricePerNight)}/đêm</p>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Check-in</p>
                  <p className="font-medium text-gray-800">{fmtDate(booking.checkIn)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Check-out</p>
                  <p className="font-medium text-gray-800">{fmtDate(booking.checkOut)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Số đêm</p>
                  <p className="font-medium text-gray-800">
                    {fmtNights(booking.checkIn, booking.checkOut)} đêm
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Số khách</p>
                  <p className="font-medium text-gray-800">{booking.guestCount ?? '—'} khách</p>
                </div>
              </div>

              {/* Notes — staff-side only */}
              {!success && booking.status === 'CHECKED_IN' && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1.5">
                    Ghi chú trả phòng (tùy chọn)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tình trạng phòng, vật dụng bị thiếu..."
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl
                      outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 resize-none"
                  />
                </div>
              )}

              {/* Email notice */}
              {!success && booking.status === 'CHECKED_IN' && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-green-50
                  border border-green-200 rounded-xl">
                  <span className="text-green-500 shrink-0 mt-0.5">📧</span>
                  <p className="text-xs text-green-700">
                    Email mời đánh giá sẽ được gửi tự động đến khách sau khi xác nhận.
                  </p>
                </div>
              )}

              {/* Action */}
              {!success && (() => {
                if (booking.status === 'CHECKED_IN') {
                  return showConfirm ? (
                    <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-indigo-900">Xác nhận trả phòng?</p>
                      <p className="text-xs text-indigo-600">
                        Phòng <strong>{booking.roomNumber}</strong> ·{' '}
                        {fmtNights(booking.checkIn, booking.checkOut)} đêm ·{' '}
                        {fmtPrice(booking.totalPrice)}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowConfirm(false)}
                          className="flex-1 py-2.5 text-sm border border-gray-300 rounded-xl
                            hover:bg-gray-50 transition cursor-pointer">
                          Hủy
                        </button>
                        <button onClick={handleCheckOut} disabled={checkingOut}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700
                            disabled:bg-indigo-400 text-white text-sm rounded-xl
                            transition cursor-pointer font-semibold">
                          {checkingOut ? 'Đang xử lý...' : '✓ Xác nhận trả phòng'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowConfirm(true)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700
                        text-white text-sm rounded-xl transition cursor-pointer font-semibold">
                      Trả phòng
                    </button>
                  );
                }
                if (booking.status === 'CHECKED_OUT') return (
                  <div className="text-center py-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <p className="text-sm text-gray-500">Booking này đã được trả phòng.</p>
                  </div>
                );
                return (
                  <div className="px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <p className="text-xs text-yellow-700">
                      Trạng thái{' '}
                      <strong>{STATUS_META[booking.status]?.label ?? booking.status}</strong>
                      {' '}— chỉ trả phòng khi khách đang lưu trú.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
