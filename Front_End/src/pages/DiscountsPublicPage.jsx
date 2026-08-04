import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getActiveDiscounts } from '../api/discounts';

// ── helpers ────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function daysLeft(endDate) {
  if (!endDate) return null;
  const ms = new Date(endDate + 'T23:59:59') - new Date();
  return ms > 0 ? Math.ceil(ms / 86400000) : 0;
}

function numFmt(n) {
  return Number(n).toLocaleString('vi-VN');
}

// ── skeleton ───────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-black/8 overflow-hidden animate-pulse">
      <div className="h-1.5 bg-gradient-to-r from-[#C9A84C]/30 to-[#8A6E30]/30" />
      <div className="p-5 space-y-4">
        <div className="flex gap-3">
          <div className="h-10 flex-1 bg-gray-100 rounded-xl" />
          <div className="h-10 w-24 bg-gray-100 rounded-xl" />
        </div>
        <div className="space-y-2">
          <div className="h-7 w-36 bg-gray-100 rounded-lg" />
          <div className="h-4 w-48 bg-gray-100 rounded" />
        </div>
        <div className="h-px bg-gray-100" />
        <div className="space-y-2">
          <div className="h-3.5 w-full bg-gray-100 rounded" />
          <div className="h-3.5 w-3/4 bg-gray-100 rounded" />
        </div>
        <div className="h-10 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

// ── badge helpers ──────────────────────────────────────────────────────────

function DaysBadge({ endDate }) {
  const dl = daysLeft(endDate);
  if (dl === null) return null;

  if (dl === 0) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 border border-red-200 text-red-500">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      Hết hạn hôm nay
    </span>
  );
  if (dl <= 3) return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-50 border border-orange-200 text-orange-500">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
      Còn {dl} ngày
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#C9A84C]/8 border border-[#C9A84C]/20 text-[#8A6E30]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
      Còn {dl} ngày
    </span>
  );
}

function TypeBadge({ type }) {
  return type === 'PERCENTAGE'
    ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-600">% Phần trăm</span>
    : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 border border-blue-200 text-blue-500">Giảm cố định</span>;
}

// ── copy button ────────────────────────────────────────────────────────────

