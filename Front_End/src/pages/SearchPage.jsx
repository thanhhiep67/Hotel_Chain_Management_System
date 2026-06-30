import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { searchHotels, getNearbyHotels } from '../api/hotels'

const MapView = lazy(() => import('../components/MapView'))

/* ─── CSS (injected once) ───────────────────────────────────────*/
let cssInjected = false
const CSS = `
  .sp-root {
    height: 100vh; display: flex; flex-direction: column;
    overflow: hidden; background: #F7F6F4;
    font-family: 'Outfit', system-ui, sans-serif;
  }

  /* ── Filter bar ─────────────────────────────── */
  .sp-bar {
    background: #fff;
    border-bottom: 1px solid rgba(0,0,0,0.08);
    flex-shrink: 0; z-index: 20;
  }
  .sp-bar-inner {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 20px; overflow-x: auto;
  }
  .sp-bar-inner::-webkit-scrollbar { height: 0; }

  .sp-inp {
    height: 36px; padding: 0 12px;
    border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
    font: 13px/1 'Outfit', system-ui, sans-serif;
    color: #1C1B18; background: #fff; outline: none;
    transition: border-color .18s;
  }
  .sp-inp:focus { border-color: #C9A84C; }
  .sp-inp::placeholder { color: #A09D96; }
  .sp-inp-city { min-width: 170px; }
  .sp-inp-date { width: 136px; }
  .sp-inp-price { width: 88px; }

  .sp-sel {
    height: 36px; padding: 0 10px;
    border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
    font: 13px/1 'Outfit', system-ui, sans-serif;
    color: #1C1B18; background: #fff; outline: none; cursor: pointer;
  }

  .sp-sep { width: 1px; height: 20px; background: rgba(0,0,0,0.09); flex-shrink: 0; }

  .sp-nights {
    font-size: 11px; font-weight: 700; color: #C9A84C;
    background: rgba(201,168,76,0.1); padding: 3px 8px;
    border-radius: 5px; white-space: nowrap; flex-shrink: 0;
  }

  .sp-btn {
    height: 36px; padding: 0 20px; flex-shrink: 0;
    background: #C9A84C; color: #0A0A0B;
    border: none; border-radius: 8px;
    font: 600 13px/1 'Outfit', system-ui, sans-serif;
    cursor: pointer; white-space: nowrap; transition: background .15s;
  }
  .sp-btn:hover { background: #d9b85a; }

  /* ── Split layout ────────────────────────────── */
  .sp-layout {
    flex: 1; display: grid;
    grid-template-columns: 420px 1fr;
    overflow: hidden;
  }

  /* ── Left panel ──────────────────────────────── */
  .sp-panel {
    display: flex; flex-direction: column;
    overflow: hidden; background: #F7F6F4;
    border-right: 1px solid rgba(0,0,0,0.07);
  }

  .sp-panel-head {
    padding: 11px 16px; background: #fff;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    flex-shrink: 0; display: flex; align-items: center;
    justify-content: space-between; gap: 10px;
    font-size: 13px; color: #6B6860;
  }
  .sp-panel-head strong { color: #1C1B18; font-weight: 700; }
  .sp-panel-head-right { display: flex; align-items: center; gap: 8px; }

  .sp-scroll {
    flex: 1; overflow-y: auto;
    padding: 12px 12px 24px; display: flex; flex-direction: column; gap: 8px;
  }
  .sp-scroll::-webkit-scrollbar { width: 3px; }
  .sp-scroll::-webkit-scrollbar-track { background: transparent; }
  .sp-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }

  /* ── Right panel (map) ───────────────────────── */
  .sp-map-panel { overflow: hidden; position: relative; }
  .sp-map-fallback {
    width: 100%; height: 100%; background: #EDEAE4;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px;
    color: #A09D96; font-size: 13px;
  }
  @keyframes sp-spin { to { transform:rotate(360deg); } }
  .sp-spinner {
    width: 30px; height: 30px;
    border: 3px solid #C9A84C; border-top-color: transparent;
    border-radius: 50%; animation: sp-spin .8s linear infinite;
  }

  /* ── SearchCard (horizontal) ─────────────────── */
  .sc {
    display: flex; background: #fff;
    border: 1.5px solid rgba(0,0,0,0.07);
    border-radius: 12px; overflow: hidden;
    cursor: pointer; flex-shrink: 0;
    transition: border-color .18s, box-shadow .18s, transform .18s;
  }
  .sc:hover {
    border-color: rgba(0,0,0,0.13);
    box-shadow: 0 4px 18px rgba(0,0,0,0.09);
    transform: translateY(-1px);
  }
  .sc.sc-active {
    border-color: #C9A84C !important;
    box-shadow: 0 0 0 2px rgba(201,168,76,0.35), 0 6px 22px rgba(201,168,76,0.16) !important;
    transform: translateY(-2px) !important;
  }

  /* Thumbnail */
  .sc-thumb {
    width: 130px; min-height: 90px; flex-shrink: 0;
    background: #1a1a1e; position: relative; overflow: hidden;
  }
  .sc-thumb img {
    width: 100%; height: 100%; object-fit: cover;
    transition: transform .45s cubic-bezier(.4,0,.2,1);
  }
  .sc:hover .sc-thumb img { transform: scale(1.07); }
  .sc-thumb-ph {
    width: 100%; height: 100%; display: flex;
    align-items: center; justify-content: center;
    font: 28px/1 'Cormorant Garamond', Georgia, serif;
    color: rgba(255,255,255,0.06);
  }
  .sc-badge {
    position: absolute; top: 7px; left: 7px;
    background: rgba(10,10,11,0.82); backdrop-filter: blur(5px);
    color: #F2F0EB; font-size: 11px; font-weight: 700;
    padding: 3px 7px; border-radius: 6px; line-height: 1;
  }

  /* Body */
  .sc-body { flex: 1; padding: 11px 13px; display: flex; flex-direction: column; min-width: 0; }
  .sc-name {
    font-size: 13px; font-weight: 700; color: #1C1B18;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1.3; margin-bottom: 2px;
  }
  .sc-city {
    font-size: 11px; color: #6B6860; margin-bottom: 7px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sc-rating { display: flex; align-items: center; gap: 5px; margin-bottom: 6px; }
  .sc-rbadge {
    background: #C9A84C; color: #0A0A0B;
    font-size: 11px; font-weight: 700;
    padding: 2px 6px; border-radius: 5px; line-height: 1;
  }
  .sc-rlabel { font-size: 11px; color: #6B6860; }
  .sc-rcnt { font-size: 10px; color: #A09D96; margin-left: auto; }

  .sc-foot {
    margin-top: auto; display: flex;
    align-items: flex-end; justify-content: space-between; gap: 8px;
  }
  .sc-price-from { font-size: 9px; color: #A09D96; text-transform: uppercase; letter-spacing: .08em; }
  .sc-price-val {
    font: 600 17px/1 'Cormorant Garamond', Georgia, serif;
    color: #1C1B18;
  }
  .sc-price-unit { font-size: 10px; color: #6B6860; }
  .sc-arrow {
    width: 28px; height: 28px; flex-shrink: 0;
    background: #F7F6F4; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; color: #6B6860;
    transition: background .15s, color .15s;
  }
  .sc:hover .sc-arrow, .sc.sc-active .sc-arrow { background: #C9A84C; color: #0A0A0B; }

  /* Skeletons */
  @keyframes shimmer {
    from { background-position: -500px 0 }
    to   { background-position:  500px 0 }
  }
  .sc-skel {
    height: 92px; border-radius: 12px; flex-shrink: 0;
    background: linear-gradient(90deg,#ebe8e3 25%,#e2ddd7 50%,#ebe8e3 75%);
    background-size: 500px 100%;
    animation: shimmer 1.5s infinite;
  }

  /* Empty */
  .sp-empty {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 10px; padding: 56px 20px;
    color: #A09D96; text-align: center;
  }
  .sp-empty-icon { font-size: 44px; opacity: .5; }
  .sp-empty-title { font-size: 14px; font-weight: 600; color: #6B6860; }
  .sp-empty-sub   { font-size: 12px; opacity: .7; }

  /* Pagination */
  .sp-pag {
    display: flex; align-items: center; justify-content: center;
    gap: 5px; padding: 16px 0 4px;
  }
  .sp-pbtn {
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid rgba(0,0,0,0.10); background: #fff;
    font: 12px/1 'Outfit', system-ui, sans-serif;
    color: #1C1B18; cursor: pointer; transition: all .15s;
    display: flex; align-items: center; justify-content: center;
  }
  .sp-pbtn:hover:not(:disabled) { border-color: #C9A84C; color: #C9A84C; }
  .sp-pbtn.sp-pbtn-active { background: #C9A84C; border-color: #C9A84C; color: #0A0A0B; font-weight: 700; }
  .sp-pbtn:disabled { opacity: .3; cursor: not-allowed; }

  /* Nearby banner */
  .sp-nearby-banner {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 16px; flex-shrink: 0;
    background: rgba(201,168,76,0.08);
    border-bottom: 1px solid rgba(201,168,76,0.2);
    font-size: 12px; color: #C9A84C; font-weight: 500;
  }
  .sp-nearby-banner svg { flex-shrink: 0; }
  .sp-nearby-exit {
    margin-left: auto; padding: 3px 10px;
    border: 1px solid rgba(201,168,76,0.35); border-radius: 20px;
    background: none; color: #C9A84C; font-size: 11px; font-weight: 600;
    cursor: pointer; transition: all .15s; font-family: 'Outfit', system-ui, sans-serif;
  }
  .sp-nearby-exit:hover { background: rgba(201,168,76,0.12); }

  /* Radius slider */
  .sp-radius-wrap {
    display: flex; align-items: center; gap: 8px;
    margin-left: 10px; flex-shrink: 0;
  }
  .sp-radius-label { font-size: 11px; color: rgba(201,168,76,0.65); white-space: nowrap; }
  .sp-radius-slider {
    -webkit-appearance: none; appearance: none;
    width: 110px; height: 3px; border-radius: 2px; outline: none; cursor: pointer;
    background: linear-gradient(
      to right,
      #C9A84C var(--fill-pct, 18%),
      rgba(201,168,76,0.22) var(--fill-pct, 18%)
    );
  }
  .sp-radius-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 15px; height: 15px; border-radius: 50%;
    background: #C9A84C; border: 2.5px solid #fff;
    box-shadow: 0 1px 5px rgba(0,0,0,0.35); cursor: grab;
    transition: transform .1s;
  }
  .sp-radius-slider:active::-webkit-slider-thumb { cursor: grabbing; transform: scale(1.2); }
  .sp-radius-slider::-moz-range-thumb {
    width: 15px; height: 15px; border-radius: 50%;
    background: #C9A84C; border: 2.5px solid #fff;
    box-shadow: 0 1px 5px rgba(0,0,0,0.35); cursor: grab;
  }
  .sp-radius-val {
    font-size: 12px; font-weight: 700; color: #C9A84C;
    min-width: 34px; text-align: left;
  }

  /* Distance badge — overlay on card thumbnail */
  .sc-dist-badge {
    position: absolute; bottom: 7px; right: 7px;
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(10,10,11,0.82); backdrop-filter: blur(6px);
    border: 1px solid rgba(201,168,76,0.35);
    color: #C9A84C; font-size: 10.5px; font-weight: 700;
    padding: 4px 9px; border-radius: 7px;
    white-space: nowrap; line-height: 1; pointer-events: none;
  }
  .sc-dist-badge svg { flex-shrink: 0; }

  /* Responsive */
  @media (max-width: 860px) {
    .sp-layout { grid-template-columns: 1fr; }
    .sp-map-panel { display: none; }
  }
`

