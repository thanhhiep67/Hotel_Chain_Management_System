import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReviewSection from '../components/ReviewSection';
import { getHotelById } from '../api/hotels';

/* ─── constants (unchanged) ──────────────────────────────────── */
const TYPE_LABEL = { STANDARD:'Standard', DELUXE:'Deluxe', SUITE:'Suite', FAMILY:'Family' };
const TYPE_ORDER = ['STANDARD','DELUXE','SUITE','FAMILY'];

const AMENITY_SVG = {
  'WiFi':               'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.143 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0',
  'Wi-Fi':              'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.143 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0',
  'Hồ bơi':            'M3 13.5C3 12 4 11 5.5 11S8 12 8 13.5 7 16 5.5 16 3 15 3 13.5zm9 0C12 12 13 11 14.5 11S17 12 17 13.5 16 16 14.5 16 12 15 12 13.5zm3-7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z',
  'Spa':                'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  'Nhà hàng':          'M3 6h18M3 12h18M3 18h18M6 3v18M18 3v18',
  'Gym':                'M6.75 12h10.5M3 12h1.5M19.5 12H21M5.25 5.25a.75.75 0 01.75-.75h12a.75.75 0 010 1.5H6a.75.75 0 01-.75-.75zm0 13.5a.75.75 0 01.75-.75h12a.75.75 0 010 1.5H6a.75.75 0 01-.75-.75z',
  'Bãi đỗ xe':         'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25',
  'Bar':                'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3',
  'Điều hòa':          'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
  'Dịch vụ phòng':     'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  'Trung tâm hội nghị':'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197',
};

const SCORE_LABEL = r => {
  if (!r || r === 0) return null;
  const s = r * 2;
  if (s >= 9) return 'Tuyệt vời';
  if (s >= 8) return 'Rất tốt';
  if (s >= 7) return 'Tốt';
  if (s >= 6) return 'Khá';
  return 'Bình thường';
};

