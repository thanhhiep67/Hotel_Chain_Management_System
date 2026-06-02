import { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import { getBookingById, scanQr, checkInBooking } from '../../api/bookings';
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

/* ── Multi-toast stack ─────────────────────────────────────────────────── */
function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div key={t.id}
          className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-lg
            max-w-xs text-sm font-medium animate-fade-in
            ${t.color === 'green'  ? 'bg-green-700  text-white' :
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

/* ── Live-event feed (recent CONFIRMED arrivals) ────────────────────────── */
function LiveFeed({ events }) {
  if (events.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-blue-100 shadow-sm overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-50 bg-blue-50">
        <span className="text-blue-500 text-sm">🔔</span>
        <span className="text-xs font-semibold text-blue-700">Booking sẵn sàng nhận phòng</span>
        <span className="ml-auto w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      </div>
      <div className="divide-y divide-gray-50 max-h-40 overflow-y-auto">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center
              text-blue-600 font-bold text-xs shrink-0">
              {e.roomNumber ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                Phòng {e.roomNumber ?? '—'} · {e.guestCount ?? 0} khách
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {fmtDate(e.checkIn)} → {fmtDate(e.checkOut)}
              </p>
            </div>
            <p className="text-xs text-gray-400 shrink-0">{e.time}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Main page
════════════════════════════════════════════ */
export default function StaffCheckInPage() {
  const user    = JSON.parse(localStorage.getItem('user') ?? 'null');
  const hotelId = user?.hotelId;

  const [tab,        setTab]        = useState('qr');
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [booking,    setBooking]    = useState(null);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);

  // Multi-toast stack
  const [toasts,   setToasts]   = useState([]);
  const addToast = useCallback((msg, icon = '🔔', color = 'blue') => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-2), { id, msg, icon, color }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Live feed of incoming CONFIRMED bookings (last 5)
  const [liveFeed, setLiveFeed] = useState([]);

  const inputRef = useRef(null);
  // Track current booking ID via ref — avoids stale closure in WS callback
  const bookingIdRef = useRef(null);
  useEffect(() => { bookingIdRef.current = booking?.id ?? null; }, [booking]);

  useEffect(() => { inputRef.current?.focus(); }, [tab]);

  const reset = () => {
    setInput('');
    setBooking(null);
    setError('');
    setSuccess(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const switchTab = (t) => { setTab(t); reset(); };

  /* ── WebSocket ─────────────────────────────────────────────────────────── */
  useBookingSocket(hotelId, (event) => {
    const { eventType, bookingId: evId, roomNumber, checkIn, checkOut, guestCount } = event;

    // New booking confirmed → push to live feed + toast
    if (eventType === 'BOOKING_CONFIRMED') {
      const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      setLiveFeed((prev) => [
        { id: Date.now(), roomNumber, checkIn, checkOut, guestCount, time },
        ...prev,
      ].slice(0, 5));
      addToast(
        `Phòng ${roomNumber ?? '?'} sẵn sàng nhận phòng · ${fmtDate(checkIn)}`,
        '🔔', 'blue',
      );
    }

    // Any status change on the booking currently displayed → re-fetch silently
    if (evId && evId === bookingIdRef.current) {
      getBookingById(evId)
        .then((res) => setBooking(res.data.data))
        .catch(() => {});

      if (eventType === 'BOOKING_CANCELLED' || eventType === 'BOOKING_REJECTED') {
        addToast(`Booking phòng ${roomNumber ?? '?'} vừa bị hủy/từ chối`, '⚠️', 'red');
      }
      if (eventType === 'BOOKING_CHECKED_IN') {
        addToast(`Phòng ${roomNumber ?? '?'} đã nhận phòng`, '✓', 'green');
      }
    }
  });

  /* ── Handlers ──────────────────────────────────────────────────────────── */
  const handleSearch = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setBooking(null);
    setSuccess(false);
    try {
      const res = tab === 'qr'
        ? await scanQr(trimmed)
        : await getBookingById(trimmed);
      setBooking(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? (
        tab === 'qr' ? 'Mã QR không hợp lệ hoặc đã hết hạn.' : 'Không tìm thấy booking.'
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!booking) return;
    setCheckingIn(true);
    setError('');
    try {
      const res = await checkInBooking(booking.id);
      setBooking(res.data.data);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Không thể nhận phòng. Vui lòng thử lại.');
    } finally {
      setCheckingIn(false);
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
            <h1 className="text-2xl font-bold text-gray-900">Check-in Khách</h1>
            {hotelId && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100
                border border-green-200 rounded-full text-xs text-green-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Xác minh khách không cần giấy tờ</p>
        </div>

        {/* Live feed */}
        <LiveFeed events={liveFeed} />

        {/* Tabs */}
        <div className="flex rounded-xl border border-gray-200 bg-white p-1 mb-4 gap-1">
          {[
            { key: 'qr', icon: '📷', label: 'Quét mã QR'       },
            { key: 'id', icon: '🔢', label: 'Nhập mã booking'  },
          ].map(({ key, icon, label }) => (
            <button key={key} onClick={() => switchTab(key)}
              className={`flex-1 py-2 text-sm rounded-lg font-medium transition cursor-pointer
                ${tab === key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Input card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <label className="text-xs font-medium text-gray-500 block mb-2">
            {tab === 'qr'
              ? 'Đặt đầu đọc QR vào ô bên dưới và quét'
              : 'Nhập mã booking đầy đủ'}
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={tab === 'qr' ? 'Mã QR tự điền khi quét...' : 'Mã booking...'}
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl outline-none
                focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono min-w-0"
            />
            <button onClick={handleSearch}
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                text-white text-sm rounded-xl transition cursor-pointer font-medium shrink-0">
              {loading ? '...' : tab === 'qr' ? 'Xác minh' : 'Tìm kiếm'}
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
            <p className="text-sm font-semibold text-green-700 flex-1">Nhận phòng thành công!</p>
            <button onClick={reset}
              className="text-xs text-green-600 underline cursor-pointer shrink-0">
              Check-in tiếp
            </button>
          </div>
        )}

        {/* Guest info card */}
        {booking && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <span className="text-sm font-semibold text-gray-900">Thông tin booking</span>
              <StatusBadge status={booking.status} />
            </div>

            <div className="p-5 space-y-4">

              {/* Guest identity */}
              {booking.guestName && (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-blue-50
                  border border-blue-100 rounded-xl">
                  <span className="text-blue-500">👤</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">{booking.guestName}</p>
                    {booking.guestEmail && (
                      <p className="text-xs text-blue-500 mt-0.5">{booking.guestEmail}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Room + price chips */}
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
                  <p className="text-base font-bold text-blue-600">{fmtPrice(booking.totalPrice)}</p>
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

              {/* Special requests */}
              {booking.specialRequests && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">Yêu cầu đặc biệt</p>
                  <p className="text-sm text-amber-800">{booking.specialRequests}</p>
                </div>
              )}

              {/* Action */}
              {!success && (() => {
                if (booking.status === 'CONFIRMED') return (
                  <button onClick={handleCheckIn} disabled={checkingIn}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                      text-white text-sm rounded-xl transition cursor-pointer font-semibold">
                    {checkingIn ? 'Đang xử lý...' : '✓ Xác nhận nhận phòng'}
                  </button>
                );
                if (booking.status === 'CHECKED_IN') return (
                  <div className="text-center py-3 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm font-semibold text-green-700">✓ Khách đã nhận phòng</p>
                  </div>
                );
                return (
                  <div className="px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl">
                    <p className="text-xs text-yellow-700">
                      Booking ở trạng thái{' '}
                      <strong>{STATUS_META[booking.status]?.label ?? booking.status}</strong>
                      {' '}— không thể nhận phòng.
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
