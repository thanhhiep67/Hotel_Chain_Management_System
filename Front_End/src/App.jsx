import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { NotificationProvider } from './context/NotificationContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForbiddenPage from './pages/ForbiddenPage';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import HotelDetailPage from './pages/HotelDetailPage';
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';
import AnalyticsDashboardPage from './pages/owner/AnalyticsDashboardPage';
import HotelFormPage from './pages/owner/HotelFormPage';
import AdminHotelsPage from './pages/admin/AdminHotelsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import BookingPage from './pages/BookingPage';
import MyBookingsPage from './pages/MyBookingsPage';
import BookingDetailPage from './pages/BookingDetailPage';
import PaymentPage from './pages/PaymentPage';
import PaymentResultPage from './pages/PaymentResultPage';
import PaymentHistoryPage from './pages/PaymentHistoryPage';
import HotelBookingsPage from './pages/HotelBookingsPage';
import HotelBookingDetailPage from './pages/HotelBookingDetailPage';
import DiscountsPage from './pages/owner/DiscountsPage';
import RoomManagementPage from './pages/owner/RoomManagementPage';
import DiscountsPublicPage from './pages/DiscountsPublicPage';
import StaffCheckInPage from './pages/staff/StaffCheckInPage';
import StaffCheckOutPage from './pages/staff/StaffCheckOutPage';
import ChatPage from './pages/ChatPage';
import MessagesPage from './pages/MessagesPage';

function App() {
  return (
    <NotificationProvider>
    <BrowserRouter>
      <Routes>

        {/* ── Public (không cần login) ── */}
        <Route path="/" element={<HomePage />} />
        <Route path="/hotels" element={<div className="flex items-center justify-center min-h-screen text-2xl">Danh sách Hotel</div>} />
        <Route path="/hotels/:id" element={<HotelDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<div className="flex items-center justify-center min-h-screen text-2xl">Quên mật khẩu</div>} />
        <Route path="/403" element={<ForbiddenPage />} />

        {/* ── USER (cần login) ── */}
        <Route path="/booking" element={
          <ProtectedRoute roles={['USER']}><BookingPage /></ProtectedRoute>
        } />
        <Route path="/my-bookings" element={
          <ProtectedRoute roles={['USER']}><MyBookingsPage /></ProtectedRoute>
        } />
        <Route path="/my-bookings/:id" element={
          <ProtectedRoute roles={['USER']}><BookingDetailPage /></ProtectedRoute>
        } />
        <Route path="/payment/:bookingId" element={
          <ProtectedRoute roles={['USER']}><PaymentPage /></ProtectedRoute>
        } />
        <Route path="/payment-result" element={
          <ProtectedRoute roles={['USER']}><PaymentResultPage /></ProtectedRoute>
        } />
        <Route path="/my-payments" element={
          <ProtectedRoute roles={['USER']}><PaymentHistoryPage /></ProtectedRoute>
        } />
        <Route path="/chat/:threadId" element={
          <ProtectedRoute roles={['USER', 'STAFF', 'OWNER']}><ChatPage /></ProtectedRoute>
        } />
        <Route path="/messages" element={
          <ProtectedRoute roles={['USER', 'STAFF', 'OWNER']}><MessagesPage /></ProtectedRoute>
        } />
        <Route path="/discounts" element={
          <ProtectedRoute roles={['USER']}><DiscountsPublicPage /></ProtectedRoute>
        } />

        {/* ── ADMIN ── */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute roles={['ADMIN']}><AdminHotelsPage /></ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['ADMIN']}><AdminUsersPage /></ProtectedRoute>
        } />

        {/* ── OWNER ── */}
        <Route path="/owner/dashboard" element={
          <ProtectedRoute roles={['OWNER']}><OwnerDashboardPage /></ProtectedRoute>
        } />
        <Route path="/owner/analytics" element={
          <ProtectedRoute roles={['OWNER']}><AnalyticsDashboardPage /></ProtectedRoute>
        } />
        <Route path="/owner/hotels/new" element={
          <ProtectedRoute roles={['OWNER']}><HotelFormPage /></ProtectedRoute>
        } />
        <Route path="/owner/hotels/:id/edit" element={
          <ProtectedRoute roles={['OWNER']}><HotelFormPage /></ProtectedRoute>
        } />
        <Route path="/owner/hotels/:id/rooms" element={
          <ProtectedRoute roles={['OWNER']}><RoomManagementPage /></ProtectedRoute>
        } />
        <Route path="/owner/bookings" element={
          <ProtectedRoute roles={['OWNER']}><HotelBookingsPage /></ProtectedRoute>
        } />
        <Route path="/owner/bookings/:id" element={
          <ProtectedRoute roles={['OWNER']}><HotelBookingDetailPage /></ProtectedRoute>
        } />
        <Route path="/owner/discounts" element={
          <ProtectedRoute roles={['OWNER']}><DiscountsPage /></ProtectedRoute>
        } />

        {/* ── STAFF ── */}
        <Route path="/staff/check-in" element={
          <ProtectedRoute roles={['STAFF']}><StaffCheckInPage /></ProtectedRoute>
        } />
        <Route path="/staff/check-out" element={
          <ProtectedRoute roles={['STAFF']}><StaffCheckOutPage /></ProtectedRoute>
        } />
        <Route path="/staff/bookings" element={
          <ProtectedRoute roles={['STAFF']}><HotelBookingsPage /></ProtectedRoute>
        } />
        <Route path="/staff/bookings/:id" element={
          <ProtectedRoute roles={['STAFF']}><HotelBookingDetailPage /></ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={<ForbiddenPage />} />
      </Routes>
    </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
