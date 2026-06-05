import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import DateRangePicker from '../components/DateRangePicker';
import { getRoomById, createBooking, getRoomBookedDates } from '../api/bookings';
import { getHotelById } from '../api/hotels';
import { validateDiscount } from '../api/discounts';

const TYPE_LABEL = { STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite', FAMILY: 'Family' };

function nights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const roomId         = searchParams.get('roomId') ?? '';

  const [checkIn,          setCheckIn]          = useState(searchParams.get('checkIn')  ?? '');
  const [checkOut,         setCheckOut]         = useState(searchParams.get('checkOut') ?? '');
  const [guestCount,       setGuestCount]       = useState(1);
  const [specialRequests,  setSpecialRequests]  = useState('');
  const [discountCode,     setDiscountCode]     = useState('');
  const [discountResult,   setDiscountResult]   = useState(null);
  const [discountError,    setDiscountError]    = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [room,             setRoom]             = useState(null);
  const [hotel,            setHotel]            = useState(null);
  const [bookedRanges,     setBookedRanges]     = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [submitting,       setSubmitting]       = useState(false);
  const [error,            setError]            = useState('');
  const [done,             setDone]             = useState(null);
  const [paymentMethod,    setPaymentMethod]    = useState('HOTEL');

  useEffect(() => {
    if (!roomId) { setLoading(false); return; }
    (async () => {
      try {
        const [roomRes, datesRes] = await Promise.all([
          getRoomById(roomId),
          getRoomBookedDates(roomId),
        ]);
        const r = roomRes.data.data;
        setRoom(r);
        setBookedRanges(datesRes.data.data ?? []);
        const hotelRes = await getHotelById(r.hotelId);
        setHotel(hotelRes.data.data);
      } catch {
        setError('Không tìm thấy thông tin phòng.');
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId]);

  const totalNights    = nights(checkIn, checkOut);
  const originalPrice  = room ? totalNights * room.pricePerNight : 0;
  const discountAmount = discountResult?.discountAmount ?? 0;
  const finalPrice     = originalPrice - discountAmount;

  const handleDateChange = (from, to) => {
    setCheckIn(from ?? '');
    setCheckOut(to   ?? '');
    setError('');
    setDiscountResult(null);
    setDiscountError('');
  };

  const handleApplyDiscount = async () => {
    if (!discountCode.trim() || !room) return;
    setApplyingDiscount(true);
    setDiscountError('');
    setDiscountResult(null);
    try {
      const res = await validateDiscount({
        code: discountCode,
        hotelId: hotel?.id,
        orderAmount: originalPrice,
      });
      setDiscountResult(res.data.data);
    } catch (err) {
      setDiscountError(err.response?.data?.message ?? 'Mã giảm giá không hợp lệ.');
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleSubmit = async () => {
    if (!checkIn || !checkOut) { setError('Vui lòng chọn ngày nhận và trả phòng.'); return; }
    if (totalNights <= 0)      { setError('Ngày trả phòng phải sau ngày nhận phòng.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await createBooking({
        roomId, checkIn, checkOut, guestCount,
        specialRequests: specialRequests || null,
        discountCode: discountResult ? discountCode : null,
      });
      setDone(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message ?? 'Đặt phòng thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success ── */
  if (done) {
    const hasDiscount = (done.discountAmount ?? 0) > 0;
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Đặt phòng thành công!</h2>
            <p className="text-sm text-gray-500 mt-1 mb-6">
              Mã đặt phòng:{' '}
              <span className="font-mono font-medium text-gray-800">{done.id}</span>
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-left space-y-2 mb-6">
              {[
                ['Khách sạn',  done.hotelName],
                ['Phòng',      `${done.roomNumber} (${TYPE_LABEL[done.roomType] ?? done.roomType})`],
                ['Nhận phòng', fmt(done.checkIn)],
                ['Trả phòng',  fmt(done.checkOut)],
                ...(hasDiscount ? [
                  ['Giá gốc',  `${(done.originalPrice ?? originalPrice).toLocaleString('vi-VN')}đ`],
                  ['Giảm giá', `−${done.discountAmount.toLocaleString('vi-VN')}đ`],
                ] : []),
                ['Tổng tiền',  `${(done.totalPrice ?? finalPrice).toLocaleString('vi-VN')}đ`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-gray-500">{label}</span>
                  <span className={`font-medium ${label === 'Giảm giá' ? 'text-green-600' : 'text-gray-900'}`}>
                    {value}
                  </span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-gray-500">Trạng thái</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  bg-yellow-50 text-yellow-700 border border-yellow-200">
                  Chờ xác nhận
                </span>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Link to="/my-bookings"
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white
                  rounded-xl transition font-medium">
                Xem lịch sử đặt phòng
              </Link>
              <Link to="/"
                className="px-4 py-2 text-sm border border-gray-300 text-gray-600
                  hover:bg-gray-50 rounded-xl transition">
                Về trang chủ
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
          <span>›</span>
          {hotel && (
            <>
              <Link to={`/hotels/${hotel.id}`} className="hover:text-blue-600 transition truncate max-w-40">
                {hotel.name}
              </Link>
              <span>›</span>
            </>
          )}
          <span className="text-gray-600">Đặt phòng</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Xác nhận đặt phòng</h1>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-28 animate-pulse" />
            ))}
          </div>
        ) : error && !room ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
              Về trang chủ
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* ══ LEFT: Form ══ */}
            <div className="lg:col-span-2 space-y-4">

              {/* Customer info display */}
              {(() => {
                const u = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
                if (!u) return null;
                return (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                      Thông tin khách hàng
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1.5">Họ và tên</label>
                        <div className="px-3.5 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm font-medium text-gray-800">
                          {u.fullName}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1.5">Email</label>
                        <div className="px-3.5 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700">
                          {u.email ?? '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Date range picker */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  Chọn ngày lưu trú
                </h3>
                {(checkIn || checkOut) && (
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1 bg-blue-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-blue-400 mb-0.5">Nhận phòng</p>
                      <p className="font-bold text-blue-800 text-sm">{checkIn ? fmt(checkIn) : '—'}</p>
                    </div>
                    <div className="flex-1 bg-blue-50 rounded-xl px-3 py-2">
                      <p className="text-xs text-blue-400 mb-0.5">Trả phòng</p>
                      <p className="font-bold text-blue-800 text-sm">{checkOut ? fmt(checkOut) : '—'}</p>
                    </div>
                    {totalNights > 0 && (
                      <div className="flex items-center justify-center px-3 bg-blue-700 rounded-xl min-w-16">
                        <p className="text-white text-xs font-bold whitespace-nowrap">{totalNights} đêm</p>
                      </div>
                    )}
                  </div>
                )}
                <DateRangePicker
                  bookedRanges={bookedRanges}
                  from={checkIn}
                  to={checkOut}
                  onChange={handleDateChange}
                />
              </div>

              {/* Guest count */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  Số khách
                </h3>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={() => setGuestCount(g => Math.max(1, g - 1))}
                    className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center
                      text-gray-600 hover:border-blue-400 hover:text-blue-600 transition text-xl font-medium leading-none cursor-pointer">
                    −
                  </button>
                  <span className="w-10 text-center font-bold text-gray-900 text-lg">{guestCount}</span>
                  <button type="button"
                    onClick={() => setGuestCount(g => Math.min(room?.capacity ?? 10, g + 1))}
                    className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center
                      text-gray-600 hover:border-blue-400 hover:text-blue-600 transition text-xl font-medium leading-none cursor-pointer">
                    +
                  </button>
                  {room?.capacity && (
                    <span className="text-sm text-gray-400">tối đa {room.capacity} khách</span>
                  )}
                </div>
              </div>

              {/* Special requests */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center shrink-0">4</span>
                  Yêu cầu đặc biệt
                  <span className="text-xs font-normal text-gray-400">(không bắt buộc)</span>
                </h3>
                <textarea rows={3} value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Ví dụ: phòng tầng cao, crib cho trẻ em, đến muộn..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm
                    outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none text-gray-700" />
              </div>

              {/* Discount code */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center shrink-0">5</span>
                  Mã giảm giá
                  <span className="text-xs font-normal text-gray-400">(không bắt buộc)</span>
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => {
                      setDiscountCode(e.target.value.toUpperCase());
                      setDiscountResult(null);
                      setDiscountError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyDiscount()}
                    placeholder="VD: SUMMER20"
                    disabled={!totalNights || !room}
                    className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm font-mono
                      tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                      disabled:bg-gray-50 disabled:text-gray-400 placeholder:font-sans placeholder:tracking-normal"
                  />
                  <button
                    type="button"
                    onClick={handleApplyDiscount}
                    disabled={!discountCode.trim() || applyingDiscount || !totalNights}
                    className="px-5 py-2.5 text-sm bg-gray-900 hover:bg-gray-700 text-white rounded-xl
                      transition font-medium whitespace-nowrap cursor-pointer
                      disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
                    {applyingDiscount ? '...' : 'Áp dụng'}
                  </button>
                </div>
                {discountResult && (
                  <div className="mt-2.5 flex items-center gap-2 px-3.5 py-2.5 bg-green-50 border border-green-200 rounded-xl">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <p className="text-sm text-green-700 font-medium flex-1">
                      Giảm {discountResult.discountAmount.toLocaleString('vi-VN')}đ
                    </p>
                    <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{discountCode}</span>
                  </div>
                )}
                {discountError && (
                  <p className="mt-2 text-sm text-red-500 flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {discountError}
                  </p>
                )}
              </div>

              {/* Payment methods */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-700 text-white text-xs font-bold flex items-center justify-center shrink-0">6</span>
                  Phương thức thanh toán
                </h3>
                <div className="space-y-2">
                  {[
                    { value: 'HOTEL',  icon: '🏨', label: 'Thanh toán tại khách sạn', desc: 'Thanh toán khi nhận phòng'   },
                    { value: 'CARD',   icon: '💳', label: 'Thẻ tín dụng / ghi nợ',   desc: 'Visa, Mastercard, JCB...'    },
                    { value: 'BANK',   icon: '🏦', label: 'Chuyển khoản ngân hàng',   desc: 'ATM, Internet Banking'       },
                    { value: 'WALLET', icon: '📱', label: 'Ví điện tử',               desc: 'Momo, ZaloPay, VNPay'        },
                  ].map(pm => (
                    <label key={pm.value}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${paymentMethod === pm.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                      <input type="radio" name="paymentMethod" value={pm.value}
                        checked={paymentMethod === pm.value}
                        onChange={() => setPaymentMethod(pm.value)}
                        className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                        ${paymentMethod === pm.value ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                        {paymentMethod === pm.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-xl">{pm.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{pm.label}</p>
                        <p className="text-xs text-gray-500">{pm.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

            </div>

            {/* ══ RIGHT: Summary ══ */}
            <div className="space-y-4 lg:sticky lg:top-24">

              {/* Room & hotel summary */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
                <div className="h-44 bg-linear-to-br from-slate-100 to-slate-200 overflow-hidden">
                  {room?.images?.[0]
                    ? <img src={room.images[0]} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-4xl">🛏</div>
                  }
                </div>
                <div className="p-4">
                  <p className="text-xs text-gray-400 font-medium mb-0.5">{hotel?.name}</p>
                  <h3 className="font-bold text-gray-900 text-sm">
                    Phòng {room?.roomNumber} — {TYPE_LABEL[room?.type] ?? room?.type}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{hotel?.address}, {hotel?.city}</p>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full">
                      {room?.capacity} khách
                    </span>
                    <span className="text-sm font-bold text-blue-700">
                      {room?.pricePerNight?.toLocaleString('vi-VN')}đ
                      <span className="text-xs font-normal text-gray-400">/đêm</span>
                    </span>
                  </div>
                </div>
                {(checkIn || checkOut) && (
                  <div className="grid grid-cols-2 border-t border-gray-100">
                    <div className="px-4 py-3 border-r border-gray-100">
                      <p className="text-xs text-gray-400">Nhận phòng</p>
                      <p className="text-sm font-bold text-gray-800">{checkIn ? fmt(checkIn) : '—'}</p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-xs text-gray-400">Trả phòng</p>
                      <p className="text-sm font-bold text-gray-800">{checkOut ? fmt(checkOut) : '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Price breakdown */}
              {totalNights > 0 && room && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Tóm tắt đặt phòng</h3>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>{room.pricePerNight?.toLocaleString('vi-VN')}đ × {totalNights} đêm</span>
                      <span>{originalPrice.toLocaleString('vi-VN')}đ</span>
                    </div>
                    {discountResult && (
                      <div className="flex justify-between text-green-600 font-medium">
                        <span>Giảm giá ({discountCode})</span>
                        <span>−{discountAmount.toLocaleString('vi-VN')}đ</span>
                      </div>
                    )}
                    <div className="border-t border-gray-100 pt-2.5 flex justify-between font-bold text-gray-900">
                      <span>Tổng cộng</span>
                      <span className="text-blue-700 text-base">{finalPrice.toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5 text-xs text-gray-500">
                    <p className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                      Hủy miễn phí trước 24h
                    </p>
                    <p className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                      Thanh toán an toàn
                    </p>
                    <p className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                      </svg>
                      Xác nhận ngay lập tức
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <button type="button" onClick={handleSubmit}
                  disabled={submitting || !checkIn || !checkOut}
                  className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300
                    text-white text-sm rounded-xl transition cursor-pointer font-bold shadow-sm shadow-blue-900/20
                    flex items-center justify-center gap-2">
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      Xác nhận đặt phòng
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
                <button type="button" onClick={() => navigate(-1)}
                  className="w-full py-3 border border-gray-300 text-gray-600 text-sm
                    rounded-xl hover:bg-gray-50 transition cursor-pointer font-medium">
                  ← Quay lại
                </button>
              </div>

            </div>

          </div>
        )}
      </main>
    </div>
  );
}
