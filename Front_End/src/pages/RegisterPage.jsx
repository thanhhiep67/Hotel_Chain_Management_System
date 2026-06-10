import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/auth';

const HOTEL_BG = 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '', role: 'USER',
  });
  const [errors,      setErrors]      = useState({});
  const [serverError, setServerError] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [success,     setSuccess]     = useState(false);
  const [showPwd,     setShowPwd]     = useState(false);

  const validate = () => {
    const e = {};
    if (!form.fullName.trim())                    e.fullName        = 'Họ tên không được để trống';
    if (!form.email)                              e.email           = 'Email không được để trống';
    else if (!/\S+@\S+\.\S+/.test(form.email))   e.email           = 'Email không hợp lệ';
    if (!form.password)                           e.password        = 'Mật khẩu không được để trống';
    else if (form.password.length < 6)            e.password        = 'Mật khẩu tối thiểu 6 ký tự';
    if (!form.confirmPassword)                    e.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    else if (form.confirmPassword !== form.password) e.confirmPassword = 'Mật khẩu không khớp';
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    setErrors(p => ({ ...p, [name]: '' }));
    setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await register({ fullName: form.fullName, email: form.email, password: form.password, role: form.role });
      setSuccess(true);
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  /* ── Success screen ── */
  if (success) {
    return (
      <div className="min-h-screen bg-[#F7F6F4] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5
            ${form.role === 'OWNER' ? 'bg-[#C9A84C]/15' : 'bg-green-50'}`}>
            {form.role === 'OWNER'
              ? <svg className="w-8 h-8 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              : <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
            }
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Đăng ký thành công!</h2>
          {form.role === 'OWNER' ? (
            <>
              <p className="text-gray-500 text-sm mb-1">Tài khoản Owner đang chờ Admin duyệt.</p>
              <p className="text-gray-400 text-sm mb-6">Bạn sẽ nhận được thông báo qua email.</p>
            </>
          ) : (
            <p className="text-gray-500 text-sm mb-6">Tài khoản đã được tạo. Bạn có thể đăng nhập ngay.</p>
          )}
          <button onClick={() => navigate('/login')}
            className="w-full py-3 bg-[#0A0A0B] hover:bg-[#C9A84C] text-white hover:text-[#0A0A0B]
              font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer">
            Đến trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: dark luxury ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] flex-col relative overflow-hidden bg-[#0A0A0B]">
        <img src={HOTEL_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0"
          style={{background:'linear-gradient(160deg,rgba(10,10,11,0.55) 0%,rgba(10,10,11,0.94) 100%)'}} />

        <div className="relative flex flex-col justify-between h-full p-10">
          <Link to="/" className="flex items-center gap-2.5 w-fit">
            <div className="w-9 h-9 bg-[#C9A84C] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[#0A0A0B]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Hotel<span className="text-[#C9A84C]">Chain</span>
            </span>
          </Link>

          <div>
          <p
  style={{ fontFamily: 'Arial' }}
  className="text-4xl text-white font-light italic leading-snug mb-8"
>
  Tham gia cộng đồng
  <br />
  du lịch đẳng cấp
</p>
            <div className="space-y-3">
              {['Đặt phòng nhanh chóng, an toàn','Hàng nghìn khách sạn toàn quốc','Hỗ trợ 24/7 mọi lúc mọi nơi'].map(t => (
                <div key={t} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#C9A84C]/20 border border-[#C9A84C]/40 flex items-center justify-center shrink-0">
                    <svg className="w-3 h-3 text-[#C9A84C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                    </svg>
                  </div>
                  <span className="text-white/70 text-sm">{t}</span>  
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: white form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-10 overflow-y-auto">
        <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-[#C9A84C] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-[#0A0A0B]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900">Hotel<span className="text-[#C9A84C]">Chain</span></span>
        </Link>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Tạo tài khoản</h1>
          <p className="text-sm text-gray-500 mb-7">Đăng ký để sử dụng Hotel Chain</p>

          {serverError && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Họ tên */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Họ và tên</label>
              <input type="text" name="fullName" value={form.fullName} onChange={handleChange}
                placeholder="Nguyễn Văn A" autoComplete="name"
                className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition
                  ${errors.fullName ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                    : 'border-gray-200 focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15'}`} />
              {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="example@gmail.com" autoComplete="email"
                className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition
                  ${errors.email ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                    : 'border-gray-200 focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15'}`} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bạn là</label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { value: 'USER',  label: 'Khách hàng',    desc: 'Tìm kiếm & đặt phòng' },
                  { value: 'OWNER', label: 'Chủ khách sạn', desc: 'Quản lý khách sạn'     },
                ].map(r => (
                  <label key={r.value}
                    className={`flex flex-col p-3 border-2 rounded-xl cursor-pointer transition-all
                      ${form.role === r.value
                        ? 'border-[#C9A84C] bg-[#C9A84C]/5'
                        : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="role" value={r.value} checked={form.role === r.value}
                      onChange={handleChange} className="hidden" />
                    <span className="text-sm font-semibold text-gray-800">{r.label}</span>
                    <span className="text-xs text-gray-500 mt-0.5">{r.desc}</span>
                  </label>
                ))}
              </div>
              {form.role === 'OWNER' && (
                <p className="mt-2 text-xs text-[#C9A84C] bg-[#C9A84C]/8 border border-[#C9A84C]/25 rounded-xl px-3 py-2">
                  Tài khoản Owner cần Admin duyệt trước khi sử dụng.
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} placeholder="••••••••" autoComplete="new-password"
                  className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition pr-11
                    ${errors.password ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                      : 'border-gray-200 focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15'}`} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPwd
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                      : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                    }
                  </svg>
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Xác nhận mật khẩu</label>
              <input type="password" name="confirmPassword" value={form.confirmPassword}
                onChange={handleChange} placeholder="••••••••" autoComplete="new-password"
                className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition
                  ${errors.confirmPassword ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                    : 'border-gray-200 focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15'}`} />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#0A0A0B] hover:bg-[#C9A84C] disabled:opacity-60
                text-white hover:text-[#0A0A0B] font-semibold rounded-xl text-sm
                transition-all duration-200 cursor-pointer mt-2">
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-[#C9A84C] font-semibold hover:underline">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
