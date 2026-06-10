import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

/* ─── nav links (unchanged) ─────────────────────────────────── */
const PUBLIC_NAV_LINKS = [
  { to: '/my-bookings', label: 'Đặt phòng của tôi' },
    { to: '/discounts',   label: 'Khuyến mãi'         },
    { to: '/messages',    label: 'Tin nhắn'            },
];

const NAV_LINKS = {
  ADMIN: [
    { to: '/admin/dashboard', label: 'Duyệt khách sạn' },
    { to: '/admin/users',     label: 'Người dùng'      },
  ],
  OWNER: [
    { to: '/owner/dashboard', label: 'Khách sạn của tôi' },
    { to: '/owner/analytics', label: 'Dashboard'          },
    { to: '/owner/bookings',  label: 'Quản lý Booking'   },
    { to: '/owner/discounts', label: 'Mã giảm giá'       },
    { to: '/messages',        label: 'Tin nhắn'           },
  ],
  STAFF: [
    { to: '/staff/check-in',  label: 'Check-in'       },
    { to: '/staff/check-out', label: 'Check-out'       },
    { to: '/staff/bookings',  label: 'Quản lý Booking' },
    { to: '/messages',        label: 'Tin nhắn'        },
  ],
  USER: [
    { to: '/my-bookings', label: 'Đặt phòng của tôi' },
    { to: '/my-payments', label: 'Lịch sử thanh toán' },
    { to: '/discounts',   label: 'Khuyến mãi'         },
    { to: '/messages',    label: 'Tin nhắn'            },
  ],
};

