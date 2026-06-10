import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../api/auth';

const ROLE_REDIRECT = {
  ADMIN: '/admin/dashboard',
  OWNER: '/owner/dashboard',
  STAFF: '/staff/bookings',
  USER:  '/my-bookings',
};

const HOTEL_BG = 'https://images.unsplash.com/photo-1455587734955-081b22074882?w=1200&q=80';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form,        setForm]        = useState({ email: '', password: '' });
  const [errors,      setErrors]      = useState({});
  const [serverError, setServerError] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showPwd,     setShowPwd]     = useState(false);

  const validate = () => {
    const e = {};
    if (!form.email)                          e.email    = 'Email không được để trống';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email  = 'Email không hợp lệ';
    if (!form.password)                        e.password = 'Mật khẩu không được để trống';
    else if (form.password.length < 6)         e.password = 'Mật khẩu tối thiểu 6 ký tự';
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
      const res = await login(form);
      const { accessToken, refreshToken, user } = res.data.data;
      localStorage.setItem('accessToken',  accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      const from = location.state?.from ?? ROLE_REDIRECT[user.role] ?? '/';
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: dark luxury ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] flex-col relative overflow-hidden bg-[#0A0A0B]">
        <img src={HOTEL_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        <div className="absolute inset-0"
          style={{background:'linear-gradient(160deg,rgba(10,10,11,0.6) 0%,rgba(10,10,11,0.92) 100%)'}} />

        <div className="relative flex flex-col justify-between h-full p-10">
          {/* Logo */}
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

          {/* Bottom content */}
          <div>
          <p
  className="text-4xl text-white font-light leading-snug mb-8"
>
  Trải nghiệm kỳ nghỉ
  <br />
  hoàn hảo bắt đầu từ đây
</p>

            <div className="flex items-center gap-4 mb-3">
              {[['500+','Khách sạn'],['50K+','Lượt khách'],['4.8','Điểm TB']].map(([v,l]) => (
                <div key={l} className="text-center">
                  <p className="text-[#C9A84C] font-bold text-lg leading-none">{v}</p>
                  <p className="text-white/50 text-xs mt-1">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: white form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-6 py-10">
        {/* Mobile logo */}
        <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-[#C9A84C] rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-[#0A0A0B]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900">Hotel<span className="text-[#C9A84C]">Chain</span></span>
        </Link>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Đăng nhập</h1>
          <p className="text-sm text-gray-500 mb-8">Chào mừng bạn trở lại!</p>

          {serverError && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange}
                placeholder="example@gmail.com" autoComplete="email"
                className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition
                  ${errors.email
                    ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                    : 'border-gray-200 focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15'}`} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Mật khẩu</label>
                <Link to="/forgot-password" className="text-xs text-[#C9A84C] hover:underline">
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} placeholder="••••••••" autoComplete="current-password"
                  className={`w-full px-4 py-3 border rounded-xl text-sm outline-none transition pr-11
                    ${errors.password
                      ? 'border-red-400 focus:ring-2 focus:ring-red-100'
                      : 'border-gray-200 focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/15'}`} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                  {showPwd
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#0A0A0B] hover:bg-[#C9A84C] disabled:opacity-60
                text-white hover:text-[#0A0A0B] font-semibold rounded-xl text-sm
                transition-all duration-200 cursor-pointer mt-2">
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-[#C9A84C] font-semibold hover:underline">
              Đăng ký ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
