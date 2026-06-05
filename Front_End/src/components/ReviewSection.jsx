import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHotelReviews, createReview, uploadReviewImage } from '../api/reviews';
import { getMyBookings } from '../api/bookings';

const BASE_URL = 'http://localhost:8080';

/* ── helpers ── */
const fmtDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const avg = (arr, key) => {
  if (!arr.length) return 0;
  return arr.reduce((s, r) => s + (r[key] ?? 0), 0) / arr.length;
};

/* ── StarDisplay ── */
function StarDisplay({ value, size = 'sm' }) {
  const sz = size === 'lg' ? 'w-6 h-6' : size === 'md' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`${sz} ${s <= Math.round(value) ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969
            0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755
            1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118
            l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0
            00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </span>
  );
}

/* ── StarPicker ── */
function StarPicker({ value, onChange, label }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-24 shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="cursor-pointer transition-transform hover:scale-110">
            <svg className={`w-7 h-7 transition-colors
              ${s <= active ? 'text-yellow-400' : 'text-gray-200'}`}
              fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969
                0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755
                1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118
                l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0
                00.951-.69l1.07-3.292z"/>
            </svg>
          </button>
        ))}
        {value > 0 && (
          <span className="ml-1 text-sm font-semibold text-gray-700">
            {['', 'Tệ', 'Không tốt', 'Bình thường', 'Tốt', 'Tuyệt vời'][value]}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── RatingBar ── */
function RatingBar({ star, count, total }) {
  const pct = total > 0 ? Math.round(count / total * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 text-gray-500 text-right">{star}</span>
      <svg className="w-3 h-3 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969
          0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755
          1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118
          l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0
          00.951-.69l1.07-3.292z"/>
      </svg>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 text-gray-400 text-right">{pct}%</span>
    </div>
  );
}

/* ── ReviewCard ── */
function ReviewCard({ review }) {
  const [imgOpen, setImgOpen] = useState(null);
  const initials = review.userName?.split(' ').filter(Boolean).slice(-2)
    .map(w => w[0].toUpperCase()).join('') || '?';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center
            text-blue-700 text-sm font-bold shrink-0">
            {initials}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{review.userName ?? 'Khách hàng'}</p>
            <p className="text-xs text-gray-400">{fmtDate(review.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StarDisplay value={review.overallRating} size="md" />
          <span className="text-sm font-bold text-gray-800">{review.overallRating}.0</span>
        </div>
      </div>

      {/* Sub-criteria */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {[
          { label: 'Vệ sinh',  val: review.cleanlinessRating },
          { label: 'Dịch vụ', val: review.serviceRating },
          { label: 'Vị trí',  val: review.locationRating },
        ].map(({ label, val }) => (
          <div key={label} className="flex items-center gap-1 text-xs text-gray-500">
            <span>{label}</span>
            <StarDisplay value={val} size="sm" />
            <span className="text-gray-400">{val}.0</span>
          </div>
        ))}
      </div>

      {/* Comment */}
      {review.comment && (
        <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
      )}

      {/* Images */}
      {review.images?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.images.map((url, i) => (
            <button key={i} onClick={() => setImgOpen(url)}
              className="w-16 h-16 rounded-xl overflow-hidden border border-gray-100
                hover:opacity-80 transition cursor-pointer shrink-0">
              <img src={BASE_URL + url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Owner reply */}
      {review.ownerReply && (
        <div className="bg-blue-50 border-l-4 border-blue-300 rounded-r-xl px-4 py-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">
            Phản hồi của khách sạn · {fmtDate(review.ownerRepliedAt)}
          </p>
          <p className="text-sm text-blue-800 leading-relaxed">{review.ownerReply}</p>
        </div>
      )}

      {/* Image lightbox */}
      {imgOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImgOpen(null)}>
          <img src={BASE_URL + imgOpen} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}

/* ── ReviewForm ── */
function ReviewForm({ hotelId, eligibleBookings, onSuccess, onCancel }) {
  const [form, setForm] = useState({
    bookingId: eligibleBookings[0]?.id ?? '',
    overallRating: 0, cleanlinessRating: 0, serviceRating: 0, locationRating: 0,
    comment: '',
  });
  const [images,    setImages]    = useState([]); // { file, previewUrl, uploading, uploadedUrl }
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState('');
  const fileRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFilePick = (e) => {
    const files = Array.from(e.target.files ?? []);
    const remaining = 5 - images.length;
    files.slice(0, remaining).forEach(file => {
      setImages(prev => [...prev, {
        file,
        previewUrl: URL.createObjectURL(file),
        uploading: false,
        uploadedUrl: null,
      }]);
    });
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.bookingId) return setError('Vui lòng chọn đặt phòng.');
    if ([form.overallRating, form.cleanlinessRating, form.serviceRating, form.locationRating]
          .some(r => r < 1)) return setError('Vui lòng chọn đủ 4 tiêu chí đánh giá.');

    setSubmitting(true);
    try {
      // Upload images trước
      const uploadedUrls = [];
      for (const img of images) {
        if (img.uploadedUrl) { uploadedUrls.push(img.uploadedUrl); continue; }
        try {
          const res = await uploadReviewImage(img.file);
          uploadedUrls.push(res.data.data);
        } catch { /* bỏ qua ảnh lỗi */ }
      }

      await createReview({ ...form, images: uploadedUrls });
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg === 'Booking đã được đánh giá'
        ? 'Bạn đã đánh giá đặt phòng này rồi.'
        : msg ?? 'Gửi đánh giá thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtBooking = (b) => {
    const ci = b.checkIn ? new Date(b.checkIn + 'T00:00:00')
        .toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' }) : '';
    const co = b.checkOut ? new Date(b.checkOut + 'T00:00:00')
        .toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' }) : '';
    return `Phòng ${b.roomNumber ?? '—'} · ${ci} – ${co}`;
  };

  return (
    <form onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-blue-100 shadow-sm p-6 space-y-5">
      <h3 className="font-bold text-gray-900 text-base">Viết đánh giá của bạn</h3>

      {/* Booking selector */}
      {eligibleBookings.length > 1 && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">Đặt phòng</label>
          <select
            value={form.bookingId}
            onChange={e => set('bookingId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none
              focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white transition">
            {eligibleBookings.map(b => (
              <option key={b.id} value={b.id}>{fmtBooking(b)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Star pickers */}
      <div className="space-y-3">
        <StarPicker label="Tổng thể"  value={form.overallRating}      onChange={v => set('overallRating', v)} />
        <StarPicker label="Vệ sinh"   value={form.cleanlinessRating}   onChange={v => set('cleanlinessRating', v)} />
        <StarPicker label="Dịch vụ"   value={form.serviceRating}       onChange={v => set('serviceRating', v)} />
        <StarPicker label="Vị trí"    value={form.locationRating}      onChange={v => set('locationRating', v)} />
      </div>

      {/* Comment */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1.5">
          Nhận xét
          <span className="text-gray-400 font-normal ml-1">(tuỳ chọn)</span>
        </label>
        <textarea
          value={form.comment}
          onChange={e => set('comment', e.target.value)}
          rows={4}
          placeholder="Chia sẻ trải nghiệm của bạn về phòng, dịch vụ, vị trí..."
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none
            focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition"
        />
      </div>

      {/* Image upload */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">
          Ảnh đính kèm
          <span className="text-gray-400 font-normal ml-1">
            ({images.length}/5)
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {images.map((img, idx) => (
            <div key={idx} className="relative w-16 h-16 shrink-0 group">
              <img src={img.previewUrl} alt=""
                className="w-full h-full object-cover rounded-xl border border-gray-200" />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white
                  rounded-full text-xs flex items-center justify-center opacity-0
                  group-hover:opacity-100 transition cursor-pointer">
                ×
              </button>
            </div>
          ))}
          {images.length < 5 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-16 h-16 shrink-0 border-2 border-dashed border-gray-300
                rounded-xl flex items-center justify-center text-gray-400 text-2xl
                hover:border-blue-400 hover:text-blue-400 transition cursor-pointer">
              +
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple
            onChange={handleFilePick} className="hidden" />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="px-5 py-2 text-sm border border-gray-300 text-gray-600
            rounded-xl hover:bg-gray-50 transition cursor-pointer">
          Hủy
        </button>
        <button type="submit" disabled={submitting}
          className="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
            text-white rounded-xl font-medium transition cursor-pointer">
          {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
        </button>
      </div>
    </form>
  );
}

/* ── Main ReviewSection ── */
export default function ReviewSection({ hotelId, avgRating = 0, reviewCount = 0 }) {
  const navigate = useNavigate();
  const user     = JSON.parse(localStorage.getItem('user') ?? 'null');
  const isUser   = user?.role === 'USER';

  /* review list */
  const [reviews,      setReviews]      = useState([]);
  const [statsReviews, setStatsReviews] = useState([]); // for bar chart
  const [totalPages,   setTotalPages]   = useState(0);
  const [totalEls,     setTotalEls]     = useState(reviewCount);
  const [page,         setPage]         = useState(0);
  const [starFilter,   setStarFilter]   = useState(null);
  const [sort,         setSort]         = useState('newest');
  const [loading,      setLoading]      = useState(false);
  const [successMsg,   setSuccessMsg]   = useState('');

  /* form eligibility */
  const [showForm,         setShowForm]         = useState(false);
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [checkingEligible, setCheckingEligible] = useState(false);

  /* fetch stats (large, once) */
  useEffect(() => {
    getHotelReviews(hotelId, { page: 0, size: 200, sort: 'newest' })
      .then(res => setStatsReviews(res.data.data?.content ?? []))
      .catch(() => {});
  }, [hotelId]);

  /* fetch paginated reviews */
  const fetchReviews = useCallback(() => {
    setLoading(true);
    const params = { page, size: 10, sort };
    if (starFilter) params.rating = starFilter;
    getHotelReviews(hotelId, params)
      .then(res => {
        const data = res.data.data;
        setReviews(data.content ?? []);
        setTotalPages(data.totalPages ?? 0);
        setTotalEls(data.totalElements ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hotelId, page, sort, starFilter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  /* reset page khi đổi filter/sort */
  const changeFilter = (val) => { setStarFilter(val); setPage(0); };
  const changeSort   = (val) => { setSort(val);       setPage(0); };

  /* check eligible bookings */
  const handleWriteReview = async () => {
    if (!user) { navigate('/login'); return; }
    if (!isUser) return;
    setCheckingEligible(true);
    try {
      const res = await getMyBookings({ status: 'CHECKED_OUT', size: 50 });
      const eligible = (res.data.data?.content ?? [])
        .filter(b => b.hotelId === hotelId);
      setEligibleBookings(eligible);
      setShowForm(true);
    } catch {
      setShowForm(true);
    } finally {
      setCheckingEligible(false);
    }
  };

  const handleSuccess = () => {
    setShowForm(false);
    setSuccessMsg('Cảm ơn bạn! Đánh giá của bạn đã được ghi nhận.');
    fetchReviews();
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  /* compute distribution from stats */
  const distribution = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: statsReviews.filter(r => r.overallRating === s).length,
  }));
  const criteriaAvg = {
    cleanliness: avg(statsReviews, 'cleanlinessRating'),
    service:     avg(statsReviews, 'serviceRating'),
    location:    avg(statsReviews, 'locationRating'),
  };

  const displayCount = totalEls || reviewCount;

  // Ưu tiên tính từ statsReviews đã load — tránh hiện 0.0 khi hotel.avgRating
  // chưa được cập nhật (race condition sau khi tạo review đầu tiên)
  const displayAvg = statsReviews.length > 0
    ? parseFloat(avg(statsReviews, 'overallRating').toFixed(1))
    : (avgRating || 0);

  return (
    <section className="space-y-5">

      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">
          Đánh giá khách hàng
        </h2>
        {isUser && !showForm && (
          <button
            onClick={handleWriteReview}
            disabled={checkingEligible}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
              text-white rounded-xl font-medium transition cursor-pointer whitespace-nowrap">
            {checkingEligible ? '...' : '✏️ Viết đánh giá'}
          </button>
        )}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm
          rounded-xl px-4 py-3 flex items-center gap-2">
          <span>✓</span> {successMsg}
        </div>
      )}

      {/* Summary card */}
      {displayCount > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row gap-6">

            {/* Big number */}
            <div className="flex flex-col items-center justify-center shrink-0 sm:w-36">
              <span className="text-5xl font-bold text-gray-900">
                {displayAvg > 0 ? displayAvg.toFixed(1) : '—'}
              </span>
              <div className="mt-2">
                <StarDisplay value={displayAvg} size="md" />
              </div>
              <p className="text-xs text-gray-400 mt-1">{displayCount} đánh giá</p>
            </div>

            {/* Bar chart */}
            <div className="flex-1 space-y-1.5">
              {distribution.map(({ star, count }) => (
                <RatingBar
                  key={star}
                  star={star}
                  count={count}
                  total={statsReviews.length}
                />
              ))}
            </div>

            {/* Criteria */}
            {statsReviews.length > 0 && (
              <div className="flex flex-col gap-2 justify-center sm:w-44 shrink-0">
                {[
                  { label: 'Vệ sinh',  val: criteriaAvg.cleanliness },
                  { label: 'Dịch vụ', val: criteriaAvg.service },
                  { label: 'Vị trí',  val: criteriaAvg.location },
                ].map(({ label, val }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <StarDisplay value={val} size="sm" />
                      <span className="font-semibold text-gray-800 w-6 text-right">
                        {val.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review form */}
      {showForm && (
        eligibleBookings.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
            <span className="text-2xl shrink-0">💡</span>
            <div>
              <p className="font-semibold text-amber-800 text-sm">
                Chưa thể đánh giá
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Bạn cần có đặt phòng đã hoàn thành (trả phòng) tại khách sạn này để để lại đánh giá.
              </p>
              <button onClick={() => setShowForm(false)}
                className="mt-3 text-xs text-amber-600 underline cursor-pointer">
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <ReviewForm
            hotelId={hotelId}
            eligibleBookings={eligibleBookings}
            onSuccess={handleSuccess}
            onCancel={() => setShowForm(false)}
          />
        )
      )}

      {/* Filter + Sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[null, 5, 4, 3, 2, 1].map((s) => (
            <button
              key={s ?? 'all'}
              onClick={() => changeFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full border font-medium transition cursor-pointer
                ${starFilter === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
              {s === null ? 'Tất cả' : `${'★'.repeat(s)} ${s} sao`}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={e => changeSort(e.target.value)}
          className="text-sm px-3 py-1.5 border border-gray-200 rounded-xl
            outline-none focus:border-blue-400 bg-white cursor-pointer">
          <option value="newest">Mới nhất</option>
          <option value="rating_desc">Điểm cao nhất</option>
          <option value="rating_asc">Điểm thấp nhất</option>
        </select>
      </div>

      {/* Review list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-32 animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-16 bg-white rounded-2xl border border-gray-100 text-center">
          <p className="text-4xl mb-3">📝</p>
          <p className="text-gray-500 text-sm">
            {starFilter
              ? `Không có đánh giá ${starFilter} sao nào.`
              : 'Chưa có đánh giá nào. Hãy là người đầu tiên!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200
              text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition cursor-pointer text-sm">
            ‹
          </button>

          {[...Array(totalPages)].map((_, i) => {
            const show = i === 0 || i === totalPages - 1
              || Math.abs(i - page) <= 1;
            const ellipsis = (i === 1 && page > 3)
              || (i === totalPages - 2 && page < totalPages - 4);
            if (!show && !ellipsis) return null;
            if (ellipsis) return <span key={i} className="text-gray-400 text-sm px-1">…</span>;
            return (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm
                  font-medium transition cursor-pointer
                  ${page === i
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {i + 1}
              </button>
            );
          })}

          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200
              text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition cursor-pointer text-sm">
            ›
          </button>
        </div>
      )}
    </section>
  );
}