function CopyBtn({ code, copied, onCopy }) {
  const done = copied === code;
  return (
    <button
      onClick={() => onCopy(code)}
      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer border
        ${done
          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
          : 'bg-[#F7F6F4] border-black/8 text-[#6B6860] hover:border-[#C9A84C]/40 hover:text-[#1C1B18]'}`}
    >
      {done ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Đã sao chép
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Sao chép
        </>
      )}
    </button>
  );
}

// ── usage progress bar ─────────────────────────────────────────────────────

function UsageBar({ used, total }) {
  const pct = Math.min(100, Math.round(((used ?? 0) / total) * 100));
  const color = pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-orange-400' : 'bg-[#C9A84C]';
  return (
    <div>
      <div className="flex justify-between text-[11px] text-[#A09D96] mb-1.5">
        <span>Đã sử dụng</span>
        <span className="font-medium text-[#6B6860]">{used ?? 0}/{total} lượt</span>
      </div>
      <div className="h-1.5 bg-[#F7F6F4] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── discount card ──────────────────────────────────────────────────────────

function DiscountCard({ d, copied, onCopy }) {
  const isPercent = d.type === 'PERCENTAGE';
  const mainValue = isPercent ? `${d.value}%` : `${numFmt(d.value)} ₫`;
  const dl = daysLeft(d.endDate);
  const isUrgent = dl !== null && dl <= 3;

  return (
    <div className={`group bg-white rounded-2xl border overflow-hidden flex flex-col transition-all duration-200
      hover:shadow-lg hover:-translate-y-0.5
      ${isUrgent ? 'border-orange-200 hover:border-orange-300' : 'border-black/8 hover:border-[#C9A84C]/40'}`}>

      {/* top accent bar */}
      <div className={`h-1.5 ${isUrgent
        ? 'bg-gradient-to-r from-orange-400 to-red-400'
        : 'bg-gradient-to-r from-[#C9A84C] to-[#8A6E30]'}`} />

      <div className="flex flex-col flex-1 p-5 gap-4">

        {/* header: badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={d.type} />
          <DaysBadge endDate={d.endDate} />
          {!d.hotelId && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-600">
              Tất cả khách sạn
            </span>
          )}
        </div>

        {/* code row */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 font-mono font-bold text-base tracking-widest text-[#C9A84C]
            bg-[#C9A84C]/6 border border-[#C9A84C]/20 rounded-xl px-4 py-2.5
            overflow-hidden text-ellipsis whitespace-nowrap">
            {d.code}
          </div>
          <CopyBtn code={d.code} copied={copied} onCopy={onCopy} />
        </div>

        {/* value block */}
        <div>
          {d.name && <p className="text-xs text-[#A09D96] mb-1">{d.name}</p>}
          <p className="text-2xl font-bold text-[#1C1B18] leading-none">
            Giảm <span className="text-[#C9A84C]">{mainValue}</span>
          </p>
          {isPercent && d.maxDiscount && (
            <p className="text-xs text-[#6B6860] mt-1">Tối đa {numFmt(d.maxDiscount)} ₫</p>
          )}
        </div>

        {/* dashed separator – coupon perforation effect */}
        <div className="border-t border-dashed border-black/10" />

        {/* conditions list */}
        <div className="space-y-1.5 flex-1">
          {d.minOrderAmount > 0 && (
            <CondRow icon="wallet">
              Đơn tối thiểu <span className="font-semibold text-[#1C1B18]">{numFmt(d.minOrderAmount)} ₫</span>
            </CondRow>
          )}
          <CondRow icon="calendar">
            {fmtDate(d.startDate)} — {fmtDate(d.endDate)}
          </CondRow>
          {d.perUserLimit && (
            <CondRow icon="user">
              Mỗi tài khoản tối đa <span className="font-semibold text-[#1C1B18]">{d.perUserLimit} lần</span>
            </CondRow>
          )}
        </div>

        {/* usage quota */}
        {d.usageLimit > 0 && (
          <UsageBar used={d.usedCount} total={d.usageLimit} />
        )}
      </div>

      {/* footer CTA */}
      <div className="px-5 pb-5">
        <Link
          to={`/?discount=${d.code}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold
            bg-[#0A0A0B] text-white hover:bg-[#C9A84C] hover:text-[#0A0A0B] transition-all duration-200">
          Đặt phòng với mã này
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function CondRow({ icon, children }) {
  const icons = {
    wallet: <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
    calendar: <><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></>,
    user: <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  };
  return (
    <div className="flex items-start gap-2 text-xs text-[#6B6860]">
      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#A09D96]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        {icons[icon]}
      </svg>
      <span>{children}</span>
    </div>
  );
}

// ── empty state ────────────────────────────────────────────────────────────

function EmptyState({ filtered }) {
  return (
    <div className="col-span-full flex flex-col items-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#C9A84C]/8 border border-[#C9A84C]/15 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-[#C9A84C]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l-4-4m0 0l4-4m-4 4h16m-7 4l4-4m0 0l-4-4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7H4a1 1 0 00-1 1v8a1 1 0 001 1h3M17 7h3a1 1 0 011 1v8a1 1 0 01-1 1h-3" />
        </svg>
      </div>
      <p className="text-base font-semibold text-[#1C1B18] mb-2">
        {filtered ? 'Không tìm thấy mã phù hợp' : 'Chưa có mã khuyến mãi'}
      </p>
      <p className="text-sm text-[#6B6860] mb-6">
        {filtered ? 'Thử tìm kiếm với từ khóa khác hoặc xem tất cả mã' : 'Quay lại sau để không bỏ lỡ ưu đãi'}
      </p>
      <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] text-[#0A0A0B] text-sm font-semibold rounded-xl hover:bg-[#e0bc5e] transition-colors">
        Khám phá khách sạn
      </Link>
    </div>
  );
}

// ── toast ──────────────────────────────────────────────────────────────────

function Toast({ code }) {
  if (!code) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
      px-5 py-3 bg-[#1C1B18] text-white text-sm font-medium rounded-full shadow-2xl
      border border-white/10 whitespace-nowrap animate-[slideUp_0.2s_ease]">
      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Đã sao chép mã&nbsp;
      <span className="text-[#C9A84C] font-bold">{code}</span>
    </div>
  );
}

// ── filter tabs ────────────────────────────────────────────────────────────

const TABS = [
  { key: 'ALL',        label: 'Tất cả'        },
  { key: 'PERCENTAGE', label: '% Phần trăm'   },
  { key: 'FIXED',      label: 'Giảm cố định'  },
];

// ── sort options ───────────────────────────────────────────────────────────

const SORTS = [
  { key: 'expiry',    label: 'Sắp hết hạn' },
  { key: 'value-asc', label: 'Giá trị ↑'   },
  { key: 'value-desc',label: 'Giá trị ↓'   },
];

// ════════════════ Main Page ════════════════════════════════════════════════

export default function DiscountsPublicPage() {
  const [discounts, setDiscounts] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [copied,    setCopied]    = useState(null);
  const [tab,       setTab]       = useState('ALL');
  const [search,    setSearch]    = useState('');
  const [sort,      setSort]      = useState('expiry');

  useEffect(() => {
    getActiveDiscounts()
      .then(res => setDiscounts(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = useMemo(() => {
    let list = discounts;
    if (tab !== 'ALL') list = list.filter(d => d.type === tab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(d =>
        d.code?.toLowerCase().includes(q) ||
        d.name?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === 'expiry') {
        const da = a.endDate ? new Date(a.endDate).getTime() : Infinity;
        const db = b.endDate ? new Date(b.endDate).getTime() : Infinity;
        return da - db;
      }
      if (sort === 'value-asc') return Number(a.value) - Number(b.value);
      return Number(b.value) - Number(a.value);
    });
  }, [discounts, tab, search, sort]);

  const urgentCount = discounts.filter(d => {
    const dl = daysLeft(d.endDate);
    return dl !== null && dl <= 3;
  }).length;

  return (
    <div className="min-h-screen bg-[#F7F6F4]">
      <Navbar />

      {/* ── hero banner ─────────────────────────────────────────── */}
      <div className="bg-[#0A0A0B] text-white">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#C9A84C] flex items-center gap-2 mb-3">
            <span className="block h-px w-7 bg-[#8A6E30]" />
            Ưu đãi đặc biệt
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-2">
            Mã khuyến mãi
          </h1>
          <p className="text-sm text-white/50">
            Sao chép mã và nhập khi đặt phòng để được giảm giá ngay lập tức
          </p>

          {/* stats row */}
          {!loading && (
            <div className="flex items-center gap-6 mt-6 pt-6 border-t border-white/8">
              <div>
                <p className="text-xl font-bold text-[#C9A84C]">{discounts.length}</p>
                <p className="text-xs text-white/40">Mã đang hoạt động</p>
              </div>
              {urgentCount > 0 && (
                <div>
                  <p className="text-xl font-bold text-orange-400">{urgentCount}</p>
                  <p className="text-xs text-white/40">Sắp hết hạn (≤3 ngày)</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── filters ─────────────────────────────────────────────── */}
      <div className="border-b border-black/6 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-3">

            {/* type tabs */}
            <div className="flex items-center gap-1 bg-[#F7F6F4] p-1 rounded-xl shrink-0">
              {TABS.map(t => (
                <button key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer
                    ${tab === t.key
                      ? 'bg-[#0A0A0B] text-white shadow-sm'
                      : 'text-[#6B6860] hover:text-[#1C1B18]'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* search */}
            <div className="relative flex-1 min-w-[160px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A09D96]"
                fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text" value={search} placeholder="Tìm mã khuyến mãi..."
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-black/8 rounded-xl bg-white
                  outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15 transition"
              />
            </div>

            {/* sort */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-[#A09D96] hidden sm:block">Sắp xếp:</span>
              <select
                value={sort} onChange={e => setSort(e.target.value)}
                className="text-xs border border-black/8 rounded-xl px-3 py-1.5 bg-white
                  outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15
                  cursor-pointer text-[#1C1B18] transition">
                {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── content ─────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* result count */}
        {!loading && discounts.length > 0 && (
          <p className="text-xs text-[#A09D96] mb-5">
            Hiển thị <span className="font-semibold text-[#6B6860]">{filtered.length}</span> mã
            {tab !== 'ALL' || search ? ` / ${discounts.length} tổng số` : ''}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? [...Array(6)].map((_, i) => <CardSkeleton key={i} />)
            : filtered.length === 0
              ? <EmptyState filtered={tab !== 'ALL' || !!search.trim()} />
              : filtered.map(d => (
                  <DiscountCard key={d.id ?? d.code} d={d} copied={copied} onCopy={handleCopy} />
                ))
          }
        </div>
      </div>

      <Toast code={copied} />
    </div>
  );
}
