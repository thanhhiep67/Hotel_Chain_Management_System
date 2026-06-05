import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { getHotelById } from '../../api/hotels';
import { createRoom, updateRoom, deleteRoom } from '../../api/rooms';

const ROOM_TYPES   = ['STANDARD', 'DELUXE', 'SUITE', 'FAMILY'];
const TYPE_LABEL   = { STANDARD: 'Standard', DELUXE: 'Deluxe', SUITE: 'Suite', FAMILY: 'Family' };
const TYPE_COLOR   = {
  STANDARD: 'bg-gray-100 text-gray-700 border-gray-200',
  DELUXE:   'bg-blue-100 text-blue-700 border-blue-200',
  SUITE:    'bg-purple-100 text-purple-700 border-purple-200',
  FAMILY:   'bg-green-100 text-green-700 border-green-200',
};
const STATUS_COLOR = {
  AVAILABLE:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  MAINTENANCE: 'bg-orange-50  text-orange-700  border-orange-200',
};
const STATUS_LABEL = { AVAILABLE: 'Còn phòng', MAINTENANCE: 'Bảo trì' };

const AMENITY_OPTIONS = [
  'WiFi', 'Điều hòa', 'TV', 'Minibar', 'Két an toàn', 'Ban công',
  'Bồn tắm', 'Vòi sen', 'Máy sấy tóc', 'Bàn làm việc', 'Sofa',
  'View biển', 'View thành phố', 'Dịch vụ phòng', 'Phòng không hút thuốc',
];

const EMPTY_FORM = {
  roomNumber: '', type: 'STANDARD', pricePerNight: '',
  capacity: '', description: '', amenities: [], images: [],
};

/* ── Image uploader (reuse style) ── */
function ImageUploader({ images, onChange }) {
  const inputRef = useRef();
  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = ev => res(ev.target.result);
      r.readAsDataURL(f);
    }))).then(results => { onChange([...images, ...results]); e.target.value = ''; });
  };
  return (
    <div className="flex flex-wrap gap-2">
      {images.map((src, i) => (
        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 group shrink-0">
          <img src={src} alt="" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))}
            className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100
              transition flex items-center justify-center cursor-pointer text-base">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => inputRef.current?.click()}
        className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300
          hover:border-blue-400 hover:bg-blue-50 flex flex-col items-center
          justify-center gap-1 transition cursor-pointer shrink-0">
        <span className="text-2xl text-gray-300 leading-none">+</span>
        <span className="text-xs text-gray-400">Thêm ảnh</span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
    </div>
  );
}

