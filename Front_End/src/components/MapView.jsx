import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'

/* ─── Inject popup CSS vào <head> (chỉ 1 lần) ──────────────────*/
const MAP_CSS = `
  .hotel-popup .leaflet-popup-content-wrapper {
    padding: 0;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 8px 32px rgba(0,0,0,0.14);
    font-family: 'Outfit', system-ui, sans-serif;
  }
  .hotel-popup .leaflet-popup-content {
    margin: 0;
    width: 240px !important;
  }
  .hotel-popup .leaflet-popup-tip-container { display: none; }
  .hotel-popup .leaflet-popup-close-button {
    top: 8px; right: 8px;
    color: rgba(255,255,255,0.85);
    font-size: 18px; z-index: 10;
  }
  .hotel-popup .leaflet-popup-close-button:hover { color: #fff; }
`

let cssInjected = false
function injectCss() {
  if (cssInjected) return
  cssInjected = true
  const el = document.createElement('style')
  el.textContent = MAP_CSS
  document.head.appendChild(el)
}

/* ─── Price-tag divIcon ─────────────────────────────────────────*/
function makeIcon(minPrice, highlighted = false) {
  const label = minPrice
    ? minPrice >= 1_000_000
      ? (minPrice / 1_000_000).toFixed(1) + 'M₫'
      : Math.round(minPrice / 1_000) + 'K₫'
    : '🏨'

  if (highlighted) {
    return L.divIcon({
      className: '',
      html: `<div style="
        position:relative;display:inline-flex;align-items:center;
        background:#1C1B18;color:#C9A84C;
        padding:7px 13px;border-radius:10px;
        font:700 13px/1 'Outfit',sans-serif;
        white-space:nowrap;
        border:2px solid #C9A84C;
        box-shadow:0 4px 20px rgba(0,0,0,0.45),0 0 0 4px rgba(201,168,76,0.22);
        cursor:pointer;user-select:none;
        transform:scale(1.08);transform-origin:bottom center;">
        ${label}
        <span style="
          position:absolute;bottom:-8px;left:50%;
          transform:translateX(-50%);
          border-left:7px solid transparent;
          border-right:7px solid transparent;
          border-top:8px solid #1C1B18;">
        </span>
      </div>`,
      iconSize: [82, 32],
      iconAnchor: [41, 40],
      popupAnchor: [0, -44],
    })
  }

  return L.divIcon({
    className: '',
    html: `<div style="
      position:relative;display:inline-flex;align-items:center;
      background:#C9A84C;color:#0A0A0B;
      padding:5px 10px;border-radius:8px;
      font:700 12px/1 'Outfit',sans-serif;
      white-space:nowrap;border:2px solid #8A6E30;
      box-shadow:0 3px 12px rgba(0,0,0,0.35);
      cursor:pointer;user-select:none;">
      ${label}
      <span style="
        position:absolute;bottom:-7px;left:50%;
        transform:translateX(-50%);
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:7px solid #C9A84C;">
      </span>
    </div>`,
    iconSize: [70, 28],
    iconAnchor: [35, 35],
    popupAnchor: [0, -38],
  })
}

/* ─── FitBounds ─────────────────────────────────────────────────*/
function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) { map.setView(points[0], 15, { animate: false }); return }
    map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 15, animate: false })
  }, [points, map])
  return null
}

/* ─── User location pin (blue dot) ─────────────────────────────*/
const USER_PIN = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:20px;height:20px;">
    <div style="
      position:absolute;inset:0;border-radius:50%;
      background:rgba(66,133,244,0.18);border:1px solid rgba(66,133,244,0.35);
    "></div>
    <div style="
      position:absolute;top:5px;left:5px;
      width:10px;height:10px;border-radius:50%;
      background:#4285F4;border:2.5px solid #fff;
      box-shadow:0 1px 6px rgba(66,133,244,0.65);
    "></div>
  </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

/* ─── Fit map to circle bounds once on mount ────────────────────*/
function CircleFit({ lat, lng, radiusKm }) {
  const map  = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    const bounds = L.circle([lat, lng], { radius: radiusKm * 1000 }).getBounds()
    map.fitBounds(bounds, { padding: [36, 36], animate: false })
  }, []) // intentionally empty — fit only once
  return null
}

/* ─── Rating label ──────────────────────────────────────────────*/
function scoreLabel(r) {
  const s = r * 2
  if (s >= 9) return 'Tuyệt vời'
  if (s >= 8) return 'Rất tốt'
  if (s >= 7) return 'Tốt'
  if (s >= 6) return 'Khá'
  return 'Bình thường'
}

