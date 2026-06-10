import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';

const HERO_IMG = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=85';
import { searchHotels } from '../api/hotels';
import { getHybridRecommendations } from '../api/recommendations';

/* ─── constants (unchanged) ─────────────────────────────────── */
const ROOM_TYPES      = ['STANDARD','DELUXE','SUITE','FAMILY'];
const ROOM_TYPE_LABEL = { STANDARD:'Standard', DELUXE:'Deluxe', SUITE:'Suite', FAMILY:'Gia đình' };
const PAGE_SIZE       = 9;

const POPULAR_CITIES = [
  { name:'Đà Nẵng',         count:'354', img:'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=700&q=85' },
  { name:'Nha Trang',       count:'289', img:'https://tse3.mm.bing.net/th/id/OIP.6SWIJXfq1GEwA4Lbzd39ewHaE7?pid=Api&P=0&h=180' },
  { name:'Phú Quốc',        count:'312', img:'https://images.unsplash.com/photo-1528127269322-539801943592?w=700&q=85' },
  { name:'Hà Nội',          count:'412', img:'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?w=700&q=85' },
  { name:'TP. Hồ Chí Minh', count:'398', img:'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=700&q=85' },
];

const STATS = [
  { value:'500+',    label:'Khách sạn'    },
  { value:'10.000+', label:'Phòng nghỉ'   },
  { value:'50.000+', label:'Lượt khách'   },
  { value:'4.8/5',   label:'Điểm đánh giá'},
];

const SCORE_LABEL = r => {
  if (!r) return '';
  const s = r * 2;
  if (s >= 9) return 'Tuyệt vời';
  if (s >= 8) return 'Rất tốt';
  if (s >= 7) return 'Tốt';
  return 'Khá';
};

