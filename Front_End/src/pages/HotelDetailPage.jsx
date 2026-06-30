import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ReviewSection from '../components/ReviewSection';
import { getHotelById } from '../api/hotels';

const MiniMap = lazy(() => import('../components/MiniMap'));

/* ─── Constants ──────────────────────────────────────────────── */
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

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
  :root {
    --c-bg:     #F7F6F4;
    --c-white:  #FFFFFF;
    --c-border: rgba(0,0,0,0.08);
    --c-bord2:  rgba(0,0,0,0.13);
    --c-gold:   #C9A84C;
    --c-gold-d: #8A6E30;
    --c-text:   #1C1B18;
    --c-muted:  #6B6860;
    --c-subtle: #A09D96;
    --r:        12px;
    --t:        all 0.2s cubic-bezier(.4,0,.2,1);
    --font-d:   'Cormorant Garamond', Georgia, serif;
    --font-b:   'Outfit', system-ui, sans-serif;
  }

  .hd-root { background:var(--c-bg); font-family:var(--font-b); min-height:100vh; color:var(--c-text); }

  /* ── Gallery ────────────────────────── */
  .gal-wrap { background:#111; }
  .gal-grid { display:grid; grid-template-columns:1fr 340px; height:480px; max-width:1200px; margin:0 auto; }
  .gal-main { position:relative; overflow:hidden; }
  .gal-main img { width:100%; height:100%; object-fit:cover; transition:transform .5s; }
  .gal-main:hover img { transform:scale(1.02); }
  .gal-nav {
    position:absolute; top:50%; transform:translateY(-50%);
    width:40px; height:40px; border-radius:50%;
    background:rgba(0,0,0,0.55); border:1px solid rgba(255,255,255,0.15);
    color:#fff; font-size:20px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    transition:var(--t); backdrop-filter:blur(8px);
  }
  .gal-nav:hover { background:rgba(201,168,76,.75); border-color:transparent; }
  .gal-nav-l { left:14px; } .gal-nav-r { right:14px; }
  .gal-side { display:grid; grid-template-rows:1fr 1fr; grid-template-columns:1fr 1fr; gap:3px; padding-left:3px; }
  .gal-thumb { position:relative; overflow:hidden; background:#111; cursor:pointer; }
  .gal-thumb img { width:100%; height:100%; object-fit:cover; transition:transform .4s; }
  .gal-thumb:hover img { transform:scale(1.07); }
  .gal-more {
    position:absolute; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(2px);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    color:#fff; gap:4px;
  }
  .gal-more-n { font-size:26px; font-weight:700; font-family:var(--font-d); }
  .gal-more-t { font-size:12px; font-weight:500; }
  .gal-pill {
    position:absolute; bottom:14px; right:14px;
    background:rgba(0,0,0,0.65); backdrop-filter:blur(8px);
    color:#fff; font-size:11px; font-weight:600;
    padding:5px 13px; border-radius:20px;
    border:1px solid rgba(255,255,255,0.14); cursor:pointer; transition:var(--t);
  }
  .gal-pill:hover { background:rgba(201,168,76,.75); }

  /* lightbox */
  .hd-lb { position:fixed; inset:0; z-index:60; background:rgba(0,0,0,0.96); display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; }
  .hd-lb img { max-height:80vh; max-width:100%; object-fit:contain; border-radius:8px; }
  .hd-lb-close { position:absolute; top:16px; right:16px; width:38px; height:38px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.18); border-radius:50%; color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:var(--t); }
  .hd-lb-close:hover { background:rgba(255,255,255,0.2); }
  .hd-lb-strip { display:flex; gap:5px; margin-top:14px; overflow-x:auto; max-width:100%; padding-bottom:4px; }
  .hd-lb-th { flex-shrink:0; width:60px; height:44px; border-radius:6px; overflow:hidden; border:2px solid transparent; cursor:pointer; opacity:.4; transition:var(--t); }
  .hd-lb-th.on { border-color:var(--c-gold); opacity:1; }
  .hd-lb-th:not(.on):hover { opacity:.7; }
  .hd-lb-th img { width:100%; height:100%; object-fit:cover; }

  /* ── Wrap & grid ────────────────────── */
  .hd-wrap { max-width:1200px; margin:0 auto; padding:22px 28px 80px; }
  .hd-crumb { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--c-subtle); margin-bottom:20px; flex-wrap:wrap; }
  .hd-crumb a { color:var(--c-muted); text-decoration:none; transition:var(--t); }
  .hd-crumb a:hover { color:var(--c-gold); }
  .hd-grid { display:grid; grid-template-columns:1fr 356px; gap:40px; align-items:start; }

  /* ── Identity (no card) ─────────────── */
  .hd-iden { padding-bottom:20px; border-bottom:1px solid var(--c-border); margin-bottom:22px; }
  .hd-name { font-size:clamp(22px,3vw,34px); font-weight:700; color:var(--c-text); line-height:1.15; letter-spacing:-.02em; margin-bottom:10px; }
  .hd-meta { display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-bottom:10px; }
  .hd-stars { display:flex; gap:2px; }
  .hd-star { width:15px; height:15px; }
  .hd-star.on { color:var(--c-gold); } .hd-star.off { color:rgba(0,0,0,0.12); }
  .hd-score { background:var(--c-gold); color:#0A0A0B; font-size:12px; font-weight:800; padding:3px 9px; border-radius:7px; line-height:1; }
  .hd-score-lbl { font-size:13px; font-weight:600; }
  .hd-score-cnt { font-size:12px; color:var(--c-muted); }
  .hd-iden-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
  .hd-addr { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--c-muted); }
  .hd-chat { display:inline-flex; align-items:center; gap:7px; padding:8px 15px; border-radius:9px; font-size:12px; font-weight:600; background:rgba(201,168,76,.08); border:1px solid rgba(201,168,76,.28); color:var(--c-gold); cursor:pointer; transition:var(--t); font-family:var(--font-b); }
  .hd-chat:hover { background:rgba(201,168,76,.16); }

  /* ── Highlights bar ─────────────────── */
  .hd-hl { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:22px; }
  .hd-hl-pill { display:flex; align-items:center; gap:6px; background:var(--c-white); border:1px solid var(--c-border); border-radius:20px; padding:6px 13px; font-size:12px; font-weight:500; color:var(--c-muted); }
  .hd-hl-ic { width:13px; height:13px; color:var(--c-gold); flex-shrink:0; }

  /* ── Section pattern ────────────────── */
  .hd-sec { padding-bottom:28px; margin-bottom:28px; border-bottom:1px solid var(--c-border); }
  .hd-sec:last-child { border-bottom:none; }
  .hd-sec-title { font-size:17px; font-weight:700; color:var(--c-text); margin-bottom:14px; }

  /* ── Description ────────────────────── */
  .hd-desc { font-size:14px; color:var(--c-muted); line-height:1.8; }
  .hd-desc-btn { background:none; border:none; color:var(--c-gold); font-size:12px; font-weight:600; cursor:pointer; margin-top:7px; padding:0; font-family:var(--font-b); }

  /* ── Amenities ──────────────────────── */
  .hd-amen-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:7px; }
  .hd-amen-item { display:flex; align-items:center; gap:9px; padding:9px 12px; border-radius:9px; border:1px solid var(--c-border); background:var(--c-white); font-size:12px; color:var(--c-muted); font-weight:500; }
  .hd-amen-ic { width:15px; height:15px; color:var(--c-gold); flex-shrink:0; }
  .hd-amen-more { background:none; border:none; color:var(--c-gold); font-size:12px; font-weight:600; cursor:pointer; margin-top:9px; padding:0; font-family:var(--font-b); }

  /* ── Room tabs ──────────────────────── */
  .hd-tabs { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:14px; }
  .hd-tab { padding:7px 16px; border-radius:20px; font-size:12px; font-weight:600; border:1px solid var(--c-border); background:var(--c-white); color:var(--c-muted); cursor:pointer; transition:var(--t); font-family:var(--font-b); }
  .hd-tab:hover { border-color:var(--c-gold-d); color:var(--c-text); }
  .hd-tab.on { background:var(--c-gold); border-color:var(--c-gold); color:#0A0A0B; }

  /* ── Date strip (compact) ───────────── */
  .hd-date-strip { display:flex; align-items:center; gap:10px; background:rgba(201,168,76,.07); border:1px solid rgba(201,168,76,.22); border-radius:10px; padding:11px 16px; margin-bottom:14px; flex-wrap:wrap; }
  .hd-date-lbl { font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--c-gold); margin-bottom:2px; }
  .hd-date-val { font-size:13px; font-weight:600; color:var(--c-text); }
  .hd-nights-pill { margin-left:auto; background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.3); border-radius:14px; padding:3px 12px; font-size:11px; font-weight:700; color:var(--c-gold); }

  /* ── Room card ──────────────────────── */
  .hd-room { display:flex; background:var(--c-white); border:1px solid var(--c-border); border-radius:var(--r); overflow:hidden; margin-bottom:10px; transition:var(--t); }
  .hd-room:hover { border-color:var(--c-bord2); box-shadow:0 6px 22px rgba(0,0,0,.07); transform:translateY(-2px); }
  .hd-room:hover .hd-room-img { transform:scale(1.05); }
  .hd-room-img-wrap { width:165px; flex-shrink:0; overflow:hidden; background:#1a1a1e; position:relative; }
  .hd-room-img { width:100%; height:100%; object-fit:cover; transition:transform .45s cubic-bezier(.4,0,.2,1); }
  .hd-room-tag { position:absolute; top:9px; left:9px; background:rgba(0,0,0,.78); backdrop-filter:blur(5px); color:var(--c-gold); font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; padding:3px 8px; border-radius:5px; border:1px solid rgba(201,168,76,.3); }
  .hd-room-body { flex:1; min-width:0; padding:16px 18px; display:flex; flex-direction:column; justify-content:space-between; }
  .hd-room-name { font-size:14px; font-weight:700; margin-bottom:3px; }
  .hd-room-desc { font-size:12px; color:var(--c-muted); font-style:italic; margin-bottom:9px; }
  .hd-room-chips { display:flex; flex-wrap:wrap; gap:5px; }
  .hd-room-chip { font-size:11px; color:var(--c-muted); background:#F7F6F4; border:1px solid var(--c-border); padding:3px 8px; border-radius:5px; }
  .hd-room-foot { display:flex; align-items:flex-end; justify-content:space-between; margin-top:13px; padding-top:13px; border-top:1px solid var(--c-border); }
  .hd-room-price { font-size:23px; font-weight:700; color:var(--c-gold); line-height:1; }
  .hd-room-per { font-size:11px; color:var(--c-subtle); margin-top:2px; }
  .hd-room-nights { font-size:11px; color:var(--c-muted); margin-top:2px; }
  .hd-room-nights strong { color:var(--c-text); }
  .hd-room-avail { font-size:11px; font-weight:600; letter-spacing:.04em; margin-bottom:6px; }
  .hd-room-avail.ok { color:#16a34a; } .hd-room-avail.no { color:#dc2626; }
  .hd-room-btn { padding:9px 18px; border-radius:9px; font-size:12px; font-weight:700; border:none; cursor:pointer; transition:var(--t); font-family:var(--font-b); }
  .hd-room-btn.ok { background:var(--c-gold); color:#0A0A0B; }
  .hd-room-btn.ok:hover { background:#d9b85a; transform:translateY(-1px); box-shadow:0 4px 14px rgba(201,168,76,.3); }
  .hd-room-btn.dis { background:#F0EDE8; color:var(--c-subtle); cursor:not-allowed; }
  .hd-rooms-empty { text-align:center; padding:44px 20px; border:1px solid var(--c-border); border-radius:var(--r); background:var(--c-white); }

  /* ── Skeleton ───────────────────────── */
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .sk { background:linear-gradient(90deg,#ebe8e3 25%,#e2ddd7 50%,#ebe8e3 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; border-radius:10px; }
  .location-map-skeleton { height:193px; border-radius:14px; border:1px solid rgba(0,0,0,.08); background:linear-gradient(90deg,#ebe8e3 25%,#e2ddd7 50%,#ebe8e3 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }

  /* ── Error ──────────────────────────── */
  .hd-err { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; gap:16px; text-align:center; }
  .hd-back { display:inline-flex; align-items:center; gap:6px; padding:11px 24px; background:var(--c-gold); color:#0A0A0B; font-size:13px; font-weight:700; border-radius:10px; text-decoration:none; font-family:var(--font-b); }

  /* ── Sidebar ────────────────────────── */
  .hd-sb-sticky { position:sticky; top:24px; }
  .hd-sb-card { background:var(--c-white); border:1px solid var(--c-border); border-radius:16px; overflow:hidden; box-shadow:0 4px 28px rgba(0,0,0,.06); }
  .hd-sb-price { padding:20px 22px 18px; border-bottom:1px solid var(--c-border); }
  .hd-sb-from { font-size:10px; color:var(--c-subtle); text-transform:uppercase; letter-spacing:.1em; margin-bottom:4px; }
  .hd-sb-amt { font-size:32px; font-weight:700; color:var(--c-text); line-height:1; }
  .hd-sb-unit { font-size:12px; color:var(--c-muted); margin-top:3px; }
  .hd-sb-npill { display:inline-block; background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.3); color:var(--c-gold); font-size:11px; font-weight:700; padding:3px 10px; border-radius:14px; margin-top:8px; }
  .hd-sb-body { padding:16px 22px; display:flex; flex-direction:column; gap:12px; }
  .hd-sb-dates { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
  .hd-sb-dbox { background:#F7F6F4; border:1px solid var(--c-border); border-radius:9px; padding:10px 12px; }
  .hd-sb-dlbl { font-size:9px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--c-gold); margin-bottom:3px; }
  .hd-sb-dval { font-size:13px; font-weight:600; }
  .hd-sb-bd { background:#F7F6F4; border:1px solid var(--c-border); border-radius:9px; padding:13px; }
  .hd-sb-bdrow { display:flex; justify-content:space-between; font-size:12px; color:var(--c-muted); margin-bottom:7px; }
  .hd-sb-bdtotal { display:flex; justify-content:space-between; font-size:14px; font-weight:700; padding-top:9px; border-top:1px solid var(--c-border); margin-top:3px; }
  .hd-sb-bdtotal-val { color:var(--c-gold); }
  .hd-sb-cta { width:100%; padding:14px; font-size:14px; font-weight:700; background:var(--c-gold); color:#0A0A0B; border:none; border-radius:10px; cursor:pointer; font-family:var(--font-b); transition:var(--t); display:flex; align-items:center; justify-content:center; gap:8px; }
  .hd-sb-cta:hover { background:#d9b85a; box-shadow:0 5px 20px rgba(201,168,76,.32); transform:translateY(-1px); }
  .hd-sb-cta:disabled { background:#E8E5E0; color:var(--c-subtle); cursor:not-allowed; transform:none; box-shadow:none; }
  .hd-sb-trust { display:flex; flex-direction:column; gap:7px; }
  .hd-sb-trust-row { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--c-muted); }
  .hd-sb-trust-ic { width:13px; height:13px; color:var(--c-gold); flex-shrink:0; }
  .hd-sb-rating { display:flex; align-items:center; gap:11px; padding:14px 22px; border-top:1px solid var(--c-border); }
  .hd-sb-rbadge { width:42px; height:42px; background:var(--c-gold); color:#0A0A0B; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; flex-shrink:0; }
  .hd-sb-rlbl { font-size:13px; font-weight:700; }
  .hd-sb-rsub { font-size:11px; color:var(--c-subtle); margin-top:1px; }

  /* ── Responsive ─────────────────────── */
  @media(max-width:960px){
    .hd-grid { grid-template-columns:1fr; }
    .hd-sb-sticky { position:static; }
    .gal-side { display:none; }
    .gal-grid { grid-template-columns:1fr; height:280px; }
  }
  @media(max-width:600px){
    .hd-wrap { padding:14px 16px 60px; }
    .gal-grid { height:220px; }
    .hd-room-img-wrap { width:120px; }
  }
`;

/* ─── Gallery ────────────────────────────────────────────────── */
function Gallery({ images, name }) {
  const [active, setActive] = useState(0);
  const [lb,     setLb]     = useState(false);

  if (!images?.length) return (
    <div className="gal-wrap" style={{height:320,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',fontSize:52,color:'rgba(255,255,255,0.06)'}}>✦</div>
  );

  const thumbs = images.slice(1, 5);

  return (
    <div className="gal-wrap">
      <div className="gal-grid">
        {/* Main */}
        <div className="gal-main">
          <img src={images[active]} alt={name} />
          {images.length > 1 && <>
            <button className="gal-nav gal-nav-l" onClick={() => setActive(a => (a-1+images.length)%images.length)}>‹</button>
            <button className="gal-nav gal-nav-r" onClick={() => setActive(a => (a+1)%images.length)}>›</button>
          </>}
          <button className="gal-pill" onClick={() => setLb(true)}>📷 {active+1} / {images.length}</button>
        </div>
        {/* 2×2 thumbs */}
        {thumbs.length > 0 && (
          <div className="gal-side">
            {thumbs.map((img, i) => (
              <div key={i} className="gal-thumb" onClick={() => setActive(i+1)}>
                <img src={img} alt="" />
                {i === 3 && images.length > 5 && (
                  <div className="gal-more" onClick={e => {e.stopPropagation(); setLb(true);}}>
                    <span className="gal-more-n">+{images.length - 5}</span>
                    <span className="gal-more-t">Xem tất cả</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lb && (
        <div className="hd-lb" onClick={() => setLb(false)}>
          <button className="hd-lb-close">✕</button>
          <img src={images[active]} alt={name} onClick={e => e.stopPropagation()} />
          <div className="hd-lb-strip">
            {images.map((img, i) => (
              <div key={i} className={`hd-lb-th${i === active ? ' on' : ''}`}
                onClick={e => {e.stopPropagation(); setActive(i);}}>
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
    <div className="hd-stars">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={`hd-star ${s <= Math.round(rating) ? 'on' : 'off'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

/* ─── AmenityIcon ────────────────────────────────────────────── */
function AmenityIcon({ name, className = 'hd-amen-ic' }) {
  const d = AMENITY_SVG[name];
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7}
        d={d ?? 'M5 13l4 4L19 7'}/>
    </svg>
  );
}

/* ─── ChatButton ─────────────────────────────────────────────── */
function ChatButton({ hotelId }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') ?? 'null');
  if (['STAFF','OWNER','ADMIN'].includes(user?.role)) return null;
  return (
    <button className="hd-chat" onClick={() => {
      if (!user) { navigate('/login', { state: { from: window.location.pathname } }); return; }
      navigate(`/chat/${user.id}_${hotelId}`);
    }}>
      <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
      </svg>
      Nhắn tin
    </button>
  );
}

/* ─── RoomCard ───────────────────────────────────────────────── */
function RoomCard({ room, checkIn, checkOut }) {
  const navigate  = useNavigate();
  const available = room.status === 'AVAILABLE';
  const nights = (checkIn && checkOut)
    ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000))
    : 0;

  const handleBook = () => {
    const user = localStorage.getItem('user');
    if (!user) { navigate('/login', { state: { from: window.location.pathname } }); return; }
    const p = new URLSearchParams({ roomId: room.id });
    if (checkIn)  p.set('checkIn',  checkIn);
    if (checkOut) p.set('checkOut', checkOut);
    navigate(`/booking?${p.toString()}`);
  };

  return (
    <div className="hd-room" style={!available ? {opacity:.65} : {}}>
      <div className="hd-room-img-wrap">
        {room.images?.[0]
          ? <img src={room.images[0]} alt={room.roomNumber} className="hd-room-img" />
          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Georgia,serif',fontSize:'34px',color:'rgba(255,255,255,0.08)'}}>✦</div>
        }
        <span className="hd-room-tag">{TYPE_LABEL[room.type] ?? room.type}</span>
      </div>

      <div className="hd-room-body">
        <div>
          <div className="hd-room-name">{TYPE_LABEL[room.type] ?? room.type} · Phòng {room.roomNumber}</div>
          {room.description && <div className="hd-room-desc">{room.description}</div>}
          <div className="hd-room-chips">
            <span className="hd-room-chip">👤 {room.capacity} người</span>
            {room.amenities?.slice(0, 3).map(a => <span key={a} className="hd-room-chip">{a}</span>)}
          </div>
        </div>

        <div className="hd-room-foot">
          <div>
            <div className="hd-room-price">{room.pricePerNight?.toLocaleString('vi-VN')}₫</div>
            <div className="hd-room-per">mỗi đêm</div>
            {nights > 0 && (
              <div className="hd-room-nights">
                {nights} đêm = <strong>{(nights * room.pricePerNight).toLocaleString('vi-VN')}₫</strong>
              </div>
            )}
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
            <div className={`hd-room-avail ${available ? 'ok' : 'no'}`}>
              ● {available ? 'Còn phòng' : 'Bảo trì'}
            </div>
            <button className={`hd-room-btn ${available ? 'ok' : 'dis'}`}
              onClick={handleBook} disabled={!available}>
              {available ? 'Đặt phòng này' : 'Không khả dụng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════ Main Page ════════════════ */
export default function HotelDetailPage() {
  const { id }    = useParams();
  const { state } = useLocation();
  const navigate  = useNavigate();
  const checkIn   = state?.checkIn  ?? '';
  const checkOut  = state?.checkOut ?? '';

  const [hotel,            setHotel]            = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');
  const [descExpanded,     setDescExpanded]     = useState(false);
  const [allAmen,          setAllAmen]          = useState(false);
  const [activeType,       setActiveType]       = useState(null);

  useEffect(() => {
    getHotelById(id)
      .then(res => setHotel(res.data.data))
      .catch(() => setError('Không tìm thấy khách sạn.'))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── Loading ── */
  if (loading) return (
    <>
      <style>{CSS}</style>
      <div className="hd-root">
        <Navbar />
        <div className="gal-wrap"><div style={{height:480,background:'#1a1a1e'}} /></div>
        <div className="hd-wrap">
          <div className="hd-grid">
            <div>
              <div className="sk" style={{height:40,marginBottom:12,width:'60%'}} />
              <div className="sk" style={{height:20,marginBottom:24,width:'40%'}} />
              <div className="sk" style={{height:120,marginBottom:16}} />
              <div className="sk" style={{height:80}} />
            </div>
            <div className="sk" style={{height:340}} />
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
        <div className="hd-wrap">
          <div className="hd-err">
            <div style={{fontFamily:'Georgia,serif',fontSize:52,color:'rgba(0,0,0,0.06)'}}>✦</div>
            <div style={{fontSize:20,fontWeight:700}}>{error}</div>
            <Link to="/" className="hd-back">← Quay về trang chủ</Link>
          </div>
        </div>
      </div>
    </>
  );

  /* ── Derived values ── */
  const activeRooms = hotel.rooms?.filter(r => r.status !== 'DELETED') ?? [];
  const types       = TYPE_ORDER.filter(t => activeRooms.some(r => r.type === t));
  const curType     = activeType ?? types[0];
  const roomsToShow = activeRooms.filter(r => r.type === curType);

  const minPrice = activeRooms.filter(r => r.status === 'AVAILABLE').length
    ? Math.min(...activeRooms.filter(r => r.status === 'AVAILABLE').map(r => r.pricePerNight).filter(Boolean))
    : null;

  const nights   = (checkIn && checkOut) ? Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000)) : 0;
  const subTotal = minPrice && nights ? minPrice * nights : 0;
  const tax      = Math.round(subTotal * 0.1);
  const total    = subTotal + tax;

  const amenities    = hotel.amenities ?? [];
  const topAmenities = amenities.slice(0, 4);
  const visAmenities = allAmen ? amenities : amenities.slice(0, 8);

  const hasCoords = Array.isArray(hotel.location?.coordinates) && hotel.location.coordinates.length === 2;

  const TRUST = [
    { path:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',    text:'Hủy miễn phí trước 24h nhận phòng' },
    { path:'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', text:'Thanh toán an toàn & bảo mật' },
    { path:'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z', text:'Hỗ trợ 24/7 luôn sẵn sàng' },
  ];

  /* ── Render ── */
  return (
    <>
      <style>{CSS}</style>
      <div className="hd-root">
        <Navbar />

        {/* Gallery — full-width */}
        <Gallery images={hotel.images} name={hotel.name} />

        <div className="hd-wrap">

          {/* Breadcrumb */}
          <nav className="hd-crumb">
            <Link to="/">Trang chủ</Link>
            <span>›</span>
            <span style={{color:'var(--c-muted)'}}>{hotel.city}</span>
            <span>›</span>
            <span style={{color:'var(--c-text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:240}}>{hotel.name}</span>
          </nav>

          <div className="hd-grid">

            {/* ════ Left column ════ */}
            <div>

              {/* Identity */}
              <div className="hd-iden">
                <h1 className="hd-name">{hotel.name}</h1>

                {hotel.avgRating > 0 && (
                  <div className="hd-meta">
                    <Stars rating={hotel.avgRating} />
                    <span className="hd-score">{(hotel.avgRating * 2).toFixed(1)}</span>
                    <span className="hd-score-lbl">{SCORE_LABEL(hotel.avgRating)}</span>
                    {hotel.reviewCount > 0 && (
                      <span className="hd-score-cnt">· {hotel.reviewCount} đánh giá</span>
                    )}
                  </div>
                )}

                <div className="hd-iden-foot">
                  <div className="hd-addr">
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    {hotel.address}, {hotel.city}
                  </div>
                  <ChatButton hotelId={hotel.id} />
                </div>
              </div>

              {/* Highlights */}
              {topAmenities.length > 0 && (
                <div className="hd-hl">
                  {topAmenities.map(a => (
                    <div key={a} className="hd-hl-pill">
                      <AmenityIcon name={a} className="hd-hl-ic" />
                      {a}
                    </div>
                  ))}
                </div>
              )}

              {/* About */}
              {hotel.description && (
                <div className="hd-sec">
                  <div className="hd-sec-title">Giới thiệu</div>
                  <p className="hd-desc" style={{
                    overflow: descExpanded ? 'visible' : 'hidden',
                    display: descExpanded ? 'block' : '-webkit-box',
                    WebkitLineClamp: descExpanded ? 'unset' : 4,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {hotel.description}
                  </p>
                  {hotel.description.length > 280 && (
                    <button className="hd-desc-btn" onClick={() => setDescExpanded(e => !e)}>
                      {descExpanded ? 'Thu gọn ▲' : 'Xem thêm ▼'}
                    </button>
                  )}
                </div>
              )}

              {/* Amenities */}
              {amenities.length > 0 && (
                <div className="hd-sec">
                  <div className="hd-sec-title">Tiện nghi nổi bật</div>
                  <div className="hd-amen-grid">
                    {visAmenities.map(a => (
                      <div key={a} className="hd-amen-item">
                        <AmenityIcon name={a} />
                        {a}
                      </div>
                    ))}
                  </div>
                  {amenities.length > 8 && (
                    <button className="hd-amen-more" onClick={() => setAllAmen(e => !e)}>
                      {allAmen ? '▲ Thu gọn' : `▼ Xem thêm ${amenities.length - 8} tiện nghi`}
                    </button>
                  )}
                </div>
              )}

              {/* Location */}
              {hasCoords && (() => {
                const [lng, lat] = hotel.location.coordinates;
                return (
                  <div className="hd-sec">
                    <div className="hd-sec-title">Vị trí</div>
                    <Suspense fallback={<div className="location-map-skeleton" />}>
                      <MiniMap lat={lat} lng={lng} address={`${hotel.address}, ${hotel.city}`} />
                    </Suspense>
                  </div>
                );
              })()}

              {/* Rooms */}
              <div className="hd-sec">
                <div className="hd-sec-title">Chọn phòng</div>

                {/* Date strip */}
                {(checkIn || checkOut) && (
                  <div className="hd-date-strip">
                    {checkIn && <div><div className="hd-date-lbl">Nhận phòng</div><div className="hd-date-val">{checkIn}</div></div>}
                    {checkIn && checkOut && <span style={{color:'var(--c-gold)',fontSize:16}}>→</span>}
                    {checkOut && <div><div className="hd-date-lbl">Trả phòng</div><div className="hd-date-val">{checkOut}</div></div>}
                    {nights > 0 && <div className="hd-nights-pill">{nights} đêm</div>}
                  </div>
                )}

                {/* Type tabs */}
                {types.length > 1 && (
                  <div className="hd-tabs">
                    {types.map(t => (
                      <button key={t}
                        className={`hd-tab${curType === t ? ' on' : ''}`}
                        onClick={() => setActiveType(t)}>
                        {TYPE_LABEL[t]}
                        <span style={{opacity:.65,fontWeight:400,marginLeft:4}}>
                          ({activeRooms.filter(r => r.type === t).length})
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {types.length === 0 ? (
                  <div className="hd-rooms-empty">
                    <p style={{color:'var(--c-muted)',fontSize:14}}>Khách sạn chưa có phòng nào.</p>
                  </div>
                ) : (
                  roomsToShow.map(room => (
                    <RoomCard key={room.id} room={room} checkIn={checkIn} checkOut={checkOut} />
                  ))
                )}
              </div>

              {/* Reviews */}
              <div className="hd-sec" style={{borderBottom:'none',paddingBottom:0}}>
                <ReviewSection hotelId={hotel.id} avgRating={hotel.avgRating} reviewCount={hotel.reviewCount} />
              </div>
            </div>

            {/* ════ Sidebar ════ */}
            <div>
              <div className="hd-sb-sticky">
                <div className="hd-sb-card">

                  {/* Price */}
                  <div className="hd-sb-price">
                    <div className="hd-sb-from">{nights > 0 && minPrice ? 'Tổng thanh toán' : 'Giá từ'}</div>
                    {minPrice ? (
                      <>
                        <div className="hd-sb-amt">
                          {(nights > 0 ? total : minPrice).toLocaleString('vi-VN')}₫
                        </div>
                        <div className="hd-sb-unit">{nights > 0 ? 'Bao gồm thuế & phí' : 'mỗi đêm'}</div>
                        {nights > 0 && <div className="hd-sb-npill">{nights} đêm lưu trú</div>}
                      </>
                    ) : (
                      <div style={{fontSize:15,color:'var(--c-muted)',fontWeight:600}}>Liên hệ để biết giá</div>
                    )}
                  </div>

                  <div className="hd-sb-body">
                    {/* Dates */}
                    {(checkIn || checkOut) ? (
                      <div className="hd-sb-dates">
                        <div className="hd-sb-dbox">
                          <div className="hd-sb-dlbl">Nhận phòng</div>
                          <div className="hd-sb-dval">{checkIn || '—'}</div>
                        </div>
                        <div className="hd-sb-dbox">
                          <div className="hd-sb-dlbl">Trả phòng</div>
                          <div className="hd-sb-dval">{checkOut || '—'}</div>
                        </div>
                      </div>
                    ) : (
                      <div style={{background:'#F7F6F4',border:'1px solid var(--c-border)',borderRadius:9,padding:12,textAlign:'center',fontSize:12,color:'var(--c-subtle)'}}>
                        Chọn ngày để xem giá tốt nhất
                      </div>
                    )}

                    {/* Breakdown */}
                    {nights > 0 && minPrice > 0 && (
                      <div className="hd-sb-bd">
                        <div className="hd-sb-bdrow">
                          <span>{minPrice.toLocaleString('vi-VN')}₫ × {nights} đêm</span>
                          <span>{subTotal.toLocaleString('vi-VN')}₫</span>
                        </div>
                        <div className="hd-sb-bdrow">
                          <span>Thuế & phí (10%)</span>
                          <span>{tax.toLocaleString('vi-VN')}₫</span>
                        </div>
                        <div className="hd-sb-bdtotal">
                          <span>Tổng tiền</span>
                          <span className="hd-sb-bdtotal-val">{total.toLocaleString('vi-VN')}₫</span>
                        </div>
                      </div>
                    )}

                    {/* CTA */}
                    <button className="hd-sb-cta"
                      disabled={!activeRooms.some(r => r.status === 'AVAILABLE')}
                      onClick={() => {
                        const first = activeRooms.find(r => r.status === 'AVAILABLE');
                        if (!first) return;
                        const user = localStorage.getItem('user');
                        if (!user) { navigate('/login', { state: { from: window.location.pathname } }); return; }
                        const p = new URLSearchParams({ roomId: first.id });
                        if (checkIn)  p.set('checkIn',  checkIn);
                        if (checkOut) p.set('checkOut', checkOut);
                        navigate(`/booking?${p.toString()}`);
                      }}>
                      Đặt phòng ngay
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>

                    {/* Trust signals */}
                    <div className="hd-sb-trust">
                      {TRUST.map(t => (
                        <div key={t.text} className="hd-sb-trust-row">
                          <svg className="hd-sb-trust-ic" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={t.path}/>
                          </svg>
                          {t.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rating footer */}
                  {hotel.avgRating > 0 && (
                    <div className="hd-sb-rating">
                      <div className="hd-sb-rbadge">{(hotel.avgRating * 2).toFixed(1)}</div>
                      <div>
                        <div className="hd-sb-rlbl">{SCORE_LABEL(hotel.avgRating)}</div>
                        <div className="hd-sb-rsub">
                          {hotel.reviewCount > 0 ? `${hotel.reviewCount} đánh giá từ khách` : 'Chưa có đánh giá'}
                        </div>
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
