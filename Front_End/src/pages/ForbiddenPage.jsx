import { useNavigate } from 'react-router-dom';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') ?? 'null');

  const ROLE_REDIRECT = {
    ADMIN: '/admin/dashboard',
    OWNER: '/owner/dashboard',
    STAFF: '/staff/dashboard',
    USER: '/home',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-blue-600 mb-4">403</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Không có quyền truy cập</h1>
        <p className="text-gray-500 text-sm mb-8">Bạn không có quyền vào trang này.</p>
        <button
          onClick={() => navigate(ROLE_REDIRECT[user?.role] ?? '/login')}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition cursor-pointer"
        >
          Về trang chủ
        </button>
      </div>
    </div>
  );
}