/* ─── CSS (same token system as HomePage_v2) ─────────────────── */
const CSS = `

  :root {
    --c-bg:      #F7F6F4;
    --c-surface: #FFFFFF;
    --c-card:    #FFFFFF;
    --c-border:  rgba(0,0,0,0.08);
    --c-border2: rgba(0,0,0,0.13);
    --c-gold:    #C9A84C;
    --c-gold-d:  #8A6E30;
    --c-text:    #1C1B18;
    --c-muted:   #6B6860;
    --c-subtle:  #A09D96;
    --r:         14px;
    --t:         all 0.22s cubic-bezier(0.4,0,0.2,1);
    --font-d:    'Cormorant Garamond', Georgia, serif;
    --font-b:    'Outfit', system-ui, sans-serif;
  }

  .hd-root {
    background: var(--c-bg); color: var(--c-text);
    font-family: var(--font-b); font-size: 14px;
    line-height: 1.6; min-height: 100vh;
  }

  /* ── breadcrumb ── */
  .breadcrumb { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--c-subtle); margin-bottom:20px; }
  .breadcrumb a { color:var(--c-muted); text-decoration:none; transition:var(--t); }
  .breadcrumb a:hover { color:var(--c-gold); }
  .breadcrumb-sep { color:var(--c-subtle); }

  /* ── gallery ── */
  .gallery-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; border-radius:var(--r); overflow:hidden; height:420px; }
  .gallery-main { position:relative; overflow:hidden; background:#1a1a1e; }
  .gallery-main img { width:100%; height:100%; object-fit:cover; transition:transform 0.5s cubic-bezier(0.4,0,0.2,1); }
  .gallery-main:hover img { transform:scale(1.03); }
  .gallery-nav {
    position:absolute; top:50%; transform:translateY(-50%);
    width:38px; height:38px; border-radius:50%;
    background:rgba(10,10,11,0.7); border:1px solid var(--c-border2);
    color:var(--c-text); font-size:18px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    transition:var(--t); backdrop-filter:blur(8px);
  }
  .gallery-nav:hover { background:rgba(201,168,76,0.25); border-color:var(--c-gold-d); }
  .gallery-nav-l { left:12px; }
  .gallery-nav-r { right:12px; }
  .gallery-thumbs-grid { display:grid; grid-template-rows:1fr 1fr; grid-template-columns:1fr 1fr; gap:6px; }
  .gallery-thumb { position:relative; overflow:hidden; background:#1a1a1e; cursor:pointer; }
  .gallery-thumb img { width:100%; height:100%; object-fit:cover; transition:transform 0.4s; }
  .gallery-thumb:hover img { transform:scale(1.06); }
  .gallery-more-overlay {
    position:absolute; inset:0; background:rgba(10,10,11,0.7);
    display:flex; align-items:center; justify-content:center;
    color:var(--c-text); font-size:13px; font-weight:600; cursor:pointer;
    backdrop-filter:blur(2px);
  }
  .gallery-strip { display:flex; gap:6px; margin-top:8px; overflow-x:auto; padding-bottom:2px; }
  .gallery-strip::-webkit-scrollbar { height:3px; }
  .gallery-strip::-webkit-scrollbar-track { background:var(--c-surface); }
  .gallery-strip::-webkit-scrollbar-thumb { background:var(--c-border2); border-radius:2px; }
  .gallery-strip-item {
    flex-shrink:0; width:56px; height:56px; border-radius:8px; overflow:hidden;
    border:2px solid transparent; cursor:pointer; transition:var(--t); opacity:0.45;
  }
  .gallery-strip-item.active { border-color:var(--c-gold); opacity:1; }
  .gallery-strip-item:not(.active):hover { opacity:0.75; }
  .gallery-strip-item img { width:100%; height:100%; object-fit:cover; }
  .gallery-see-all {
    display:inline-flex; align-items:center; gap:6px; margin-top:10px;
    font-size:12px; color:var(--c-muted); cursor:pointer; transition:var(--t);
    background:none; border:none; font-family:var(--font-b);
  }
  .gallery-see-all:hover { color:var(--c-gold); }

  /* lightbox */
  .lightbox { position:fixed; inset:0; z-index:60; background:rgba(0,0,0,0.95); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; }
  .lightbox img { max-height:80vh; max-width:100%; object-fit:contain; border-radius:8px; }
  .lightbox-close { position:absolute; top:16px; right:16px; width:36px; height:36px; background:rgba(255,255,255,0.1); border:1px solid var(--c-border); border-radius:50%; color:var(--c-text); font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:var(--t); }
  .lightbox-close:hover { background:rgba(255,255,255,0.2); }
  .lightbox-strip { display:flex; gap:6px; margin-top:12px; overflow-x:auto; max-width:100%; padding-bottom:4px; }

  /* ── layout ── */
  .detail-wrap { max-width:1140px; margin:0 auto; padding:28px 28px 64px; }
  .detail-grid { display:grid; grid-template-columns:1fr 340px; gap:24px; margin-top:24px; }

  /* ── cards / panels ── */
  .panel {
    background:var(--c-card); border:1px solid var(--c-border);
    border-radius:var(--r); padding:24px; margin-bottom:16px;
  }
  .panel-title {
    font-family:var(--font-b); font-size:22px; font-weight:600;
    color:var(--c-text); margin-bottom:16px;
  }

  /* ── hotel name block ── */
  .hotel-name {
    font-family:var(--font-b); font-size:clamp(26px,3.5vw,38px);
    font-weight:600; color:var(--c-text); line-height:1.15; letter-spacing:-0.01em;
  }
  .score-badge {
    display:inline-flex; align-items:center; justify-content:center;
    background:var(--c-gold); color:#0A0A0B;
    font-size:15px; font-weight:800; font-family:var(--font-b);
    width:44px; height:44px; border-radius:10px; flex-shrink:0;
  }
  .stars { display:flex; gap:3px; }
  .star { width:16px; height:16px; }
  .star-on  { color:#C9A84C; }
  .star-off { color:rgba(255,255,255,0.1); }
  .hotel-addr { font-size:13px; color:var(--c-muted); margin-top:8px; }

  /* ── amenities ── */
  .amenities-grid { display:flex; flex-wrap:wrap; gap:8px; }
  .amenity-chip {
    display:flex; align-items:center; gap:8px;
    background:rgba(255,255,255,0.04); border:1px solid var(--c-border);
    border-radius:10px; padding:8px 14px;
    font-size:12px; color:var(--c-muted); font-weight:500;
    transition:var(--t);
  }
  .amenity-chip:hover { border-color:var(--c-gold-d); color:var(--c-text); }
  .amenity-icon { width:16px; height:16px; color:var(--c-gold); flex-shrink:0; }

  /* ── date strip ── */
  .date-strip {
    display:flex; align-items:center; gap:12px;
    background:rgba(201,168,76,0.07); border:1px solid rgba(201,168,76,0.2);
    border-radius:12px; padding:14px 18px;
  }
  .date-item { display:flex; flex-direction:column; gap:2px; }
  .date-label { font-size:10px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:var(--c-gold); }
  .date-value { font-size:14px; font-weight:600; color:var(--c-text); }
  .date-arrow { color:var(--c-gold-d); font-size:18px; }

  /* ── section heading ── */
  .section-heading {
    font-family:var(--font-b); font-size:26px; font-weight:600;
    color:var(--c-text); margin-bottom:20px;
  }
  .type-heading {
    display:flex; align-items:center; gap:10px; margin-bottom:12px; margin-top:28px;
  }
  .type-heading-bar { width:3px; height:20px; background:var(--c-gold); border-radius:2px; }
  .type-heading-name { font-size:16px; font-weight:600; color:var(--c-text); }
  .type-heading-count {
    font-size:11px; color:var(--c-muted); background:rgba(255,255,255,0.05);
    border:1px solid var(--c-border); padding:2px 10px; border-radius:20px;
  }

  /* ── room card ── */
  .room-card {
    background:var(--c-card); border:1px solid var(--c-border);
    border-radius:var(--r); overflow:hidden;
    display:flex; transition:var(--t); margin-bottom:10px;
  }
  .room-card:hover { border-color:var(--c-border2); box-shadow:0 8px 32px rgba(0,0,0,0.4); }
  .room-card:hover .room-img { transform:scale(1.05); }
  .room-img-wrap { width:160px; flex-shrink:0; position:relative; overflow:hidden; background:#1a1a1e; }
  .room-img { width:100%; height:100%; object-fit:cover; transition:transform 0.45s cubic-bezier(0.4,0,0.2,1); }
  .room-type-badge {
    position:absolute; top:10px; left:10px;
    font-size:10px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase;
    background:rgba(10,10,11,0.82); color:var(--c-gold);
    border:1px solid rgba(201,168,76,0.3); padding:3px 9px; border-radius:6px;
  }
  .room-body { flex:1; min-width:0; padding:18px 20px; display:flex; flex-direction:column; justify-content:space-between; }
  .room-name { font-size:15px; font-weight:600; color:var(--c-text); line-height:1.3; }
  .room-desc { font-size:12px; color:var(--c-muted); margin-top:3px; font-style:italic; }
  .room-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
  .room-chip {
    font-size:11px; color:var(--c-muted); background:rgba(255,255,255,0.04);
    border:1px solid var(--c-border); padding:4px 10px; border-radius:6px;
  }
  .room-footer { display:flex; align-items:flex-end; justify-content:space-between; margin-top:16px; padding-top:16px; border-top:1px solid var(--c-border); }
  .room-price { font-family:var(--font-b); font-size:26px; font-weight:600; color:var(--c-gold); line-height:1; }
  .room-price-unit { font-size:12px; color:var(--c-muted); font-family:var(--font-b); font-weight:300; margin-top:3px; }
  .room-nights { font-size:12px; color:var(--c-muted); margin-top:4px; }
  .room-nights strong { color:var(--c-text); font-weight:600; }
  .room-status-ok  { font-size:11px; color:#4ade80; font-weight:600; margin-bottom:8px; letter-spacing:0.04em; }
  .room-status-bad { font-size:11px; color:#fb923c; font-weight:600; margin-bottom:8px; letter-spacing:0.04em; }
  .room-btn {
    padding:10px 22px; font-size:13px; font-weight:600; border:none; border-radius:10px;
    cursor:pointer; transition:var(--t); font-family:var(--font-b); white-space:nowrap;
  }
  .room-btn-ok  { background:var(--c-gold); color:#0A0A0B; }
  .room-btn-ok:hover  { background:#e0bc5e; box-shadow:0 4px 16px rgba(201,168,76,0.3); transform:translateY(-1px); }
  .room-btn-dis { background:rgba(255,255,255,0.06); color:var(--c-subtle); cursor:not-allowed; }

  /* ── sticky panel ── */
  .sticky-panel { position:sticky; top:24px; background:var(--c-card); border:1px solid var(--c-border); border-radius:var(--r); overflow:hidden; }
  .sticky-header { background:linear-gradient(135deg,#1a1510,#0f0d09); padding:24px; border-bottom:1px solid var(--c-border); }
  .sticky-hotel { font-size:11px; color:var(--c-muted); text-transform:uppercase; letter-spacing:0.12em; margin-bottom:6px; }
  .sticky-price { font-family:var(--font-b); font-size:36px; font-weight:600; color:var(--c-gold); line-height:1; }
  .sticky-price-sub { font-size:12px; color:var(--c-muted); margin-top:4px; }
  .sticky-nights { display:inline-block; background:rgba(201,168,76,0.15); border:1px solid rgba(201,168,76,0.3); color:var(--c-gold); font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; margin-top:8px; }
  .sticky-body { padding:20px; display:flex; flex-direction:column; gap:16px; }
  .date-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .date-box { background:rgba(255,255,255,0.04); border:1px solid var(--c-border); border-radius:10px; padding:12px; }
  .date-box-label { font-size:10px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:var(--c-gold); margin-bottom:4px; }
  .date-box-val { font-size:13px; font-weight:600; color:var(--c-text); }
  .price-breakdown { background:rgba(255,255,255,0.03); border:1px solid var(--c-border); border-radius:10px; padding:14px; }
  .pb-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--c-muted); margin-bottom:8px; }
  .pb-row-total { display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:700; color:var(--c-text); padding-top:10px; border-top:1px solid var(--c-border); margin-top:4px; }
  .pb-total-val { color:var(--c-gold); }
  .sticky-cta {
    width:100%; padding:15px; font-size:14px; font-weight:700;
    background:var(--c-gold); color:#0A0A0B; border:none;
    border-radius:10px; cursor:pointer; font-family:var(--font-b);
    transition:var(--t); display:flex; align-items:center; justify-content:center; gap:8px;
  }
  .sticky-cta:hover { background:#e0bc5e; box-shadow:0 6px 24px rgba(201,168,76,0.35); transform:translateY(-1px); }
  .trust-list { display:flex; flex-direction:column; gap:8px; }
  .trust-item { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--c-muted); }
  .trust-dot { width:6px; height:6px; border-radius:50%; background:var(--c-gold); flex-shrink:0; }
  .rating-row { display:flex; align-items:center; gap:12px; padding-top:16px; border-top:1px solid var(--c-border); }
  .rating-big { width:48px; height:48px; background:var(--c-gold); border-radius:10px; display:flex; align-items:center; justify-content:center; font-family:var(--font-b); font-size:18px; font-weight:700; color:#0A0A0B; flex-shrink:0; }
  .rating-label { font-size:14px; font-weight:600; color:var(--c-text); }
  .rating-sub { font-size:11px; color:var(--c-subtle); margin-top:2px; }

  /* ── chat btn ── */
  .chat-btn {
    display:inline-flex; align-items:center; gap:8px;
    padding:10px 18px; border-radius:10px; font-size:13px; font-weight:600;
    background:rgba(201,168,76,0.1); border:1px solid rgba(201,168,76,0.3);
    color:var(--c-gold); cursor:pointer; transition:var(--t); font-family:var(--font-b);
    white-space:nowrap;
  }
  .chat-btn:hover { background:rgba(201,168,76,0.18); border-color:var(--c-gold-d); }

  /* ── skeleton ── */
  .sk { background:linear-gradient(90deg,#1e1e22 25%,#252529 50%,#1e1e22 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:10px; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* ── empty ── */
  .rooms-empty { text-align:center; padding:64px 20px; background:var(--c-card); border:1px solid var(--c-border); border-radius:var(--r); }
  .rooms-empty-glyph { font-family:var(--font-b); font-size:52px; color:rgba(255,255,255,0.06); margin-bottom:16px; }

  /* ── error ── */
  .error-state { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; text-align:center; }
  .error-glyph { font-family:var(--font-b); font-size:64px; color:rgba(255,255,255,0.06); margin-bottom:16px; }
  .error-title { font-family:var(--font-b); font-size:24px; color:var(--c-text); margin-bottom:16px; }
  .back-link {
    display:inline-flex; align-items:center; gap:6px;
    padding:11px 24px; background:var(--c-gold); color:#0A0A0B;
    font-size:13px; font-weight:600; border-radius:10px; text-decoration:none;
    transition:var(--t); font-family:var(--font-b);
  }
  .back-link:hover { background:#e0bc5e; }

  @media(max-width:900px) {
    .gallery-grid { height:280px; }
    .detail-grid { grid-template-columns:1fr; }
    .room-img-wrap { width:120px; }
    .gallery-thumbs-grid { display:none; }
    .gallery-grid { grid-template-columns:1fr; }
  }
  @media(max-width:600px) {
    .detail-wrap { padding:16px; }
    .gallery-grid { height:220px; }
    .room-card { flex-direction:column; }
    .room-img-wrap { width:100%; height:180px; }
    .date-strip { flex-direction:column; align-items:flex-start; gap:8px; }
  }
`;

