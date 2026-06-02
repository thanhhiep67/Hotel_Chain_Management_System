import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getThreads } from '../api/messages';
import { useNotifications } from '../context/NotificationContext';

/* ── Helpers ── */
function fmtRelative(ts) {
  if (!ts) return '';
  const ms   = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)   return 'Vừa xong';
  if (mins < 60)  return `${mins} phút`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} giờ`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 7)   return `${days} ngày`;
  return new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

const AVATAR_PALETTE = [
  'bg-blue-500',   'bg-violet-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500',   'bg-teal-500',   'bg-indigo-500',  'bg-rose-500',
  'bg-amber-500',  'bg-cyan-500',
];

function avatarBg(name) {
  const code = (name ?? '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}

function Avatar({ name }) {
  const initials = (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  return (
    <div className={`w-12 h-12 rounded-full ${avatarBg(name)} flex items-center justify-center
      text-white text-sm font-bold shrink-0 select-none`}>
      {initials}
    </div>
  );
}

/* ── Thread row skeleton ── */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <div className="h-3.5 w-28 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-3 w-10 bg-gray-100 rounded-full animate-pulse" />
        </div>
        <div className="h-3 w-52 bg-gray-100 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function MessagesPage() {
  const navigate             = useNavigate();
  const user                 = JSON.parse(localStorage.getItem('user') ?? 'null');
  const isUser               = user?.role === 'USER';
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
    getThreads({ page: nextPage, size: PAGE_SIZE })
      .then(res => {
        const data = res.data.data;
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

  const filtered = threads.filter(t => {
    const name = isUser ? t.hotelName : t.userName;
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  const totalUnread = threads.reduce((s, t) => s + (t.unreadCount ?? 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">

        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Tin nhắn</h1>
            {totalUnread > 0 && (
              <span className="px-2.5 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                {totalUnread} chưa đọc
              </span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isUser ? 'Tìm khách sạn...' : 'Tìm khách hàng...'}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200
              rounded-2xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition"
          />
        </div>

        {/* Thread list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {loading ? (
            <div className="divide-y divide-gray-50">
              {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
            </div>

          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <span className="text-5xl">💬</span>
              <p className="text-sm font-medium">
                {search ? 'Không tìm thấy kết quả' : 'Chưa có tin nhắn nào'}
              </p>
              {!search && (
                <p className="text-xs text-gray-300">
                  {isUser ? 'Nhắn tin với khách sạn để bắt đầu' : 'Khách hàng sẽ nhắn tin cho bạn'}
                </p>
              )}
            </div>

          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((thread) => {
                const name      = isUser ? thread.hotelName : thread.userName;
                const hasUnread = (thread.unreadCount ?? 0) > 0;

                return (
                  <button
                    key={thread.threadId}
                    onClick={() => navigate(`/chat/${thread.threadId}`)}
                    className={`w-full flex items-center gap-3.5 px-4 py-4
                      hover:bg-gray-50 active:bg-gray-100 transition text-left cursor-pointer
                      ${hasUnread ? 'bg-blue-50/40' : ''}`}>

                    {/* Avatar + unread dot */}
                    <div className="relative shrink-0">
                      <Avatar name={name} />
                      {hasUnread && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5
                          bg-blue-600 border-2 border-white rounded-full" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <p className={`text-sm truncate
                          ${hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {name ?? '—'}
                        </p>
                        <span className={`text-[11px] shrink-0 whitespace-nowrap
                          ${hasUnread ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                          {fmtRelative(thread.lastMessageAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate leading-relaxed
                          ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                          {thread.lastMessage ?? 'Bắt đầu cuộc trò chuyện...'}
                        </p>
                        {hasUnread && (
                          <span className="shrink-0 min-w-5 h-5 flex items-center justify-center
                            bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5">
                            {thread.unreadCount > 99 ? '99+' : thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-gray-300 mt-4">
            {filtered.length} cuộc trò chuyện
          </p>
        )}

        {!loading && !search && page < totalPages - 1 && (
          <button
            onClick={() => { setPage(p => p + 1); fetchThreads(false); }}
            disabled={loadingMore}
            className="w-full mt-3 py-2.5 text-sm text-blue-600 font-medium
              bg-white border border-gray-100 rounded-2xl shadow-sm
              hover:bg-blue-50 disabled:opacity-50 transition cursor-pointer">
            {loadingMore ? 'Đang tải...' : 'Xem thêm cuộc trò chuyện'}
          </button>
        )}
      </main>
    </div>
  );
}