function injectCss() {
  if (cssInjected) return
  cssInjected = true
  const el = document.createElement('style')
  el.textContent = CSS
  document.head.appendChild(el)
}

/* ─── Constants ─────────────────────────────────────────────────*/
const PAGE_SIZE = 12
const ROOM_TYPES  = ['STANDARD','DELUXE','SUITE','FAMILY']
const TYPE_LABEL  = { STANDARD:'Standard', DELUXE:'Deluxe', SUITE:'Suite', FAMILY:'Gia đình' }
const SCORE_LABEL = r => {
  const s = r * 2
  if (s >= 9) return 'Tuyệt vời'
  if (s >= 8) return 'Rất tốt'
  if (s >= 7) return 'Tốt'
  return 'Khá'
}

/* ─── Distance formatter ─────────────────────────────────────────*/
function fmtDist(km) {
  if (km < 0.1)  return `${Math.round(km * 1000)} m từ bạn`
  if (km < 1)    return `${(km * 1000).toFixed(0)} m từ bạn`
  if (km < 10)   return `${km.toFixed(1)} km từ bạn`
  return `${Math.round(km)} km từ bạn`
}

/* ─── SearchCard ────────────────────────────────────────────────*/
function SearchCard({ hotel, checkIn, checkOut, isHighlighted, onHover, onLeave, cardRef, distanceKm }) {
  const navigate = useNavigate()
  const img   = hotel.images?.[0]
  const score = hotel.avgRating > 0 ? (hotel.avgRating * 2).toFixed(1) : null

  return (
    <div
      ref={cardRef}
      className={`sc${isHighlighted ? ' sc-active' : ''}`}
      onClick={() => navigate(`/hotels/${hotel.id}`, { state: { checkIn, checkOut } })}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Thumbnail */}
      <div className="sc-thumb">
        {img
          ? <img src={img} alt={hotel.name} />
          : <div className="sc-thumb-ph">✦</div>
        }
        {score && <div className="sc-badge">★ {score}</div>}

        {/* Distance badge — overlay bottom-right on thumbnail */}
        {distanceKm != null && (
          <div className="sc-dist-badge">
            <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
            </svg>
            {fmtDist(distanceKm)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="sc-body">
        <div className="sc-name">{hotel.name}</div>
        <div className="sc-city">📍 {hotel.city}{hotel.address ? `, ${hotel.address}` : ''}</div>

        {score && (
          <div className="sc-rating">
            <span className="sc-rbadge">{score}</span>
            <span className="sc-rlabel">{SCORE_LABEL(hotel.avgRating)}</span>
            {hotel.reviewCount > 0 && (
              <span className="sc-rcnt">{hotel.reviewCount} đánh giá</span>
            )}
          </div>
        )}

        <div className="sc-foot">
          <div>
            {hotel.minPrice ? (
              <>
                <div className="sc-price-from">Từ</div>
                <span className="sc-price-val">{hotel.minPrice.toLocaleString('vi-VN')}</span>
                <span className="sc-price-unit"> ₫/đêm</span>
              </>
            ) : (
              <span style={{ fontSize: 11, color: '#A09D96' }}>Liên hệ xem giá</span>
            )}
          </div>
          <div className="sc-arrow">→</div>
        </div>
      </div>
    </div>
  )
}

/* ─── Pagination ────────────────────────────────────────────────*/
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  const MAX = 7
  let pages = []
  if (totalPages <= MAX) {
    pages = Array.from({ length: totalPages }, (_, i) => i)
  } else {
    pages = [0, 1, '…', Math.max(1, page - 1), page, Math.min(totalPages - 2, page + 1), '…', totalPages - 1]
      .filter((v, i, a) => a.indexOf(v) === i && (typeof v !== 'number' || v >= 0))
  }
  return (
    <div className="sp-pag">
      <button className="sp-pbtn" disabled={page === 0} onClick={() => onChange(page - 1)}>‹</button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} style={{ fontSize: 12, color: '#A09D96', padding: '0 4px' }}>…</span>
          : <button key={p} className={`sp-pbtn${p === page ? ' sp-pbtn-active' : ''}`} onClick={() => onChange(p)}>{p + 1}</button>
      )}
      <button className="sp-pbtn" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}>›</button>
    </div>
  )
}

