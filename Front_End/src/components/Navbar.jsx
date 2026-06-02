import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

const NAV_LINKS = {
  ADMIN: [
    { to: '/admin/dashboard', label: 'Duyệt khách sạn' },
    { to: '/admin/users',     label: 'Người dùng' },
  ],
  OWNER: [
    { to: '/owner/dashboard', label: 'Khách sạn của tôi' },
    { to: '/owner/bookings',  label: 'Quản lý Booking'   },
    { to: '/owner/discounts', label: 'Mã giảm giá'       },
    { to: '/messages',        label: 'Tin nhắn'          },
  ],
  STAFF: [
    { to: '/staff/check-in',  label: 'Check-in'        },
    { to: '/staff/check-out', label: 'Check-out'        },
    { to: '/staff/bookings',  label: 'Quản lý Booking'  },
    { to: '/messages',        label: 'Tin nhắn'         },
  ],
  USER: [
    { to: '/my-bookings', label: 'Đặt phòng của tôi' },
    { to: '/discounts',   label: 'Khuyến mãi'         },
    { to: '/messages',    label: 'Tin nhắn'            },
  ],
};

function fmtRelative(ts) {
  if (!ts) return '';
  const now  = Date.now();
  const ms   = now - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)  return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 7)   return `${days} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

const EVENT_META = {
  BOOKING_CREATED:     { icon: '📩', label: 'Booking mới',           bg: 'hover:bg-gray-50',   color: 'text-gray-900'   },
  BOOKING_CANCELLED:   { icon: '❌', label: 'Khách hủy',             bg: 'hover:bg-red-50',    color: 'text-red-700'    },
  BOOKING_CONFIRMED:   { icon: '✅', label: 'Đặt phòng đã xác nhận', bg: 'hover:bg-green-50',  color: 'text-green-700'  },
  BOOKING_REJECTED:    { icon: '🚫', label: 'Đặt phòng bị từ chối', bg: 'hover:bg-red-50',    color: 'text-red-700'    },
  BOOKING_CHECKED_IN:  { icon: '🏠', label: 'Khách nhận phòng',      bg: 'hover:bg-blue-50',   color: 'text-blue-700'   },
  BOOKING_CHECKED_OUT: { icon: '🧳', label: 'Khách trả phòng',       bg: 'hover:bg-indigo-50', color: 'text-indigo-700' },
  BOOKING_PAID:        { icon: '💳', label: 'Khách đã thanh toán',   bg: 'hover:bg-violet-50', color: 'text-violet-700' },
};

/* ── Notification bell ── */
function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  // Lọc NEW_MESSAGE ra khỏi bell — hiển thị riêng trên tab Tin nhắn
  const bellNotifs = notifications.filter(n => n.type !== 'NEW_MESSAGE');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">

      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition cursor-pointer"
        title="Thông báo">
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor"
          strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002
               6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6
               8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6
               0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Badge — pulse khi có unread */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full
              rounded-full bg-red-400 opacity-60" />
            <span className="relative inline-flex items-center justify-center
              h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl
          border border-gray-100 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">Thông báo</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] font-semibold
                  bg-red-100 text-red-600 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800
                    font-medium transition cursor-pointer">
                  Đánh dấu đã đọc
                </button>
              )}
              {bellNotifs.length > 0 && (
                <button onClick={clearAll}
                  className="text-xs text-gray-400 hover:text-red-500 transition cursor-pointer">
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {bellNotifs.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2 text-gray-400">
                <span className="text-3xl">🔔</span>
                <p className="text-sm">Chưa có thông báo nào</p>
              </div>
            ) : (
              bellNotifs.map((n, i) => {
                const meta = EVENT_META[n.type] ?? EVENT_META.BOOKING_CREATED;
                return (
                  <div key={`${n.type}-${n.referenceId ?? i}-${n.receivedAt}`}
                    className={`px-4 py-3 transition cursor-default ${meta.bg}
                      ${!n.isRead ? 'border-l-2 border-blue-400' : 'border-l-2 border-transparent'}`}>

                    <div className="flex items-start gap-2.5">
                      {/* Unread dot */}
                      <div className="mt-1.5 shrink-0">
                        {!n.isRead
                          ? <span className="block w-2 h-2 rounded-full bg-blue-500" />
                          : <span className="block w-2 h-2" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm shrink-0">{meta.icon}</span>
                            <p className={`text-sm font-medium truncate ${meta.color}`}>
                              {n.title}
                            </p>
                          </div>
                          <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap mt-0.5">
                            {fmtRelative(n.receivedAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {bellNotifs.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 text-center">
              <span className="text-xs text-gray-400">
                {bellNotifs.length} thông báo
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Navbar ── */
export default function Navbar() {
  const navigate       = useNavigate();
  const { pathname }   = useLocation();
  const userStr        = localStorage.getItem('user');
  const user           = userStr ? JSON.parse(userStr) : null;
  const links          = user ? (NAV_LINKS[user.role] ?? []) : [];
  const showBell       = user?.role === 'OWNER' || user?.role === 'STAFF' || user?.role === 'USER';
  const { msgUnreadCount } = useNotifications();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        <div className="flex items-center gap-6">
          <Link to="/" className="text-xl font-bold text-blue-600 tracking-tight shrink-0">
            Hotel Chain
          </Link>

          {links.length > 0 && (
            <div className="hidden sm:flex items-center gap-1">
              {links.map((l) => (
                <Link key={l.to} to={l.to}
                  className={`relative px-3 py-1.5 text-sm rounded-lg transition font-medium
                    ${pathname === l.to || pathname.startsWith('/chat')
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'}`}>
                  {l.label}
                  {l.to === '/messages'
                    && msgUnreadCount > 0
                    && !pathname.startsWith('/messages')
                    && !pathname.startsWith('/chat') && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1
                      bg-blue-600 text-white text-[10px] font-bold rounded-full
                      flex items-center justify-center leading-none">
                      {msgUnreadCount > 9 ? '9+' : msgUnreadCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {showBell && <NotificationBell />}
              <span className="text-sm text-gray-600 hidden sm:block ml-1">
                Xin chào, <span className="font-medium text-gray-800">{user.fullName}</span>
              </span>
              <button onClick={handleLogout}
                className="px-4 py-1.5 text-sm border border-gray-300 rounded-lg
                  hover:bg-gray-50 transition cursor-pointer">
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login"
                className="px-4 py-1.5 text-sm text-gray-700 border border-gray-300
                  rounded-lg hover:bg-gray-50 transition">
                Đăng nhập
              </Link>
              <Link to="/register"
                className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg
                  hover:bg-blue-700 transition">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
