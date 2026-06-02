import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { getAdminHotels, updateHotelStatus } from '../../api/admin';

const STATUS_STYLE = {
  PENDING:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  APPROVED: 'bg-green-50  text-green-700  border-green-200',
  REJECTED: 'bg-red-50    text-red-700    border-red-200',
  INACTIVE: 'bg-gray-100  text-gray-500   border-gray-200',
};
const STATUS_LABEL = {
  PENDING:  'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  INACTIVE: 'Ngừng HĐ',
};
const FILTERS = [
  { value: '',         label: 'Tất cả' },
  { value: 'PENDING',  label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'INACTIVE', label: 'Ngừng HĐ' },
];
const PAGE_SIZE = 10;

/* ── Confirm modal ── */
function ConfirmModal({ hotel, action, onConfirm, onCancel, loading }) {
  const isApprove = action === 'APPROVED';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-gray-900">
          {isApprove ? 'Duyệt khách sạn' : 'Từ chối khách sạn'}
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          {isApprove
            ? <>Xác nhận duyệt <strong>{hotel.name}</strong>? Khách sạn sẽ hiển thị công khai.</>
            : <>Xác nhận từ chối <strong>{hotel.name}</strong>?</>
          }
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl
              hover:bg-gray-50 transition cursor-pointer">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-4 py-2 text-sm text-white rounded-xl transition cursor-pointer
              disabled:opacity-50 ${isApprove
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'}`}>
            {loading ? 'Đang xử lý...' : isApprove ? 'Duyệt' : 'Từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Hotel row ── */
function HotelRow({ hotel, onAction }) {
  const img = hotel.images?.[0];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
      flex flex-col sm:flex-row">
      <div className="sm:w-36 h-32 sm:h-auto shrink-0 bg-linear-to-br
        from-blue-100 to-indigo-200 overflow-hidden">
        {img
          ? <img src={img} alt={hotel.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">🏨</div>
        }
      </div>

      <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 truncate">{hotel.name}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs
              font-medium border shrink-0 ${STATUS_STYLE[hotel.status]}`}>
              {STATUS_LABEL[hotel.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">
            {hotel.address}, {hotel.city}
          </p>
          {hotel.description && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-1">{hotel.description}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Tạo lúc: {hotel.createdAt ? new Date(hotel.createdAt).toLocaleDateString('vi-VN') : '—'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link to={`/hotels/${hotel.id}`} target="_blank"
            className="px-3 py-1.5 text-xs border border-gray-300 rounded-xl
              hover:bg-gray-50 transition text-gray-600">
            Xem
          </Link>

          {hotel.status === 'PENDING' && (
            <>
              <button onClick={() => onAction(hotel, 'APPROVED')}
                className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700
                  text-white rounded-xl transition cursor-pointer font-medium">
                ✓ Duyệt
              </button>
              <button onClick={() => onAction(hotel, 'REJECTED')}
                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700
                  text-white rounded-xl transition cursor-pointer font-medium">
                ✕ Từ chối
              </button>
            </>
          )}

          {hotel.status === 'APPROVED' && (
            <button onClick={() => onAction(hotel, 'INACTIVE')}
              className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600
                hover:bg-gray-50 rounded-xl transition cursor-pointer">
              Ngừng HĐ
            </button>
          )}

          {(hotel.status === 'REJECTED' || hotel.status === 'INACTIVE') && (
            <button onClick={() => onAction(hotel, 'APPROVED')}
              className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700
                text-white rounded-xl transition cursor-pointer font-medium">
              ✓ Duyệt lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Pagination ── */
function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button onClick={() => onChange(page - 1)} disabled={page === 0}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl
          disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer">
        ← Trước
      </button>
      {start > 0 && <span className="px-2 text-gray-400">…</span>}
      {pages.map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={`w-9 h-9 text-sm rounded-xl transition cursor-pointer
            ${p === page ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'}`}>
          {p + 1}
        </button>
      ))}
      {end < totalPages - 1 && <span className="px-2 text-gray-400">…</span>}
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl
          disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer">
        Sau →
      </button>
    </div>
  );
}

/* ── Main page ── */
export default function AdminHotelsPage() {
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [hotels, setHotels]             = useState([]);
  const [page, setPage]                 = useState(0);
  const [totalPages, setTotalPages]     = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [confirm, setConfirm]           = useState(null); // { hotel, action }
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]               = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async (status, p) => {
    setLoading(true);
    try {
      const params = { page: p, size: PAGE_SIZE };
      if (status) params.status = status;
      const res = await getAdminHotels(params);
      const d   = res.data.data;
      setHotels(d.content);
      setTotalPages(d.totalPages);
      setTotalElements(d.totalElements);
    } catch {
      setHotels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(statusFilter, page); }, [statusFilter, page, load]);

  const handleFilterChange = (val) => {
    setStatusFilter(val);
    setPage(0);
  };

  const handleAction = (hotel, action) => setConfirm({ hotel, action });

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      await updateHotelStatus(confirm.hotel.id, confirm.action);
      const msg = confirm.action === 'APPROVED' ? 'Đã duyệt khách sạn!'
        : confirm.action === 'REJECTED' ? 'Đã từ chối khách sạn.'
        : 'Đã cập nhật trạng thái.';
      showToast(msg);
      setConfirm(null);
      load(statusFilter, page);
    } catch (err) {
      showToast(err.response?.data?.message ?? 'Có lỗi xảy ra');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Duyệt khách sạn</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Quản lý yêu cầu đăng ký từ các chủ khách sạn
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => handleFilterChange(f.value)}
              className={`px-4 py-1.5 text-sm rounded-xl border transition cursor-pointer font-medium
                ${statusFilter === f.value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
              {f.label}
            </button>
          ))}

          <span className="ml-auto text-sm text-gray-400 self-center">
            {totalElements} khách sạn
          </span>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i}
                className="bg-white rounded-2xl border border-gray-100 h-32 animate-pulse" />
            ))}
          </div>
        ) : hotels.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-3">🎉</div>
            <p className="text-gray-500 font-medium">
              {statusFilter === 'PENDING'
                ? 'Không có khách sạn nào chờ duyệt'
                : 'Không có kết quả'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {hotels.map((h) => (
              <HotelRow key={h.id} hotel={h} onAction={handleAction} />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }} />
      </main>

      {confirm && (
        <ConfirmModal
          hotel={confirm.hotel}
          action={confirm.action}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          loading={actionLoading}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3
          bg-gray-900 text-white text-sm rounded-2xl shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