/* ─── global styles injected once ───────────────────────────── */
const GLOBAL_CSS = `

  :root {
    --c-bg:       #F7F6F4;
    --c-surface:  #FFFFFF;
    --c-card:     #FFFFFF;
    --c-border:   rgba(0,0,0,0.08);
    --c-border2:  rgba(0,0,0,0.13);
    --c-gold:     #C9A84C;
    --c-gold-dim: #8A6E30;
    --c-text:     #1C1B18;
    --c-muted:    #6B6860;
    --c-subtle:   #A09D96;
    --r-card:     14px;
    --r-btn:      10px;
    --shadow-card: 0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-gold: 0 0 0 1px var(--c-gold), 0 4px 24px rgba(201,168,76,0.18);
    --font-display: 'Cormorant Garamond', Georgia, serif;
    --font-body:    'Outfit', system-ui, sans-serif;
    --transition:   all 0.22s cubic-bezier(0.4,0,0.2,1);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .hc-root {
    background: var(--c-bg);
    color: var(--c-text);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.6;
    min-height: 100vh;
  }

  /* ── hero ── */
  .hero { position:relative; min-height:620px; display:flex; align-items:center; overflow:hidden; }
  .hero-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    120deg,
    rgba(10,10,11,0.60) 0%,
    rgba(10,10,11,0.35) 55%,
    rgba(10,10,11,0.08) 100%
  );
}
  .hero-grain {
    position:absolute; inset:0; opacity:0.035;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size:180px;
    pointer-events:none;
  }
  .hero-content { position:relative; max-width:1140px; margin:0 auto; padding:0 28px; width:100%; }
  .hero-eyebrow {
    display:inline-flex; align-items:center; gap:10px;
    font-family:var(--font-body); font-size:11px; font-weight:500;
    letter-spacing:0.22em; text-transform:uppercase;
    color:var(--c-gold); margin-bottom:24px;
  }
  .hero-eyebrow::before, .hero-eyebrow::after {
    content:''; display:block; height:1px; width:32px; background:var(--c-gold-dim);
  }
  .hero-title {
    font-family:var(--font-body);
    font-size:clamp(42px,5.5vw,72px);
    font-weight:700; line-height:1.1;
    color:#F2F0EB; letter-spacing:-0.02em;
    margin-bottom:18px;
  }
  .hero-title em { font-style:italic; color:var(--c-gold); font-weight:400; }
  .hero-sub {
    font-size:15px; color:rgba(242,240,235,0.7); max-width:400px; margin-bottom:44px; font-weight:300;
  }

  /* ── search box ── */
  .search-box {
    background:rgba(22,22,26,0.85);
    border:1px solid var(--c-border2);
    backdrop-filter:blur(20px);
    border-radius:16px;
    padding:6px;
    display:flex; gap:0; max-width:860px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .search-field {
    flex:1; display:flex; flex-direction:column;
    padding:14px 20px; cursor:text;
    border-right:1px solid var(--c-border);
    transition: background 0.15s;
    border-radius:12px;
  }
  .search-field:last-of-type { border-right:none; }
  .search-field:hover { background:rgba(255,255,255,0.04); }
  .search-label {
    font-size:9.5px; font-weight:600; letter-spacing:0.18em;
    text-transform:uppercase; color:var(--c-gold); margin-bottom:5px;
  }
  .search-input {
    background:none; border:none; outline:none; width:100%;
    font-family:var(--font-body); font-size:13.5px; font-weight:400;
    color:#F2F0EB;
  }
  .search-input::placeholder { color:rgba(242,240,235,0.45); }
  .search-input::-webkit-calendar-picker-indicator { filter:invert(0.6); cursor:pointer; }
  .search-btn {
    flex-shrink:0; padding:14px 28px; margin:0;
    background:var(--c-gold);
    color:#0A0A0B; font-family:var(--font-body);
    font-size:13px; font-weight:600; letter-spacing:0.04em;
    border:none; border-radius:12px; cursor:pointer;
    transition:var(--transition);
    white-space:nowrap;
  }
  .search-btn:hover { background:#e0bc5e; transform:translateY(-1px); box-shadow:0 6px 20px rgba(201,168,76,0.35); }
  .search-btn:active { transform:translateY(0); }

  /* ── stats ── */
  .stats-bar {
    background:var(--c-surface);
    border-bottom:1px solid var(--c-border);
  }
  .stats-inner {
    max-width:1140px; margin:0 auto; padding:0 28px;
    display:grid; grid-template-columns:repeat(4,1fr);
  }
  .stat-item {
    padding:26px 0; text-align:center;
    border-right:1px solid var(--c-border);
    position:relative;
  }
  .stat-item:last-child { border-right:none; }
  .stat-value {
    font-family:var(--font-display); font-size:36px; font-weight:600;
    color:var(--c-text); letter-spacing:-0.02em; line-height:1;
  }
  .stat-label {
    font-size:11px; color:var(--c-muted); margin-top:5px;
    letter-spacing:0.08em; text-transform:uppercase; font-weight:500;
  }

  /* ── section ── */
  .section { max-width:1140px; margin:0 auto; padding:0 28px; }
  .section-header { margin-bottom:32px; }
  .section-eyebrow {
    font-size:10px; font-weight:600; letter-spacing:0.22em;
    text-transform:uppercase; color:var(--c-gold); margin-bottom:8px;
  }
  .section-title {
    font-family:var(--font-body); font-size:32px;
    font-weight:700; color:#1C1B18; letter-spacing:-0.02em;
  }

  /* ── city cards ── */
  .cities-grid {
    display:grid; grid-template-columns:repeat(5,1fr); gap:12px;
  }
  .city-card {
    position:relative; border-radius:var(--r-card); overflow:hidden;
    min-height:180px; cursor:pointer; border:1px solid var(--c-border);
    transition:var(--transition);
  }
  .city-card:hover { border-color:var(--c-gold-dim); transform:translateY(-3px); box-shadow:0 12px 40px rgba(0,0,0,0.6); }
  .city-card:hover .city-img { transform:scale(1.08); }
  .city-img { width:100%; height:100%; object-fit:cover; transition:transform 0.5s cubic-bezier(0.4,0,0.2,1); position:absolute; inset:0; }
  .city-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 55%); }
  .city-text { position:absolute; bottom:0; left:0; right:0; padding:16px; }
  .city-name { font-size:14px; font-weight:600; color:#fff; line-height:1.2; }
  .city-count { font-size:11px; color:rgba(255,255,255,0.5); margin-top:2px; }
  .city-card:hover .city-name { color:var(--c-gold); }

  /* ── filter bar ── */
  .filter-bar {
    background:var(--c-surface);
    border-top:1px solid var(--c-border);
    border-bottom:1px solid var(--c-border);
    position:sticky; top:0; z-index:30;
  }
  .filter-inner {
    max-width:1140px; margin:0 auto; padding:0 28px;
    display:flex; align-items:center; gap:12px; height:56px;
  }
  .filter-select, .filter-input {
    background:rgba(255,255,255,0.04); border:1px solid var(--c-border);
    color:var(--c-text); font-family:var(--font-body); font-size:13px;
    padding:8px 14px; border-radius:8px; outline:none; cursor:pointer;
    transition:var(--transition);
  }
  .filter-select:focus, .filter-input:focus { border-color:var(--c-gold-dim); background:rgba(201,168,76,0.05); }
  .filter-select option { background:#FFFFFF; color:#1C1B18; }
  .filter-input::placeholder { color:var(--c-subtle); }
  .filter-sep { color:var(--c-subtle); font-size:12px; }
  .filter-apply {
    padding:8px 18px; background:var(--c-gold);
    color:#0A0A0B; font-size:13px; font-weight:600;
    border:none; border-radius:8px; cursor:pointer; transition:var(--transition);
  }
  .filter-apply:hover { background:#e0bc5e; }
  .filter-clear {
    padding:8px 14px; background:none;
    border:1px solid var(--c-border); color:var(--c-muted);
    font-size:12px; border-radius:8px; cursor:pointer; transition:var(--transition);
    font-family:var(--font-body);
  }
  .filter-clear:hover { border-color:rgba(255,80,80,0.4); color:#ff6b6b; }
  .filter-count { margin-left:auto; font-size:12px; color:var(--c-subtle); }

  /* ── hotel cards ── */
  .hotels-grid {
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
    gap:16px;
  }
  .hotel-card {
    background:var(--c-card); border:1px solid var(--c-border);
    border-radius:var(--r-card); overflow:hidden; cursor:pointer;
    transition:var(--transition); box-shadow:var(--shadow-card);
  }
  .hotel-card:hover {
    border-color:var(--c-border2); transform:translateY(-4px);
    box-shadow:0 12px 32px rgba(0,0,0,0.12);
  }
  .hotel-card:hover .hotel-img { transform:scale(1.06); }
  .hotel-img-wrap { position:relative; height:180px; background:#1a1a1e; overflow:hidden; }
  .hotel-img { width:100%; height:100%; object-fit:cover; transition:transform 0.5s cubic-bezier(0.4,0,0.2,1); }
  .hotel-no-img { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:40px; color:rgba(255,255,255,0.1); font-family:var(--font-display); }
  .hotel-score {
    position:absolute; top:12px; left:12px;
    background:rgba(10,10,11,0.88); backdrop-filter:blur(8px);
    border:1px solid var(--c-border2); color:#F2F0EB;
    font-size:13px; font-weight:700; font-family:var(--font-display);
    width:40px; height:40px; border-radius:10px;
    display:flex; align-items:center; justify-content:center;
  }
  .hotel-body { padding:16px; }
  .hotel-name {
    font-size:14px; font-weight:600; color:var(--c-text);
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    line-height:1.3;
  }
  .hotel-city { font-size:12px; color:var(--c-muted); margin-top:4px; }
  .hotel-rating { display:flex; align-items:center; gap:6px; margin-top:10px; }
  .stars { display:flex; gap:2px; }
  .star { width:11px; height:11px; }
  .star-on  { color:#C9A84C; }
  .star-off { color:#DDD9D2; }
  .hotel-rating-label { font-size:11px; color:var(--c-muted); }
  .hotel-reviews { font-size:11px; color:var(--c-subtle); margin-left:auto; }
  .hotel-footer {
    display:flex; align-items:flex-end; justify-content:space-between;
    margin-top:14px; padding-top:14px; border-top:1px solid var(--c-border);
  }
  .hotel-price-from { font-size:10px; color:var(--c-subtle); text-transform:uppercase; letter-spacing:0.1em; }
  .hotel-price-val {
    font-family:var(--font-display); font-size:20px; font-weight:600;
    color:var(--c-text); letter-spacing:-0.01em; line-height:1;
  }
  .hotel-price-unit { font-size:11px; color:var(--c-muted); font-family:var(--font-body); font-weight:300; }
  .hotel-arrow { font-size:18px; color:var(--c-subtle); transition:var(--transition); line-height:1; }
  .hotel-card:hover .hotel-arrow { color:var(--c-gold); }

  /* ── skeleton ── */
  .skeleton { border-radius:var(--r-card); overflow:hidden; background:var(--c-card); border:1px solid var(--c-border); }
  .skeleton-img { height:180px; background:linear-gradient(90deg,#ede9e4 25%,#e2ddd7 50%,#ede9e4 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
  .skeleton-body { padding:16px; }
  .skeleton-line { height:12px; border-radius:4px; background:linear-gradient(90deg,#ede9e4 25%,#e2ddd7 50%,#ede9e4 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; margin-bottom:10px; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* ── empty state ── */
  .empty-state {
    text-align:center; padding:80px 20px;
    background:var(--c-card); border:1px solid var(--c-border);
    border-radius:var(--r-card);
  }
  .empty-glyph {
    font-family:var(--font-display); font-size:64px; color:rgba(0,0,0,0.1);
    line-height:1; margin-bottom:20px;
  }
  .empty-title { font-size:16px; font-weight:600; color:var(--c-text); }
  .empty-sub { font-size:13px; color:var(--c-muted); margin-top:6px; }
  .empty-btn {
    display:inline-block; margin-top:24px; padding:11px 28px;
    background:var(--c-gold); color:#0A0A0B;
    font-family:var(--font-body); font-size:13px; font-weight:600;
    border:none; border-radius:var(--r-btn); cursor:pointer; transition:var(--transition);
  }
  .empty-btn:hover { background:#e0bc5e; }

  /* ── trust / why choose us ── */
  .trust-section { padding:64px 0 0; }
  .trust-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:20px; }
  .trust-card {
    background:var(--c-surface); border:1px solid var(--c-border);
    border-radius:var(--r-card); padding:30px 22px 26px;
    text-align:center; transition:var(--transition);
  }
  .trust-card:hover {
    border-color:rgba(201,168,76,0.35);
    box-shadow:0 6px 28px rgba(201,168,76,0.09);
    transform:translateY(-3px);
  }
  .trust-icon {
    width:52px; height:52px; border-radius:14px;
    background:rgba(201,168,76,0.1); border:1px solid rgba(201,168,76,0.2);
    display:flex; align-items:center; justify-content:center;
    margin:0 auto 18px; color:var(--c-gold);
  }
  .trust-title { font-size:14px; font-weight:600; color:var(--c-text); margin-bottom:8px; }
  .trust-desc { font-size:12px; color:var(--c-muted); line-height:1.7; }

  /* ── pagination ── */
  .pagination { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:48px; }
  .page-btn {
    min-width:38px; height:38px; border-radius:8px; font-size:13px; font-weight:500;
    border:1px solid var(--c-border); background:none; color:var(--c-muted);
    cursor:pointer; transition:var(--transition); font-family:var(--font-body); padding:0 10px;
  }
  .page-btn:hover:not(:disabled) { border-color:var(--c-border2); color:var(--c-text); }
  .page-btn.active { background:var(--c-gold); border-color:var(--c-gold); color:#0A0A0B; font-weight:700; }
  .page-btn:disabled { opacity:0.25; cursor:not-allowed; }

  /* ── footer ── */
  .footer { background:var(--c-surface); border-top:1px solid var(--c-border); margin-top:64px; }
  .footer-inner { max-width:1140px; margin:0 auto; padding:56px 28px 32px; }
  .footer-grid { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:48px; margin-bottom:48px; }
  .footer-brand { font-family:var(--font-display); font-size:24px; font-weight:600; color:var(--c-text); margin-bottom:10px; }
  .footer-brand-sub { font-size:12px; color:var(--c-subtle); line-height:1.7; max-width:220px; }
  .footer-col-title { font-size:10px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:var(--c-gold); margin-bottom:16px; }
  .footer-link { display:block; font-size:13px; color:var(--c-muted); margin-bottom:10px; cursor:pointer; transition:var(--transition); text-decoration:none; }
  .footer-link:hover { color:var(--c-text); }
  .footer-bottom { border-top:1px solid var(--c-border); padding-top:24px; font-size:12px; color:var(--c-subtle); text-align:center; }

  /* ── AI drawer ── */
  .fab {
    position:fixed; bottom:28px; right:28px; z-index:40;
    display:flex; align-items:center; gap:10px;
    padding:14px 22px; border-radius:50px;
    background:var(--c-gold); color:#0A0A0B;
    font-family:var(--font-body); font-size:13px; font-weight:700;
    border:none; cursor:pointer; transition:var(--transition);
    box-shadow:0 4px 24px rgba(201,168,76,0.4);
    letter-spacing:0.02em;
  }
  .fab:hover { background:#e0bc5e; transform:translateY(-2px); box-shadow:0 8px 32px rgba(201,168,76,0.5); }
  .fab-badge {
    background:#0A0A0B; color:var(--c-gold); font-size:11px; font-weight:800;
    width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  }
  .drawer-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(6px); z-index:50; display:flex; justify-content:flex-end; }
  .drawer-panel {
    position:relative; width:100%; max-width:380px;
    background:var(--c-surface); display:flex; flex-direction:column; overflow:hidden;
    border-left:1px solid var(--c-border);
    animation:slideRight 0.28s cubic-bezier(0.4,0,0.2,1);
  }
  @keyframes slideRight { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
  .drawer-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:20px 20px 18px; border-bottom:1px solid var(--c-border);
    background:linear-gradient(135deg,rgba(201,168,76,0.1),rgba(201,168,76,0.02));
    flex-shrink:0;
  }
  .drawer-title { font-family:var(--font-display); font-size:18px; font-weight:600; color:var(--c-text); }
  .drawer-sub { font-size:11px; color:var(--c-muted); margin-top:2px; }
  .drawer-close {
    width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.06);
    border:1px solid var(--c-border); color:var(--c-muted); font-size:16px;
    display:flex; align-items:center; justify-content:center; cursor:pointer; transition:var(--transition);
  }
  .drawer-close:hover { background:rgba(255,255,255,0.1); color:var(--c-text); }
  .drawer-body { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }

  /* ── rec card ── */
  .rec-card {
    display:flex; background:var(--c-card); border:1px solid var(--c-border);
    border-radius:12px; overflow:hidden; cursor:pointer; transition:var(--transition);
  }
  .rec-card:hover { border-color:var(--c-gold-dim); box-shadow:0 4px 20px rgba(0,0,0,0.4); }
  .rec-card:hover .rec-img { transform:scale(1.06); }
  .rec-img-wrap { width:90px; flex-shrink:0; position:relative; overflow:hidden; background:#1a1a1e; }
  .rec-img { width:100%; height:100%; object-fit:cover; transition:transform 0.4s cubic-bezier(0.4,0,0.2,1); }
  .rec-type {
    position:absolute; bottom:6px; left:6px;
    font-size:9px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase;
    background:rgba(10,10,11,0.82); color:var(--c-gold); border:1px solid rgba(201,168,76,0.3);
    padding:2px 7px; border-radius:4px;
  }
  .rec-body { flex:1; min-width:0; padding:12px; display:flex; flex-direction:column; justify-content:space-between; }
  .rec-hotel { font-size:13px; font-weight:600; color:var(--c-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .rec-city { font-size:11px; color:var(--c-muted); margin-top:2px; }
  .rec-footer { display:flex; align-items:center; justify-content:space-between; margin-top:8px; }
  .rec-score { font-size:11px; font-weight:700; background:var(--c-gold); color:#0A0A0B; padding:2px 7px; border-radius:5px; }
  .rec-price { font-family:var(--font-display); font-size:16px; font-weight:600; color:var(--c-text); }
  .rec-price span { font-size:11px; color:var(--c-muted); font-family:var(--font-body); font-weight:300; }
  .rec-arrow { font-size:16px; color:var(--c-subtle); transition:var(--transition); }
  .rec-card:hover .rec-arrow { color:var(--c-gold); }

  /* ─ responsive ─ */
  @media(max-width:900px) {
    .stats-inner { grid-template-columns:repeat(2,1fr); }
    .cities-grid { grid-template-columns:repeat(3,1fr); }
    .trust-grid { grid-template-columns:repeat(2,1fr); }
    .footer-grid { grid-template-columns:1fr 1fr; gap:32px; }
  }
  @media(max-width:640px) {
    .search-box { flex-direction:column; }
    .search-field { border-right:none; border-bottom:1px solid var(--c-border); border-radius:0; }
    .search-field:last-of-type { border-bottom:none; }
    .cities-grid { grid-template-columns:1fr 1fr; }
    .trust-grid { grid-template-columns:1fr 1fr; gap:12px; }
    .filter-inner { flex-wrap:wrap; height:auto; padding:10px 16px; gap:8px; }
    .hero-title { font-size:36px; }
    .stats-inner { grid-template-columns:1fr 1fr; }
    .footer-grid { grid-template-columns:1fr; }
  }
`;