/* ── Room form modal ── */
function RoomFormModal({ hotelId, room, onClose, onSaved }) {
  const isEdit = !!room;
  const [form, setForm]       = useState(isEdit ? {
    roomNumber:   room.roomNumber   ?? '',
    type:         room.type         ?? 'STANDARD',
    pricePerNight: room.pricePerNight ?? '',
    capacity:     room.capacity     ?? '',
    description:  room.description  ?? '',
    amenities:    room.amenities    ?? [],
    images:       room.images       ?? [],
  } : EMPTY_FORM);
  const [errors,     setErrors]     = useState({});
  const [serverErr,  setServerErr]  = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (field, val) => {
    setForm(p => ({ ...p, [field]: val }));
    setErrors(p => ({ ...p, [field]: '' }));
    setServerErr('');
  };

  const toggleAmenity = (a) =>
    set('amenities', form.amenities.includes(a)
      ? form.amenities.filter(x => x !== a)
      : [...form.amenities, a]);

  const validate = () => {
    const e = {};
    if (!form.roomNumber.trim())  e.roomNumber    = 'Nhập số phòng';
    if (!form.pricePerNight)      e.pricePerNight = 'Nhập giá/đêm';
    if (!form.capacity)           e.capacity      = 'Nhập sức chứa';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      hotelId,
      roomNumber:    form.roomNumber.trim(),
      type:          form.type,
      pricePerNight: Number(form.pricePerNight),
      capacity:      Number(form.capacity),
      description:   form.description.trim() || null,
      amenities:     form.amenities,
      images:        form.images,
    };

    setSubmitting(true);
    try {
      if (isEdit) await updateRoom(room.id, payload);
      else        await createRoom(payload);
      onSaved(isEdit ? 'Cập nhật phòng thành công!' : 'Thêm phòng thành công!');
    } catch (err) {
      setServerErr(err.response?.data?.message ?? 'Có lỗi, vui lòng thử lại');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full flex flex-col shadow-2xl overflow-hidden
        animate-[slideInRight_0.25s_ease-out]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? `Sửa phòng ${room.roomNumber}` : 'Thêm phòng mới'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Điền thông tin phòng bên dưới</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center
              transition cursor-pointer text-gray-500 text-lg">✕</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {serverErr && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
              {serverErr}
            </div>
          )}

          {/* Số phòng + Loại */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Số phòng <span className="text-red-500">*</span>
              </label>
              <input value={form.roomNumber} onChange={e => set('roomNumber', e.target.value)}
                placeholder="101, A02..." maxLength={10}
                className={`w-full px-3.5 py-2.5 border-2 rounded-xl text-sm outline-none transition
                  ${errors.roomNumber ? 'border-red-400' : 'border-gray-200 focus:border-blue-500'}`} />
              {errors.roomNumber && <p className="mt-1 text-xs text-red-500">{errors.roomNumber}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Loại phòng</label>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-xl text-sm
                  outline-none focus:border-blue-500 bg-white cursor-pointer">
                {ROOM_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
          </div>

          {/* Giá + Sức chứa */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Giá / đêm (₫) <span className="text-red-500">*</span>
              </label>
              <input type="number" min={0} value={form.pricePerNight}
                onChange={e => set('pricePerNight', e.target.value)}
                placeholder="500000"
                className={`w-full px-3.5 py-2.5 border-2 rounded-xl text-sm outline-none transition
                  ${errors.pricePerNight ? 'border-red-400' : 'border-gray-200 focus:border-blue-500'}`} />
              {errors.pricePerNight && <p className="mt-1 text-xs text-red-500">{errors.pricePerNight}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Sức chứa (khách) <span className="text-red-500">*</span>
              </label>
              <input type="number" min={1} max={20} value={form.capacity}
                onChange={e => set('capacity', e.target.value)}
                placeholder="2"
                className={`w-full px-3.5 py-2.5 border-2 rounded-xl text-sm outline-none transition
                  ${errors.capacity ? 'border-red-400' : 'border-gray-200 focus:border-blue-500'}`} />
              {errors.capacity && <p className="mt-1 text-xs text-red-500">{errors.capacity}</p>}
            </div>
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô tả phòng</label>
            <textarea rows={3} value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Phòng rộng rãi với view biển, nội thất sang trọng..."
              className="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-xl text-sm
                outline-none focus:border-blue-500 resize-none" />
          </div>

          {/* Tiện nghi */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Tiện nghi phòng</label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map(a => {
                const sel = form.amenities.includes(a);
                return (
                  <button key={a} type="button" onClick={() => toggleAmenity(a)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer
                      ${sel
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'}`}>
                    {sel ? '✓ ' : ''}{a}
                  </button>
                );
              })}
            </div>
            {form.amenities.length > 0 && (
              <p className="mt-2 text-xs text-gray-400">Đã chọn: {form.amenities.length} tiện nghi</p>
            )}
          </div>

          {/* Ảnh */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Ảnh phòng</label>
            <ImageUploader images={form.images} onChange={v => set('images', v)} />
            <p className="mt-2 text-xs text-gray-400">JPG, PNG • Ảnh đầu tiên là ảnh đại diện</p>
          </div>
        </form>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex gap-3 bg-white">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-gray-300 rounded-xl
              hover:bg-gray-50 transition cursor-pointer font-medium text-gray-700">
            Hủy
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 py-2.5 text-sm bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300
              text-white rounded-xl transition cursor-pointer font-bold flex items-center justify-center gap-2">
            {submitting ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang lưu...</>
            ) : isEdit ? 'Lưu thay đổi' : '+ Thêm phòng'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete confirm ── */
function ConfirmDelete({ room, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-base font-bold text-gray-900">Xóa phòng {room.roomNumber}?</h3>
        <p className="mt-2 text-sm text-gray-500">
          Phòng sẽ bị đánh dấu xóa và không hiển thị với khách. Thao tác này không thể hoàn tác.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 transition cursor-pointer">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-400
              text-white rounded-xl transition cursor-pointer font-medium">
            {loading ? 'Đang xóa...' : 'Xóa phòng'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Room card ── */
function RoomCard({ room, onEdit, onDelete }) {
  const img = room.images?.[0];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden
      flex flex-col sm:flex-row hover:shadow-md transition-shadow duration-200">

      {/* Thumbnail */}
      <div className="sm:w-40 h-36 sm:h-auto shrink-0 bg-linear-to-br from-slate-100 to-slate-200 overflow-hidden relative">
        {img
          ? <img src={img} alt={room.roomNumber} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">🛏️</div>
        }
        <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-semibold border
          ${TYPE_COLOR[room.type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
          {TYPE_LABEL[room.type] ?? room.type}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-gray-900">Phòng {room.roomNumber}</h3>
              {room.description && (
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">{room.description}</p>
              )}
            </div>
            <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium
              ${STATUS_COLOR[room.status] ?? STATUS_COLOR.MAINTENANCE}`}>
              {STATUS_LABEL[room.status] ?? room.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              {room.capacity} khách
            </span>
            {room.amenities?.slice(0, 3).map(a => (
              <span key={a} className="bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">{a}</span>
            ))}
            {(room.amenities?.length ?? 0) > 3 && (
              <span className="text-gray-400">+{room.amenities.length - 3}</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <p className="text-lg font-extrabold text-blue-700">
            {room.pricePerNight?.toLocaleString('vi-VN')}₫
            <span className="text-xs font-normal text-gray-400"> /đêm</span>
          </p>
          <div className="flex gap-2">
            <button onClick={() => onEdit(room)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-xl
                hover:bg-gray-50 transition cursor-pointer font-medium text-gray-700">
              ✏️ Sửa
            </button>
            <button onClick={() => onDelete(room)}
              className="px-3 py-1.5 text-sm border border-red-200 text-red-600
                hover:bg-red-50 rounded-xl transition cursor-pointer font-medium">
              🗑️ Xóa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════ Main Page ════════════ */
export default function RoomManagementPage() {
  const { id: hotelId } = useParams();
  const navigate        = useNavigate();

  const [hotel,        setHotel]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [editRoom,     setEditRoom]     = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast,        setToast]        = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const reload = () => {
    setLoading(true);
    getHotelById(hotelId)
      .then(res => setHotel(res.data.data))
      .catch(() => navigate('/owner/dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [hotelId]); // eslint-disable-line

  const handleSaved = (msg) => {
    setShowForm(false);
    setEditRoom(null);
    showToast(msg);
    reload();
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteRoom(deleteTarget.id);
      setDeleteTarget(null);
      showToast('Đã xóa phòng.');
      reload();
    } catch (err) {
      showToast(err.response?.data?.message ?? 'Xóa thất bại');
      setDeleteTarget(null);
    } finally { setDeleteLoading(false); }
  };

  const rooms = hotel?.rooms?.filter(r => r.status !== 'DELETED') ?? [];

  /* ── Loading skeleton ── */
  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4 animate-pulse">
        <div className="h-8 bg-white rounded-2xl w-1/3 border border-gray-100" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-36 bg-white rounded-2xl border border-gray-100" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 flex items-center gap-2 mb-6">
          <Link to="/owner/dashboard" className="hover:text-blue-600 transition">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-600 truncate max-w-48">{hotel?.name}</span>
          <span>›</span>
          <span className="text-gray-800 font-medium">Quản lý phòng</span>
        </nav>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Quản lý phòng</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {hotel?.name} · {rooms.length} phòng
            </p>
          </div>
          <button
            onClick={() => { setEditRoom(null); setShowForm(true); }}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800
              text-white text-sm font-bold rounded-xl transition cursor-pointer shadow-sm shadow-blue-900/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/>
            </svg>
            Thêm phòng
          </button>
        </div>

        {/* Stats */}
        {rooms.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Tổng phòng',  value: rooms.length,                                        color: 'text-gray-900'   },
              { label: 'Còn phòng',   value: rooms.filter(r => r.status === 'AVAILABLE').length,   color: 'text-emerald-600' },
              { label: 'Đang bảo trì', value: rooms.filter(r => r.status === 'MAINTENANCE').length, color: 'text-orange-500'  },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
                <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Room list */}
        {rooms.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 border-dashed">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-700">Chưa có phòng nào</h3>
            <p className="text-sm text-gray-400 mt-1 mb-5">Thêm phòng đầu tiên để bắt đầu nhận đặt phòng</p>
            <button onClick={() => { setEditRoom(null); setShowForm(true); }}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm
                font-bold rounded-xl transition cursor-pointer">
              + Thêm phòng đầu tiên
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map(room => (
              <RoomCard key={room.id} room={room}
                onEdit={r => { setEditRoom(r); setShowForm(true); }}
                onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </main>

      {/* Room form drawer */}
      {showForm && (
        <RoomFormModal
          hotelId={hotelId}
          room={editRoom}
          onClose={() => { setShowForm(false); setEditRoom(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDelete
          room={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3
          bg-gray-900 text-white text-sm font-medium rounded-2xl shadow-xl whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
