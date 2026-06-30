import { useState, useEffect, useRef, lazy, Suspense } from 'react';
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

/* ── Address autocomplete (Nominatim / Vietnam) ── */
function AddressAutocomplete({ value, onChange, onSelect, error }) {
  const [open,    setOpen]    = useState(false);
  const [hits,    setHits]    = useState([]);
  const [busy,    setBusy]    = useState(false);
  const timerRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => {
    const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleInput = (e) => {
    const q = e.target.value;
    onChange(q);
    clearTimeout(timerRef.current);
    if (q.trim().length < 3) { setHits([]); setOpen(false); return; }

    timerRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=vn&limit=7&accept-language=vi`,
          { headers: { 'User-Agent': 'HotelChainApp/1.0' } }
        );
        const data = await res.json();
        setHits(data);
        setOpen(data.length > 0);
      } catch { /* network error — silently ignore */ }
      setBusy(false);
    }, 500);
  };

  const pick = (item) => {
    const a = item.address;
    const streetParts = [
      a.house_number, a.road || a.pedestrian || a.footway,
      a.suburb || a.neighbourhood || a.quarter,
    ].filter(Boolean);
    const street = streetParts.join(' ') || item.display_name.split(',')[0].trim();
    const city   = a.city || a.town || a.city_district || a.county || a.state_district || a.state || '';

    setHits([]); setOpen(false);
    onSelect({ address: street, city, lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Địa chỉ<span className="text-red-500 ml-0.5">*</span>
      </label>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInput}
          onKeyDown={e => e.key === 'Escape' && setOpen(false)}
          placeholder="123 Phố Huế, Hoàn Kiếm, Hà Nội…"
          autoComplete="off"
          className={`w-full px-3 py-2.5 border rounded-xl text-sm outline-none transition pr-9
            ${error
              ? 'border-red-400 focus:ring-2 focus:ring-red-100'
              : 'border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
        />
        {busy && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </span>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {open && hits.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200
          rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {hits.map((item) => {
            const a = item.address;
            const main = [a.house_number, a.road || a.pedestrian || a.footway].filter(Boolean).join(' ')
              || item.display_name.split(',')[0].trim();
            const sub = [
              a.suburb || a.neighbourhood,
              a.city_district || a.town || a.city,
              a.state,
            ].filter(Boolean).join(', ');
            return (
              <li key={item.place_id}
                onMouseDown={e => { e.preventDefault(); pick(item); }}
                className="flex items-start gap-3 px-4 py-3 hover:bg-blue-50 cursor-pointer
                  border-b border-gray-100 last:border-b-0 transition">
                <span className="text-blue-400 mt-0.5 shrink-0">📍</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{main}</div>
                  {sub && <div className="text-xs text-gray-500 truncate mt-0.5">{sub}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
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

/* ── Lazy Leaflet map ── */
const DraggableMap = lazy(() => import('../../components/DraggableMap'))

/* ── Reverse geocode: lat/lng → address + city ── */
async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=vi`,
    { headers: { 'User-Agent': 'HotelChainApp/1.0' } }
  );
  const data = await res.json();
  const a = data.address || {};
  const parts = [a.house_number, a.road, a.suburb || a.quarter || a.neighbourhood].filter(Boolean);
  return {
    address: parts.join(', '),
    city: a.city || a.town || a.county || a.state || '',
  };
}

/* ── Forward geocode: address + city → lat/lng ── */
async function geocodeAddress(address, city) {
  const q = [address, city, 'Việt Nam'].filter(Boolean).join(', ');
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=vn`,
    { headers: { 'User-Agent': 'HotelChainApp/1.0' } }
  );
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
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
  const [geoStatus, setGeoStatus]         = useState(null); // null | 'locating' | 'ok' | 'fail'
  const [reverseStatus, setReverseStatus] = useState(null); // null | 'loading' | 'ok'
  const [mapCenter, setMapCenter]         = useState({ lat: 21.0278, lng: 105.8342 }); // Hà Nội default
  const cityGeoTimer = useRef(null);

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

  // Khi city thay đổi và chưa có tọa độ → geocode thành phố → cập nhật center map
  useEffect(() => {
    if (form.latitude && form.longitude) return; // đã có tọa độ, không cần
    const city = form.city.trim();
    if (!city) return;
    clearTimeout(cityGeoTimer.current);
    cityGeoTimer.current = setTimeout(async () => {
      try {
        const coords = await geocodeAddress('', city);
        if (coords) setMapCenter({ lat: coords.lat, lng: coords.lng });
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(cityGeoTimer.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.city]);

  const handleMapDrag = async (lat, lng) => {
    setForm(f => ({ ...f, latitude: String(lat), longitude: String(lng) }));
    setGeoStatus(null);
    setReverseStatus('loading');
    try {
      const { address, city } = await reverseGeocode(lat, lng);
      setForm(f => ({
        ...f,
        address: address || f.address,
        city:    city    || f.city,
      }));
      setErrors(e => ({ ...e, address: '', city: '' }));
      setReverseStatus('ok');
    } catch {
      setReverseStatus(null);
    }
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

    setLoading(true);
    setServerErr('');

    let lat = form.latitude  ? Number(form.latitude)  : null;
    let lng = form.longitude ? Number(form.longitude) : null;

    // Forward geocode khi thiếu tọa độ
    if (!lat || !lng) {
      setGeoStatus('locating');
      try {
        const coords = await geocodeAddress(form.address.trim(), form.city.trim());
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          setForm(f => ({ ...f, latitude: String(lat), longitude: String(lng) }));
          setGeoStatus('ok');
        } else {
          setGeoStatus('fail');
        }
      } catch {
        setGeoStatus('fail');
      }
    }

    const payload = {
      name:        form.name.trim(),
      city:        form.city.trim(),
      address:     form.address.trim(),
      description: form.description.trim(),
      amenities,
      images,
      longitude:   lng,
      latitude:    lat,
    };

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
                <AddressAutocomplete
                  value={form.address}
                  onChange={val => {
                    setForm(f => ({ ...f, address: val }));
                    setErrors(e => ({ ...e, address: '' }));
                  }}
                  onSelect={({ address, city, lat, lng }) => {
                    setForm(f => ({
                      ...f,
                      address,
                      city: city || f.city,
                      latitude:  String(lat),
                      longitude: String(lng),
                    }));
                    setErrors(e => ({ ...e, address: '', city: '' }));
                  }}
                  error={errors.address}
                />
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
          <Section title="Vị trí">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Kinh độ (Longitude)" name="longitude" value={form.longitude}
                onChange={handleChange} placeholder="105.8412" type="number" />
              <Field label="Vĩ độ (Latitude)" name="latitude" value={form.latitude}
                onChange={handleChange} placeholder="21.0245" type="number" />
            </div>

            {/* Geocode / reverse status */}
            <div className="mt-2 flex items-center gap-2 min-h-5">
              {geoStatus === 'locating' && (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                  <span className="text-xs text-blue-500">Đang xác định tọa độ từ địa chỉ…</span>
                </>
              )}
              {geoStatus === 'ok' && (
                <span className="text-xs text-green-600">
                  ✓ Đã xác định tọa độ — {Number(form.latitude).toFixed(5)}, {Number(form.longitude).toFixed(5)}
                </span>
              )}
              {geoStatus === 'fail' && (
                <span className="text-xs text-amber-500">
                  ⚠ Không tìm được tọa độ — khách sạn sẽ lưu không có bản đồ.
                </span>
              )}
              {reverseStatus === 'loading' && (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin inline-block" />
                  <span className="text-xs text-amber-500">Đang cập nhật địa chỉ…</span>
                </>
              )}
              {reverseStatus === 'ok' && !geoStatus && (
                <span className="text-xs text-green-600">✓ Địa chỉ đã cập nhật theo vị trí marker</span>
              )}
              {!geoStatus && !reverseStatus && (
                <p className="text-xs text-gray-400">
                  Tự điền khi chọn gợi ý địa chỉ · Hoặc nhập thủ công · Để trống → tự geocode khi lưu.
                </p>
              )}
            </div>

            {/* Draggable map — always visible; defaults to Hà Nội if no coords yet */}
            {(() => {
              const hasCoords = !!(
                form.latitude && form.longitude &&
                !isNaN(Number(form.latitude)) && !isNaN(Number(form.longitude))
              );
              const mapLat = hasCoords ? Number(form.latitude)  : mapCenter.lat;
              const mapLng = hasCoords ? Number(form.longitude) : mapCenter.lng;
              return (
                <div className="mt-4">
                  <Suspense fallback={
                    <div className="h-64 bg-gray-100 rounded-xl animate-pulse flex items-center justify-center text-sm text-gray-400">
                      Đang tải bản đồ…
                    </div>
                  }>
                    <DraggableMap
                      lat={mapLat}
                      lng={mapLng}
                      hasCoords={hasCoords}
                      onDragEnd={handleMapDrag}
                    />
                  </Suspense>
                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <span style={{ color: '#C9A84C' }}>✦</span>
                    {hasCoords
                      ? 'Kéo marker để điều chỉnh vị trí chính xác — địa chỉ sẽ tự cập nhật.'
                      : 'Kéo marker đến đúng vị trí khách sạn — tọa độ và địa chỉ sẽ tự điền.'}
                  </p>
                </div>
              );
            })()}
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
