import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'

/* ── inject once ─────────────────────────────────────────────── */
let cssInjected = false
function injectCss() {
  if (cssInjected) return
  cssInjected = true
  const el = document.createElement('style')
  el.textContent = `
    .mini-map-wrap { pointer-events: none !important; }
    .mini-map-wrap * { pointer-events: none !important; }
    .mini-map-wrap .leaflet-container { cursor: default !important; background: #e8e4de; }
    .mini-map-wrap .leaflet-control-container { display: none !important; }
  `
  document.head.appendChild(el)
}

/* ── gold pin icon ───────────────────────────────────────────── */
const HOTEL_PIN = L.divIcon({
  className: '',
  html: `<div style="
    position:relative; width:28px; height:34px;
    display:flex; flex-direction:column; align-items:center;
    filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35));
  ">
    <div style="
      width:20px; height:20px; border-radius:50%;
      background:#C9A84C; border:3px solid #fff;
      box-shadow:0 0 0 2px rgba(201,168,76,0.4);
    "></div>
    <div style="
      width:2px; height:10px;
      background:linear-gradient(to bottom,#C9A84C,rgba(201,168,76,0));
    "></div>
  </div>`,
  iconSize: [28, 34],
  iconAnchor: [14, 34],
})

/* ── MiniMap ─────────────────────────────────────────────────── */
export default function MiniMap({ lat, lng, address }) {
  useEffect(() => { injectCss() }, [])

  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null

  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

  return (
    <div style={{
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid rgba(0,0,0,0.08)',
      background: '#fff',
      position: 'relative',
    }}>
      {/* Map — pointer-events none */}
      <div className="mini-map-wrap" style={{ height: 180 }}>
        <MapContainer
          center={[lat, lng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          dragging={false}
          zoomControl={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          keyboard={false}
          touchZoom={false}
          attributionControl={false}
        >
          {/* Cartodb Light — neutral, matches the hotel design */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <Marker position={[lat, lng]} icon={HOTEL_PIN} />
        </MapContainer>
      </div>

      {/* Address footer — interactive (pointer-events restored) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderTop: '1px solid rgba(0,0,0,0.07)',
        gap: 8,
        pointerEvents: 'all',
      }}>
        <span style={{
          fontSize: 12, color: '#6B6860',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          📍 {address}
        </span>
        <a
          href={gmapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            fontSize: 11, fontWeight: 600,
            color: '#C9A84C', textDecoration: 'none',
            fontFamily: "'Outfit', system-ui, sans-serif",
            transition: 'color .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#d9b85a' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#C9A84C' }}
        >
          Google Maps →
        </a>
      </div>
    </div>
  )
}