/* ─── Popup card ────────────────────────────────────────────────*/
function HotelPopup({ hotel, onNavigate }) {
  const img   = hotel.images?.[0]
  const score = hotel.avgRating > 0 ? (hotel.avgRating * 2).toFixed(1) : null

  return (
    <div style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}>

      {/* Thumbnail */}
      <div style={{ height: 130, background: '#1a1a1e', position: 'relative', overflow: 'hidden' }}>
        {img
          ? <img src={img} alt={hotel.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: 'rgba(255,255,255,0.08)', fontFamily: 'Georgia,serif' }}>✦</div>
        }
        {score && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(10,10,11,0.85)', backdropFilter: 'blur(6px)',
            color: '#F2F0EB', fontSize: 12, fontWeight: 700,
            padding: '4px 8px', borderRadius: 7, lineHeight: 1,
          }}>
            ★ {score}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '13px 14px 14px' }}>

        {/* Tên */}
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#1C1B18',
          lineHeight: 1.35, marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {hotel.name}
        </div>

        {/* Thành phố */}
        <div style={{ fontSize: 11, color: '#6B6860', marginBottom: 10,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          📍 {hotel.city}{hotel.address ? `, ${hotel.address}` : ''}
        </div>

        {/* Rating */}
        {score && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{
              background: '#C9A84C', color: '#0A0A0B',
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
            }}>{score}</span>
            <span style={{ fontSize: 11, color: '#6B6860' }}>{scoreLabel(hotel.avgRating)}</span>
            {hotel.reviewCount > 0 && (
              <span style={{ fontSize: 10, color: '#A09D96', marginLeft: 'auto' }}>
                {hotel.reviewCount} đánh giá
              </span>
            )}
          </div>
        )}

        {/* Giá thấp nhất */}
        <div style={{ marginBottom: 12 }}>
          {hotel.minPrice ? (
            <div>
              <span style={{ fontSize: 10, color: '#A09D96', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Từ </span>
              <span style={{ fontFamily: 'Georgia,serif', fontSize: 18, fontWeight: 600, color: '#1C1B18' }}>
                {hotel.minPrice.toLocaleString('vi-VN')}
              </span>
              <span style={{ fontSize: 11, color: '#6B6860' }}> ₫/đêm</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#A09D96' }}>Liên hệ xem giá</span>
          )}
        </div>

        {/* Nút Xem chi tiết */}
        <button
          onClick={onNavigate}
          style={{
            width: '100%', padding: '9px 0', textAlign: 'center',
            background: '#C9A84C', color: '#0A0A0B',
            fontFamily: "'Outfit', sans-serif", fontSize: 12, fontWeight: 700,
            border: 'none', borderRadius: 8, cursor: 'pointer',
            letterSpacing: '0.03em',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#d9b85a' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#C9A84C' }}
        >
          Xem chi tiết →
        </button>
      </div>
    </div>
  )
}

/* ─── MapView (default export) ──────────────────────────────────*/
export default function MapView({
  hotels = [], checkIn, checkOut,
  height = '480px', hoveredHotelId, onHoverHotel, noBorder = false,
  userLocation = null, radiusKm = 10,
}) {
  const navigate = useNavigate()

  useEffect(() => { injectCss() }, [])

  // Chỉ lấy hotel có tọa độ hợp lệ
  const located = hotels.filter(h =>
    Array.isArray(h.location?.coordinates) && h.location.coordinates.length === 2
  )

  const points = located.map(h => [
    h.location.coordinates[1],  // lat
    h.location.coordinates[0],  // lng
  ])

  // Empty state — chỉ hiện khi không có hotel VÀ không có vị trí user
  if (!located.length && !userLocation) {
    return (
      <div style={{
        height,
        borderRadius: noBorder ? 0 : 14,
        border: noBorder ? 'none' : '1px solid rgba(0,0,0,0.08)',
        background: '#F0EDE8', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        color: '#A09D96', fontFamily: "'Outfit', sans-serif",
      }}>
        <span style={{ fontSize: 36 }}>🗺️</span>
        <span style={{ fontSize: 13 }}>Chưa có dữ liệu vị trí</span>
      </div>
    )
  }

  // Điểm center ban đầu: ưu tiên user location, fallback về hotel đầu tiên
  const initCenter = userLocation
    ? [userLocation.lat, userLocation.lng]
    : points[0]
  const initZoom = userLocation ? 12 : (points.length === 1 ? 15 : 10)

  return (
    <div style={{
      height, overflow: 'hidden',
      borderRadius: noBorder ? 0 : 14,
      border: noBorder ? 'none' : '1px solid rgba(0,0,0,0.08)',
    }}>
      <MapContainer
        center={initCenter}
        zoom={initZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/* Vòng tròn bán kính + vị trí user */}
        {userLocation && (
          <>
            <CircleFit lat={userLocation.lat} lng={userLocation.lng} radiusKm={radiusKm} />
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={radiusKm * 1000}
              pathOptions={{
                color: '#C9A84C',
                fillColor: '#C9A84C',
                fillOpacity: 0.07,
                weight: 1.5,
                dashArray: '7 5',
              }}
            />
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={USER_PIN}
              zIndexOffset={2000}
            />
          </>
        )}

        {/* Hotel markers */}
        {located.map(hotel => {
          const isHovered = hotel.id === hoveredHotelId
          return (
            <Marker
              key={hotel.id}
              position={[hotel.location.coordinates[1], hotel.location.coordinates[0]]}
              icon={makeIcon(hotel.minPrice, isHovered)}
              zIndexOffset={isHovered ? 1000 : 0}
              eventHandlers={{
                mouseover: () => onHoverHotel?.(hotel.id),
                mouseout:  () => onHoverHotel?.(null),
              }}
            >
              <Popup className="hotel-popup" maxWidth={240} minWidth={240}>
                <HotelPopup
                  hotel={hotel}
                  onNavigate={() => navigate(`/hotels/${hotel.id}`, { state: { checkIn, checkOut } })}
                />
              </Popup>
            </Marker>
          )
        })}

        {/* FitBounds chỉ dùng khi không có userLocation */}
        {!userLocation && points.length > 1 && <FitBounds points={points} />}
      </MapContainer>
    </div>
  )
}