/* ─── Gallery ────────────────────────────────────────────────── */
function Gallery({ images, name }) {
  const [active,  setActive]  = useState(0);
  const [showAll, setShowAll] = useState(false);

  if (!images?.length) return (
    <div style={{height:'420px',background:'var(--c-card)',border:'1px solid var(--c-border)',borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-d)',fontSize:'56px',color:'rgba(255,255,255,0.06)'}}>✦</div>
  );

  const thumbs = images.slice(1, 5);

  return (
    <div>
      <div className="gallery-grid">
        {/* Main */}
        <div className="gallery-main">
          <img src={images[active]} alt={name} />
          {images.length > 1 && (
            <>
              <button className="gallery-nav gallery-nav-l" onClick={() => setActive(a => (a - 1 + images.length) % images.length)}>‹</button>
              <button className="gallery-nav gallery-nav-r" onClick={() => setActive(a => (a + 1) % images.length)}>›</button>
            </>
          )}
        </div>
        {/* 2×2 thumbs */}
        {thumbs.length > 0 && (
          <div className="gallery-thumbs-grid">
            {thumbs.map((img, i) => (
              <div key={i} className="gallery-thumb" onClick={() => setActive(i + 1)}>
                <img src={img} alt="" />
                {i === 3 && images.length > 5 && (
                  <div className="gallery-more-overlay" onClick={e => { e.stopPropagation(); setShowAll(true); }}>
                    +{images.length - 5} ảnh
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Strip */}
      {images.length > 1 && (
        <div className="gallery-strip">
          {images.map((img, i) => (
            <div key={i} className={`gallery-strip-item ${i === active ? 'active' : ''}`} onClick={() => setActive(i)}>
              <img src={img} alt="" />
            </div>
          ))}
        </div>
      )}

      <button className="gallery-see-all" onClick={() => setShowAll(true)}>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
        </svg>
        Xem tất cả {images.length} ảnh
      </button>

      {/* Lightbox */}
      {showAll && (
        <div className="lightbox" onClick={() => setShowAll(false)}>
          <button className="lightbox-close" onClick={() => setShowAll(false)}>✕</button>
          <img src={images[active]} alt={name} onClick={e => e.stopPropagation()} />
          <div className="lightbox-strip">
            {images.map((img, i) => (
              <div key={i} className={`gallery-strip-item ${i === active ? 'active' : ''}`}
                onClick={e => { e.stopPropagation(); setActive(i); }}>
                <img src={img} alt="" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Stars ──────────────────────────────────────────────────── */
function Stars({ rating }) {
  return (
    <div className="stars">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={`star ${s <= Math.round(rating) ? 'star-on' : 'star-off'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

/* ─── AmenityIcon ────────────────────────────────────────────── */
function AmenityIcon({ name }) {
  const d = AMENITY_SVG[name];
  if (!d) return (
    <svg className="amenity-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M5 13l4 4L19 7"/>
    </svg>
  );
  return (
    <svg className="amenity-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={d}/>
    </svg>
  );
}

/* ─── RoomCard ───────────────────────────────────────────────── */
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
    <div className="room-card" style={!available ? {opacity:0.6} : {}}>
      <div className="room-img-wrap">
        {room.images?.[0]
          ? <img src={room.images[0]} alt={room.roomNumber} className="room-img" />
          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-d)',fontSize:'36px',color:'rgba(255,255,255,0.08)'}}>✦</div>
        }
        <span className="room-type-badge">{TYPE_LABEL[room.type] ?? room.type}</span>
      </div>

      <div className="room-body">
        <div>
          <div className="room-name">{TYPE_LABEL[room.type] ?? room.type} · Phòng {room.roomNumber}</div>
          {room.description && <div className="room-desc">{room.description}</div>}
          <div className="room-chips">
            <span className="room-chip">{room.capacity} người</span>
            {room.amenities?.slice(0, 3).map(a => (
              <span key={a} className="room-chip">{a}</span>
            ))}
          </div>
        </div>

        <div className="room-footer">
          <div>
            <div className="room-price">{room.pricePerNight?.toLocaleString('vi-VN')}₫</div>
            <div className="room-price-unit">mỗi đêm</div>
            {nights > 0 && (
              <div className="room-nights">
                {nights} đêm = <strong>{(nights * room.pricePerNight).toLocaleString('vi-VN')}₫</strong>
              </div>
            )}
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px'}}>
            <div className={available ? 'room-status-ok' : 'room-status-bad'}>
              {available ? '● Còn phòng' : '● Bảo trì'}
            </div>
            <button
              className={`room-btn ${available ? 'room-btn-ok' : 'room-btn-dis'}`}
              onClick={handleBook} disabled={!available}
            >
              {available ? 'Đặt phòng này' : 'Không khả dụng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ChatButton ─────────────────────────────────────────────── */
function ChatButton({ hotelId }) {
  const navigate = useNavigate();
  const user     = JSON.parse(localStorage.getItem('user') ?? 'null');
  if (['STAFF','OWNER','ADMIN'].includes(user?.role)) return null;

  const handleChat = () => {
    if (!user) { navigate('/login', { state: { from: window.location.pathname } }); return; }
    navigate(`/chat/${user.id}_${hotelId}`);
  };
  return (
    <button className="chat-btn" onClick={handleChat}>
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
      Nhắn tin
    </button>
  );
}

/* ════════════════ Main Page ════════════════ */
export default function HotelDetailPage() {
  const { id }     = useParams();
  const { state }  = useLocation();
  const checkIn    = state?.checkIn  ?? '';
  const checkOut   = state?.checkOut ?? '';

  const [hotel,   setHotel]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    getHotelById(id)
      .then(res => setHotel(res.data.data))
      .catch(() => setError('Không tìm thấy khách sạn.'))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── Skeleton ── */
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="hd-root">
        <Navbar />
        <div className="detail-wrap">
          <div className="sk" style={{height:'420px',marginBottom:'24px'}} />
          <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:'24px'}}>
            <div>
              <div className="sk" style={{height:'200px',marginBottom:'16px'}} />
              <div className="sk" style={{height:'100px'}} />
            </div>
            <div className="sk" style={{height:'360px'}} />
          </div>
        </div>
      </div>
    </>
  );

  /* ── Error ── */
  if (error) return (
    <>
      <style>{CSS}</style>
      <div className="hd-root">
        <Navbar />
        <div className="detail-wrap">
          <div className="error-state">
            <div className="error-glyph">✦</div>
            <div className="error-title">{error}</div>
            <Link to="/" className="back-link">← Quay về trang chủ</Link>
          </div>
        </div>
      </div>
    </>
  );

  const activeRooms = hotel.rooms?.filter(r => r.status !== 'DELETED') ?? [];
  const roomsByType = TYPE_ORDER.reduce((acc, t) => {
    const list = activeRooms.filter(r => r.type === t);
    if (list.length) acc[t] = list;
    return acc;
  }, {});

  const minPrice   = activeRooms.length
    ? Math.min(...activeRooms.filter(r => r.status === 'AVAILABLE').map(r => r.pricePerNight).filter(Boolean))
    : null;

  const nights   = (checkIn && checkOut)
    ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000))
    : 0;
  const subTotal = minPrice && nights ? minPrice * nights : 0;
  const tax      = Math.round(subTotal * 0.1);
  const total    = subTotal + tax;

  return (
    <>
      <style>{CSS}</style>
      <div className="hd-root">
        <Navbar />

        <div className="detail-wrap">

          {/* Breadcrumb */}
          <nav className="breadcrumb">
            <Link to="/">Trang chủ</Link>
            <span className="breadcrumb-sep">›</span>
            <span style={{color:'var(--c-muted)'}}>{hotel.city}</span>
            <span className="breadcrumb-sep">›</span>
            <span style={{color:'var(--c-text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'260px'}}>{hotel.name}</span>
          </nav>

          {/* Gallery */}
          <Gallery images={hotel.images} name={hotel.name} />

          {/* Main grid */}
          <div className="detail-grid">

            {/* ── Left Column ── */}
            <div>

              {/* Name + rating + chat */}
              <div className="panel">
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'16px',flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <h1 className="hotel-name">{hotel.name}</h1>

                    {hotel.avgRating > 0 && (
                      <div style={{display:'flex',alignItems:'center',gap:'12px',marginTop:'12px',flexWrap:'wrap'}}>
                        <Stars rating={hotel.avgRating} />
                        <span className="score-badge">{(hotel.avgRating * 2).toFixed(1)}</span>
                        <span style={{fontSize:'14px',fontWeight:'600',color:'var(--c-text)'}}>{SCORE_LABEL(hotel.avgRating)}</span>
                        {hotel.reviewCount > 0 && (
                          <span style={{fontSize:'13px',color:'var(--c-muted)'}}>({hotel.reviewCount} đánh giá)</span>
                        )}
                      </div>
                    )}

                    <div className="hotel-addr">
                      {hotel.address}, {hotel.city}
                    </div>
                  </div>
                  <ChatButton hotelId={hotel.id} />
                </div>

                {hotel.description && (
                  <p style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid var(--c-border)',fontSize:'14px',color:'var(--c-muted)',lineHeight:'1.75'}}>
                    {hotel.description}
                  </p>
                )}
              </div>

              {/* Amenities */}
              {hotel.amenities?.length > 0 && (
                <div className="panel">
                  <div className="panel-title">Tiện nghi</div>
                  <div className="amenities-grid">
                    {hotel.amenities.map(a => (
                      <div key={a} className="amenity-chip">
                        <AmenityIcon name={a} />
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Date strip */}
              {(checkIn || checkOut) && (
                <div className="date-strip" style={{marginBottom:'16px'}}>
                  {checkIn && (
                    <div className="date-item">
                      <span className="date-label">Nhận phòng</span>
                      <span className="date-value">{checkIn}</span>
                    </div>
                  )}
                  {checkIn && checkOut && <span className="date-arrow">→</span>}
                  {checkOut && (
                    <div className="date-item">
                      <span className="date-label">Trả phòng</span>
                      <span className="date-value">{checkOut}</span>
                    </div>
                  )}
                  {nights > 0 && (
                    <div style={{marginLeft:'auto',background:'rgba(201,168,76,0.1)',border:'1px solid rgba(201,168,76,0.25)',borderRadius:'20px',padding:'4px 14px',fontSize:'12px',fontWeight:'600',color:'var(--c-gold)'}}>
                      {nights} đêm
                    </div>
                  )}
                </div>
              )}

              {/* Rooms */}
              <div>
                <div className="section-heading">Chọn phòng</div>
                {Object.keys(roomsByType).length === 0 ? (
                  <div className="rooms-empty">
                    <div className="rooms-empty-glyph">✦</div>
                    <p style={{fontSize:'15px',color:'var(--c-muted)'}}>Khách sạn chưa có phòng nào.</p>
                  </div>
                ) : (
                  Object.entries(roomsByType).map(([type, rooms]) => (
                    <div key={type}>
                      <div className="type-heading">
                        <div className="type-heading-bar" />
                        <span className="type-heading-name">{TYPE_LABEL[type]}</span>
                        <span className="type-heading-count">{rooms.length} phòng</span>
                      </div>
                      {rooms.map(room => (
                        <RoomCard key={room.id} room={room} checkIn={checkIn} checkOut={checkOut} />
                      ))}
                    </div>
                  ))
                )}
              </div>

              {/* Reviews */}
              <div style={{marginTop:'32px'}}>
                <ReviewSection hotelId={hotel.id} avgRating={hotel.avgRating} reviewCount={hotel.reviewCount} />
              </div>
            </div>

            {/* ── Sticky Panel ── */}
            <div>
              <div className="sticky-panel">
                <div className="sticky-header">
                  <div className="sticky-hotel">{hotel.name}</div>
                  {nights > 0 && minPrice ? (
                    <>
                      <div className="sticky-price">{total.toLocaleString('vi-VN')}₫</div>
                      <div className="sticky-price-sub">Tổng bao gồm thuế & phí</div>
                      <div className="sticky-nights">{nights} đêm lưu trú</div>
                    </>
                  ) : (
                    <>
                      <div style={{fontSize:'12px',color:'var(--c-muted)',marginBottom:'6px'}}>Giá từ</div>
                      {minPrice
                        ? <><div className="sticky-price">{minPrice.toLocaleString('vi-VN')}₫</div><div className="sticky-price-sub">mỗi đêm</div></>
                        : <div style={{fontSize:'16px',color:'var(--c-muted)'}}>Liên hệ để biết giá</div>
                      }
                    </>
                  )}
                </div>

                <div className="sticky-body">
                  {/* Dates */}
                  {(checkIn || checkOut) ? (
                    <div className="date-grid">
                      <div className="date-box">
                        <div className="date-box-label">Nhận phòng</div>
                        <div className="date-box-val">{checkIn || '—'}</div>
                      </div>
                      <div className="date-box">
                        <div className="date-box-label">Trả phòng</div>
                        <div className="date-box-val">{checkOut || '—'}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid var(--c-border)',borderRadius:'10px',padding:'12px',textAlign:'center',fontSize:'12px',color:'var(--c-subtle)'}}>
                      Chọn ngày để xem giá tốt nhất
                    </div>
                  )}

                  {/* Price breakdown */}
                  {nights > 0 && minPrice > 0 && (
                    <div className="price-breakdown">
                      <div className="pb-row">
                        <span>{minPrice.toLocaleString('vi-VN')}₫ × {nights} đêm</span>
                        <span>{subTotal.toLocaleString('vi-VN')}₫</span>
                      </div>
                      <div className="pb-row">
                        <span>Thuế & phí (10%)</span>
                        <span>{tax.toLocaleString('vi-VN')}₫</span>
                      </div>
                      <div className="pb-row-total">
                        <span>Tổng tiền</span>
                        <span className="pb-total-val">{total.toLocaleString('vi-VN')}₫</span>
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <button className="sticky-cta" onClick={() => {
                    const first = activeRooms.find(r => r.status === 'AVAILABLE');
                    if (!first) return;
                    const user = localStorage.getItem('user');
                    if (!user) { window.location.href = '/login'; return; }
                    const p = new URLSearchParams({ roomId: first.id });
                    if (checkIn)  p.set('checkIn',  checkIn);
                    if (checkOut) p.set('checkOut', checkOut);
                    window.location.href = `/booking?${p.toString()}`;
                  }}>
                    Tiếp tục đặt phòng
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>

                  {/* Trust signals */}
                  <div className="trust-list">
                    {['Hủy miễn phí trước 24h nhận phòng','Thanh toán an toàn – bảo mật tuyệt đối','Hỗ trợ 24/7 – luôn sẵn sàng cho bạn'].map(t => (
                      <div key={t} className="trust-item">
                        <span className="trust-dot" />
                        {t}
                      </div>
                    ))}
                  </div>

                  {/* Rating row */}
                  {hotel.avgRating > 0 && (
                    <div className="rating-row">
                      <div className="rating-big">{hotel.avgRating.toFixed(1)}</div>
                      <div>
                        <div className="rating-label">{SCORE_LABEL(hotel.avgRating)}</div>
                        <div className="rating-sub">{hotel.reviewCount} đánh giá từ khách</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}