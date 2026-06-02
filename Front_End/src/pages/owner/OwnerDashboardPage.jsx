import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { getMyHotels, deleteHotel } from '../../api/hotels';

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
  INACTIVE: 'Ngừng hoạt động',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs
      font-medium border ${STATUS_STYLE[status] ?? STATUS_STYLE.INACTIVE}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function ConfirmDialog({ hotel, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-semibold text-gray-900">Xóa khách sạn</h3>
        <p className="mt-2 text-sm text-gray-500">
          Bạn có chắc muốn xóa <strong>{hotel.name}</strong>? Thao tác này không thể hoàn tác.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl
              hover:bg-gray-50 transition cursor-pointer">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-400
              text-white rounded-xl transition cursor-pointer">
            {loading ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HotelCard({ hotel, onEdit, onDelete }) {
  const img = hotel.images?.[0];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
      flex flex-col sm:flex-row">
      <div className="sm:w-40 h-36 sm:h-auto shrink-0 bg-linear-to-br
        from-blue-100 to-indigo-200 overflow-hidden">
        {img
          ? <img src={img} alt={hotel.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">🏨</div>
        }
      </div>

      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-gray-900 text-base">{hotel.name}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{hotel.address}, {hotel.city}</p>
            </div>
            <StatusBadge status={hotel.status} />
          </div>

          {hotel.description && (
            <p className="mt-2 text-sm text-gray-500 line-clamp-2">{hotel.description}</p>
          )}

          {hotel.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hotel.amenities.slice(0, 4).map((a) => (
                <span key={a}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {a}
                </span>
              ))}
              {hotel.amenities.length > 4 && (
                <span className="text-xs text-gray-400">+{hotel.amenities.length - 4}</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Link to={`/hotels/${hotel.id}`} className="text-sm text-blue-600 hover:underline">
            Xem chi tiết →
          </Link>
          <div className="flex gap-2">
            <button onClick={() => onEdit(hotel)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl
                hover:bg-gray-50 transition cursor-pointer">
              ✏️ Sửa
            </button>
            <button onClick={() => onDelete(hotel)} disabled={hotel.status === 'INACTIVE'}
              className="px-3 py-1.5 text-sm border border-red-200 text-red-600
                hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed
                rounded-xl transition cursor-pointer">
              🗑️ Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OwnerDashboardPage() {
  const navigate                        = useNavigate();
  const { state }                       = useLocation();
  const [hotels, setHotels]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast]               = useState(state?.toast ?? '');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // Xoá toast state khỏi history để không hiện lại khi F5
  useEffect(() => {
    if (state?.toast) window.history.replaceState({}, '');
  }, [state]);

  const loadHotels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyHotels();
      setHotels(res.data.data ?? []);
    } catch { setHotels([]); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { loadHotels(); }, [loadHotels]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteHotel(deleteTarget.id);
      showToast('Đã xóa khách sạn.');
      setDeleteTarget(null);
      loadHotels();
    } catch (err) {
      showToast(err.response?.data?.message ?? 'Xóa thất bại');
    } finally { setDeleteLoading(false); }
  };

  const stats = {
    total:    hotels.length,
    approved: hotels.filter((h) => h.status === 'APPROVED').length,
    pending:  hotels.filter((h) => h.status === 'PENDING').length,
    rejected: hotels.filter((h) => h.status === 'REJECTED').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Khách sạn của tôi</h1>
            <p className="text-sm text-gray-500 mt-0.5">Quản lý danh sách khách sạn</p>
          </div>
          <button
            onClick={() => navigate('/owner/hotels/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700
              text-white text-sm font-medium rounded-xl transition cursor-pointer">
            + Thêm khách sạn
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Tổng cộng',  value: stats.total,    color: 'text-gray-900' },
            { label: 'Đã duyệt',   value: stats.approved, color: 'text-green-600' },
            { label: 'Chờ duyệt',  value: stats.pending,  color: 'text-yellow-600' },
            { label: 'Bị từ chối', value: stats.rejected, color: 'text-red-600' },
          ].map((s) => (
            <div key={s.label}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i}
                className="bg-white rounded-2xl border border-gray-100 h-36 animate-pulse" />
            ))}
          </div>
        ) : hotels.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <div className="text-5xl mb-4">🏨</div>
            <h3 className="text-lg font-semibold text-gray-700">Chưa có khách sạn nào</h3>
            <p className="text-gray-400 text-sm mt-1 mb-5">Tạo khách sạn đầu tiên để bắt đầu</p>
            <button onClick={() => navigate('/owner/hotels/new')}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm
                rounded-xl transition cursor-pointer">
              + Thêm khách sạn
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {hotels.map((h) => (
              <HotelCard key={h.id} hotel={h}
                onEdit={(hotel) => navigate(`/owner/hotels/${hotel.id}/edit`)}
                onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </main>

      {deleteTarget && (
        <ConfirmDialog hotel={deleteTarget} onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)} loading={deleteLoading} />
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
