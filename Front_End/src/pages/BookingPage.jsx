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
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

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
          <div className="space-y-4">

            {/* Room & hotel info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <div className="sm:w-40 h-36 sm:h-auto shrink-0 bg-linear-to-br
                  from-slate-100 to-slate-200 overflow-hidden">
                  {room?.images?.[0]
                    ? <img src={room.images[0]} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl">🛏</div>
                  }
                </div>
                <div className="flex-1 p-4">
                  <p className="text-xs text-gray-400 mb-1">{hotel?.name}</p>
                  <h3 className="font-semibold text-gray-900">
                    Phòng {room?.roomNumber} — {TYPE_LABEL[room?.type] ?? room?.type}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">{hotel?.address}, {hotel?.city}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>Sức chứa: {room?.capacity} khách</span>
                    <span>·</span>
                    <span className="font-medium text-gray-800">
                      {room?.pricePerNight?.toLocaleString('vi-VN')}đ / đêm
                    </span>
                  </div>
                  {room?.amenities?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {room.amenities.slice(0, 4).map((a) => (
                        <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Date range picker */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Chọn ngày lưu trú</h3>
              {(checkIn || checkOut) && (
                <div className="flex gap-4 mb-3 text-sm">
                  <div className="flex-1 bg-blue-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-blue-400 mb-0.5">Nhận phòng</p>
                    <p className="font-semibold text-blue-800">{checkIn ? fmt(checkIn) : '—'}</p>
                  </div>
                  <div className="flex-1 bg-blue-50 rounded-xl px-3 py-2">
                    <p className="text-xs text-blue-400 mb-0.5">Trả phòng</p>
                    <p className="font-semibold text-blue-800">{checkOut ? fmt(checkOut) : '—'}</p>
                  </div>
                  {totalNights > 0 && (
                    <div className="flex items-center px-2">
                      <span className="text-xs text-gray-400">{totalNights} đêm</span>
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <label className="text-sm font-semibold text-gray-700 block mb-3">Số khách</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setGuestCount(g => Math.max(1, g - 1))}
                  className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 transition text-lg leading-none cursor-pointer">
                  −
                </button>
                <span className="w-8 text-center font-semibold text-gray-900">{guestCount}</span>
                <button type="button"
                  onClick={() => setGuestCount(g => Math.min(room?.capacity ?? 10, g + 1))}
                  className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center
                    text-gray-600 hover:bg-gray-50 transition text-lg leading-none cursor-pointer">
                  +
                </button>
                {room?.capacity && (
                  <span className="text-xs text-gray-400 ml-1">tối đa {room.capacity} khách</span>
                )}
              </div>
            </div>

            {/* Special requests */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Yêu cầu đặc biệt{' '}
                <span className="text-xs font-normal text-gray-400">(không bắt buộc)</span>
              </label>
              <textarea rows={3} value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Ví dụ: phòng tầng cao, crib cho trẻ em, đến muộn..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm
                  outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none" />
            </div>

            {/* Discount code */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Mã giảm giá{' '}
                <span className="text-xs font-normal text-gray-400">(không bắt buộc)</span>
              </label>
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
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono
                    tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100
                    disabled:bg-gray-50 disabled:text-gray-400 placeholder:font-sans placeholder:tracking-normal"
                />
                <button
                  type="button"
                  onClick={handleApplyDiscount}
                  disabled={!discountCode.trim() || applyingDiscount || !totalNights}
                  className="px-4 py-2 text-sm bg-gray-900 hover:bg-gray-700 text-white rounded-xl
                    transition font-medium whitespace-nowrap cursor-pointer
                    disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed">
                  {applyingDiscount ? 'Đang kiểm tra...' : 'Áp dụng'}
                </button>
              </div>
              {discountResult && (
                <p className="mt-2 text-sm text-green-600 flex items-center gap-1.5">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Áp dụng thành công — giảm {discountResult.discountAmount.toLocaleString('vi-VN')}đ
                </p>
              )}
              {discountError && (
                <p className="mt-2 text-sm text-red-500">{discountError}</p>
              )}
            </div>

            {/* Price summary */}
            {totalNights > 0 && room && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Chi tiết giá</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>{room.pricePerNight?.toLocaleString('vi-VN')}đ × {totalNights} đêm</span>
                    <span>{originalPrice.toLocaleString('vi-VN')}đ</span>
                  </div>
                  {discountResult && (
                    <div className="flex justify-between text-green-600">
                      <span>Giảm giá ({discountCode})</span>
                      <span>−{discountAmount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  )}
                  <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold text-gray-900">
                    <span>Tổng cộng</span>
                    <span className="text-blue-600 text-base">{finalPrice.toLocaleString('vi-VN')}đ</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl
                px-4 py-2 text-center">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button type="button" onClick={() => navigate(-1)}
                className="flex-1 py-3 border border-gray-300 text-gray-600 text-sm
                  rounded-xl hover:bg-gray-50 transition cursor-pointer font-medium">
                Quay lại
              </button>
              <button type="button" onClick={handleSubmit}
                disabled={submitting || !checkIn || !checkOut}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                  text-white text-sm rounded-xl transition cursor-pointer font-semibold">
                {submitting ? 'Đang xử lý...' : 'Xác nhận đặt phòng'}
              </button>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
