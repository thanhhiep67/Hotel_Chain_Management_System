import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { createHotel, updateHotel, getHotelById } from '../../api/hotels';

/* ── Predefined amenities ── */
const AMENITY_OPTIONS = [
  'WiFi miễn phí', 'Hồ bơi', 'Spa & Massage', 'Nhà hàng', 'Bar & Lounge',
  'Phòng gym', 'Bãi đỗ xe', 'Điều hòa', 'Thang máy', 'Phòng họp',
  'Dịch vụ phòng 24/7', 'Nhận phòng sớm', 'Trả phòng muộn',
  'Đưa đón sân bay', 'Giặt ủi', 'Cho phép thú cưng', 'Bãi biển riêng', 'Sân tennis',
];

/* ── Image uploader ── */
function ImageUploader({ images, onChange }) {
  const inputRef = useRef();

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(
      files.map((file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      }))
    ).then((results) => {
      onChange([...images, ...results]);
      e.target.value = '';
    });
  };

  const remove = (idx) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-wrap gap-3">
      {images.map((src, i) => (
        <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
          <img src={src} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => remove(i)}
            className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100
              transition flex items-center justify-center text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300
          hover:border-blue-400 hover:bg-blue-50 flex flex-col items-center
          justify-center gap-1 transition cursor-pointer"
      >
        <span className="text-2xl text-gray-300">+</span>
        <span className="text-xs text-gray-400">Thêm ảnh</span>
      </button>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
    </div>
  );
}

/* ── Section wrapper ── */
function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  );
}

/* ── Text input ── */
function Field({ label, name, value, onChange, placeholder, type = 'text', error, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 border rounded-xl text-sm outline-none transition
          ${error
            ? 'border-red-400 focus:ring-2 focus:ring-red-100'
            : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ── Main page ── */
export default function HotelFormPage() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const isEdit      = !!id;

  const [form, setForm] = useState({
    name: '', city: '', address: '', description: '', longitude: '', latitude: '',
  });
  const [amenities, setAmenities] = useState([]);
  const [images, setImages]       = useState([]);
  const [errors, setErrors]       = useState({});
  const [serverErr, setServerErr] = useState('');
  const [loading, setLoading]     = useState(false);
  const [fetching, setFetching]   = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    getHotelById(id)
      .then((res) => {
        const h = res.data.data;
        setForm({
          name:        h.name        ?? '',
          city:        h.city        ?? '',
          address:     h.address     ?? '',
          description: h.description ?? '',
          longitude:   h.location?.coordinates?.[0] ?? '',
          latitude:    h.location?.coordinates?.[1] ?? '',
        });
        setAmenities(h.amenities ?? []);
        setImages(h.images ?? []);
      })
      .catch(() => navigate('/owner/dashboard'))
      .finally(() => setFetching(false));
  }, [id, isEdit, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: '' }));
    setServerErr('');
  };

  const toggleAmenity = (item) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())    e.name    = 'Vui lòng nhập tên khách sạn';
    if (!form.city.trim())    e.city    = 'Vui lòng nhập thành phố';
    if (!form.address.trim()) e.address = 'Vui lòng nhập địa chỉ';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      name:        form.name.trim(),
      city:        form.city.trim(),
      address:     form.address.trim(),
      description: form.description.trim(),
      amenities,
      images,
      longitude:   form.longitude ? Number(form.longitude) : null,
      latitude:    form.latitude  ? Number(form.latitude)  : null,
    };

    setLoading(true);
    try {
      if (isEdit) await updateHotel(id, payload);
      else        await createHotel(payload);
      navigate('/owner/dashboard', {
        state: { toast: isEdit ? 'Cập nhật thành công!' : 'Tạo khách sạn thành công! Đang chờ duyệt.' },
      });
    } catch (err) {
      setServerErr(err.response?.data?.message ?? 'Có lỗi xảy ra, vui lòng thử lại');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 flex items-center gap-1 mb-6">
          <Link to="/owner/dashboard" className="hover:text-blue-600 transition">Dashboard</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">
            {isEdit ? 'Chỉnh sửa khách sạn' : 'Thêm khách sạn mới'}
          </span>
        </nav>

        {serverErr && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
            {serverErr}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Thông tin cơ bản */}
          <Section title="Thông tin cơ bản">
            <div className="space-y-4">
              <Field label="Tên khách sạn" name="name" value={form.name}
                onChange={handleChange} placeholder="Grand Hotel Hà Nội"
                error={errors.name} required />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Thành phố" name="city" value={form.city}
                  onChange={handleChange} placeholder="Hà Nội"
                  error={errors.city} required />
                <Field label="Địa chỉ" name="address" value={form.address}
                  onChange={handleChange} placeholder="123 Phố Huế, Hoàn Kiếm"
                  error={errors.address} required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  name="description"
                  rows={4}
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Giới thiệu về khách sạn, vị trí, phong cách, đặc điểm nổi bật..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm
                    outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
                />
              </div>
            </div>
          </Section>

          {/* Tiện ích */}
          <Section title="Tiện ích khách sạn">
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((item) => {
                const selected = amenities.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAmenity(item)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition cursor-pointer
                      ${selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600'}`}
                  >
                    {selected ? '✓ ' : ''}{item}
                  </button>
                );
              })}
            </div>

            {amenities.length > 0 && (
              <p className="mt-3 text-xs text-gray-400">
                Đã chọn: {amenities.length} tiện ích
              </p>
            )}
          </Section>

          {/* Ảnh */}
          <Section title="Ảnh khách sạn">
            <ImageUploader images={images} onChange={setImages} />
            <p className="mt-3 text-xs text-gray-400">
              Chọn từ máy tính • JPG, PNG, WEBP • Ảnh đầu tiên sẽ là ảnh bìa
            </p>
          </Section>

          {/* Vị trí */}
          <Section title="Vị trí (tuỳ chọn)">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Kinh độ" name="longitude" value={form.longitude}
                onChange={handleChange} placeholder="105.8412" type="number" />
              <Field label="Vĩ độ" name="latitude" value={form.latitude}
                onChange={handleChange} placeholder="21.0245" type="number" />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Dùng để hiển thị bản đồ. Có thể bỏ qua nếu chưa có.
            </p>
          </Section>

          {/* Submit */}
          <div className="flex items-center justify-between pt-2 pb-6">
            <Link to="/owner/dashboard"
              className="px-5 py-2.5 text-sm border border-gray-300 rounded-xl
                hover:bg-gray-50 transition text-gray-700">
              Hủy
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700
                disabled:bg-blue-400 text-white text-sm font-medium rounded-xl transition cursor-pointer"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang lưu...</>
                : isEdit ? 'Lưu thay đổi' : '✓ Tạo khách sạn — Chờ duyệt'
              }
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
