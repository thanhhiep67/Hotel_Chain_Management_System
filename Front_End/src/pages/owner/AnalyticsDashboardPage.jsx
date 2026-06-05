import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { getMyHotels } from '../../api/hotels';
import { getHotelBookings, checkInBooking } from '../../api/bookings';
import {
  getOverview, getRevenue, getBookingsByStatus,
  getTopRooms, getDiscountStats, exportExcel, getPriceSuggestion, getForecast,
} from '../../api/analytics';
import {
  LineChart, Line, BarChart, Bar, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

/* ── helpers ── */
const fmtVnd  = (n) => (n ?? 0).toLocaleString('vi-VN') + ' ₫';
const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};
const todayStr  = () => new Date().toISOString().slice(0, 10);
const nMonthsAgo = (n) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
};

const ROOM_TYPE_LABEL = {
  SINGLE:  'Phòng đơn',
  DOUBLE:  'Phòng đôi',
  TWIN:    'Phòng Twin',
  SUITE:   'Phòng Suite',
  DELUXE:  'Phòng Deluxe',
  FAMILY:  'Phòng gia đình',
};

/* ── Metric card ── */
function MetricCard({ label, value, sub, icon, color = 'blue', loading }) {
  const colors = {
    blue:   'bg-blue-50   border-blue-100   text-blue-600',
    green:  'bg-green-50  border-green-100  text-green-600',
    orange: 'bg-orange-50 border-orange-100 text-orange-600',
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          {loading
            ? <div className="h-7 w-28 bg-gray-100 rounded-lg animate-pulse" />
            : <p className="text-2xl font-bold text-gray-900">{value}</p>
          }
          {sub && !loading && (
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl
          border ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ── Status colors for pie chart ── */
const STATUS_COLOR = {
  PENDING:     '#FBBF24',
  CONFIRMED:   '#3B82F6',
  CHECKED_IN:  '#10B981',
  CHECKED_OUT: '#6B7280',
  CANCELLED:   '#EF4444',
  REJECTED:    '#F97316',
};
const STATUS_LABEL = {
  PENDING:     'Chờ xác nhận',
  CONFIRMED:   'Đã xác nhận',
  CHECKED_IN:  'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED:   'Đã hủy',
  REJECTED:    'Từ chối',
};

const PAY_META = {
  PAID:     { label: 'Đã thanh toán',  cls: 'bg-green-50  text-green-700  border-green-200'  },
  UNPAID:   { label: 'Chưa thanh toán', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  REFUNDED: { label: 'Đã hoàn tiền',   cls: 'bg-blue-50   text-blue-700   border-blue-200'   },
};

/* ── Custom tooltip for LineChart ── */
function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm font-bold text-blue-600">{fmtVnd(payload[0]?.value)}</p>
      <p className="text-xs text-gray-400">{payload[0]?.payload?.bookingCount} booking</p>
    </div>
  );
}

/* ── Custom label for PieChart ── */
const renderPieLabel = ({ name, percent }) =>
  percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : '';

/* ── Confirm Modal ── */
function ConfirmCheckInModal({ booking, onConfirm, onCancel }) {
  if (!booking) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5
        animate-[fadeIn_0.15s_ease-out]">

        {/* Icon + title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center text-3xl">
            🏠
          </div>
          <h3 className="text-lg font-bold text-gray-900">Xác nhận Check-in</h3>
          <p className="text-sm text-gray-500">
            Bạn có chắc muốn thực hiện check-in cho đặt phòng này?
          </p>
        </div>

        {/* Booking info */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Mã đặt phòng</span>
            <span className="font-mono font-semibold text-blue-600">
              #{booking.id.slice(-8).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Phòng</span>
            <span className="font-semibold text-gray-800">{booking.roomNumber ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Ngày trả phòng</span>
            <span className="text-gray-700">{fmtDate(booking.checkOut)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Số khách</span>
            <span className="text-gray-700">{booking.guestCount ?? 1} khách</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm
              font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer">
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white
              rounded-xl text-sm font-semibold transition cursor-pointer">
            Xác nhận Check-in
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function AnalyticsDashboardPage() {
  const navigate = useNavigate();

  /* Hotel selector */
  const [hotels,        setHotels]        = useState([]);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [hotelsLoading, setHotelsLoading] = useState(true);

  /* Date range */
  const [from,   setFrom]   = useState(nMonthsAgo(6));
  const [to,     setTo]     = useState(todayStr());
  const [period, setPeriod] = useState('monthly');

  /* Data */
  const [overview,      setOverview]      = useState(null);
  const [revenue,       setRevenue]       = useState([]);
  const [statusData,    setStatusData]    = useState([]);
  const [checkIns,      setCheckIns]      = useState([]);
  const [topRooms,      setTopRooms]      = useState([]);
  const [discountStats,   setDiscountStats]   = useState([]);
  const [priceSuggestion, setPriceSuggestion] = useState(null);
  const [forecast,        setForecast]        = useState(null);

  /* Loading states */
  const [ovLoading,  setOvLoading]  = useState(false);
  const [revLoading, setRevLoading] = useState(false);
  const [stLoading,  setStLoading]  = useState(false);
  const [ciLoading,  setCiLoading]  = useState(false);
  const [trLoading,  setTrLoading]  = useState(false);
  const [dsLoading,  setDsLoading]  = useState(false);
  const [psLoading,  setPsLoading]  = useState(false);
  const [fcLoading,  setFcLoading]  = useState(false);
  const [exporting,  setExporting]  = useState(false);

  /* Quick action states */
  const [actingId,       setActingId]       = useState(null);
  const [confirmBooking, setConfirmBooking] = useState(null);

  /* Load hotels on mount */
  useEffect(() => {
    getMyHotels()
      .then(res => {
        const list = res.data.data ?? [];
        setHotels(list);
        if (list.length > 0) setSelectedHotel(list[0]);
      })
      .catch(() => {})
      .finally(() => setHotelsLoading(false));
  }, []);

  /* Fetch all analytics when hotel / date range changes */
  const hotelId = selectedHotel?.id;

  const fetchAll = useCallback(() => {
    if (!hotelId) return;

    setOvLoading(true);
    getOverview(hotelId)
      .then(r => setOverview(r.data.data))
      .catch(() => {})
      .finally(() => setOvLoading(false));

    setRevLoading(true);
    getRevenue(hotelId, { period, from, to })
      .then(r => setRevenue(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setRevLoading(false));

    setStLoading(true);
    getBookingsByStatus(hotelId, { from, to })
      .then(r => setStatusData(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setStLoading(false));

    setCiLoading(true);
    getHotelBookings(hotelId, { status: 'CONFIRMED', checkIn: todayStr(), size: 50 })
      .then(r => setCheckIns(r.data.data?.content ?? []))
      .catch(() => {})
      .finally(() => setCiLoading(false));

    setTrLoading(true);
    getTopRooms(hotelId, { from, to })
      .then(r => setTopRooms(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setTrLoading(false));

    setDsLoading(true);
    getDiscountStats(hotelId, { from, to })
      .then(r => setDiscountStats(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setDsLoading(false));

    // Price suggestion & Forecast chỉ phụ thuộc hotelId
    setPsLoading(true);
    getPriceSuggestion(hotelId)
      .then(r => setPriceSuggestion(r.data.data))
      .catch(() => {})
      .finally(() => setPsLoading(false));

    setFcLoading(true);
    getForecast(hotelId)
      .then(r => setForecast(r.data.data))
      .catch(() => {})
      .finally(() => setFcLoading(false));
  }, [hotelId, from, to, period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* Excel export */
  const handleExport = async () => {
    if (!hotelId) return;
    setExporting(true);
    try { await exportExcel(hotelId, from, to); }
    catch { alert('Xuất file thất bại. Vui lòng thử lại.'); }
    finally { setExporting(false); }
  };

  /* Check-in handlers */
  const handleCheckIn = (booking) => setConfirmBooking(booking);

  const doCheckIn = async () => {
    if (!confirmBooking) return;
    const bookingId = confirmBooking.id;
    setConfirmBooking(null);
    setActingId(bookingId);
    try {
      await checkInBooking(bookingId);
      setCheckIns(prev => prev.filter(b => b.id !== bookingId));
    } catch (err) {
      alert(err.response?.data?.message ?? 'Check-in thất bại. Vui lòng thử lại.');
    } finally {
      setActingId(null);
    }
  };

  /* Chart data */
  const pieData = statusData.map(d => ({
    name:  STATUS_LABEL[d.status] ?? d.status,
    value: Number(d.count),
    color: STATUS_COLOR[d.status] ?? '#94A3B8',
  }));

  const lineData = revenue.map(d => ({
    ...d,
    label: d.period.includes('W')
      ? d.period.replace('-W', ' T')
      : d.period.replace('-', '/'),
  }));

  /* ── Loading skeleton ── */
  if (hotelsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-10 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  /* ── No hotels ── */
  if (hotels.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-24 text-center">
          <p className="text-5xl mb-4">🏨</p>
          <h2 className="text-xl font-semibold text-gray-700">Chưa có khách sạn nào</h2>
          <button onClick={() => navigate('/owner/hotels/new')}
            className="mt-5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white
              rounded-xl text-sm transition cursor-pointer">
            + Thêm khách sạn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* ── Confirm check-in modal ── */}
      <ConfirmCheckInModal
        booking={confirmBooking}
        onConfirm={doCheckIn}
        onCancel={() => setConfirmBooking(null)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard phân tích</h1>
            <p className="text-sm text-gray-500 mt-0.5">Thống kê hoạt động khách sạn</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hotels.length > 1 && (
              <select
                value={selectedHotel?.id ?? ''}
                onChange={e => setSelectedHotel(hotels.find(h => h.id === e.target.value))}
                className="text-sm px-3 py-2 border border-gray-200 rounded-xl
                  outline-none focus:border-blue-400 bg-white cursor-pointer max-w-48 truncate">
                {hotels.map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            )}

            <input type="date" value={from} max={to}
              onChange={e => setFrom(e.target.value)}
              className="text-sm px-3 py-2 border border-gray-200 rounded-xl
                outline-none focus:border-blue-400 bg-white cursor-pointer" />
            <span className="text-gray-400 text-sm">→</span>
            <input type="date" value={to} min={from} max={todayStr()}
              onChange={e => setTo(e.target.value)}
              className="text-sm px-3 py-2 border border-gray-200 rounded-xl
                outline-none focus:border-blue-400 bg-white cursor-pointer" />

            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600
                hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm
                font-medium rounded-xl transition cursor-pointer whitespace-nowrap">
              {exporting
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent
                    rounded-full animate-spin inline-block" />
                : '📥'
              }
              Xuất Excel
            </button>
          </div>
        </div>

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Doanh thu tháng này"
            value={fmtVnd(overview?.revenueThisMonth)}
            sub="Bookings đã thanh toán"
            icon="💰" color="green" loading={ovLoading}
          />
          <MetricCard
            label="Tổng đặt phòng"
            value={(overview?.totalBookings ?? 0).toLocaleString()}
            sub="Mọi thời điểm"
            icon="📋" color="blue" loading={ovLoading}
          />
          <MetricCard
            label="Lấp đầy hôm nay"
            value={`${overview?.occupancyRate ?? 0}%`}
            sub={`${overview?.totalRooms ?? 0} phòng`}
            icon="🏠" color="orange" loading={ovLoading}
          />
          <MetricCard
            label="Rating trung bình"
            value={(overview?.avgRating ?? 0) > 0
              ? `⭐ ${overview.avgRating.toFixed(1)}`
              : '—'
            }
            sub={overview?.reviewCount
              ? `${overview.reviewCount} đánh giá`
              : 'Chưa có đánh giá'
            }
            icon="⭐" color="yellow" loading={ovLoading}
          />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Line chart — doanh thu */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <h2 className="font-semibold text-gray-900">Biểu đồ doanh thu</h2>
              <div className="flex items-center gap-2">
                {['monthly', 'weekly'].map(p => (
                  <button key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition cursor-pointer
                      ${period === p
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    {p === 'monthly' ? 'Tháng' : 'Tuần'}
                  </button>
                ))}
              </div>
            </div>

            {revLoading ? (
              <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
            ) : lineData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                <p className="text-3xl mb-2">📊</p>
                <p className="text-sm">Không có dữ liệu trong khoảng thời gian này</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={lineData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9CA3AF' }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1_000_000
                      ? `${(v/1_000_000).toFixed(1)}M`
                      : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : v}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Line
                    type="monotone" dataKey="revenue"
                    stroke="#3B82F6" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#1D4ED8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie chart — booking status */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Trạng thái booking</h2>

            {stLoading ? (
              <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
            ) : pieData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                <p className="text-3xl mb-2">🥧</p>
                <p className="text-sm">Không có dữ liệu</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData} cx="50%" cy="45%"
                    outerRadius={90} innerRadius={45}
                    dataKey="value"
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    formatter={(value) => (
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{value}</span>
                    )}
                  />
                  <Tooltip
                    formatter={(value, name) => [`${value} booking`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Top 5 phòng & Discount stats row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top 5 phòng phổ biến */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Top 5 phòng phổ biến</h2>
              <p className="text-xs text-gray-400 mt-0.5">Theo số lần đặt trong khoảng thời gian</p>
            </div>

            {trLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : topRooms.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-2 text-gray-400">
                <p className="text-3xl">🛏️</p>
                <p className="text-sm">Không có dữ liệu phòng</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 text-left">
                      {['#', 'Phòng', 'Loại', 'Lượt đặt', 'Doanh thu'].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-400
                          uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {topRooms.map((room, idx) => (
                      <tr key={room.roomId} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center
                            text-xs font-bold
                            ${idx === 0 ? 'bg-yellow-100 text-yellow-700'
                              : idx === 1 ? 'bg-gray-100 text-gray-600'
                              : idx === 2 ? 'bg-orange-100 text-orange-600'
                              : 'bg-gray-50 text-gray-400'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-gray-800">
                          {room.roomNumber}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {ROOM_TYPE_LABEL[room.roomType] ?? room.roomType}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5
                            bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                            {room.bookingCount} lượt
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-gray-800">
                          {fmtVnd(room.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Thống kê mã giảm giá */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900">Thống kê mã giảm giá</h2>
              <p className="text-xs text-gray-400 mt-0.5">Mã được sử dụng nhiều nhất</p>
            </div>

            {dsLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : discountStats.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-2 text-gray-400">
                <p className="text-3xl">🏷️</p>
                <p className="text-sm">Chưa có mã giảm giá nào được dùng</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 text-left">
                      {['Mã', 'Tên', 'Lượt dùng', 'Tổng giảm'].map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-400
                          uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {discountStats.map((d) => (
                      <tr key={d.discountId} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-xs px-2 py-1 bg-purple-50
                            text-purple-700 border border-purple-100 rounded-lg font-semibold">
                            {d.code}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 max-w-32 truncate">
                          {d.name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5
                            bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
                            {d.usageCount} lượt
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-red-500">
                          -{fmtVnd(d.totalDiscountAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── AI Insights — Price suggestion + Forecast ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {/* Header */}
          <div className="flex items-center gap-2 mb-5">
            <h2 className="font-semibold text-gray-900">🤖 AI Insights</h2>
            <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full font-semibold">
              Beta
            </span>
            <span className="text-xs text-gray-400 ml-1">
              Gợi ý giá · Dự báo booking
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* ── Price suggestion ── */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                💡 Gợi ý điều chỉnh giá
              </p>

          {psLoading ? (
            <div className="h-40 bg-gray-50 rounded-xl animate-pulse" />
          ) : !priceSuggestion ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
              Không có dữ liệu
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">

              {/* ── Panel đề xuất ── */}
              <div className={`shrink-0 lg:w-64 rounded-xl p-4 border ${
                priceSuggestion.action === 'INCREASE'
                  ? 'bg-green-50  border-green-100'
                  : priceSuggestion.action === 'DECREASE'
                  ? 'bg-red-50    border-red-100'
                  : 'bg-gray-50   border-gray-100'
              }`}>
                {/* Action badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-3xl font-bold ${
                    priceSuggestion.action === 'INCREASE' ? 'text-green-600'
                      : priceSuggestion.action === 'DECREASE' ? 'text-red-500'
                      : 'text-gray-500'
                  }`}>
                    {priceSuggestion.action === 'INCREASE' ? '↑'
                      : priceSuggestion.action === 'DECREASE' ? '↓'
                      : '→'}
                  </span>
                  <div>
                    <p className={`text-sm font-bold ${
                      priceSuggestion.action === 'INCREASE' ? 'text-green-700'
                        : priceSuggestion.action === 'DECREASE' ? 'text-red-600'
                        : 'text-gray-600'
                    }`}>
                      {priceSuggestion.action === 'INCREASE'
                        ? `Tăng giá ${priceSuggestion.suggestedAdjustmentPct}%`
                        : priceSuggestion.action === 'DECREASE'
                        ? `Giảm giá ${priceSuggestion.suggestedAdjustmentPct}%`
                        : 'Giữ nguyên giá'}
                    </p>
                    <p className="text-xs text-gray-400">Đề xuất AI</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-1.5 text-xs mb-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Tuần này</span>
                    <span className="font-semibold">{priceSuggestion.thisWeekOccupancy}%</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>TB 4 tuần</span>
                    <span className="font-semibold">{priceSuggestion.avgPast4WeeksOccupancy}%</span>
                  </div>
                  <div className={`flex justify-between font-bold ${
                    priceSuggestion.occupancyDelta >= 0 ? 'text-green-600' : 'text-red-500'
                  }`}>
                    <span>Chênh lệch</span>
                    <span>{priceSuggestion.occupancyDelta >= 0 ? '+' : ''}{priceSuggestion.occupancyDelta}%</span>
                  </div>
                </div>

                <p className="text-xs text-gray-500 leading-relaxed">
                  {priceSuggestion.reason}
                </p>
              </div>

              {/* ── Vertical bar chart 5 tuần ── */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-2">Occupancy rate 5 tuần (%)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={[...priceSuggestion.weeklyBreakdown].reverse()}
                    margin={{ top: 20, right: 4, left: -20, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="label" hide />
                    <YAxis domain={[0, 100]}
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickLine={false} axisLine={false}
                      tickFormatter={v => `${v}%`} />
                    <Tooltip
                      formatter={v => [`${v}%`, 'Lấp đầy']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="occupancy" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="occupancy"
                        position="top"
                        formatter={v => `${v}%`}
                        style={{ fontSize: 10, fontWeight: '600', fill: '#374151' }}
                      />
                      <LabelList
                        dataKey="label"
                        position="insideBottom"
                        offset={6}
                        style={{ fontSize: 9, fill: '#6B7280' }}
                      />
                      {[...priceSuggestion.weeklyBreakdown].reverse().map((_, i, arr) => (
                        <Cell
                          key={i}
                          fill={i === arr.length - 1
                            ? (priceSuggestion.action === 'INCREASE' ? '#10B981'
                                : priceSuggestion.action === 'DECREASE' ? '#EF4444'
                                : '#6B7280')
                            : '#BFDBFE'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          )}
            </div>{/* end price suggestion inner card */}

            {/* ── Forecast ── */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                📈 Dự báo booking tuần tới
              </p>

          {fcLoading ? (
            <div className="h-44 bg-gray-50 rounded-xl animate-pulse" />
          ) : !forecast ? (
            <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
              Không có dữ liệu
            </div>
          ) : (() => {
            const TREND_META = {
              UP:     { label: 'Tăng',    cls: 'text-green-600', bg: 'bg-green-50 border-green-100', icon: '↑' },
              DOWN:   { label: 'Giảm',    cls: 'text-red-500',   bg: 'bg-red-50   border-red-100',   icon: '↓' },
              STABLE: { label: 'Ổn định', cls: 'text-gray-500',  bg: 'bg-gray-50  border-gray-100',  icon: '→' },
            };
            const meta = TREND_META[forecast.trend] ?? TREND_META.STABLE;

            // Chart data: 4 history weeks (oldest→newest) + thisWeek + forecast
            const chartData = [
              ...forecast.history.map(w => ({ label: w.dateRange, count: w.count, type: 'history' })),
              { label: forecast.thisWeek.dateRange, count: forecast.thisWeek.count, type: 'current' },
              { label: forecast.forecastWeek,       count: forecast.forecastCount,  type: 'forecast' },
            ];

            return (
              <div className="flex flex-col lg:flex-row gap-6">

                {/* ── Panel số ── */}
                <div className={`shrink-0 lg:w-56 rounded-xl p-4 border ${meta.bg}`}>
                  <p className="text-xs text-gray-400 mb-1">Dự báo tuần</p>
                  <p className="text-xs font-medium text-gray-500 mb-3">{forecast.forecastWeek}</p>

                  <div className={`text-4xl font-bold mb-1 ${meta.cls}`}>
                    {forecast.forecastCount}
                  </div>
                  <p className="text-sm text-gray-500 mb-4">booking dự kiến</p>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Moving Average</span>
                      <span className="font-semibold">{forecast.movingAverage}</span>
                    </div>
                    <div className={`flex justify-between font-bold ${meta.cls}`}>
                      <span>Xu hướng</span>
                      <span>{meta.icon} {meta.label}
                        {forecast.trend !== 'STABLE' &&
                          ` ${Math.abs(forecast.trendPct).toFixed(1)}%`}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Tuần này</span>
                      <span>{forecast.thisWeek.count} booking</span>
                    </div>
                  </div>
                </div>

                {/* ── Bar chart ── */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-2">Số booking theo tuần</p>
                  <ResponsiveContainer width="100%" height={165}>
                    <BarChart data={chartData}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="label"
                        tick={{ fontSize: 9, fill: '#9CA3AF' }}
                        tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false}
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(v, _, props) => [
                          `${v} booking`,
                          props.payload.type === 'forecast' ? 'Dự báo' : 'Thực tế',
                        ]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        <LabelList
                          dataKey="count"
                          position="top"
                          style={{ fontSize: 11, fontWeight: '600', fill: '#374151' }}
                        />
                        {chartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={
                              entry.type === 'forecast' ? '#F59E0B'
                                : entry.type === 'current' ? '#60A5FA'
                                : '#BFDBFE'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm inline-block bg-blue-200" /> Lịch sử
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm inline-block bg-blue-400" /> Tuần này
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm inline-block bg-amber-400" /> Dự báo
                    </span>
                  </div>
                </div>

              </div>
            );
          })()}
            </div>{/* end forecast inner card */}

          </div>{/* end 2-col grid */}
        </div>{/* end AI Insights outer card */}

        {/* ── Check-in hôm nay ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Check-in hôm nay</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {fmtDate(todayStr())} · Trạng thái CONFIRMED
              </p>
            </div>
            {!ciLoading && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold
                ${checkIns.length > 0
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-gray-100 text-gray-500'}`}>
                {checkIns.length} khách
              </span>
            )}
          </div>

          {ciLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : checkIns.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-2 text-gray-400">
              <p className="text-3xl">✅</p>
              <p className="text-sm">Không có khách check-in hôm nay</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-left">
                    {['Mã đặt phòng', 'Phòng', 'Check-out', 'Số khách', 'Thanh toán', 'Thao tác']
                      .map(h => (
                        <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-400
                          uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {checkIns.map(b => {
                    const pay = PAY_META[b.paymentStatus] ?? PAY_META.UNPAID;
                    return (
                      <tr key={b.id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => navigate(`/owner/bookings/${b.id}`)}
                            className="font-mono text-xs text-blue-600 hover:underline cursor-pointer">
                            #{b.id.slice(-8).toUpperCase()}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-gray-800">
                          {b.roomNumber ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">
                          {fmtDate(b.checkOut)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-center">
                          {b.guestCount ?? 1}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full
                            text-xs font-medium border ${pay.cls}`}>
                            {pay.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => handleCheckIn(b)}
                            disabled={actingId === b.id}
                            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700
                              disabled:bg-green-400 text-white rounded-lg font-medium
                              transition cursor-pointer whitespace-nowrap">
                            {actingId === b.id
                              ? <span className="flex items-center gap-1">
                                  <span className="w-3 h-3 border-2 border-white
                                    border-t-transparent rounded-full animate-spin" />
                                  Đang xử lý...
                                </span>
                              : '🏠 Check-in'
                            }
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
