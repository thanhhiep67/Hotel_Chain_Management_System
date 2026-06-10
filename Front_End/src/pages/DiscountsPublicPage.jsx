import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getActiveDiscounts } from '../api/discounts';

/* ─── helpers (unchanged) ────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d+'T00:00:00').toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtValue(d) {
  if (d.type === 'PERCENTAGE') {
    const cap = d.maxDiscount ? `, tối đa ${Number(d.maxDiscount).toLocaleString('vi-VN')} ₫` : '';
    return `Giảm ${d.value}%${cap}`;
  }
  return `Giảm ${Number(d.value).toLocaleString('vi-VN')} ₫`;
}
function daysLeft(endDate) {
  if (!endDate) return null;
  const ms = new Date(endDate+'T00:00:00') - new Date();
  const d  = Math.ceil(ms / 86400000);
  return d > 0 ? d : 0;
}

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
  :root {
    --c-bg:     #F7F6F4;
    --c-surf:   #FFFFFF;
    --c-card:   #FFFFFF;
    --c-bdr:    rgba(0,0,0,0.08);
    --c-bdr2:   rgba(0,0,0,0.13);
    --c-gold:   #C9A84C;
    --c-gold-d: #8A6E30;
    --c-text:   #1C1B18;
    --c-muted:  #6B6860;
    --c-subtle: #A09D96;
    --r:        14px;
    --t:        all 0.22s cubic-bezier(0.4,0,0.2,1);
    --font-d:   'Cormorant Garamond', Georgia, serif;
    --font-b:   'Outfit', system-ui, sans-serif;
  }
  .dc-root { background:var(--c-bg); color:var(--c-text); font-family:var(--font-b); min-height:100vh; }
  .dc-wrap { max-width:820px; margin:0 auto; padding:36px 28px 72px; }

  /* header */
  .dc-eyebrow { font-size:10px; font-weight:600; letter-spacing:0.22em; text-transform:uppercase; color:var(--c-gold); margin-bottom:8px; display:flex; align-items:center; gap:10px; }
  .dc-eyebrow::before { content:''; display:block; height:1px; width:28px; background:var(--c-gold-d); }
  .dc-title { font-family:var(--font-b); font-size:clamp(28px,4vw,40px); font-weight:600; color:var(--c-text); letter-spacing:-0.01em; margin-bottom:6px; }
  .dc-sub { font-size:13px; color:var(--c-muted); margin-bottom:32px; }

  /* grid */
  .dc-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }

  /* card */
  .dc-card {
    background:var(--c-card); border:1px solid var(--c-bdr); border-radius:var(--r);
    overflow:hidden; display:flex; flex-direction:column;
    transition:var(--t); position:relative;
  }
  .dc-card:hover { border-color:var(--c-gold-d); box-shadow:0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,168,76,0.1); transform:translateY(-2px); }

  /* top accent */
  .dc-card-top { height:3px; background:linear-gradient(90deg, var(--c-gold), var(--c-gold-d)); opacity:0.6; }

  /* days-left badge */
  .dc-days-badge {
    position:absolute; top:12px; right:12px;
    font-size:10px; font-weight:600; padding:3px 9px; border-radius:20px;
    background:rgba(201,168,76,0.12); border:1px solid rgba(201,168,76,0.25);
    color:var(--c-gold);
  }
  .dc-days-badge.urgent { background:rgba(239,68,68,0.1); border-color:rgba(239,68,68,0.25); color:#f87171; }

  /* card body */
  .dc-body { padding:18px 18px 16px; flex:1; display:flex; flex-direction:column; gap:14px; }

  /* code row */
  .dc-code-row { display:flex; align-items:center; gap:10px; }
  .dc-code {
    font-family:'Courier New', monospace; font-size:17px; font-weight:700;
    letter-spacing:0.18em; color:var(--c-gold);
    background:rgba(201,168,76,0.08); border:1px solid rgba(201,168,76,0.2);
    border-radius:9px; padding:8px 14px; line-height:1; flex:1; min-width:0;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  }
  .dc-copy-btn {
    flex-shrink:0; padding:8px 14px; border-radius:9px; font-size:12px; font-weight:600;
    cursor:pointer; transition:var(--t); font-family:var(--font-b); border:none;
    white-space:nowrap; display:flex; align-items:center; gap:6px;
  }
  .dc-copy-btn-idle { background:rgba(255,255,255,0.05); border:1px solid var(--c-bdr); color:var(--c-muted); }
  .dc-copy-btn-idle:hover { background:rgba(255,255,255,0.09); border-color:var(--c-bdr2); color:var(--c-text); }
  .dc-copy-btn-done { background:rgba(74,222,128,0.12); border:1px solid rgba(74,222,128,0.25); color:#4ade80; }

  /* value */
  .dc-name { font-size:12px; color:var(--c-muted); margin-bottom:4px; }
  .dc-value { font-family:var(--font-b); font-size:22px; font-weight:600; color:var(--c-text); line-height:1; }
  .dc-value-sub { font-size:11px; color:var(--c-muted); margin-top:3px; font-family:var(--font-b); font-weight:300; }

  /* conditions */
  .dc-conditions { display:flex; flex-direction:column; gap:5px; padding-top:12px; border-top:1px solid var(--c-bdr); }
  .dc-cond-row { display:flex; align-items:center; gap:7px; font-size:11px; color:var(--c-muted); }
  .dc-cond-dot { width:4px; height:4px; border-radius:50%; background:var(--c-gold-d); flex-shrink:0; }

  /* scope badge */
  .dc-scope { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:500; background:rgba(255,255,255,0.04); border:1px solid var(--c-bdr); color:var(--c-muted); }
  .dc-scope-all { background:rgba(16,185,129,0.08); border-color:rgba(16,185,129,0.2); color:#34d399; }

  /* footer */
  .dc-footer { padding:12px 18px 16px; border-top:1px solid var(--c-bdr); }
  .dc-use-btn {
    display:block; width:100%; padding:10px; text-align:center;
    background:var(--c-gold); color:#0A0A0B; font-size:13px; font-weight:700;
    border-radius:10px; text-decoration:none; transition:var(--t); font-family:var(--font-b);
  }
  .dc-use-btn:hover { background:#e0bc5e; box-shadow:0 4px 16px rgba(201,168,76,0.3); }

  /* skeleton */
  .sk { background:linear-gradient(90deg,#1e1e22 25%,#252529 50%,#1e1e22 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; border-radius:var(--r); border:1px solid var(--c-bdr); }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* empty */
  .dc-empty { text-align:center; padding:72px 20px; background:var(--c-card); border:1px solid var(--c-bdr); border-radius:var(--r); }
  .dc-empty-glyph { font-family:var(--font-b); font-size:52px; color:rgba(255,255,255,0.06); margin-bottom:14px; }
  .dc-empty-title { font-size:15px; font-weight:600; color:var(--c-text); margin-bottom:6px; }
  .dc-empty-sub { font-size:13px; color:var(--c-muted); margin-bottom:20px; }
  .dc-empty-btn { display:inline-flex; padding:11px 24px; background:var(--c-gold); color:#0A0A0B; font-size:13px; font-weight:700; border-radius:10px; text-decoration:none; transition:var(--t); font-family:var(--font-b); }
  .dc-empty-btn:hover { background:#e0bc5e; }

  /* toast */
  .dc-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:50; padding:11px 20px; background:#111113; border:1px solid rgba(74,222,128,0.3); color:#4ade80; font-size:13px; font-weight:500; border-radius:50px; box-shadow:0 8px 32px rgba(0,0,0,0.5); display:flex; align-items:center; gap:8px; white-space:nowrap; }
  .dc-toast-dot { width:6px; height:6px; border-radius:50%; background:#4ade80; flex-shrink:0; }

  @media(max-width:600px) {
    .dc-wrap { padding:20px 16px 48px; }
    .dc-grid { grid-template-columns:1fr; }
  }
`;

/* ─── DiscountCard ───────────────────────────────────────────── */
function DiscountCard({ d, copied, onCopy }) {
  const dl        = daysLeft(d.endDate);
  const isUrgent  = dl !== null && dl <= 3;
  const valStr    = fmtValue(d);

  // Parse value display
  const isPercent = d.type === 'PERCENTAGE';
  const numVal    = isPercent ? `${d.value}%` : `${Number(d.value).toLocaleString('vi-VN')} ₫`;
  const capStr    = isPercent && d.maxDiscount
    ? `tối đa ${Number(d.maxDiscount).toLocaleString('vi-VN')} ₫`
    : null;

  return (
    <div className="dc-card">
      <div className="dc-card-top" />

      {/* Days left badge */}
      {dl !== null && (
        <div className={`dc-days-badge ${isUrgent ? 'urgent' : ''}`}>
          {dl === 0 ? 'Hết hạn hôm nay' : `Còn ${dl} ngày`}
        </div>
      )}

      <div className="dc-body">
        {/* Code row */}
        <div className="dc-code-row">
          <span className="dc-code">{d.code}</span>
          <button
            className={`dc-copy-btn ${copied === d.code ? 'dc-copy-btn-done' : 'dc-copy-btn-idle'}`}
            onClick={() => onCopy(d.code)}
          >
            {copied === d.code ? (
              <>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                Đã sao chép
              </>
            ) : (
              <>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                Sao chép
              </>
            )}
          </button>
        </div>

        {/* Value */}
        <div>
          {d.name && <div className="dc-name">{d.name}</div>}
          <div className="dc-value">Giảm {numVal}</div>
          {capStr && <div className="dc-value-sub">{capStr}</div>}
        </div>

        {/* Scope badge */}
        <div>
          {!d.hotelId
            ? <span className="dc-scope dc-scope-all">Áp dụng tất cả khách sạn</span>
            : <span className="dc-scope">Khách sạn cụ thể</span>
          }
        </div>

        {/* Conditions */}
        <div className="dc-conditions">
          {d.minOrderAmount > 0 && (
            <div className="dc-cond-row">
              <span className="dc-cond-dot" />
              Đơn tối thiểu: <strong style={{color:'var(--c-text)',marginLeft:'3px'}}>{Number(d.minOrderAmount).toLocaleString('vi-VN')} ₫</strong>
            </div>
          )}
          <div className="dc-cond-row">
            <span className="dc-cond-dot" />
            Hiệu lực: {fmtDate(d.startDate)} → {fmtDate(d.endDate)}
          </div>
          {d.perUserLimit && (
            <div className="dc-cond-row">
              <span className="dc-cond-dot" />
              Mỗi tài khoản dùng tối đa {d.perUserLimit} lần
            </div>
          )}
          {d.usageLimit && (
            <div className="dc-cond-row">
              <span className="dc-cond-dot" />
              Tổng: {d.usedCount ?? 0}/{d.usageLimit} lượt đã dùng
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="dc-footer">
        <Link to={`/?discount=${d.code}`} className="dc-use-btn">
          Đặt phòng với mã này →
        </Link>
      </div>
    </div>
  );
}

/* ════════════════ Main Page ════════════════ */
export default function DiscountsPublicPage() {
  const [discounts, setDiscounts] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [copied,    setCopied]    = useState(null);

  useEffect(() => {
    getActiveDiscounts()
      .then(res => setDiscounts(res.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2200);
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="dc-root">
        <Navbar />

        {copied && (
          <div className="dc-toast">
            <span className="dc-toast-dot" />
            Đã sao chép mã <strong style={{color:'var(--c-gold)',margin:'0 3px'}}>{copied}</strong>
          </div>
        )}

        <div className="dc-wrap">
          <div className="dc-eyebrow">Ưu đãi đặc biệt</div>
          <div className="dc-title">Mã khuyến mãi</div>
          <div className="dc-sub">Sao chép mã và nhập khi đặt phòng để được giảm giá ngay lập tức</div>

          {loading ? (
            <div className="dc-grid">
              {[...Array(4)].map((_,i) => <div key={i} className="sk" style={{height:'260px'}} />)}
            </div>
          ) : discounts.length === 0 ? (
            <div className="dc-empty">
              <div className="dc-empty-glyph">✦</div>
              <div className="dc-empty-title">Chưa có mã khuyến mãi nào</div>
              <div className="dc-empty-sub">Quay lại sau để không bỏ lỡ ưu đãi</div>
              <Link to="/" className="dc-empty-btn">Khám phá khách sạn</Link>
            </div>
          ) : (
            <div className="dc-grid">
              {discounts.map(d => (
                <DiscountCard key={d.id} d={d} copied={copied} onCopy={handleCopy} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}