import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { searchHotels } from '../api/hotels';

const DASHBOARD_LINK = {
  ADMIN: { to: '/admin/dashboard', label: 'Trang quản trị' },
  OWNER: { to: '/owner/dashboard', label: 'Quản lý khách sạn' },
  STAFF: { to: '/staff/dashboard', label: 'Dashboard' },
};

const ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'FAMILY'];
const PAGE_SIZE  = 9;

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map((s) => (
        <svg key={s} className={`w-4 h-4 ${s <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462
            c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755
            1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118
            l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0
            00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
      <span className="text-sm text-gray-500 ml-1">({rating?.toFixed(1) ?? '—'})</span>
    </div>
  );
}

function HotelCard({ hotel, checkIn, checkOut }) {
  const navigate = useNavigate();
  const img = hotel.images?.[0];

  return (
    <div
      onClick={() => navigate(`/hotels/${hotel.id}`, { state: { checkIn, checkOut } })}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden
        hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
    >
      <div className="h-48 bg-gradient-to-br from-blue-100 to-indigo-200 overflow-hidden">
        {img ? (
          <img src={img} alt={hotel.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">🏨</div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-base truncate">{hotel.name}</h3>

        <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span className="truncate">{hotel.city}{hotel.address ? `, ${hotel.address}` : ''}</span>
        </div>

        <div className="mt-2">
          <StarRating rating={hotel.avgRating} />
          {hotel.reviewCount > 0 && (
            <span className="text-xs text-gray-400 mt-0.5 block">{hotel.reviewCount} đánh giá</span>
          )}
        </div>

        {hotel.amenities?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {hotel.amenities.slice(0, 3).map((a) => (
              <span key={a} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{a}</span>
            ))}
            {hotel.amenities.length > 3 && (
              <span className="text-xs text-gray-400">+{hotel.amenities.length - 3}</span>
            )}
          </div>
        )}

        <button className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
          font-medium rounded-lg transition cursor-pointer">
          Xem chi tiết
        </button>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 mt-10">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 0}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40
          hover:bg-gray-50 disabled:cursor-not-allowed transition cursor-pointer"
      >
        ← Trước
      </button>

      {start > 0 && <span className="px-2 text-gray-400">…</span>}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`w-9 h-9 text-sm rounded-lg transition cursor-pointer
            ${p === page
              ? 'bg-blue-600 text-white font-medium'
              : 'border border-gray-300 hover:bg-gray-50'}`}
        >
          {p + 1}
        </button>
      ))}

      {end < totalPages - 1 && <span className="px-2 text-gray-400">…</span>}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40
          hover:bg-gray-50 disabled:cursor-not-allowed transition cursor-pointer"
      >
        Sau →
      </button>
    </div>
  );
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  })();
  const dashLink = currentUser ? DASHBOARD_LINK[currentUser.role] ?? null : null;

  const [filters, setFilters] = useState({
    city:     searchParams.get('city')     ?? '',
    checkIn:  searchParams.get('checkIn')  ?? '',
    checkOut: searchParams.get('checkOut') ?? '',
    type:     searchParams.get('type')     ?? '',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
  });
  const [draft, setDraft]           = useState(filters);
  const [hotels, setHotels]         = useState([]);
  const [page, setPage]             = useState(Number(searchParams.get('page') ?? 0));
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);

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

  useEffect(() => {
    fetchHotels(filters, page);
  }, [filters, page, fetchHotels]);

  const handleSearch = (e) => {
    e.preventDefault();
    const newPage = 0;
    setFilters(draft);
    setPage(newPage);

    const p = {};
    if (draft.city)     p.city     = draft.city;
    if (draft.checkIn)  p.checkIn  = draft.checkIn;
    if (draft.checkOut) p.checkOut = draft.checkOut;
    if (draft.type)     p.type     = draft.type;
    if (draft.minPrice) p.minPrice = draft.minPrice;
    if (draft.maxPrice) p.maxPrice = draft.maxPrice;
    setSearchParams(p);
  };

  const handlePageChange = (p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white py-14 px-4">
        <div className="max-w-4xl mx-auto text-center">

          {/* Greeting banner */}
          {currentUser && dashLink && (
            <Link to={dashLink.to}
              className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full
                bg-white/20 hover:bg-white/30 transition text-sm font-medium
                border border-white/30 cursor-pointer">
              <span>👋 Xin chào, {currentUser.fullName}!</span>
              <span className="opacity-60">→</span>
              <span>{dashLink.label}</span>
            </Link>
          )}
          {currentUser && !dashLink && (
            <p className="mb-5 text-sm text-blue-100 font-medium">
              👋 Xin chào, {currentUser.fullName}!
            </p>
          )}

          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Tìm khách sạn lý tưởng</h1>
          <p className="text-blue-100 mb-8 text-sm sm:text-base">
            Hơn {totalElements > 0 ? totalElements : '—'} khách sạn trên toàn quốc đang chờ bạn
          </p>

          <form onSubmit={handleSearch}
            className="bg-white rounded-2xl p-4 shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 text-left px-1">Thành phố</label>
              <input
                type="text"
                placeholder="Hà Nội, TP.HCM..."
                value={draft.city}
                onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800
                  outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 text-left px-1">Nhận phòng</label>
              <input
                type="date"
                min={today}
                value={draft.checkIn}
                onChange={(e) => setDraft((p) => ({ ...p, checkIn: e.target.value }))}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800
                  outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 text-left px-1">Trả phòng</label>
              <input
                type="date"
                min={draft.checkIn || tomorrow}
                value={draft.checkOut}
                onChange={(e) => setDraft((p) => ({ ...p, checkOut: e.target.value }))}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800
                  outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl
                text-sm transition cursor-pointer mt-4 sm:mt-0 self-end"
            >
              🔍 Tìm kiếm
            </button>
          </form>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">

          <span className="text-sm font-medium text-gray-600 shrink-0">Lọc thêm:</span>

          <select
            value={draft.type}
            onChange={(e) => { setDraft((p) => ({ ...p, type: e.target.value })); }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700
              outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">Tất cả loại phòng</option>
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Giá từ"
              min={0}
              value={draft.minPrice}
              onChange={(e) => setDraft((p) => ({ ...p, minPrice: e.target.value }))}
              className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm
                outline-none focus:border-blue-500"
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="number"
              placeholder="Đến"
              min={0}
              value={draft.maxPrice}
              onChange={(e) => setDraft((p) => ({ ...p, maxPrice: e.target.value }))}
              className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm
                outline-none focus:border-blue-500"
            />
            <span className="text-sm text-gray-500">VNĐ / đêm</span>
          </div>

          <button
            onClick={handleSearch}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm
              rounded-lg transition cursor-pointer"
          >
            Áp dụng
          </button>

          {(filters.city || filters.type || filters.minPrice || filters.maxPrice) && (
            <button
              onClick={() => {
                const cleared = { city: '', checkIn: '', checkOut: '', type: '', minPrice: '', maxPrice: '' };
                setDraft(cleared);
                setFilters(cleared);
                setPage(0);
                setSearchParams({});
              }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-500 transition cursor-pointer"
            >
              ✕ Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Result summary */}
        {searched && !loading && (
          <p className="text-sm text-gray-500 mb-6">
            {totalElements > 0
              ? `Tìm thấy ${totalElements} khách sạn${filters.city ? ` tại "${filters.city}"` : ''}`
              : 'Không tìm thấy khách sạn phù hợp'}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(PAGE_SIZE)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="h-9 bg-gray-200 rounded-lg mt-4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grid */}
        {!loading && hotels.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotels.map((hotel) => (
              <HotelCard
                key={hotel.id}
                hotel={hotel}
                checkIn={filters.checkIn}
                checkOut={filters.checkOut}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && searched && hotels.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏨</div>
            <h3 className="text-lg font-semibold text-gray-700">Không tìm thấy khách sạn</h3>
            <p className="text-gray-400 text-sm mt-1">Thử thay đổi bộ lọc hoặc tìm kiếm thành phố khác</p>
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
      </main>
    </div>
  );
}
