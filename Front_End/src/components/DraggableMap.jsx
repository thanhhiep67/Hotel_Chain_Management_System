import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'

/* ── inject CSS once ─────────────────────────────────────────── */
let cssInjected = false
function injectCss() {
  if (cssInjected) return
  cssInjected = true
  const el = document.createElement('style')
  el.textContent = `
    .dm-wrap .leaflet-container { cursor: crosshair !important; }
    .dm-wrap .leaflet-marker-icon { cursor: grab !important; }
    .dm-wrap .leaflet-marker-icon:active { cursor: grabbing !important; }
  `
  document.head.appendChild(el)
}

/* ── gold draggable pin ─────────────────────────────────────── */
const DRAG_PIN = L.divIcon({
  className: '',
  html: `<div style="
    position:relative; width:28px; height:38px;
    display:flex; flex-direction:column; align-items:center;
    filter:drop-shadow(0 4px 8px rgba(0,0,0,0.4));
  ">
    <div style="
      width:22px; height:22px; border-radius:50%;
      background:#C9A84C; border:3px solid #fff;
      box-shadow:0 0 0 2.5px rgba(201,168,76,0.5);
    "></div>
    <div style="
      width:2.5px; height:12px;
      background:linear-gradient(to bottom,#C9A84C,rgba(201,168,76,0));
    "></div>
  </div>`,
  iconSize: [28, 38],
  iconAnchor: [14, 38],
})

/* ── re-center map when lat/lng props change ────────────────── */
function MapSync({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true, duration: 0.4 })
  }, [lat, lng, map])
  return null
}

/* ── DraggableMap ────────────────────────────────────────────── */
export default function DraggableMap({ lat, lng, hasCoords = true, onDragEnd }) {
  useEffect(() => { injectCss() }, [])

  return (
    <div
      className="dm-wrap"
      style={{
        position: 'relative',
        height: 260,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.1)',
        background: '#f0ede8',
      }}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={hasCoords ? 15 : 12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <MapSync lat={lat} lng={lng} />
        <Marker
          position={[lat, lng]}
          draggable
          icon={DRAG_PIN}
          eventHandlers={{
            dragend: (e) => {
              const { lat: newLat, lng: newLng } = e.target.getLatLng()
              onDragEnd(newLat, newLng)
            },
          }}
        />
      </MapContainer>

      {/* Overlay hint — chỉ hiện khi chưa có tọa độ */}
      {!hasCoords && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, pointerEvents: 'none',
          background: 'rgba(10,10,11,0.75)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(201,168,76,0.35)',
          borderRadius: 50, padding: '7px 16px',
          display: 'flex', alignItems: 'center', gap: 7,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: 14 }}>✦</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#C9A84C', letterSpacing: '0.02em' }}>
            Kéo marker đến vị trí khách sạn
          </span>
        </div>
      )}
    </div>
  )
}
