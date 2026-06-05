import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import heroImg from '../assets/hero.png';
import Navbar from '../components/Navbar';
import { searchHotels } from '../api/hotels';
import { getHybridRecommendations } from '../api/recommendations';

/* ── constants ── */
const DASHBOARD_LINK = {
  ADMIN: { to: '/admin/dashboard', label: 'Trang quản trị' },
  OWNER: { to: '/owner/dashboard', label: 'Quản lý khách sạn' },
  STAFF: { to: '/staff/dashboard', label: 'Dashboard' },
};
const ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'FAMILY'];
const ROOM_TYPE_LABEL = { STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite', FAMILY: 'Gia đình' };
const ROOM_TYPE_CLS   = {
  STANDARD: 'bg-gray-100 text-gray-700',
  DELUXE:   'bg-blue-100 text-blue-700',
  SUITE:    'bg-purple-100 text-purple-700',
  FAMILY:   'bg-green-100 text-green-700',
};
const PAGE_SIZE = 9;

const POPULAR_CITIES = [
  { name: 'Đà Nẵng',        count: '354', emoji: '🏖️', g1: '#0EA5E9', g2: '#1E40AF' },
  { name: 'Nha Trang',       count: '289', emoji: '🌊', g1: '#0D9488', g2: '#0369A1' },
  { name: 'Phú Quốc',        count: '312', emoji: '🌴', g1: '#10B981', g2: '#0F766E' },
  { name: 'Hà Nội',          count: '412', emoji: '🏯', g1: '#EF4444', g2: '#9F1239' },
  { name: 'TP. Hồ Chí Minh', count: '398', emoji: '🌆', g1: '#F97316', g2: '#C2410C' },
];

const STATS = [
  { value: '500+',    label: 'Khách sạn',  iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',   iconD: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { value: '10.000+', label: 'Phòng',       iconBg: 'bg-purple-100', iconColor: 'text-purple-600', iconD: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { value: '50.000+', label: 'Khách hàng', iconBg: 'bg-green-100',  iconColor: 'text-green-600',  iconD: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { value: '4.8/5',   label: 'Đánh giá',  iconBg: 'bg-amber-100',  iconColor: 'text-amber-600',  iconD: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
];

/* ── StarRating ── */
function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={`w-3.5 h-3.5 ${s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0
            1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54
            1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292
            a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating?.toFixed(1) ?? '—'}</span>
    </div>
  );
}

const SCORE_LABEL = (r) => {
  if (!r) return '';
  const s = r * 2;
  if (s >= 9) return 'Tuyệt vời';
  if (s >= 8) return 'Rất tốt';
  if (s >= 7) return 'Tốt';
  return 'Khá';
};

/* ── HotelCard ── */
function HotelCard({ hotel, checkIn, checkOut }) {
  const navigate = useNavigate();
  const img      = hotel.images?.[0];
  const score    = hotel.avgRating > 0 ? (hotel.avgRating * 2).toFixed(1) : null;
  return (
    <div onClick={() => navigate(`/hotels/${hotel.id}`, { state: { checkIn, checkOut } })}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden cursor-pointer group
        hover:shadow-xl hover:-translate-y-1 transition-all duration-200 shadow-sm">

      {/* Image */}
      <div className="relative h-52 bg-linear-to-br from-blue-100 to-indigo-200 overflow-hidden">
        {img
          ? <img src={img} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-5xl">🏨</div>
        }
        {/* Score badge — Booking.com style */}
        {score && (
          <div className="absolute top-3 left-3 bg-blue-700 text-white text-sm font-extrabold
            w-10 h-10 rounded-xl flex items-center justify-center shadow-lg">
            {score}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 truncate text-sm leading-snug">{hotel.name}</h3>

        <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1 truncate">
          <svg className="w-3 h-3 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          {hotel.city}{hotel.address ? `, ${hotel.address}` : ''}
        </p>

        {/* Rating row */}
        {hotel.avgRating > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <StarRating rating={hotel.avgRating} />
            <span className="text-xs font-semibold text-gray-600">{SCORE_LABEL(hotel.avgRating)}</span>
            {hotel.reviewCount > 0 && (
              <span className="text-xs text-gray-400 ml-auto">({hotel.reviewCount})</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-3 flex items-end justify-between">
          {hotel.minPrice ? (
            <div>
              <p className="text-xs text-gray-400">Từ</p>
              <p className="text-base font-extrabold text-blue-700">
                {hotel.minPrice.toLocaleString('vi-VN')}
                <span className="text-xs font-normal text-gray-400"> VND/đêm</span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Xem giá phòng →</p>
          )}
          <span className="text-xs text-blue-600 font-semibold group-hover:underline">Xem →</span>
        </div>
      </div>
    </div>
  );
}

/* ── AI Recommendation card (drawer list style) ── */
/* Drawer card — horizontal layout fits the narrow panel */
function RecommendedRoomCard({ rec, onClose }) {
  const navigate = useNavigate();
  const img      = rec.images?.[0] ?? rec.hotelImage;
  const score    = rec.hotelAvgRating > 0 ? (rec.hotelAvgRating * 2).toFixed(1) : null;

  const handleClick = () => {
    onClose?.();
    navigate(`/hotels/${rec.hotelId}`);
  };

  return (
    <div onClick={handleClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
        hover:shadow-md hover:border-blue-200 transition-all duration-200 cursor-pointer group
        flex gap-0">

      {/* Thumbnail */}
      <div className="relative w-28 shrink-0 bg-linear-to-br from-blue-100 to-indigo-200 overflow-hidden">
        {img
          ? <img src={img} alt={rec.hotelName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">🛏️</div>
        }
        <span className={`absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold
          ${ROOM_TYPE_CLS[rec.type] ?? 'bg-white/90 text-gray-700'}`}>
          {ROOM_TYPE_LABEL[rec.type] ?? rec.type}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-between gap-1.5">
        <div>
          <p className="font-bold text-gray-900 truncate text-sm leading-tight">{rec.hotelName}</p>
          <p className="text-xs text-gray-400 flex items-center gap-1 truncate mt-0.5">
            <svg className="w-3 h-3 shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            {rec.hotelCity}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {score && (
              <span className="text-[11px] font-extrabold text-white bg-blue-700 px-1.5 py-0.5 rounded-md leading-none">
                {score}
              </span>
            )}
            <p className="text-sm font-extrabold text-blue-700 leading-none">
              {(rec.pricePerNight ?? 0).toLocaleString('vi-VN')}₫
            </p>
            <span className="text-xs text-gray-400">/đêm</span>
          </div>
          <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ── */
function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="flex items-center justify-center gap-1 mt-10">
      <button onClick={() => onPageChange(page - 1)} disabled={page === 0}
        className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40
          hover:bg-gray-50 transition cursor-pointer font-medium text-gray-600">
        ← Trước
      </button>
      {start > 0 && <span className="px-2 text-gray-400">…</span>}
      {pages.map(p => (
        <button key={p} onClick={() => onPageChange(p)}
          className={`w-9 h-9 text-sm rounded-lg transition cursor-pointer font-medium
            ${p === page ? 'bg-blue-700 text-white' : 'border border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
          {p + 1}
        </button>
      ))}
      {end < totalPages - 1 && <span className="px-2 text-gray-400">…</span>}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}
        className="px-4 py-2 text-sm border border-gray-200 rounded-lg disabled:opacity-40
          hover:bg-gray-50 transition cursor-pointer font-medium text-gray-600">
        Sau →
      </button>
    </div>
  );
}

