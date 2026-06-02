import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/auth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '', role: 'USER' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const errs = {};
    if (!form.fullName.trim()) errs.fullName = 'Họ tên không được để trống';
    if (!form.email) errs.email = 'Email không được để trống';
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Email không hợp lệ';
    if (!form.password) errs.password = 'Mật khẩu không được để trống';
    else if (form.password.length < 6) errs.password = 'Mật khẩu tối thiểu 6 ký tự';
    if (!form.confirmPassword) errs.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    else if (form.confirmPassword !== form.password) errs.confirmPassword = 'Mật khẩu không khớp';
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
      await register({ fullName: form.fullName, email: form.email, password: form.password, role: form.role });
      setSuccess(true);
    } catch (err) {
      setServerError(err.response?.data?.message ?? 'Đăng ký thất bại');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center">
          {form.role === 'OWNER' ? (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Đăng ký thành công!</h2>
              <p className="text-gray-500 text-sm mb-1">Tài khoản Owner của bạn đang chờ Admin duyệt.</p>
              <p className="text-gray-400 text-sm mb-6">Vui lòng đợi thông báo qua email sau khi được phê duyệt.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Đăng ký thành công!</h2>
              <p className="text-gray-500 text-sm mb-6">Tài khoản đã được tạo. Bạn có thể đăng nhập ngay.</p>
            </>
          )}
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition cursor-pointer"
          >
            Đến trang đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Tạo tài khoản</h1>
          <p className="text-gray-500 mt-1 text-sm">Đăng ký để sử dụng Hotel Chain</p>
        </div>

        {serverError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">

          {/* Họ tên */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="Nguyễn Văn A"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition
                ${errors.fullName ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
            />
            {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="example@gmail.com"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition
                ${errors.email ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bạn là</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'USER', label: 'Khách hàng', desc: 'Tìm kiếm & đặt phòng' },
                { value: 'OWNER', label: 'Chủ khách sạn', desc: 'Quản lý khách sạn của bạn' },
              ].map((r) => (
                <label
                  key={r.value}
                  className={`flex flex-col p-3 border-2 rounded-xl cursor-pointer transition
                    ${form.role === r.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={handleChange} className="hidden" />
                  <span className="text-sm font-semibold text-gray-800">{r.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5">{r.desc}</span>
                </label>
              ))}
            </div>
            {form.role === 'OWNER' && (
              <p className="mt-2 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                Tài khoản Owner cần được Admin duyệt trước khi sử dụng.
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition
                ${errors.password ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
            />
            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              className={`w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition
                ${errors.confirmPassword ? 'border-red-400 focus:ring-2 focus:ring-red-200' : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'}`}
            />
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition cursor-pointer"
          >
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}
