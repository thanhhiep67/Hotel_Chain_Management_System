import { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { getMyDiscounts, createDiscount, updateDiscount, toggleDiscount, deleteDiscount } from '../../api/discounts';
import { getMyHotels } from '../../api/hotels';

const STATUS_META = {
  ACTIVE:   { label: 'Đang hoạt động', cls: 'bg-green-50 text-green-700 border-green-200'  },
  INACTIVE: { label: 'Đã tắt',         cls: 'bg-gray-50  text-gray-500  border-gray-200'   },
  EXPIRED:  { label: 'Hết hạn',        cls: 'bg-red-50   text-red-600   border-red-200'    },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN',
    { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtValue(d) {
  if (d.type === 'PERCENTAGE') {
    const cap = d.maxDiscount ? `, tối đa ${d.maxDiscount.toLocaleString('vi-VN')}đ` : '';
    return `Giảm ${d.value}%${cap}`;
  }
  return `Giảm ${Number(d.value).toLocaleString('vi-VN')}đ`;
}

const EMPTY = {
  code: '', name: '', type: 'PERCENTAGE', value: '',
  minOrderAmount: '', maxDiscount: '', usageLimit: '',
  startDate: '', endDate: '', hotelId: '',
};

function discountToForm(d) {
  return {
    code:           d.code ?? '',
    name:           d.name ?? '',
    type:           d.type ?? 'PERCENTAGE',
    value:          d.value?.toString() ?? '',
    minOrderAmount: d.minOrderAmount?.toString() ?? '',
    maxDiscount:    d.maxDiscount?.toString()    ?? '',
    usageLimit:     d.usageLimit?.toString()     ?? '',
    startDate:      d.startDate ?? '',
    endDate:        d.endDate   ?? '',
    hotelId:        d.hotelId   ?? '',
  };
}

export default function DiscountsPage() {
  const [discounts,  setDiscounts]  = useState([]);
  const [hotels,     setHotels]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [form,       setForm]       = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState('');
  const [deleting,   setDeleting]   = useState(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    Promise.all([getMyDiscounts(), getMyHotels()])
      .then(([dr, hr]) => {
        setDiscounts(dr.data.data ?? []);
        setHotels(hr.data.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (d) => {
    setEditingId(d.id);
    setForm(discountToForm(d));
    setFormError('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY);
    setFormError('');
  };

  const buildPayload = () => ({
    code:           form.code,
    name:           form.name  || null,
    type:           form.type,
    value:          parseFloat(form.value),
    minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : 0,
    maxDiscount:    form.maxDiscount    ? parseFloat(form.maxDiscount)    : null,
    usageLimit:     form.usageLimit     ? parseInt(form.usageLimit)       : null,
    startDate:      form.startDate,
    endDate:        form.endDate,
    hotelId:        form.hotelId || null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.value || !form.startDate || !form.endDate) {
      setFormError('Vui lòng điền đầy đủ các trường bắt buộc (*).');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await updateDiscount(editingId, buildPayload());
        setDiscounts(prev => prev.map(d => d.id === editingId ? res.data.data : d));
      } else {
        const res = await createDiscount(buildPayload());
        setDiscounts(prev => [res.data.data, ...prev]);
      }
      closeForm();
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Thao tác thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await toggleDiscount(id);
      setDiscounts(prev => prev.map(d => d.id === id ? res.data.data : d));
    } catch { /* ignore */ }
  };

  const handleDelete = async (d) => {
    setDeleteError('');
    setDeleting(d.id);
    try {
      await deleteDiscount(d.id);
      setDiscounts(prev => prev.filter(x => x.id !== d.id));
    } catch (err) {
      setDeleteError(err.response?.data?.message ?? 'Xóa thất bại.');
    } finally {
      setDeleting(null);
    }
  };

  const hotelName = (hotelId) =>
    hotelId ? (hotels.find(h => h.id === hotelId)?.name ?? hotelId) : 'Tất cả khách sạn';

  const FormField = ({ label, required, hint, children }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}{required && ' *'}{hint && (
          <span className="normal-case font-normal text-gray-400 ml-1">{hint}</span>
        )}
      </label>
      {children}
    </div>
  );

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mã giảm giá</h1>
            <p className="text-sm text-gray-500 mt-0.5">Tạo và quản lý mã khuyến mãi</p>
          </div>
          {!showForm && (
            <button onClick={openCreate}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white
                rounded-xl font-medium transition cursor-pointer">
              + Tạo mã mới
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              {editingId ? 'Chỉnh sửa mã giảm giá' : 'Tạo mã giảm giá mới'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Mã giảm giá" required>
                <input value={form.code}
                  onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="VD: SUMMER20"
                  className={`${inputCls} font-mono tracking-widest placeholder:font-sans placeholder:tracking-normal`}
                />
              </FormField>

              <FormField label="Tên hiển thị" hint="(tùy chọn)">
                <input value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="VD: Khuyến mãi mùa hè"
                  className={inputCls} />
              </FormField>

              <FormField label="Loại giảm giá" required>
                <select value={form.type} onChange={e => set('type', e.target.value)}
                  className={inputCls}>
                  <option value="PERCENTAGE">Phần trăm (%)</option>
                  <option value="FIXED_AMOUNT">Số tiền cố định (đ)</option>
                </select>
              </FormField>

              <FormField label="Giá trị" required hint={form.type === 'PERCENTAGE' ? '(%)' : '(đ)'}>
                <input type="number" min="0" value={form.value}
                  onChange={e => set('value', e.target.value)}
                  placeholder={form.type === 'PERCENTAGE' ? 'VD: 20' : 'VD: 200000'}
                  className={inputCls} />
              </FormField>

              <FormField label="Đơn tối thiểu (đ)" hint="(tùy chọn)">
                <input type="number" min="0" value={form.minOrderAmount}
                  onChange={e => set('minOrderAmount', e.target.value)}
                  placeholder="VD: 500000" className={inputCls} />
              </FormField>

              {form.type === 'PERCENTAGE' && (
                <FormField label="Trần giảm tối đa (đ)" hint="(tùy chọn)">
                  <input type="number" min="0" value={form.maxDiscount}
                    onChange={e => set('maxDiscount', e.target.value)}
                    placeholder="VD: 500000" className={inputCls} />
                </FormField>
              )}

              <FormField label="Số lần dùng" hint="(để trống = không giới hạn)">
                <input type="number" min="1" value={form.usageLimit}
                  onChange={e => set('usageLimit', e.target.value)}
                  placeholder="VD: 100" className={inputCls} />
              </FormField>

              <FormField label="Ngày bắt đầu" required>
                <input type="date" value={form.startDate}
                  onChange={e => set('startDate', e.target.value)}
                  className={inputCls} />
              </FormField>

              <FormField label="Ngày kết thúc" required>
                <input type="date" value={form.endDate} min={form.startDate}
                  onChange={e => set('endDate', e.target.value)}
                  className={inputCls} />
              </FormField>

              <FormField label="Áp dụng cho">
                <select value={form.hotelId} onChange={e => set('hotelId', e.target.value)}
                  className={inputCls}>
                  <option value="">Tất cả khách sạn của tôi</option>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </FormField>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-red-500 bg-red-50 border border-red-100
                rounded-xl px-4 py-2">{formError}</p>
            )}

            <div className="flex justify-end gap-3 mt-5">
              <button type="button" onClick={closeForm}
                className="px-4 py-2 text-sm border border-gray-300 rounded-xl
                  text-gray-600 hover:bg-gray-50 transition cursor-pointer">
                Hủy
              </button>
              <button type="submit" disabled={submitting}
                className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                  text-white rounded-xl font-semibold transition cursor-pointer">
                {submitting ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo mã'}
              </button>
            </div>
          </form>
        )}

        {/* Delete error */}
        {deleteError && (
          <div className="mb-4 text-sm text-red-500 bg-red-50 border border-red-100
            rounded-xl px-4 py-2 flex items-center justify-between">
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError('')}
              className="text-red-400 hover:text-red-600 ml-3 cursor-pointer">✕</button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-24 animate-pulse" />
            ))}
          </div>
        ) : discounts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-4xl mb-3">🎟️</p>
            <p className="text-gray-500 text-sm">Chưa có mã giảm giá nào.</p>
            <button onClick={openCreate}
              className="mt-4 text-sm text-blue-600 hover:underline cursor-pointer">
              Tạo mã đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {discounts.map(d => {
              const meta = STATUS_META[d.status] ?? STATUS_META.INACTIVE;
              const pct  = d.usageLimit ? Math.min(100, (d.usedCount / d.usageLimit) * 100) : 0;
              const isExpired = d.status === 'EXPIRED';

              return (
                <div key={d.id}
                  className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4
                    ${isExpired ? 'opacity-60' : ''}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">

                    {/* Left */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="font-mono font-bold text-base tracking-widest
                        bg-gray-100 text-gray-900 rounded-lg px-3 py-2 shrink-0 leading-none">
                        {d.code}
                      </span>
                      <div className="min-w-0 flex-1">
                        {d.name && (
                          <p className="text-xs text-gray-500 mb-0.5">{d.name}</p>
                        )}
                        <p className="text-sm font-semibold text-gray-800">{fmtValue(d)}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                          {d.minOrderAmount > 0 && (
                            <span>Đơn từ {Number(d.minOrderAmount).toLocaleString('vi-VN')}đ</span>
                          )}
                          <span>{fmtDate(d.startDate)} → {fmtDate(d.endDate)}</span>
                          <span className="text-blue-600 truncate">{hotelName(d.hotelId)}</span>
                        </div>

                        {/* Progress bar */}
                        {d.usageLimit ? (
                          <div className="mt-2 max-w-48">
                            <div className="flex justify-between text-[11px] text-gray-400 mb-0.5">
                              <span>Đã dùng</span>
                              <span className="font-medium text-gray-600">
                                {d.usedCount}/{d.usageLimit}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${pct}%` }}
                                className={`h-full rounded-full transition-all
                                  ${pct >= 90 ? 'bg-red-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-blue-500'}`}
                              />
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1.5 text-[11px] text-gray-400">
                            Đã dùng: <span className="font-medium text-gray-600">{d.usedCount}</span> lần · Không giới hạn
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: status + actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${meta.cls}`}>
                        {meta.label}
                      </span>

                      {/* Edit */}
                      {!isExpired && (
                        <button onClick={() => openEdit(d)} title="Chỉnh sửa"
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer
                            text-gray-400 hover:text-gray-700">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                                 m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}

                      {/* Toggle */}
                      {!isExpired && (
                        <button onClick={() => handleToggle(d.id)}
                          title={d.status === 'ACTIVE' ? 'Tắt mã' : 'Bật mã'}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer
                            text-gray-400 hover:text-gray-700">
                          {d.status === 'ACTIVE' ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                              stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                              stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </button>
                      )}

                      {/* Delete — only if never used */}
                      {d.usedCount === 0 && (
                        <button onClick={() => handleDelete(d)}
                          disabled={deleting === d.id} title="Xóa mã"
                          className="p-1.5 rounded-lg hover:bg-red-50 transition cursor-pointer
                            text-gray-400 hover:text-red-500 disabled:opacity-40">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                                 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0
                                 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
}
