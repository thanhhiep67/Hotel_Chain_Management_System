import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getHotelById } from '../api/hotels';

const TYPE_LABEL = {
  STANDARD: 'Standard',
  DELUXE:   'Deluxe',
  SUITE:    'Suite',
  FAMILY:   'Family',
};
const TYPE_ORDER = ['STANDARD', 'DELUXE', 'SUITE', 'FAMILY'];

/* ── Image gallery ── */
function Gallery({ images, name }) {
  const [active, setActive] = useState(0);

  if (!images?.length) {
    return (
      <div className="h-72 sm:h-96 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-200
        flex items-center justify-center text-6xl">
        🏨
      </div>
    );
  }

  return (
    <div>
      <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden bg-gray-100">
        <img
          src={images[active]}
          alt={name}
          className="w-full h-full object-cover"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive((a) => (a - 1 + images.length) % images.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40
                hover:bg-black/60 text-white rounded-full flex items-center justify-center
                transition cursor-pointer text-lg"
            >
              ‹
            </button>
            <button
              onClick={() => setActive((a) => (a + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-black/40
                hover:bg-black/60 text-white rounded-full flex items-center justify-center
                transition cursor-pointer text-lg"
            >
              ›
            </button>
            <span className="absolute bottom-3 right-4 bg-black/50 text-white text-xs
              px-2 py-0.5 rounded-full">
              {active + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition cursor-pointer
                ${i === active ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Star rating ── */
function Stars({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map((s) => (
        <svg key={s} className={`w-5 h-5 ${s <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462
            c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755
            1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118
            l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0
            00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
      <span className="ml-1 font-semibold text-gray-800">{rating?.toFixed(1) ?? '—'}</span>
    </div>
  );
}

/* ── Room card ── */
function RoomCard({ room, checkIn, checkOut }) {
  const navigate  = useNavigate();
  const available = room.status === 'AVAILABLE';

  const handleBook = () => {
    const user = localStorage.getItem('user');
    if (!user) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }
    const params = new URLSearchParams({ roomId: room.id });
    if (checkIn)  params.set('checkIn',  checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    navigate(`/booking?${params.toString()}`);
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden
      flex flex-col sm:flex-row">
      <div className="sm:w-48 h-40 sm:h-auto shrink-0 bg-gradient-to-br from-slate-100 to-slate-200
        overflow-hidden">
        {room.images?.[0]
          ? <img src={room.images[0]} alt={room.roomNumber} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">🛏️</div>
        }
      </div>

      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-gray-900">Phòng {room.roomNumber}</h4>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium
                ${available
                  ? 'bg-green-50 text-green-700'
                  : 'bg-yellow-50 text-yellow-700'}`}>
                {available ? 'Còn phòng' : 'Đang bảo trì'}
              </span>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-blue-600">
                {room.pricePerNight?.toLocaleString('vi-VN')}₫
              </p>
              <p className="text-xs text-gray-400">/ đêm</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857
                  M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002
                  5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {room.capacity} khách
            </span>
            {room.description && (
              <span className="text-gray-500 text-xs line-clamp-1">{room.description}</span>
            )}
          </div>

          {room.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {room.amenities.slice(0, 4).map((a) => (
                <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>
              ))}
              {room.amenities.length > 4 && (
                <span className="text-xs text-gray-400">+{room.amenities.length - 4}</span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleBook}
          disabled={!available}
          className="mt-4 sm:self-end px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200
            disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium
            rounded-xl transition cursor-pointer"
        >
          {available ? 'Đặt phòng' : 'Không khả dụng'}
        </button>
      </div>
    </div>
  );
}

/* ── Chat button ── */
function ChatButton({ hotelId }) {
  const navigate = useNavigate();
  const user     = JSON.parse(localStorage.getItem('user') ?? 'null');

  // STAFF của chính hotel này hoặc OWNER sở hữu hotel này → không cần nhắn với chính mình
  if (user?.role === 'STAFF' && user?.hotelId === hotelId) return null;
  if (user?.role === 'OWNER') return null;
  if (user?.role === 'ADMIN') return null;

  const handleChat = () => {
    if (!user) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }
    navigate(`/chat/${user.id}_${hotelId}`);
  };

  return (
    <button
      onClick={handleChat}
      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
        border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100
        rounded-xl transition cursor-pointer">
      💬 Nhắn tin
    </button>
  );
}

/* ── Main page ── */
export default function HotelDetailPage() {
  const { id }            = useParams();
  const { state }         = useLocation();
  const checkIn           = state?.checkIn  ?? '';
  const checkOut          = state?.checkOut ?? '';

  const [hotel, setHotel]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    getHotelById(id)
      .then((res) => setHotel(res.data.data))
      .catch(() => setError('Không tìm thấy khách sạn.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-10 animate-pulse space-y-6">
        <div className="h-96 bg-gray-200 rounded-2xl" />
        <div className="h-6 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-1/4" />
        <div className="h-20 bg-gray-100 rounded" />
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-xl font-semibold text-gray-700">{error}</h2>
        <Link to="/" className="mt-4 text-blue-600 text-sm hover:underline">← Quay về trang chủ</Link>
      </div>
    </div>
  );

  const activeRooms  = hotel.rooms?.filter((r) => r.status !== 'DELETED') ?? [];
  const roomsByType  = TYPE_ORDER.reduce((acc, t) => {
    const list = activeRooms.filter((r) => r.type === t);
    if (list.length) acc[t] = list;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 flex items-center gap-1">
          <Link to="/" className="hover:text-blue-600 transition">Trang chủ</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium truncate">{hotel.name}</span>
        </nav>

        {/* Gallery */}
        <Gallery images={hotel.images} name={hotel.name} />

        {/* Hotel info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{hotel.name}</h1>
              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0
                    1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                {hotel.address}, {hotel.city}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <Stars rating={hotel.avgRating} />
              {hotel.reviewCount > 0 && (
                <p className="text-xs text-gray-400">{hotel.reviewCount} đánh giá</p>
              )}
              <ChatButton hotelId={hotel.id} />
            </div>
          </div>

          {hotel.description && (
            <p className="mt-4 text-gray-600 text-sm leading-relaxed">{hotel.description}</p>
          )}

          {hotel.amenities?.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Tiện ích khách sạn</h3>
              <div className="flex flex-wrap gap-2">
                {hotel.amenities.map((a) => (
                  <span key={a} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {(checkIn || checkOut) && (
            <div className="mt-4 flex gap-4 text-sm bg-blue-50 rounded-xl px-4 py-3">
              {checkIn  && <span>📅 Nhận phòng: <strong>{checkIn}</strong></span>}
              {checkOut && <span>📅 Trả phòng: <strong>{checkOut}</strong></span>}
            </div>
          )}
        </div>

        {/* Rooms */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Danh sách phòng</h2>

          {Object.keys(roomsByType).length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <div className="text-4xl mb-3">🛏️</div>
              <p className="text-gray-500">Khách sạn chưa có phòng nào.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(roomsByType).map(([type, rooms]) => (
                <div key={type}>
                  <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-full inline-block" />
                    {TYPE_LABEL[type]}
                    <span className="text-xs font-normal text-gray-400">({rooms.length} phòng)</span>
                  </h3>
                  <div className="space-y-3">
                    {rooms.map((room) => (
                      <RoomCard key={room.id} room={room} checkIn={checkIn} checkOut={checkOut} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
