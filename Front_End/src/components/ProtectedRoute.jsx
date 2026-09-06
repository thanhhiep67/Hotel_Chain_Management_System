import { Navigate, useLocation } from 'react-router-dom';

function isTokenExpired(token) {
  try {
    const exp = JSON.parse(atob(token.split('.')[1])).exp; // seconds
    return exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export default function ProtectedRoute({ children, roles }) {
  const refreshToken = localStorage.getItem('refreshToken');
  const user         = JSON.parse(localStorage.getItem('user') ?? 'null');
  const location     = useLocation();

  // Chỉ redirect khi refresh token không hợp lệ / hết hạn.
  // Access token hết hạn → axios interceptor tự refresh — không cần check ở đây.
  if (!user || !refreshToken || isTokenExpired(refreshToken)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;

  return children;
}