/* ─── StarRating ─────────────────────────────────────────────── */
function StarRating({ rating }) {
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

/* ─── HotelCard ──────────────────────────────────────────────── */
function HotelCard({ hotel, checkIn, checkOut }) {
  const navigate = useNavigate();
  const img   = hotel.images?.[0];
  const score = hotel.avgRating > 0 ? (hotel.avgRating * 2).toFixed(1) : null;

  return (
    <div className="hotel-card" onClick={() => navigate(`/hotels/${hotel.id}`, { state: { checkIn, checkOut } })}>
      <div className="hotel-img-wrap">
        {img
          ? <img src={img} alt={hotel.name} className="hotel-img" />
          : <div className="hotel-no-img">✦</div>
        }
        {score && <div className="hotel-score">{score}</div>}
      </div>
      <div className="hotel-body">
        <div className="hotel-name">{hotel.name}</div>
        <div className="hotel-city">{hotel.city}{hotel.address ? `, ${hotel.address}` : ''}</div>
        {hotel.avgRating > 0 && (
          <div className="hotel-rating">
            <StarRating rating={hotel.avgRating} />
            <span className="hotel-rating-label">{SCORE_LABEL(hotel.avgRating)}</span>
            {hotel.reviewCount > 0 && <span className="hotel-reviews">{hotel.reviewCount} đánh giá</span>}
          </div>
        )}
        <div className="hotel-footer">
          {hotel.minPrice ? (
            <div>
              <div className="hotel-price-from">Từ</div>
              <div>
                <span className="hotel-price-val">{hotel.minPrice.toLocaleString('vi-VN')}</span>
                <span className="hotel-price-unit"> ₫/đêm</span>
              </div>
            </div>
          ) : (
            <span style={{fontSize:'12px',color:'var(--c-subtle)'}}>Xem giá phòng</span>
          )}
          <span className="hotel-arrow">→</span>
        </div>
      </div>
    </div>
  );
}

/* ─── RecommendedRoomCard ────────────────────────────────────── */
function RecommendedRoomCard({ rec, onClose }) {
  const navigate = useNavigate();
  const img   = rec.images?.[0] ?? rec.hotelImage;
  const score = rec.hotelAvgRating > 0 ? (rec.hotelAvgRating * 2).toFixed(1) : null;

  return (
    <div className="rec-card" onClick={() => { onClose?.(); navigate(`/hotels/${rec.hotelId}`); }}>
      <div className="rec-img-wrap">
        {img
          ? <img src={img} alt={rec.hotelName} className="rec-img" />
          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,0.1)',fontSize:'24px',fontFamily:'var(--font-display)'}}>✦</div>
        }
        <span className="rec-type">{ROOM_TYPE_LABEL[rec.type] ?? rec.type}</span>
      </div>
      <div className="rec-body">
        <div>
          <div className="rec-hotel">{rec.hotelName}</div>
          <div className="rec-city">{rec.hotelCity}</div>
        </div>
        <div className="rec-footer">
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            {score && <span className="rec-score">{score}</span>}
            <div className="rec-price">
              {(rec.pricePerNight ?? 0).toLocaleString('vi-VN')}₫
              <span>/đêm</span>
            </div>
          </div>
          <span className="rec-arrow">→</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Pagination ─────────────────────────────────────────────── */
function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page === 0}>← Trước</button>
      {start > 0 && <span style={{color:'var(--c-subtle)',padding:'0 4px'}}>…</span>}
      {pages.map(p => (
        <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onPageChange(p)}>
          {p + 1}
        </button>
      ))}
      {end < totalPages - 1 && <span style={{color:'var(--c-subtle)',padding:'0 4px'}}>…</span>}
      <button className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}>Sau →</button>
    </div>
  );
}