function fmtRelative(ts) {
  if (!ts) return '';
  const ms   = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)   return 'Vừa xong';
  if (mins < 60)  return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 7)   return `${days} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' });
}

const EVENT_META = {
  BOOKING_CREATED:     { dot:'#C9A84C', label:'Booking mới'            },
  BOOKING_CANCELLED:   { dot:'#f87171', label:'Khách hủy'              },
  BOOKING_CONFIRMED:   { dot:'#4ade80', label:'Đã xác nhận'            },
  BOOKING_REJECTED:    { dot:'#f87171', label:'Bị từ chối'             },
  BOOKING_CHECKED_IN:  { dot:'#60a5fa', label:'Khách nhận phòng'       },
  BOOKING_CHECKED_OUT: { dot:'#a78bfa', label:'Khách trả phòng'        },
  BOOKING_PAID:        { dot:'#34d399', label:'Đã thanh toán'          },
};

/* ─── CSS (injected once) ────────────────────────────────────── */
const NAV_CSS = `

  :root {
    --nav-bg:      #1C1917;
    --nav-border:  rgba(255,255,255,0.07);
    --nav-text:    rgba(242,240,235,0.55);
    --nav-text-h:  #F2F0EB;
    --nav-gold:    #C9A84C;
    --nav-gold-d:  #8A6E30;
    --nav-active:  rgba(201,168,76,0.12);
    --nav-hover:   rgba(255,255,255,0.05);
    --font-d: 'Cormorant Garamond', Georgia, serif;
    --font-b: 'Outfit', system-ui, sans-serif;
    --t: all 0.18s cubic-bezier(0.4,0,0.2,1);
  }

  /* ── nav shell ── */
  .nav-shell {
    position: sticky; top: 0; z-index: 50;
    background: var(--nav-bg);
    border-bottom: 1px solid var(--nav-border);
    backdrop-filter: blur(20px);
    box-shadow: 0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.4);
    font-family: var(--font-b);
  }
  .nav-inner {
    max-width: 1280px; margin: 0 auto;
    padding: 0 28px; height: 60px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 24px;
  }

  /* ── logo ── */
  .nav-logo { display:flex; align-items:center; gap:10px; text-decoration:none; flex-shrink:0; }
  .nav-logo-icon {
    width:32px; height:32px; border-radius:9px;
    background:var(--nav-gold); display:flex; align-items:center; justify-content:center;
    box-shadow: 0 2px 8px rgba(201,168,76,0.35);
  }
  .nav-logo-icon svg { width:16px; height:16px; color:#0C0C0E; }
  .nav-logo-text {
    font-family: var(--font-d); font-size:20px; font-weight:700;
    color: var(--nav-text-h); letter-spacing:-0.01em; line-height:1;
  }
  .nav-logo-text em { font-style:normal; color:var(--nav-gold); }

  /* ── links ── */
  .nav-links { display:flex; align-items:center; gap:2px; flex:1; }
  .nav-link {
    position:relative; padding:7px 13px; border-radius:8px;
    font-size:13px; font-weight:500; color:var(--nav-text);
    text-decoration:none; transition:var(--t); white-space:nowrap;
  }
  .nav-link:hover { color:var(--nav-text-h); background:var(--nav-hover); }
  .nav-link.active { color:var(--nav-gold); background:var(--nav-active); }
  .nav-link-badge {
    position:absolute; top:-4px; right:-4px;
    min-width:17px; height:17px; padding:0 4px;
    background:var(--nav-gold); color:#0C0C0E;
    font-size:10px; font-weight:700; border-radius:9px;
    display:flex; align-items:center; justify-content:center; line-height:1;
  }

  /* ── right actions ── */
  .nav-right { display:flex; align-items:center; gap:6px; flex-shrink:0; }

  /* currency chip */
  .nav-currency {
    display:flex; align-items:center; gap:5px;
    padding:6px 11px; border:1px solid var(--nav-border);
    border-radius:8px; font-size:12px; font-weight:500;
    color:var(--nav-text); cursor:default; transition:var(--t);
  }

  /* bell */
  .nav-bell { position:relative; }
  .nav-bell-btn {
    width:36px; height:36px; border-radius:9px; border:none;
    background:rgba(255,255,255,0.04); border:1px solid var(--nav-border);
    color:var(--nav-text); display:flex; align-items:center; justify-content:center;
    cursor:pointer; transition:var(--t);
  }
  .nav-bell-btn:hover { background:var(--nav-hover); color:var(--nav-text-h); border-color:var(--nav-border); }
  .nav-bell-badge {
    position:absolute; top:-3px; right:-3px;
    display:flex; width:18px; height:18px;
  }
  .nav-bell-ping {
    position:absolute; width:100%; height:100%; border-radius:50%;
    background:rgba(201,168,76,0.5); animation:nb-ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
  }
  .nav-bell-dot {
    position:relative; width:18px; height:18px; border-radius:50%;
    background:var(--nav-gold); color:#0C0C0E;
    font-size:9px; font-weight:800;
    display:flex; align-items:center; justify-content:center; line-height:1;
  }
  @keyframes nb-ping { 75%,100%{transform:scale(1.8);opacity:0} }

  /* dropdown */
  .nav-dropdown {
    position:absolute; right:0; top:calc(100% + 10px);
    width:320px; background:#242018;
    border:1px solid rgba(255,255,255,0.1); border-radius:14px;
    box-shadow:0 16px 48px rgba(0,0,0,0.6); overflow:hidden; z-index:60;
  }
  .nav-dd-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 16px; border-bottom:1px solid rgba(255,255,255,0.06);
  }
  .nav-dd-title { font-size:13px; font-weight:600; color:#F2F0EB; }
  .nav-dd-count {
    font-size:11px; font-weight:600; padding:2px 8px;
    background:rgba(201,168,76,0.15); color:var(--nav-gold);
    border:1px solid rgba(201,168,76,0.25); border-radius:20px;
  }
  .nav-dd-actions { display:flex; align-items:center; gap:10px; }
  .nav-dd-btn {
    font-size:11px; font-weight:500; background:none; border:none;
    cursor:pointer; transition:var(--t); font-family:var(--font-b);
  }
  .nav-dd-btn-read { color:var(--nav-gold); }
  .nav-dd-btn-read:hover { color:#e0bc5e; }
  .nav-dd-btn-clear { color:rgba(242,240,235,0.3); }
  .nav-dd-btn-clear:hover { color:#f87171; }
  .nav-dd-list { max-height:380px; overflow-y:auto; }
  .nav-dd-list::-webkit-scrollbar { width:3px; }
  .nav-dd-list::-webkit-scrollbar-track { background:transparent; }
  .nav-dd-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
  .nav-dd-item {
    display:flex; align-items:flex-start; gap:10px;
    padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.04);
    transition:background 0.15s; cursor:default;
  }
  .nav-dd-item:last-child { border-bottom:none; }
  .nav-dd-item:hover { background:rgba(255,255,255,0.03); }
  .nav-dd-item.unread { background:rgba(201,168,76,0.04); border-left:2px solid var(--nav-gold); padding-left:14px; }
  .nav-dd-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; margin-top:5px; }
  .nav-dd-body { flex:1; min-width:0; }
  .nav-dd-item-title { font-size:12px; font-weight:600; color:#F2F0EB; line-height:1.3; }
  .nav-dd-item-msg { font-size:11px; color:rgba(242,240,235,0.45); margin-top:2px; line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .nav-dd-time { font-size:10px; color:rgba(242,240,235,0.25); white-space:nowrap; flex-shrink:0; margin-top:2px; }
  .nav-dd-empty { padding:40px 16px; text-align:center; }
  .nav-dd-empty-glyph { font-size:28px; color:rgba(255,255,255,0.08); font-family:var(--font-d); margin-bottom:8px; }
  .nav-dd-empty-text { font-size:12px; color:rgba(242,240,235,0.3); }
  .nav-dd-footer { padding:10px 16px; border-top:1px solid rgba(255,255,255,0.06); text-align:center; font-size:11px; color:rgba(242,240,235,0.25); }

  /* avatar + name */
  .nav-avatar {
    width:32px; height:32px; border-radius:50%; flex-shrink:0;
    background:var(--nav-gold); color:#0C0C0E;
    font-size:13px; font-weight:700;
    display:flex; align-items:center; justify-content:center;
    border:1.5px solid rgba(201,168,76,0.4);
    font-family:var(--font-b);
  }
  .nav-username {
    font-size:13px; font-weight:500; color:var(--nav-text);
    max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  }

  /* buttons */
  .nav-btn-logout {
    padding:7px 14px; font-size:12px; font-weight:600; font-family:var(--font-b);
    border:1px solid rgba(255,255,255,0.12); border-radius:8px;
    color:var(--nav-text); background:none; cursor:pointer; transition:var(--t);
  }
  .nav-btn-logout:hover { border-color:rgba(248,113,113,0.35); color:#f87171; background:rgba(248,113,113,0.06); }
  .nav-btn-login {
    padding:7px 16px; font-size:13px; font-weight:500; font-family:var(--font-b);
    border:1px solid rgba(255,255,255,0.12); border-radius:8px;
    color:var(--nav-text); text-decoration:none; transition:var(--t); white-space:nowrap;
  }
  .nav-btn-login:hover { color:var(--nav-text-h); border-color:var(--nav-border); background:var(--nav-hover); }
  .nav-btn-register {
    padding:7px 18px; font-size:13px; font-weight:700; font-family:var(--font-b);
    background:var(--nav-gold); color:#0C0C0E; border:none;
    border-radius:8px; text-decoration:none; transition:var(--t);
    box-shadow:0 2px 10px rgba(201,168,76,0.25); white-space:nowrap;
  }
  .nav-btn-register:hover { background:#e0bc5e; box-shadow:0 4px 16px rgba(201,168,76,0.4); }

  @media(max-width:768px) {
    .nav-links { display:none; }
    .nav-currency { display:none; }
    .nav-username { display:none; }
    .nav-inner { padding:0 16px; }
  }
`;

/* ─── NotificationBell ───────────────────────────────────────── */
function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const bellNotifs = notifications.filter(n => n.type !== 'NEW_MESSAGE');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className="nav-bell" style={{position:'relative'}}>
      <button className="nav-bell-btn" onClick={() => setOpen(v => !v)} title="Thông báo">
        <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unreadCount > 0 && (
          <span className="nav-bell-badge">
            <span className="nav-bell-ping" />
            <span className="nav-bell-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="nav-dropdown">
          {/* Header */}
          <div className="nav-dd-header">
            <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
              <span className="nav-dd-title">Thông báo</span>
              {unreadCount > 0 && <span className="nav-dd-count">{unreadCount} mới</span>}
            </div>
            <div className="nav-dd-actions">
              {unreadCount > 0 && (
                <button className="nav-dd-btn nav-dd-btn-read" onClick={markAllRead}>Đánh dấu đã đọc</button>
              )}
              {bellNotifs.length > 0 && (
                <button className="nav-dd-btn nav-dd-btn-clear" onClick={clearAll}>Xóa tất cả</button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="nav-dd-list">
            {bellNotifs.length === 0 ? (
              <div className="nav-dd-empty">
                <div className="nav-dd-empty-glyph">✦</div>
                <div className="nav-dd-empty-text">Chưa có thông báo nào</div>
              </div>
            ) : (
              bellNotifs.map((n, i) => {
                const meta = EVENT_META[n.type] ?? EVENT_META.BOOKING_CREATED;
                return (
                  <div key={`${n.type}-${n.referenceId ?? i}-${n.receivedAt}`}
                    className={`nav-dd-item ${!n.isRead ? 'unread' : ''}`}>
                    <span className="nav-dd-dot" style={{background: meta.dot}} />
                    <div className="nav-dd-body">
                      <div className="nav-dd-item-title">{n.title}</div>
                      <div className="nav-dd-item-msg">{n.message}</div>
                    </div>
                    <div className="nav-dd-time">{fmtRelative(n.receivedAt)}</div>
                  </div>
                );
              })
            )}
          </div>

          {bellNotifs.length > 0 && (
            <div className="nav-dd-footer">{bellNotifs.length} thông báo</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main Navbar ────────────────────────────────────────────── */
export default function Navbar() {
  const navigate     = useNavigate();
  const { pathname } = useLocation();

  const user    = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
  const links   = user ? (NAV_LINKS[user.role] ?? []) : PUBLIC_NAV_LINKS;
  const showBell = user?.role === 'OWNER' || user?.role === 'STAFF' || user?.role === 'USER';
  const { msgUnreadCount } = useNotifications();

  const handleLogout = () => { localStorage.clear(); navigate('/'); };

  const isActive = (to) => pathname === to || (to !== '/' && pathname.startsWith(to));

  return (
    <>
      <style>{NAV_CSS}</style>
      <nav className="nav-shell">
        <div className="nav-inner">

          {/* ── Logo ── */}
          <Link to="/" className="nav-logo">
            <div className="nav-logo-icon">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
            </div>
            <span className="nav-logo-text">
              Hotel<em>Chain</em>
            </span>
          </Link>

          {/* ── Nav links ── */}
          <div className="nav-links">
            {links.map((l, i) => (
              <Link
                key={`${l.to}-${i}`}
                to={l.to}
                className={`nav-link ${isActive(l.to) ? 'active' : ''}`}
              >
                {l.label}
                {l.to === '/messages'
                  && msgUnreadCount > 0
                  && !pathname.startsWith('/messages')
                  && !pathname.startsWith('/chat') && (
                  <span className="nav-link-badge">
                    {msgUnreadCount > 9 ? '9+' : msgUnreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* ── Right ── */}
          <div className="nav-right">
            {!user && (
              <div className="nav-currency">
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                VND
              </div>
            )}

            {user ? (
              <>
                {showBell && <NotificationBell />}

                {/* Avatar + name */}
                <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'0 4px'}}>
                  <div className="nav-avatar">
                    {user.fullName?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <span className="nav-username">{user.fullName}</span>
                </div>

                <button className="nav-btn-logout" onClick={handleLogout}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-btn-login">Đăng nhập</Link>
                <Link to="/register" className="nav-btn-register">Đăng ký</Link>
              </>
            )}
          </div>

        </div>
      </nav>
    </>
  );
}