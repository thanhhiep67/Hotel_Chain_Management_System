import { Navigate, useLocation } from 'react-router-dom';

function isTokenExpired(token) {
  try {
    const exp = JSON.parse(atob(token.split('.')[1])).exp; // seconds
    return exp * 1000 < Date.now();
  } catch {
    return true; // malformed → treat as expired
  }
}

export default function ProtectedRoute({ children, roles }) {
  const token = localStorage.getItem('accessToken');
  const user  = JSON.parse(localStorage.getItem('user') ?? 'null');
  const location = useLocation();

  // No token, no user, OR access token already expired → go login
  if (!token || !user || isTokenExpired(token)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;

  return children;
}
