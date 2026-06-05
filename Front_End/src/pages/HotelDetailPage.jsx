import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReviewSection from '../components/ReviewSection';
import { getHotelById } from '../api/hotels';

const TYPE_LABEL = { STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite', FAMILY: 'Family' };
const TYPE_ORDER = ['STANDARD', 'DELUXE', 'SUITE', 'FAMILY'];
const TYPE_COLOR = {
  STANDARD: 'bg-gray-100 text-gray-700',
  DELUXE:   'bg-blue-100 text-blue-700',
  SUITE:    'bg-purple-100 text-purple-700',
  FAMILY:   'bg-green-100 text-green-700',
};

const AMENITY_SVG = {
  'WiFi':                { d: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.143 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', label: 'Wifi miễn phí' },
  'Wi-Fi':               { d: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.143 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', label: 'Wifi miễn phí' },
  'Hồ bơi':             { d: 'M3 13.5C3 12 4 11 5.5 11S8 12 8 13.5 7 16 5.5 16 3 15 3 13.5zm9 0C12 12 13 11 14.5 11S17 12 17 13.5 16 16 14.5 16 12 15 12 13.5zm3-7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z M3 20c1.5-1 3-1.5 4.5-1.5s3 .5 4.5 1.5 3 1.5 4.5 1.5 3-.5 4.5-1.5', label: 'Hồ bơi' },
  'Spa':                 { d: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', label: 'Spa' },
  'Nhà hàng':           { d: 'M3 6h18M3 12h18M3 18h18M6 3v18M18 3v18', label: 'Nhà hàng' },
  'Gym':                 { d: 'M4.5 12.375a.375.375 0 11.75 0 .375.375 0 01-.75 0zm0-6a.375.375 0 11.75 0 .375.375 0 01-.75 0zm0 12a.375.375 0 11.75 0 .375.375 0 01-.75 0zM19.125 12.375a.375.375 0 11.75 0 .375.375 0 01-.75 0zm0-6a.375.375 0 11.75 0 .375.375 0 01-.75 0zm0 12a.375.375 0 11.75 0 .375.375 0 01-.75 0zM6.75 12h10.5M3 12h1.5M19.5 12H21', label: 'Gym' },
  'Bãi đỗ xe':          { d: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12', label: 'Bãi đỗ xe' },
  'Bar':                 { d: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1-.26 2.28-1.7 1.8l-1.5-.5', label: 'Bar' },
  'Dịch vụ phòng':      { d: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0', label: 'Dịch vụ phòng' },
  'Điều hòa':           { d: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z', label: 'Điều hòa' },
  'Trung tâm hội nghị': { d: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z', label: 'Hội nghị' },
};

const SCORE_LABEL = (r) => {
  if (!r || r === 0) return null;
  const s = r * 2;
  if (s >= 9)   return 'Tuyệt vời';
  if (s >= 8)   return 'Rất tốt';
  if (s >= 7)   return 'Tốt';
  if (s >= 6)   return 'Khá';
  return 'Bình thường';
};

/* ── Gallery: 1 large + 2×2 grid ── */
function Gallery({ images, name }) {
  const [active, setActive] = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (!images?.length) return (
    <div className="h-80 rounded-2xl bg-linear-to-br from-blue-100 to-indigo-200
      flex items-center justify-center text-6xl">🏨</div>
  );

  const thumbs = images.slice(1, 5);

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-2xl overflow-hidden h-80 md:h-96">
        {/* Main image */}
        <div className="relative overflow-hidden bg-gray-100">
          <img src={images[active]} alt={name} className="w-full h-full object-cover" />
          {images.length > 1 && (
            <>
              <button onClick={() => setActive(a => (a - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40
                  hover:bg-black/60 text-white rounded-full flex items-center justify-center transition cursor-pointer text-lg">
                ‹
              </button>
              <button onClick={() => setActive(a => (a + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40
                  hover:bg-black/60 text-white rounded-full flex items-center justify-center transition cursor-pointer text-lg">
                ›
              </button>
            </>
          )}
        </div>

        {/* 2×2 grid */}
        {thumbs.length > 0 && (
          <div className="hidden md:grid grid-cols-2 grid-rows-2 gap-2">
            {thumbs.map((img, i) => (
              <div key={i} className="relative overflow-hidden bg-gray-100 cursor-pointer"
                onClick={() => setActive(i + 1)}>
                <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                {i === 3 && images.length > 5 && (
                  <button onClick={e => { e.stopPropagation(); setShowAll(true); }}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center
                      text-white font-semibold text-sm hover:bg-black/60 transition cursor-pointer">
                    +{images.length - 5} ảnh
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition cursor-pointer
                ${i === active ? 'border-blue-500' : 'border-transparent opacity-50 hover:opacity-90'}`}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* "See all" button */}
      <div className="flex justify-end mt-2">
        <button onClick={() => setShowAll(true)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800
            hover:underline cursor-pointer font-semibold transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
          </svg>
          Xem tất cả {images.length} ảnh
        </button>
      </div>

      {/* Lightbox */}
      {showAll && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setShowAll(false)}>
          <button className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center
            justify-center rounded-full hover:bg-white/10 cursor-pointer" onClick={() => setShowAll(false)}>
            ✕
          </button>
          <img src={images[active]} alt={name}
            className="max-h-[80vh] max-w-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()} />
          <div className="flex gap-2 mt-4 overflow-x-auto max-w-full pb-2">
            {images.map((img, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setActive(i); }}
                className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 cursor-pointer
                  ${i === active ? 'border-white' : 'border-transparent opacity-50 hover:opacity-90'}`}>
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stars ── */
function Stars({ rating, size = 'md' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={`${sz} ${s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0
            1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54
            1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292
            a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

/* ── Room card ── */
function RoomCard({ room, checkIn, checkOut }) {
  const navigate  = useNavigate();
  const available = room.status === 'AVAILABLE';

  const handleBook = () => {
    const user = localStorage.getItem('user');
    if (!user) { navigate('/login', { state: { from: window.location.pathname } }); return; }
    const params = new URLSearchParams({ roomId: room.id });
    if (checkIn)  params.set('checkIn',  checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    navigate(`/booking?${params.toString()}`);
  };

  const nights = (checkIn && checkOut)
    ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000))
    : 0;

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden flex flex-col sm:flex-row
      hover:shadow-lg transition-all duration-200 shadow-sm
      ${available ? 'border-gray-100' : 'border-gray-100 opacity-70'}`}>

      {/* Image */}
      <div className="sm:w-44 h-40 sm:h-auto shrink-0 bg-linear-to-br from-slate-100 to-slate-200 overflow-hidden relative">
        {room.images?.[0]
          ? <img src={room.images[0]} alt={room.roomNumber} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-4xl">🛏️</div>
        }
        <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-semibold
          ${TYPE_COLOR[room.type] ?? 'bg-gray-100 text-gray-600'}`}>
          {TYPE_LABEL[room.type] ?? room.type}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-gray-900 text-base truncate">
                {TYPE_LABEL[room.type] ?? room.type} Room · Phòng {room.roomNumber}
              </h4>
              {room.description && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">{room.description}</p>
              )}
            </div>
          </div>

          {/* Details row */}
          <div className="flex flex-wrap gap-3 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {room.capacity} người
            </span>
            {room.amenities?.slice(0, 3).map(a => (
              <span key={a} className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
                {a}
              </span>
            ))}
          </div>
        </div>

        {/* Price + Status + Button */}
        <div className="flex items-end justify-between mt-4 gap-3 flex-wrap">
          <div>
            <p className="text-2xl font-extrabold text-blue-700 leading-none">
              {room.pricePerNight?.toLocaleString('vi-VN')}₫
            </p>
            <p className="text-xs text-gray-400 mt-0.5">/ đêm</p>
            {nights > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {nights} đêm = <span className="font-bold text-gray-800">{(nights * room.pricePerNight).toLocaleString('vi-VN')}₫</span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`text-xs font-semibold ${available ? 'text-emerald-600' : 'text-orange-500'}`}>
              {available ? '✓ Còn phòng' : '✗ Bảo trì'}
            </span>
            <button onClick={handleBook} disabled={!available}
              className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-100
                disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-bold
                rounded-xl transition cursor-pointer shadow-sm shadow-blue-900/20 whitespace-nowrap">
              {available ? 'Chọn phòng' : 'Không khả dụng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Chat button ── */
function ChatButton({ hotelId }) {
  const navigate = useNavigate();
  const user     = JSON.parse(localStorage.getItem('user') ?? 'null');
  if (user?.role === 'STAFF' && user?.hotelId === hotelId) return null;
  if (user?.role === 'OWNER') return null;
  if (user?.role === 'ADMIN') return null;
  const handleChat = () => {
    if (!user) { navigate('/login', { state: { from: window.location.pathname } }); return; }
    navigate(`/chat/${user.id}_${hotelId}`);
  };
  return (
    <button onClick={handleChat}
      className="flex items-center gap-2 px-4 py-2 text-sm font-semibold
        border-2 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl transition cursor-pointer">
      💬 Nhắn tin với khách sạn
    </button>
  );
}

/* ════════════ Main page ════════════ */
export default function HotelDetailPage() {
  const { id }   = useParams();
  const { state } = useLocation();
  const checkIn  = state?.checkIn  ?? '';
  const checkOut = state?.checkOut ?? '';

  const [hotel,   setHotel]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    getHotelById(id)
      .then(res => setHotel(res.data.data))
      .catch(() => setError('Không tìm thấy khách sạn.'))
      .finally(() => setLoading(false));
  }, [id]);

  /* Loading skeleton */
  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-10 animate-pulse space-y-6">
        <div className="h-96 bg-gray-200 rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-3">
            <div className="h-8 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
            <div className="h-20 bg-gray-100 rounded" />
          </div>
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );

  /* Error */
  if (error) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-gray-700 mb-2">{error}</h2>
        <Link to="/" className="mt-3 px-5 py-2 bg-blue-700 text-white text-sm font-medium rounded-xl hover:bg-blue-800 transition">
          ← Quay về trang chủ
        </Link>
      </div>
    </div>
  );

  const activeRooms = hotel.rooms?.filter(r => r.status !== 'DELETED') ?? [];
  const roomsByType = TYPE_ORDER.reduce((acc, t) => {
    const list = activeRooms.filter(r => r.type === t);
    if (list.length) acc[t] = list;
    return acc;
  }, {});

  const minPrice = activeRooms.length
    ? Math.min(...activeRooms.filter(r => r.status === 'AVAILABLE').map(r => r.pricePerNight).filter(Boolean))
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 flex items-center gap-2 mb-5">
          <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
          <span>›</span>
          <span className="text-gray-600 font-medium truncate">{hotel.name}</span>
        </nav>

        {/* Gallery */}
        <Gallery images={hotel.images} name={hotel.name} />

        {/* Hotel info + Booking panel */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Hotel info ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Name + rating */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-extrabold text-gray-900 leading-tight">{hotel.name}</h1>

                  {hotel.avgRating > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Stars rating={hotel.avgRating} />
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-700 text-white text-sm font-extrabold px-2.5 py-1 rounded-lg leading-none">
                          {(hotel.avgRating * 2).toFixed(1)}
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {SCORE_LABEL(hotel.avgRating)}
                        </span>
                        {hotel.reviewCount > 0 && (
                          <span className="text-sm text-gray-400">({hotel.reviewCount} đánh giá)</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500">
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <span>{hotel.address}, {hotel.city}</span>
                  </div>
                </div>
                <ChatButton hotelId={hotel.id} />
              </div>

              {hotel.description && (
                <p className="mt-4 text-gray-600 text-sm leading-relaxed border-t border-gray-100 pt-4">
                  {hotel.description}
                </p>
              )}
            </div>

            {/* Amenities — horizontal icon bar */}
            {hotel.amenities?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex flex-wrap gap-x-2 gap-y-4 justify-start">
                  {hotel.amenities.map(a => {
                    const svg = AMENITY_SVG[a];
                    return (
                      <div key={a} className="flex flex-col items-center gap-1.5 min-w-16 px-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                          {svg ? (
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={svg.d}/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-xs text-gray-600 font-medium text-center leading-tight">{a}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Date selected */}
            {(checkIn || checkOut) && (
              <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm">
                {checkIn  && (
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">📅</span>
                    <span className="text-blue-500 text-xs">Nhận phòng</span>
                    <span className="font-bold text-blue-800">{checkIn}</span>
                  </div>
                )}
                {checkIn && checkOut && <span className="text-blue-200">→</span>}
                {checkOut && (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-800">{checkOut}</span>
                    <span className="text-blue-500 text-xs">Trả phòng</span>
                  </div>
                )}
              </div>
            )}

            {/* Rooms */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Danh sách phòng</h2>
              {Object.keys(roomsByType).length === 0 ? (
                <div className="text-center py-14 bg-white rounded-2xl border border-gray-100">
                  <div className="text-4xl mb-3">🛏️</div>
                  <p className="text-gray-500 font-medium">Khách sạn chưa có phòng nào.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(roomsByType).map(([type, rooms]) => (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-5 bg-blue-700 rounded-full" />
                        <h3 className="font-bold text-gray-800">{TYPE_LABEL[type]}</h3>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {rooms.length} phòng
                        </span>
                      </div>
                      <div className="space-y-3">
                        {rooms.map(room => (
                          <RoomCard key={room.id} room={room} checkIn={checkIn} checkOut={checkOut} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reviews */}
            <ReviewSection
              hotelId={hotel.id}
              avgRating={hotel.avgRating}
              reviewCount={hotel.reviewCount}
            />
          </div>

          {/* ── Right: Sticky panel ── */}
          <div className="hidden lg:block">
            {(() => {
              const stayNights = (checkIn && checkOut)
                ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000))
                : 0;
              const subTotal  = minPrice && stayNights ? minPrice * stayNights : 0;
              const tax       = Math.round(subTotal * 0.1);
              const total     = subTotal + tax;
              return (
                <div className="sticky top-8 bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
                  {/* Header */}
                  <div className="bg-blue-700 px-5 py-5 text-white">
                    {stayNights > 0 && minPrice ? (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold uppercase tracking-wide opacity-75">
                            {hotel.name}
                          </p>
                          <span className="text-xs opacity-70 bg-white/20 px-2 py-0.5 rounded-full">
                            {stayNights} đêm
                          </span>
                        </div>
                        <p className="text-3xl font-extrabold">
                          {total.toLocaleString('vi-VN')}₫
                        </p>
                        <p className="text-xs opacity-70 mt-0.5">Đã bao gồm thuế & phí</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-75 mb-1">Giá từ</p>
                        {minPrice ? (
                          <p className="text-3xl font-extrabold">
                            {minPrice.toLocaleString('vi-VN')}₫
                            <span className="text-sm font-normal opacity-75"> / đêm</span>
                          </p>
                        ) : (
                          <p className="text-lg font-semibold opacity-80">Liên hệ để biết giá</p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Dates */}
                    {(checkIn || checkOut) ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="border border-blue-200 bg-blue-50 rounded-xl p-3">
                          <p className="text-xs text-blue-400 font-medium mb-1">Nhận phòng</p>
                          <p className="text-sm font-bold text-blue-800">{checkIn || '—'}</p>
                        </div>
                        <div className="border border-blue-200 bg-blue-50 rounded-xl p-3">
                          <p className="text-xs text-blue-400 font-medium mb-1">Trả phòng</p>
                          <p className="text-sm font-bold text-blue-800">{checkOut || '—'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-500">Chọn ngày để xem giá tốt nhất</p>
                      </div>
                    )}

                    {/* Price breakdown (only when dates selected) */}
                    {stayNights > 0 && minPrice > 0 && (
                      <div className="space-y-2 text-sm bg-gray-50 rounded-xl p-4">
                        <div className="flex justify-between text-gray-600">
                          <span>{minPrice.toLocaleString('vi-VN')}₫ × {stayNights} đêm</span>
                          <span>{subTotal.toLocaleString('vi-VN')}₫</span>
                        </div>
                        <div className="flex justify-between text-gray-500 text-xs">
                          <span>Thuế &amp; phí (10%)</span>
                          <span>{tax.toLocaleString('vi-VN')}₫</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
                          <span>Tổng tiền</span>
                          <span className="text-blue-700">{total.toLocaleString('vi-VN')}₫</span>
                        </div>
                      </div>
                    )}

                    {/* Amenity summary */}
                    {hotel.amenities?.slice(0, 3).map(a => (
                      <div key={a} className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                        </svg>
                        <span>{a}</span>
                      </div>
                    ))}

                    {/* CTA */}
                    <button
                      onClick={() => {
                        const firstAvailable = activeRooms.find(r => r.status === 'AVAILABLE');
                        if (!firstAvailable) return;
                        const user = localStorage.getItem('user');
                        if (!user) { window.location.href = '/login'; return; }
                        const params = new URLSearchParams({ roomId: firstAvailable.id });
                        if (checkIn)  params.set('checkIn',  checkIn);
                        if (checkOut) params.set('checkOut', checkOut);
                        window.location.href = `/booking?${params.toString()}`;
                      }}
                      className="w-full py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold
                        rounded-xl transition text-sm cursor-pointer shadow-sm shadow-blue-900/20 flex items-center justify-center gap-2">
                      Tiếp tục đặt phòng
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>

                    <div className="space-y-1.5 pt-1">
                      {[
                        'Hủy miễn phí trước 24h nhận phòng',
                        'Thanh toán an toàn – bảo mật thông tin',
                        'Hỗ trợ 24/7',
                      ].map(t => (
                        <p key={t} className="flex items-center gap-2 text-xs text-gray-500">
                          <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                          </svg>
                          {t}
                        </p>
                      ))}
                    </div>

                    {/* Rating badge */}
                    {hotel.avgRating > 0 && (
                      <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                        <div className="w-12 h-12 bg-blue-700 rounded-xl flex items-center justify-center
                          text-white font-extrabold text-base shrink-0">
                          {hotel.avgRating.toFixed(1)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {hotel.avgRating >= 4.5 ? 'Tuyệt vời' : hotel.avgRating >= 4 ? 'Rất tốt' : 'Tốt'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{hotel.reviewCount} đánh giá từ khách</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      </main>
    </div>
  );
}
