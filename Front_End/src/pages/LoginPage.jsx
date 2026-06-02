import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { login } from '../api/auth';

const ROLE_REDIRECT = {
  ADMIN: '/admin/dashboard',
  OWNER: '/owner/dashboard',
  STAFF: '/staff/bookings',
  USER: '/my-bookings',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.email) errs.email = 'Email không được để trống';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Email không hợp lệ';
    if (!form.password) errs.password = 'Mật khẩu không được để trống';
    else if (form.password.length < 6) errs.password = 'Mật khẩu tối thiểu 6 ký tự';
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await login(form);
      const { accessToken, refreshToken, user } = res.data.data;

      localStorage.setItem('accessToken', accessToken);
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Hotel Chain</h1>
          <p className="text-gray-500 mt-1 text-sm">Đăng nhập vào tài khoản của bạn</p>
        </div>

        {serverError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="example@gmail.com"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition
                ${errors.email
                  ? 'border-red-400 focus:ring-2 focus:ring-red-200'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition
                ${errors.password
                  ? 'border-red-400 focus:ring-2 focus:ring-red-200'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
              Quên mật khẩu?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
              text-white font-medium rounded-lg text-sm transition cursor-pointer"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-blue-600 font-medium hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
