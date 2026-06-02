import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children, roles }) {
  const token = localStorage.getItem('accessToken');
  const user = JSON.parse(localStorage.getItem('user') ?? 'null');
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;

  return children;
}