/* ════════════════ Main Page ════════════════ */
export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
  const isUser      = currentUser?.role === 'USER';

  const [hybridRecs,    setHybridRecs]    = useState([]);
  const [hybridLoading, setHybridLoading] = useState(isUser);
  const [showRecs,      setShowRecs]      = useState(() => {
    try { return localStorage.getItem('hc_show_ai_recs') === 'true'; } catch { return false; }
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
  const [draft,         setDraft]         = useState(filters);
  const [hotels,        setHotels]        = useState([]);
  const [page,          setPage]          = useState(Number(searchParams.get('page') ?? 0));
  const [totalPages,    setTotalPages]    = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [searched,      setSearched]      = useState(false);

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
    } catch { setHotels([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { fetchHotels(filters, page); }, [filters, page, fetchHotels]);

  const handleSearch = (e) => {
    e.preventDefault();
    setFilters(draft); setPage(0);
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
    setDraft(updated); setFilters(updated); setPage(0);
    setSearchParams({ city: cityName });
  };

  const clearFilters = () => {
    const cleared = { city:'', checkIn:'', checkOut:'', type:'', minPrice:'', maxPrice:'' };
    setDraft(cleared); setFilters(cleared); setPage(0); setSearchParams({});
  };

  const handlePageChange = (p) => { setPage(p); window.scrollTo({ top:0, behavior:'smooth' }); };

  const today    = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  return (
    <>
      {/* Inject CSS once */}
      <style>{GLOBAL_CSS}</style>

      {/* Navbar nằm ngoài hc-root để không bị font/color override */}
      <Navbar />

      <div className="hc-root">

        {/* ══ HERO ══════════════════════════════════════════ */}
        <section className="hero">
          <img src={HERO_IMG} alt="Luxury hotel" className="hero-img" />
          <div className="hero-overlay" />
          <div className="hero-grain" />

          <div className="hero-content">

            <div className="hero-eyebrow">Khám phá Việt Nam</div>

            <h1 className="hero-title">
              Trải nghiệm<br />
              kỳ nghỉ <em>hoàn hảo</em>
            </h1>
            <p className="hero-sub">
              Hàng nghìn khách sạn đẳng cấp với mức giá tốt nhất — đặt phòng chỉ trong vài giây.
            </p>

            {/* Search */}
            <form onSubmit={handleSearch}>
              <div className="search-box">
                <div className="search-field">
                  <label className="search-label">Điểm đến</label>
                  <input className="search-input" type="text" placeholder="Thành phố, khách sạn..."
                    value={draft.city} onChange={e => setDraft(p => ({ ...p, city: e.target.value }))} />
                </div>
                <div className="search-field">
                  <label className="search-label">Nhận phòng</label>
                  <input className="search-input" type="date" min={today}
                    value={draft.checkIn} onChange={e => setDraft(p => ({ ...p, checkIn: e.target.value }))} />
                </div>
                <div className="search-field">
                  <label className="search-label">Trả phòng</label>
                  <input className="search-input" type="date" min={draft.checkIn || tomorrow}
                    value={draft.checkOut} onChange={e => setDraft(p => ({ ...p, checkOut: e.target.value }))} />
                </div>
                <button type="submit" className="search-btn">Tìm kiếm</button>
              </div>
            </form>
          </div>
        </section>

        {/* ══ STATS ═════════════════════════════════════════ */}
        <div className="stats-bar">
          <div className="stats-inner">
            {STATS.map(s => (
              <div key={s.label} className="stat-item">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ TRUST / WHY CHOOSE US ═════════════════════════ */}
        <div className="trust-section">
          <div className="section">
            <div className="section-header" style={{textAlign:'center',marginBottom:'40px'}}>
              <div className="section-eyebrow">Cam kết của chúng tôi</div>
              <div className="section-title">Tại sao chọn Hotel Chain?</div>
            </div>
            <div className="trust-grid">
              <div className="trust-card">
                <div className="trust-icon">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
                <div className="trust-title">Thanh toán bảo mật</div>
                <div className="trust-desc">Giao dịch được mã hóa SSL 256-bit. Thông tin thanh toán của bạn luôn được bảo vệ tuyệt đối.</div>
              </div>
              <div className="trust-card">
                <div className="trust-icon">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>
                </div>
                <div className="trust-title">Hủy phòng miễn phí</div>
                <div className="trust-desc">Linh hoạt thay đổi kế hoạch. Hủy phòng không tính phí tối thiểu 24 giờ trước ngày nhận phòng.</div>
              </div>
              <div className="trust-card">
                <div className="trust-icon">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013 11.83 19.79 19.79 0 01.07 3.16 2 2 0 012.07 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                </div>
                <div className="trust-title">Hỗ trợ 24/7</div>
                <div className="trust-desc">Đội ngũ chăm sóc khách hàng luôn sẵn sàng hỗ trợ bạn mọi lúc, mọi nơi qua điện thoại và chat.</div>
              </div>
              <div className="trust-card">
                <div className="trust-icon">
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
                </div>
                <div className="trust-title">Giá tốt nhất</div>
                <div className="trust-desc">Cam kết giá tốt nhất cho mọi đặt phòng. Tìm thấy giá rẻ hơn? Chúng tôi sẽ hoàn tiền chênh lệch.</div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ DESTINATIONS ══════════════════════════════════ */}
        <div style={{padding:'64px 0 0'}}>
          <div className="section">
            <div className="section-header">
              <div className="section-eyebrow">Điểm đến</div>
              <div className="section-title">Phổ biến nhất</div>
            </div>
            <div className="cities-grid">
              {POPULAR_CITIES.map(city => (
                <button key={city.name} className="city-card" onClick={() => handleCitySelect(city.name)}>
                  <img src={city.img} alt={city.name} className="city-img" />
                  <div className="city-overlay" />
                  <div className="city-text">
                    <div className="city-name">{city.name}</div>
                    <div className="city-count">{city.count} khách sạn</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ══ FILTER BAR ════════════════════════════════════ */}
        <div style={{marginTop:'48px'}}>
          <div className="filter-bar">
            <div className="filter-inner">
              <select className="filter-select" value={draft.type}
                onChange={e => setDraft(p => ({ ...p, type: e.target.value }))}>
                <option value="">Tất cả loại phòng</option>
                {ROOM_TYPES.map(t => <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>)}
              </select>

              <input className="filter-input" style={{width:'120px'}} type="number"
                placeholder="Giá từ (₫)" min={0} value={draft.minPrice}
                onChange={e => setDraft(p => ({ ...p, minPrice: e.target.value }))} />
              <span className="filter-sep">—</span>
              <input className="filter-input" style={{width:'110px'}} type="number"
                placeholder="Đến (₫)" min={0} value={draft.maxPrice}
                onChange={e => setDraft(p => ({ ...p, maxPrice: e.target.value }))} />

              <button className="filter-apply" onClick={handleSearch}>Áp dụng</button>

              {(filters.city || filters.type || filters.minPrice || filters.maxPrice) && (
                <button className="filter-clear" onClick={clearFilters}>✕ Xóa bộ lọc</button>
              )}

              {totalElements > 0 && (
                <span className="filter-count">{totalElements} khách sạn</span>
              )}
            </div>
          </div>
        </div>

        {/* ══ HOTEL GRID ════════════════════════════════════ */}
        <div style={{padding:'48px 0 0'}}>
          <div className="section">
            <div className="section-header" style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
              <div>
                <div className="section-eyebrow">
                  {filters.city ? `Kết quả tại "${filters.city}"` : 'Nổi bật'}
                </div>
                <div className="section-title">
                  {filters.city ? `Khách sạn tại ${filters.city}` : 'Khách sạn nổi bật'}
                </div>
                {searched && !loading && totalElements > 0 && (
                  <p style={{fontSize:'13px',color:'var(--c-muted)',marginTop:'6px'}}>
                    {totalElements} kết quả
                  </p>
                )}
              </div>
            </div>

            {/* Skeleton */}
            {loading && (
              <div className="hotels-grid">
                {[...Array(PAGE_SIZE)].map((_,i) => (
                  <div key={i} className="skeleton">
                    <div className="skeleton-img" />
                    <div className="skeleton-body">
                      <div className="skeleton-line" style={{width:'70%'}} />
                      <div className="skeleton-line" style={{width:'45%'}} />
                      <div className="skeleton-line" style={{width:'55%',marginTop:'16px'}} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Grid */}
            {!loading && hotels.length > 0 && (
              <div className="hotels-grid">
                {hotels.map(hotel => (
                  <HotelCard key={hotel.id} hotel={hotel} checkIn={filters.checkIn} checkOut={filters.checkOut} />
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && searched && hotels.length === 0 && (
              <div className="empty-state">
                <div className="empty-glyph">✦</div>
                <div className="empty-title">Không tìm thấy khách sạn</div>
                <div className="empty-sub">Thử thay đổi bộ lọc hoặc tìm kiếm thành phố khác</div>
                <button className="empty-btn" onClick={clearFilters}>Xóa bộ lọc</button>
              </div>
            )}

            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </div>
        </div>

        {/* ══ FOOTER ════════════════════════════════════════ */}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-grid">
              <div>
                <div className="footer-brand">Hotel Chain</div>
                <div className="footer-brand-sub">
                  Nền tảng đặt phòng khách sạn đẳng cấp hàng đầu Việt Nam. Trải nghiệm dịch vụ tốt nhất với giá tốt nhất.
                </div>
              </div>
              {[
                { title:'Khám phá', items:['Khách sạn nổi bật','Điểm đến mới','Ưu đãi đặc biệt'] },
                { title:'Hỗ trợ',   items:['Trung tâm trợ giúp','Liên hệ','Chính sách hủy'] },
                { title:'Công ty',  items:['Về chúng tôi','Tuyển dụng','Điều khoản sử dụng'] },
              ].map(col => (
                <div key={col.title}>
                  <div className="footer-col-title">{col.title}</div>
                  {col.items.map(item => (
                    <a key={item} href="#" className="footer-link">{item}</a>
                  ))}
                </div>
              ))}
            </div>
            <div className="footer-bottom">© 2026 Hotel Chain. All rights reserved.</div>
          </div>
        </footer>

        {/* ══ AI FAB + DRAWER ═══════════════════════════════ */}
        {isUser && (
          <>
            <button className="fab" onClick={toggleRecs}>
              Gợi ý cho bạn
              {!hybridLoading && hybridRecs.length > 0 && (
                <span className="fab-badge">{hybridRecs.length}</span>
              )}
            </button>

            {showRecs && (
              <div className="drawer-backdrop" onClick={toggleRecs}>
                <div className="drawer-panel" onClick={e => e.stopPropagation()}>
                  <div className="drawer-header">
                    <div>
                      <div className="drawer-title">Dành riêng cho bạn</div>
                      <div className="drawer-sub">Gợi ý AI dựa trên sở thích của bạn</div>
                    </div>
                    <button className="drawer-close" onClick={toggleRecs}>✕</button>
                  </div>

                  <div className="drawer-body">
                    {hybridLoading && [...Array(4)].map((_,i) => (
                      <div key={i} className="skeleton" style={{height:'88px',display:'flex',borderRadius:'12px',overflow:'hidden'}}>
                        <div style={{width:'90px',background:'linear-gradient(90deg,#1e1e22 25%,#252529 50%,#1e1e22 75%)',backgroundSize:'200% 100%',animation:'shimmer 1.4s infinite',flexShrink:0}} />
                        <div style={{flex:1,padding:'12px',display:'flex',flexDirection:'column',gap:'8px'}}>
                          <div className="skeleton-line" style={{width:'70%',margin:0}} />
                          <div className="skeleton-line" style={{width:'45%',margin:0}} />
                        </div>
                      </div>
                    ))}

                    {!hybridLoading && hybridRecs.map(rec => (
                      <RecommendedRoomCard key={rec.roomId} rec={rec} onClose={toggleRecs} />
                    ))}

                    {!hybridLoading && hybridRecs.length === 0 && (
                      <div style={{textAlign:'center',padding:'60px 20px'}}>
                        <div style={{fontFamily:'var(--font-display)',fontSize:'48px',color:'rgba(255,255,255,0.06)',marginBottom:'16px'}}>✦</div>
                        <p style={{fontSize:'14px',fontWeight:'600',color:'var(--c-text)'}}>Chưa có gợi ý</p>
                        <p style={{fontSize:'12px',color:'var(--c-muted)',marginTop:'6px',lineHeight:'1.6'}}>
                          Đặt phòng lần đầu để AI gợi ý phòng phù hợp với bạn
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
    </>
  );
}