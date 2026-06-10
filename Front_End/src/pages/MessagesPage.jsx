import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getThreads } from '../api/messages';
import { useNotifications } from '../context/NotificationContext';

/* ─── helpers (unchanged) ────────────────────────────────────── */
function fmtRelative(ts) {
  if (!ts) return '';
  const ms   = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)   return 'Vừa xong';
  if (mins < 60)  return `${mins} phút`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs} giờ`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Hôm qua';
  if (days  < 7)  return `${days} ngày`;
  return new Date(ts).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit'});
}

function avatarColor(name) {
  const COLORS = [
    ['#1a2a1a','#4ade80'],['#1a1a2a','#818cf8'],['#2a1a1a','#f87171'],
    ['#1a221a','#34d399'],['#221a22','#e879f9'],['#1a2222','#22d3ee'],
    ['#22201a','#fbbf24'],['#1a2030','#60a5fa'],
  ];
  const idx = (name ?? '').split('').reduce((s,c)=>s+c.charCodeAt(0),0) % COLORS.length;
  return COLORS[idx];
}

function Avatar({ name, size = 44 }) {
  const initials = (name ?? '?').split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
  const [bg, fg] = avatarColor(name);
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', flexShrink:0,
      background:bg, border:`1.5px solid ${fg}33`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'var(--font-b)', fontSize:size*0.3+'px', fontWeight:700,
      color:fg, userSelect:'none', letterSpacing:'0.04em',
    }}>
      {initials}
    </div>
  );
}

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
  :root {
    --c-bg:     #F7F6F4;
    --c-surf:   #FFFFFF;
    --c-card:   #FFFFFF;
    --c-bdr:    rgba(0,0,0,0.08);
    --c-bdr2:   rgba(0,0,0,0.13);
    --c-gold:   #C9A84C;
    --c-gold-d: #8A6E30;
    --c-text:   #1C1B18;
    --c-muted:  #6B6860;
    --c-subtle: #A09D96;
    --r:        14px;
    --t:        all 0.2s cubic-bezier(0.4,0,0.2,1);
    --font-d:   'Cormorant Garamond', Georgia, serif;
    --font-b:   'Outfit', system-ui, sans-serif;
  }
  .msg-root { background:var(--c-bg); color:var(--c-text); font-family:var(--font-b); min-height:100vh; }
  .msg-wrap { max-width:640px; margin:0 auto; padding:32px 20px 72px; }

  /* header */
  .msg-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:22px; }
  .msg-title { font-family:var(--font-b); font-size:clamp(24px,3vw,32px); font-weight:600; color:var(--c-text); letter-spacing:-0.01em; }
  .msg-unread-badge {
    display:inline-flex; align-items:center; gap:5px;
    padding:5px 12px; background:rgba(201,168,76,0.12);
    border:1px solid rgba(201,168,76,0.25); border-radius:20px;
    font-size:12px; font-weight:600; color:var(--c-gold);
  }
  .msg-unread-dot { width:6px; height:6px; border-radius:50%; background:var(--c-gold); animation:pulse-dot 1.4s ease-in-out infinite; }
  @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.35} }

  /* search */
  .msg-search-wrap { position:relative; margin-bottom:14px; }
  .msg-search-icon { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:var(--c-subtle); pointer-events:none; }
  .msg-search {
    width:100%; padding:11px 14px 11px 38px;
    background:var(--c-card); border:1px solid var(--c-bdr);
    color:var(--c-text); font-family:var(--font-b); font-size:13px;
    border-radius:12px; outline:none; transition:var(--t);
  }
  .msg-search::placeholder { color:var(--c-subtle); }
  .msg-search:focus { border-color:var(--c-gold-d); background:rgba(201,168,76,0.04); }

  /* thread list */
  .msg-list { background:var(--c-card); border:1px solid var(--c-bdr); border-radius:var(--r); overflow:hidden; }

  /* thread row */
  .msg-thread {
    display:flex; align-items:center; gap:13px;
    padding:14px 16px; border-bottom:1px solid var(--c-bdr);
    cursor:pointer; transition:var(--t); text-align:left;
    background:none; border-left:none; border-right:none; border-top:none; width:100%;
    font-family:var(--font-b);
  }
  .msg-thread:last-child { border-bottom:none; }
  .msg-thread:hover { background:rgba(255,255,255,0.03); }
  .msg-thread:active { background:rgba(255,255,255,0.05); }
  .msg-thread.unread { background:rgba(201,168,76,0.04); border-left:2px solid var(--c-gold); padding-left:14px; }
  .msg-thread.unread:hover { background:rgba(201,168,76,0.07); }

  /* avatar wrapper */
  .msg-avatar-wrap { position:relative; flex-shrink:0; }
  .msg-unread-dot-indicator {
    position:absolute; bottom:1px; right:1px;
    width:11px; height:11px; border-radius:50%;
    background:var(--c-gold); border:2px solid var(--c-card);
  }

  /* thread content */
  .msg-content { flex:1; min-width:0; }
  .msg-top-row { display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:3px; }
  .msg-name { font-size:14px; font-weight:500; color:var(--c-muted); truncate:true; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .msg-name.unread { font-weight:600; color:var(--c-text); }
  .msg-time { font-size:11px; color:var(--c-subtle); white-space:nowrap; flex-shrink:0; }
  .msg-time.unread { color:var(--c-gold); font-weight:600; }
  .msg-preview-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .msg-preview { font-size:12px; color:var(--c-subtle); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
  .msg-preview.unread { color:var(--c-muted); font-weight:500; }
  .msg-count-badge {
    flex-shrink:0; min-width:18px; height:18px; padding:0 5px;
    background:var(--c-gold); color:#0A0A0B;
    font-size:10px; font-weight:800; border-radius:9px;
    display:flex; align-items:center; justify-content:center; line-height:1;
  }

  /* skeleton */
  .sk-row { display:flex; align-items:center; gap:13px; padding:14px 16px; border-bottom:1px solid var(--c-bdr); }
  .sk-row:last-child { border-bottom:none; }
  .sk-circle { width:44px; height:44px; border-radius:50%; flex-shrink:0; background:linear-gradient(90deg,#1e1e22 25%,#252529 50%,#1e1e22 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
  .sk-lines { flex:1; display:flex; flex-direction:column; gap:8px; }
  .sk-line { height:11px; border-radius:6px; background:linear-gradient(90deg,#1e1e22 25%,#252529 50%,#1e1e22 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* empty */
  .msg-empty { padding:64px 20px; text-align:center; }
  .msg-empty-glyph { font-family:var(--font-b); font-size:48px; color:rgba(255,255,255,0.06); margin-bottom:12px; }
  .msg-empty-title { font-size:15px; font-weight:600; color:var(--c-text); margin-bottom:5px; }
  .msg-empty-sub { font-size:12px; color:var(--c-subtle); }

  /* footer info + load more */
  .msg-footer-count { text-align:center; font-size:11px; color:var(--c-subtle); margin-top:12px; }
  .msg-load-more {
    width:100%; margin-top:10px; padding:12px;
    background:var(--c-card); border:1px solid var(--c-bdr);
    color:var(--c-muted); font-size:13px; font-weight:500;
    border-radius:12px; cursor:pointer; transition:var(--t); font-family:var(--font-b);
  }
  .msg-load-more:hover:not(:disabled) { border-color:var(--c-gold-d); color:var(--c-gold); background:rgba(201,168,76,0.04); }
  .msg-load-more:disabled { opacity:0.4; cursor:not-allowed; }

  @media(max-width:480px) { .msg-wrap { padding:20px 12px 48px; } }
`;

