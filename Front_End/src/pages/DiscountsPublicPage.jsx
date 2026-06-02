import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getActiveDiscounts } from '../api/discounts';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtValue(d) {
  if (d.type === 'PERCENTAGE') {
    const cap = d.maxDiscount ? `, tối đa ${Number(d.maxDiscount).toLocaleString('vi-VN')}đ` : '';
    return `Giảm ${d.value}%${cap}`;
  }
  return `Giảm ${Number(d.value).toLocaleString('vi-VN')}đ`;
}

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
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mã khuyến mãi</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sao chép mã và nhập khi đặt phòng để được giảm giá
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-32 animate-pulse" />
            ))}
          </div>
        ) : discounts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-4xl mb-3">🎟️</p>
            <p className="text-gray-500 text-sm">Hiện chưa có mã khuyến mãi nào.</p>
            <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
              Khám phá khách sạn
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {discounts.map(d => (
              <div key={d.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4
                  flex flex-col gap-3">

                {/* Code row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-lg tracking-widest
                    text-gray-900 bg-gray-100 rounded-lg px-3 py-1.5 leading-none">
                    {d.code}
                  </span>
                  <button
                    onClick={() => handleCopy(d.code)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                      bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition cursor-pointer">
                    {copied === d.code ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Đã sao chép
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2
                               m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Sao chép
                      </>
                    )}
                  </button>
                </div>

                {/* Value badge */}
                <div>
                  {d.name && (
                    <p className="text-xs text-gray-500 mb-1">{d.name}</p>
                  )}
                  <p className="text-sm font-semibold text-green-700">{fmtValue(d)}</p>
                </div>

                {/* Conditions */}
                <div className="space-y-1 text-xs text-gray-500">
                  {d.minOrderAmount > 0 && (
                    <p>• Đơn tối thiểu: {Number(d.minOrderAmount).toLocaleString('vi-VN')}đ</p>
                  )}
                  {!d.hotelId && <p>• Áp dụng tất cả khách sạn</p>}
                  <p>• Hiệu lực: {fmtDate(d.startDate)} → {fmtDate(d.endDate)}</p>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