/* ─── SearchPage ────────────────────────────────────────────────*/
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => { injectCss() }, [])

  /* nearby mode */
  const isNearby  = searchParams.get('nearby') === 'true'
  const nearbyLat = parseFloat(searchParams.get('lat') ?? '0')
  const nearbyLng = parseFloat(searchParams.get('lng') ?? '0')

  const initKm = parseFloat(searchParams.get('radius') ?? '10')
  const [sliderKm, setSliderKm] = useState(initKm) // display value
  const [fetchKm,  setFetchKm]  = useState(initKm) // debounced fetch trigger
  const radiusTimer = useRef(null)

  const handleRadiusChange = (val) => {
    setSliderKm(val)
    clearTimeout(radiusTimer.current)
    radiusTimer.current = setTimeout(() => setFetchKm(val), 300)
  }

  useEffect(() => () => clearTimeout(radiusTimer.current), [])

  /* filters ─ init từ URL params */
  const init = {
    city:     searchParams.get('city')     ?? '',
    checkIn:  searchParams.get('checkIn')  ?? '',
    checkOut: searchParams.get('checkOut') ?? '',
    type:     searchParams.get('type')     ?? '',
    minPrice: searchParams.get('minPrice') ?? '',
    maxPrice: searchParams.get('maxPrice') ?? '',
  }
  const [filters, setFilters] = useState(init)
  const [draft,   setDraft]   = useState(init)
  const [page,    setPage]    = useState(0)
  const [sortBy,  setSortBy]  = useState(isNearby ? 'distance' : 'rating')

  /* data */
  const [hotels,        setHotels]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages,    setTotalPages]    = useState(0)

  /* hover sync */
  const [hoveredId, setHoveredId] = useState(null)
  const cardRefs = useRef({})

  /* fetch */
  useEffect(() => {
    setLoading(true)
    if (isNearby && nearbyLat && nearbyLng) {
      getNearbyHotels(nearbyLat, nearbyLng, fetchKm, 40)
        .then(res => {
          const list = res.data.data ?? []
          setHotels(list)
          setTotalElements(list.length)
          setTotalPages(1)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      searchHotels({
        city:     filters.city     || undefined,
        type:     filters.type     || undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        page,
        size: PAGE_SIZE,
      })
        .then(res => {
          const d = res.data.data
          setHotels(d.content ?? [])
          setTotalElements(d.totalElements ?? 0)
          setTotalPages(d.totalPages ?? 0)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [filters, page, isNearby, nearbyLat, nearbyLng, fetchKm])

  /* client-side sort */
  const sorted = useMemo(() => {
    const a = [...hotels]
    if (sortBy === 'price_asc')  a.sort((x, y) => (x.minPrice ?? Infinity) - (y.minPrice ?? Infinity))
    if (sortBy === 'price_desc') a.sort((x, y) => (y.minPrice ?? 0) - (x.minPrice ?? 0))
    if (sortBy === 'reviews')    a.sort((x, y) => (y.reviewCount ?? 0) - (x.reviewCount ?? 0))
    if (sortBy === 'distance')   a.sort((x, y) => (x.distanceKm ?? 0) - (y.distanceKm ?? 0))
    return a
  }, [hotels, sortBy])

  /* nights badge */
  const nights = useMemo(() => {
    if (!filters.checkIn || !filters.checkOut) return 0
    return Math.max(0, Math.round((new Date(filters.checkOut) - new Date(filters.checkIn)) / 86_400_000))
  }, [filters.checkIn, filters.checkOut])

  const handleApply = useCallback(() => {
    setFilters(draft)
    setPage(0)
  }, [draft])

  /* reset sort when exiting nearby mode */
  useEffect(() => {
    if (!isNearby && sortBy === 'distance') setSortBy('rating')
  }, [isNearby])

  /* marker hover → scroll card into view */
  const handleMapHover = useCallback((id) => {
    setHoveredId(id)
    if (id && cardRefs.current[id]) {
      cardRefs.current[id].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  /* ── Render ─────────────────────────────────── */
  return (
    <div className="sp-root">
      <Navbar />

      {/* Filter bar */}
      <div className="sp-bar">
        <div className="sp-bar-inner">

          <input
            className="sp-inp sp-inp-city"
            placeholder="🔍 Thành phố, điểm đến..."
            value={draft.city}
            onChange={e => setDraft(d => ({ ...d, city: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleApply()}
          />

          <div className="sp-sep" />

          <input type="date" className="sp-inp sp-inp-date"
            value={draft.checkIn}
            onChange={e => setDraft(d => ({ ...d, checkIn: e.target.value }))} />

          <span style={{ fontSize: 11, color: '#A09D96', flexShrink: 0 }}>→</span>

          <input type="date" className="sp-inp sp-inp-date"
            value={draft.checkOut}
            onChange={e => setDraft(d => ({ ...d, checkOut: e.target.value }))} />

          {nights > 0 && <span className="sp-nights">{nights} đêm</span>}

          <div className="sp-sep" />

          <select className="sp-sel" value={draft.type}
            onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}>
            <option value="">Loại phòng</option>
            {ROOM_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>

          <input className="sp-inp sp-inp-price" placeholder="Giá từ" type="number"
            value={draft.minPrice}
            onChange={e => setDraft(d => ({ ...d, minPrice: e.target.value }))} />

          <input className="sp-inp sp-inp-price" placeholder="Đến" type="number"
            value={draft.maxPrice}
            onChange={e => setDraft(d => ({ ...d, maxPrice: e.target.value }))} />

          <div className="sp-sep" />

          <select className="sp-sel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            {isNearby && <option value="distance">Gần nhất</option>}
            <option value="rating">Xếp hạng</option>
            <option value="price_asc">Giá thấp → cao</option>
            <option value="price_desc">Giá cao → thấp</option>
            <option value="reviews">Nhiều đánh giá</option>
          </select>

          <button className="sp-btn" onClick={handleApply}>Tìm kiếm</button>
        </div>
      </div>

      {/* Split layout */}
      <div className="sp-layout">

        {/* ── Left: card list ── */}
        <div className="sp-panel">

          {/* Nearby banner */}
          {isNearby && (
            <div className="sp-nearby-banner">
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              </svg>
              Gần bạn

              <div className="sp-radius-wrap">
                <span className="sp-radius-label">Bán kính</span>
                <input
                  type="range" min="1" max="50" step="1"
                  value={sliderKm}
                  onChange={e => handleRadiusChange(Number(e.target.value))}
                  className="sp-radius-slider"
                  style={{ '--fill-pct': `${((sliderKm - 1) / 49 * 100).toFixed(1)}%` }}
                />
                <span className="sp-radius-val">{sliderKm}km</span>
              </div>

              <button className="sp-nearby-exit" onClick={() => setSearchParams({})}>
                ✕ Thoát
              </button>
            </div>
          )}

          <div className="sp-panel-head">
            {loading
              ? <span>Đang tìm kiếm…</span>
              : <span>
                  <strong>{totalElements.toLocaleString('vi-VN')}</strong>
                  {isNearby
                    ? ` khách sạn trong vòng ${fetchKm}km`
                    : ` khách sạn${filters.city ? ` tại "${filters.city}"` : ''}`}
                </span>
            }
            {!loading && nights > 0 && (
              <div className="sp-panel-head-right">
                <span style={{ fontSize: 11, color: '#A09D96' }}>{nights} đêm</span>
              </div>
            )}
          </div>

          <div className="sp-scroll">
            {/* Loading skeletons */}
            {loading && [...Array(8)].map((_, i) => <div key={i} className="sc-skel" />)}

            {/* Hotel cards */}
            {!loading && sorted.map(hotel => (
              <SearchCard
                key={hotel.id}
                hotel={hotel}
                checkIn={filters.checkIn}
                checkOut={filters.checkOut}
                isHighlighted={hoveredId === hotel.id}
                onHover={() => setHoveredId(hotel.id)}
                onLeave={() => setHoveredId(null)}
                cardRef={el => { if (el) cardRefs.current[hotel.id] = el }}
                distanceKm={hotel.distanceKm ?? null}
              />
            ))}

            {/* Empty state */}
            {!loading && sorted.length === 0 && (
              <div className="sp-empty">
                <div className="sp-empty-icon">{isNearby ? '📍' : '🔍'}</div>
                <div className="sp-empty-title">
                  {isNearby ? 'Không có khách sạn nào gần bạn' : 'Không tìm thấy khách sạn'}
                </div>
                <div className="sp-empty-sub">
                  {isNearby ? `Không có khách sạn nào trong vòng ${fetchKm}km` : 'Thử thay đổi bộ lọc hoặc tìm kiếm thành phố khác'}
                </div>
              </div>
            )}

            {/* Pagination — hide in nearby mode (flat list) */}
            {!loading && !isNearby && totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p) }} />
            )}
          </div>
        </div>

        {/* ── Right: map ── */}
        <div className="sp-map-panel">
          <Suspense fallback={
            <div className="sp-map-fallback">
              <div className="sp-spinner" />
              <span>Đang tải bản đồ…</span>
            </div>
          }>
            <MapView
              hotels={sorted}
              hoveredHotelId={hoveredId}
              onHoverHotel={handleMapHover}
              checkIn={filters.checkIn}
              checkOut={filters.checkOut}
              height="100%"
              noBorder
              userLocation={isNearby && nearbyLat && nearbyLng
                ? { lat: nearbyLat, lng: nearbyLng }
                : null}
              radiusKm={sliderKm}
            />
          </Suspense>
        </div>

      </div>
    </div>
  )
}