/* ─── Skeleton row ───────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <div className="sk-row">
      <div className="sk-circle" />
      <div className="sk-lines">
        <div style={{display:'flex',justifyContent:'space-between',gap:'8px'}}>
          <div className="sk-line" style={{width:'40%'}} />
          <div className="sk-line" style={{width:'15%'}} />
        </div>
        <div className="sk-line" style={{width:'70%'}} />
      </div>
    </div>
  );
}

/* ════════════════ Main Page ════════════════ */
export default function MessagesPage() {
  const navigate = useNavigate();
  const user     = JSON.parse(localStorage.getItem('user') ?? 'null');
  const isUser   = user?.role === 'USER';
  const { clearMsgNotifs, notifications } = useNotifications();

  const PAGE_SIZE = 20;
  const [threads,     setThreads]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page,        setPage]        = useState(0);
  const [totalPages,  setTotalPages]  = useState(0);
  const [search,      setSearch]      = useState('');

  const fetchThreads = useCallback((reset = false) => {
    const nextPage = reset ? 0 : page;
    if (!reset) setLoadingMore(true);
    getThreads({ page:nextPage, size:PAGE_SIZE })
      .then(res => {
        const data  = res.data.data;
        const items = data.content ?? [];
        setThreads(prev => reset ? items : [...prev, ...items]);
        setTotalPages(data.totalPages ?? 0);
        if (reset) setPage(0);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [page]);

  useEffect(() => {
    clearMsgNotifs();
    setLoading(true);
    fetchThreads(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const latest = notifications[0];
    if (latest?.type !== 'NEW_MESSAGE') return;
    fetchThreads(true);
  }, [notifications, fetchThreads]);

  const filtered     = threads.filter(t => {
    const name = isUser ? t.hotelName : t.userName;
    return name?.toLowerCase().includes(search.toLowerCase());
  });
  const totalUnread  = threads.reduce((s,t) => s + (t.unreadCount ?? 0), 0);

  return (
    <>
      <style>{CSS}</style>
      <div className="msg-root">
        <Navbar />
        <div className="msg-wrap">

          {/* Header */}
          <div className="msg-header">
            <div className="msg-title">Tin nhắn</div>
            {totalUnread > 0 && (
              <div className="msg-unread-badge">
                <span className="msg-unread-dot" />
                {totalUnread} chưa đọc
              </div>
            )}
          </div>

          {/* Search */}
          <div className="msg-search-wrap">
            <span className="msg-search-icon">
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
              </svg>
            </span>
            <input
              className="msg-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isUser ? 'Tìm khách sạn...' : 'Tìm khách hàng...'}
            />
          </div>

          {/* Thread list */}
          <div className="msg-list">
            {loading ? (
              [...Array(5)].map((_,i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <div className="msg-empty">
                <div className="msg-empty-glyph">✦</div>
                <div className="msg-empty-title">
                  {search ? 'Không tìm thấy kết quả' : 'Chưa có tin nhắn nào'}
                </div>
                <div className="msg-empty-sub">
                  {!search && (isUser ? 'Nhắn tin với khách sạn để bắt đầu' : 'Khách hàng sẽ nhắn tin cho bạn')}
                </div>
              </div>
            ) : (
              filtered.map(thread => {
                const name      = isUser ? thread.hotelName : thread.userName;
                const hasUnread = (thread.unreadCount ?? 0) > 0;
                return (
                  <button
                    key={thread.threadId}
                    className={`msg-thread ${hasUnread ? 'unread' : ''}`}
                    onClick={() => navigate(`/chat/${thread.threadId}`)}
                  >
                    {/* Avatar */}
                    <div className="msg-avatar-wrap">
                      <Avatar name={name} />
                      {hasUnread && <span className="msg-unread-dot-indicator" />}
                    </div>

                    {/* Content */}
                    <div className="msg-content">
                      <div className="msg-top-row">
                        <span className={`msg-name ${hasUnread ? 'unread' : ''}`}>{name ?? '—'}</span>
                        <span className={`msg-time ${hasUnread ? 'unread' : ''}`}>
                          {fmtRelative(thread.lastMessageAt)}
                        </span>
                      </div>
                      <div className="msg-preview-row">
                        <span className={`msg-preview ${hasUnread ? 'unread' : ''}`}>
                          {thread.lastMessage ?? 'Bắt đầu cuộc trò chuyện...'}
                        </span>
                        {hasUnread && (
                          <span className="msg-count-badge">
                            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div className="msg-footer-count">{filtered.length} cuộc trò chuyện</div>
          )}

          {!loading && !search && page < totalPages - 1 && (
            <button
              className="msg-load-more"
              onClick={() => { setPage(p => p+1); fetchThreads(false); }}
              disabled={loadingMore}
            >
              {loadingMore ? 'Đang tải...' : 'Xem thêm cuộc trò chuyện'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}