/* ════════════ Main Page ════════════ */
export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();
  const dashLink = currentUser ? DASHBOARD_LINK[currentUser.role] ?? null : null;

  const isUser = currentUser?.role === 'USER';
  const [hybridRecs,    setHybridRecs]    = useState([]);
  const [hybridLoading, setHybridLoading] = useState(isUser);
  const [showRecs,      setShowRecs]      = useState(() => {
    try { return localStorage.getItem('hc_show_ai_recs') !== 'false'; } catch { return true; }
  });

  const toggleRecs = () => {
    const next = !showRecs;
    setShowRecs(next);
    try { localStorage.setItem('hc_show_ai_recs', String(next)); } catch { /* ignore */ }
  };


  useEffect(() => {
    if (!isUser) return;
    getHybridRecommendations(6)
      .then(res => setHybridRecs(res.data.data ?? []))
      .catch(err => console.error('[Recommendations]', err))
      .finally(() => setHybridLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filters, setFilters] = useState({
    city:     searchParams.get('city')     ?? '',
    checkIn:  searchParams.get('checkIn')  ?? '',
    checkOut: searchParams.get('checkOut') ?? '',
    type:     searchParams.get('type')     ?? '',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
  });
  const [draft, setDraft]                 = useState(filters);
  const [hotels, setHotels]               = useState([]);
  const [page, setPage]                   = useState(Number(searchParams.get('page') ?? 0));
  const [totalPages, setTotalPages]       = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading]             = useState(false);
  const [searched, setSearched]           = useState(false);

  const fetchHotels = useCallback(async (f, p) => {
    setLoading(true);
    try {
      const params = { page: p, size: PAGE_SIZE };
      if (f.city)     params.city     = f.city;
      if (f.type)     params.type     = f.type;
      if (f.minPrice) params.minPrice = Number(f.minPrice);
      if (f.maxPrice) params.maxPrice = Number(f.maxPrice);
      const res = await searchHotels(params);
      const d   = res.data.data;
      setHotels(d.content);
      setTotalPages(d.totalPages);
      setTotalElements(d.totalElements);
      setSearched(true);
    } catch {
      setHotels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHotels(filters, page); }, [filters, page, fetchHotels]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(draft);
    setPage(0);
    const p = {};
    if (draft.city)     p.city     = draft.city;
    if (draft.checkIn)  p.checkIn  = draft.checkIn;
    if (draft.checkOut) p.checkOut = draft.checkOut;
    if (draft.type)     p.type     = draft.type;
    if (draft.minPrice) p.minPrice = draft.minPrice;
    if (draft.maxPrice) p.maxPrice = draft.maxPrice;
    setSearchParams(p);
  };

  const handleCitySelect = (cityName) => {
    const updated = { ...draft, city: cityName };
    setDraft(updated);
    setFilters(updated);
    setPage(0);
    setSearchParams({ city: cityName });
  };

  const clearFilters = () => {
    const cleared = { city: '', checkIn: '', checkOut: '', type: '', minPrice: '', maxPrice: '' };
    setDraft(cleared);
    setFilters(cleared);
    setPage(0);
    setSearchParams({});
  };

  const handlePageChange = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  /* ── render ── */
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden" style={{ minHeight: '520px' }}>
        {/* Real hotel background image */}
        <div className="absolute inset-0">
          <img src={heroImg} alt="Hotel" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.25) 100%)' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-32 text-center">
          {currentUser && dashLink && (
            <div className="flex justify-center mb-5">
              <Link to={dashLink.to}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                  bg-white/15 hover:bg-white/25 border border-white/25 backdrop-blur-sm transition
                  text-sm font-medium text-white">
                👋 Xin chào, {currentUser.fullName}! &nbsp;·&nbsp; {dashLink.label} →
              </Link>
            </div>
          )}
          {currentUser && !dashLink && (
            <p className="text-white/70 text-sm mb-4 font-medium">
              👋 Xin chào, {currentUser.fullName}!
            </p>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-4 leading-tight tracking-tight drop-shadow-lg">
            Trải nghiệm kỳ nghỉ
            <span className="block text-amber-400 mt-1">hoàn hảo</span>
          </h1>
          <p className="text-white/80 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Khám phá hàng nghìn khách sạn tuyệt vời với giá tốt nhất
          </p>

          {/* Search card */}
          <div className="bg-white rounded-2xl shadow-2xl p-5 max-w-5xl mx-auto text-left">
            <form onSubmit={handleSearch}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Điểm đến
                </label>
                <input type="text" placeholder="Bạn muốn đi đâu?" value={draft.city}
                  onChange={e => setDraft(p => ({ ...p, city: e.target.value }))}
                  className="px-3.5 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-gray-800 transition" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  Nhận phòng
                </label>
                <input type="date" min={today} value={draft.checkIn}
                  onChange={e => setDraft(p => ({ ...p, checkIn: e.target.value }))}
                  className="px-3.5 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-gray-800 transition" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  Trả phòng
                </label>
                <input type="date" min={draft.checkIn || tomorrow} value={draft.checkOut}
                  onChange={e => setDraft(p => ({ ...p, checkOut: e.target.value }))}
                  className="px-3.5 py-3 border-2 border-gray-200 rounded-xl text-sm outline-none
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-gray-800 transition" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-transparent select-none px-1">.</label>
                <button type="submit"
                  className="py-3 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white
                    font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-900/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  Tìm kiếm
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ══ STATS ══ */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STATS.map(s => (
              <div key={s.label} className="flex flex-col items-center text-center gap-3">
                <div className={`w-14 h-14 rounded-2xl ${s.iconBg} flex items-center justify-center`}>
                  <svg className={`w-7 h-7 ${s.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.iconD} />
                  </svg>
                </div>
                <div>
                  <p className="text-3xl font-extrabold text-blue-700">{s.value}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ POPULAR DESTINATIONS ══ */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Điểm đến phổ biến</h2>
            <p className="text-gray-500 text-sm mt-1">Khám phá các thành phố du lịch hàng đầu Việt Nam</p>
          </div>
          <span className="text-sm text-blue-600 font-medium hidden sm:block cursor-default">5 điểm đến →</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {POPULAR_CITIES.map(city => (
            <button key={city.name} onClick={() => handleCitySelect(city.name)}
              className="group relative rounded-2xl overflow-hidden cursor-pointer
                hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              style={{ minHeight: '150px', background: `linear-gradient(135deg, ${city.g1}, ${city.g2})` }}>
              {/* Light shimmer on hover */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300" />
              {/* Radial highlight */}
              <div className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.5) 0%, transparent 65%)' }} />
              <div className="relative p-5 flex flex-col h-full justify-between">
                <span className="text-4xl">{city.emoji}</span>
                <div className="mt-3">
                  <p className="font-bold text-white text-sm leading-tight">{city.name}</p>
                  <p className="text-white/75 text-xs mt-0.5">{city.count} khách sạn</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ══ FILTER BAR ══ */}
      <div className="bg-white border-y border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-gray-600">Lọc:</span>

          <select value={draft.type}
            onChange={e => setDraft(p => ({ ...p, type: e.target.value }))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700
              outline-none focus:border-blue-500 cursor-pointer bg-white">
            <option value="">Tất cả loại phòng</option>
            {ROOM_TYPES.map(t => <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <input type="number" placeholder="Giá từ" min={0} value={draft.minPrice}
              onChange={e => setDraft(p => ({ ...p, minPrice: e.target.value }))}
              className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500" />
            <span className="text-gray-300">—</span>
            <input type="number" placeholder="Đến" min={0} value={draft.maxPrice}
              onChange={e => setDraft(p => ({ ...p, maxPrice: e.target.value }))}
              className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500" />
            <span className="text-xs text-gray-400 hidden sm:block">₫/đêm</span>
          </div>

          <button onClick={handleSearch}
            className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm
              font-medium rounded-lg transition cursor-pointer">
            Áp dụng
          </button>

          {(filters.city || filters.type || filters.minPrice || filters.maxPrice) && (
            <button onClick={clearFilters}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 transition cursor-pointer
                border border-gray-200 rounded-lg hover:border-red-200">
              ✕ Xóa bộ lọc
            </button>
          )}
          <span className="ml-auto text-sm text-gray-400 hidden sm:block">
            {totalElements > 0 ? `${totalElements} khách sạn` : ''}
          </span>
        </div>
      </div>

      {/* ══ MAIN ══ */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">


        {/* ══ HOTEL LIST — main section ══ */}
        <div className="flex items-end justify-between mb-6 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-blue-700 rounded-full" />
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">
                {filters.city ? `Khách sạn tại "${filters.city}"` : 'Khách sạn nổi bật'}
              </h2>
              {searched && !loading && totalElements > 0 && (
                <p className="text-sm text-gray-500 mt-0.5">
                  Tìm thấy <span className="font-semibold text-gray-700">{totalElements}</span> khách sạn
                </p>
              )}
            </div>
          </div>
          {!filters.city && !filters.type && !filters.minPrice && !filters.maxPrice && totalElements > 0 && (
            <span className="text-sm text-blue-600 font-semibold cursor-default hidden sm:block hover:underline">
              Xem tất cả →
            </span>
          )}
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(PAGE_SIZE)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-9 bg-gray-200 rounded-lg mt-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        {!loading && hotels.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {hotels.map(hotel => (
              <HotelCard key={hotel.id} hotel={hotel} checkIn={filters.checkIn} checkOut={filters.checkOut} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && searched && hotels.length === 0 && (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🏨</div>
            <h3 className="text-lg font-semibold text-gray-700">Không tìm thấy khách sạn</h3>
            <p className="text-gray-400 text-sm mt-1">Thử thay đổi bộ lọc hoặc tìm kiếm thành phố khác</p>
            <button onClick={clearFilters}
              className="mt-5 px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg transition cursor-pointer">
              Xóa bộ lọc
            </button>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      </main>

      {/* Footer */}
      <footer className="bg-blue-950 text-blue-200 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
            <div>
              <p className="font-extrabold text-white text-lg mb-3">Hotel Chain</p>
              <p className="text-blue-300 text-xs leading-relaxed">
                Nền tảng đặt phòng khách sạn hàng đầu Việt Nam
              </p>
            </div>
            {[
              { title: 'Khám phá', items: ['Khách sạn nổi bật', 'Điểm đến mới', 'Ưu đãi đặc biệt'] },
              { title: 'Hỗ trợ',   items: ['Trung tâm trợ giúp', 'Liên hệ', 'Chính sách hủy'] },
              { title: 'Công ty',  items: ['Về chúng tôi', 'Tuyển dụng', 'Điều khoản'] },
            ].map(col => (
              <div key={col.title}>
                <p className="font-semibold text-white mb-3">{col.title}</p>
                <ul className="space-y-2">
                  {col.items.map(item => (
                    <li key={item}>
                      <span className="text-xs text-blue-300 hover:text-white transition cursor-pointer">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-blue-800 mt-8 pt-6 text-center text-xs text-blue-400">
            © 2026 Hotel Chain. All rights reserved.
          </div>
        </div>
      </footer>

      {/* ══ AI FAB + DRAWER ══ */}
      {isUser && (
        <>
          {/* Floating button — bottom-right corner */}
          <button
            onClick={toggleRecs}
            title="Gợi ý AI dành cho bạn"
            className="fixed bottom-6 right-6 z-40 group flex items-center gap-2
              bg-blue-700 hover:bg-blue-800 text-white
              shadow-lg hover:shadow-xl transition-all duration-200
              rounded-full pl-3 pr-4 py-3 cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969
                0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755
                1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197
                -1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81
                .588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            <span className="text-sm font-bold">Gợi ý AI</span>
            {!hybridLoading && hybridRecs.length > 0 && (
              <span className="bg-white text-blue-700 text-xs font-extrabold
                w-5 h-5 rounded-full flex items-center justify-center leading-none">
                {hybridRecs.length}
              </span>
            )}
          </button>

          {/* Drawer overlay */}
          {showRecs && (
            <div className="fixed inset-0 z-50 flex justify-end">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={toggleRecs}
              />

              {/* Panel — slides in from right */}
              <div className="relative w-full max-w-md bg-white shadow-2xl
                flex flex-col overflow-hidden
                animate-[slideInRight_0.25s_ease-out]">

                {/* Drawer header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1B4FD8 0%, #4F46E5 100%)' }}>
                  <div className="flex items-center gap-2.5">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969
                        0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755
                        1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197
                        -1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81
                        .588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-white">Dành riêng cho bạn</p>
                      <p className="text-xs text-blue-200">Gợi ý từ AI dựa trên sở thích của bạn</p>
                    </div>
                  </div>
                  <button onClick={toggleRecs}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30
                      flex items-center justify-center transition cursor-pointer text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>

                {/* Drawer body — scrollable */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">

                  {/* Skeleton */}
                  {hybridLoading && [...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse flex">
                      <div className="w-28 h-24 bg-gray-200 shrink-0" />
                      <div className="flex-1 p-3 space-y-2">
                        <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                        <div className="h-3 bg-gray-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))}

                  {/* List — horizontal card per item */}
                  {!hybridLoading && hybridRecs.length > 0 && hybridRecs.map(rec => (
                    <RecommendedRoomCard key={rec.roomId} rec={rec} onClose={toggleRecs} />
                  ))}

                  {/* Empty */}
                  {!hybridLoading && hybridRecs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-600">Chưa có gợi ý</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs">
                        Hãy đặt phòng lần đầu để AI hiểu sở thích và gợi ý phòng phù hợp cho bạn!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
