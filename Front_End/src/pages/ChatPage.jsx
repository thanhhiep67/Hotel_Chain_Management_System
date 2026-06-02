import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import useChatSocket from '../hooks/useChatSocket';
import {
  getMessages, sendMessage, markMessagesRead, getThreadInfo,
  uploadImage, getOnlineStatus,
} from '../api/messages';
import { useNotifications } from '../context/NotificationContext';

const ROLE_LABEL = { STAFF: 'Nhân viên', OWNER: 'Quản lý', ADMIN: 'Admin' };

/* ── Notification sound ── */
function playMsgSound() {
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  } catch { /* browser blocked audio */ }
}

function fmtMsgTime(iso) {
  if (!iso) return '';
  const d   = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' + time;
}

function DateSeparator({ iso }) {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now.setHours(0,0,0,0) - d.setHours(0,0,0,0)) / 86400000);
  const label = diff === 0 ? 'Hôm nay'
              : diff === 1 ? 'Hôm qua'
              : new Date(iso).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-gray-100" />
      <span className="text-[11px] text-gray-400 px-2 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

function SystemMessage({ content }) {
  return (
    <div className="flex justify-center my-1">
      <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1.5
        rounded-full text-center leading-relaxed max-w-[80%]">
        {content}
      </span>
    </div>
  );
}

/* ── Reply quote strip ── */
function ReplyQuote({ content, onCancel }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-l-4 border-blue-400">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-blue-600 font-medium mb-0.5">Trả lời</p>
        <p className="text-xs text-gray-600 truncate">{content}</p>
      </div>
      {onCancel && (
        <button onClick={onCancel}
          className="shrink-0 p-1 hover:bg-blue-100 rounded-full transition cursor-pointer">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor"
            strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── Message bubble ── */
function Bubble({ msg, isMe, onReply, userRole }) {
  const BASE_URL = 'http://localhost:8080';
  const bookingPath = userRole === 'USER'
    ? `/my-bookings/${msg.bookingId}`
    : userRole === 'OWNER'
      ? `/owner/bookings/${msg.bookingId}`
      : `/staff/bookings/${msg.bookingId}`;

  return (
    <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} group`}>
      {!isMe && (
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center
          text-blue-700 text-xs font-bold shrink-0 mb-1">
          {msg.senderName?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}

      <div className={`flex flex-col gap-0.5 max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
        {!isMe && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs font-medium text-gray-600">{msg.senderName ?? 'Khách sạn'}</span>
            {ROLE_LABEL[msg.senderRole] && (
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100
                text-blue-700 rounded-full font-medium leading-none">
                {ROLE_LABEL[msg.senderRole]}
              </span>
            )}
          </div>
        )}

        {msg.bookingId && (
          <Link
            to={bookingPath}
            className={`flex items-center justify-between gap-3 px-3 py-2 mb-0.5
              rounded-xl border text-left hover:opacity-80 active:opacity-70 transition
              ${isMe
                ? 'bg-blue-700/30 border-blue-400/40 text-blue-100'
                : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">📋</span>
              <div className="min-w-0">
                <p className={`text-[10px] font-medium leading-none mb-0.5
                  ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>
                  Đặt phòng
                </p>
                <p className={`text-xs font-semibold font-mono
                  ${isMe ? 'text-white' : 'text-gray-800'}`}>
                  #{msg.bookingId.slice(-6).toUpperCase()}
                </p>
              </div>
            </div>
            <svg className={`w-3.5 h-3.5 shrink-0 ${isMe ? 'text-blue-300' : 'text-gray-400'}`}
              fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* Reply quote */}
        {msg.replyToContent && (
          <div className={`px-3 py-1.5 rounded-xl text-xs border-l-4 mb-0.5 max-w-full
            ${isMe
              ? 'bg-blue-700/20 border-blue-300 text-blue-100'
              : 'bg-gray-50 border-gray-300 text-gray-500'}`}>
            <p className="truncate">{msg.replyToContent}</p>
          </div>
        )}

        <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isMe
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'}`}>
          {msg.imageUrl && (
            <img
              src={BASE_URL + msg.imageUrl}
              alt="attachment"
              className="max-w-60 max-h-80 rounded-xl mb-1 cursor-pointer object-cover"
              onClick={() => window.open(BASE_URL + msg.imageUrl, '_blank')}
            />
          )}
          {msg.content && <span className="wrap-break-word">{msg.content}</span>}
        </div>

        <div className="flex items-center gap-1.5 px-1">
          <span className="text-[10px] text-gray-400">{fmtMsgTime(msg.createdAt)}</span>
          {isMe && (
            <span className={`text-[11px] leading-none ${msg.isRead ? 'text-blue-500' : 'text-gray-300'}`}>
              {msg.isRead ? '✓✓' : '✓'}
            </span>
          )}
          {/* Reply button — visible on hover */}
          <button
            onClick={() => onReply(msg)}
            className="opacity-0 group-hover:opacity-100 transition p-0.5
              hover:bg-gray-100 rounded cursor-pointer">
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor"
              strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function ChatPage() {
  const { threadId }          = useParams();
  const [searchParams]        = useSearchParams();
  const navigate              = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') ?? 'null');
  const { clearMsgNotifs } = useNotifications();

  const [, hotelId] = threadId?.includes('_') ? threadId.split('_', 2) : ['', ''];
  const threadUserId = threadId?.split('_')[0];

  // Booking context — khi mở chat từ trang BookingDetail
  const [bookingCtx, setBookingCtx] = useState(
    () => searchParams.get('bookingId') ?? null
  );

  const [threadInfo,  setThreadInfo]  = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [page,        setPage]        = useState(0);
  const [totalPages,  setTotalPages]  = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [input,       setInput]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [peerTyping,  setPeerTyping]  = useState(null);
  const [isOnline,    setIsOnline]    = useState(false);

  // Search
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchResult, setSearchResult] = useState(null); // null = not searching
  const [searching,    setSearching]    = useState(false);

  // Image upload
  const [imgPreview,  setImgPreview]  = useState(null);  // { file, url }
  const [uploading,   setUploading]   = useState(false);
  const fileInputRef = useRef(null);

  // Reply
  const [replyTo, setReplyTo] = useState(null); // { id, content }

  const listRef       = useRef(null);
  const typingTimer   = useRef(null);
  const sentTypingRef = useRef(false);
  const bottomRef     = useRef(null);
  const atBottomRef   = useRef(true);
  const prevScrollH   = useRef(0);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  useEffect(() => { clearMsgNotifs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Init */
  useEffect(() => {
    if (!threadId || !hotelId) return;

    Promise.all([
      getThreadInfo(threadId),
      getMessages(threadId, { page: 0, size: 30 }),
    ])
      .then(([tiRes, mRes]) => {
        setThreadInfo(tiRes.data.data);
        const data = mRes.data.data;
        setMessages(data.content ?? []);
        setTotalPages(data.totalPages ?? 0);
        setTimeout(() => scrollToBottom(false), 50);
      })
      .catch(() => {})
      .finally(() => setInitLoading(false));

    markMessagesRead(threadId).catch(() => {});
  }, [threadId, hotelId, scrollToBottom]);

  /* Online status — poll the other party */
  useEffect(() => {
    const otherId = user?.role === 'USER' ? null : threadUserId;
    if (!otherId) return;

    const check = () =>
      getOnlineStatus([otherId])
        .then(res => setIsOnline(res.data.data?.[otherId] ?? false))
        .catch(() => {});

    check();
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, [threadUserId, user?.role]);

  /* Real-time */
  const { publish } = useChatSocket(
    threadId,
    (msg) => {
      if (msg.type === 'READ_RECEIPT') {
        setMessages(prev => prev.map(m =>
          m.senderId === user?.id ? { ...m, isRead: true } : m));
        return;
      }
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      if (atBottomRef.current) setTimeout(scrollToBottom, 30);
      if (msg.senderId !== user?.id) {
        playMsgSound();
        markMessagesRead(threadId).catch(() => {});
      }
    },
    (evt) => {
      if (evt.senderId === user?.id) return;
      if (evt.typing) {
        setPeerTyping(evt.senderName ?? 'Đang gõ');
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setPeerTyping(null), 3000);
      } else {
        setPeerTyping(null);
      }
    }
  );

  /* Scroll + lazy load */
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;

    if (el.scrollTop < 80 && page < totalPages - 1 && !loadingMore && !searchResult) {
      prevScrollH.current = el.scrollHeight;
      setLoadingMore(true);
      const next = page + 1;
      getMessages(threadId, { page: next, size: 30 })
        .then(res => {
          const older = res.data.data?.content ?? [];
          setMessages(prev => [...older, ...prev]);
          setPage(next);
          requestAnimationFrame(() => {
            if (listRef.current)
              listRef.current.scrollTop = listRef.current.scrollHeight - prevScrollH.current;
          });
        })
        .catch(() => {})
        .finally(() => setLoadingMore(false));
    }
  }, [threadId, loadingMore, page, totalPages, searchResult]);

  /* Search */
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) { setSearchResult(null); return; }
    setSearching(true);
    getMessages(threadId, { keyword: searchQuery.trim() })
      .then(res => setSearchResult(res.data.data?.content ?? []))
      .catch(() => setSearchResult([]))
      .finally(() => setSearching(false));
  }, [threadId, searchQuery]);

  const clearSearch = () => { setSearchQuery(''); setSearchResult(null); setSearchOpen(false); };

  /* Image pick */
  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgPreview({ file, url: URL.createObjectURL(file) });
    e.target.value = '';
  };

  /* Send */
  const handleSend = useCallback(async () => {
    const hasText  = input.trim().length > 0;
    const hasImage = !!imgPreview;
    if ((!hasText && !hasImage) || sending) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    try {
      let imageUrl = null;
      if (hasImage) {
        setUploading(true);
        const upRes = await uploadImage(imgPreview.file);
        imageUrl = upRes.data.data;
        setImgPreview(null);
        setUploading(false);
      }

      const payload = {
        threadId,
        content: content || '',
        imageUrl,
        replyToId: replyTo?.id ?? null,
        bookingId:  bookingCtx ?? null,
      };
      setReplyTo(null);
      setBookingCtx(null); // chỉ gắn booking vào tin nhắn đầu tiên

      const res    = await sendMessage(payload);
      const newMsg = res.data.data;
      setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      setTimeout(() => scrollToBottom(true), 30);
    } catch {
      setInput(content);
      setUploading(false);
    } finally {
      setSending(false);
    }
  }, [threadId, input, imgPreview, replyTo, scrollToBottom, sending]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleReply = (msg) => {
    const content = msg.imageUrl && !msg.content ? '[Ảnh]' : msg.content;
    setReplyTo({ id: msg.id, content });
  };

  const hotelName = threadInfo?.hotelName ?? '—';
  const subtitle  = user?.role === 'USER' ? '' : threadInfo?.userName ?? '—';
  const displayMessages = searchResult ?? messages;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Navbar />

      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto
        bg-white shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3 shrink-0">
          <button onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer shrink-0">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor"
              strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center
              text-white text-sm font-bold">
              {hotelName[0] ?? '?'}
            </div>
            {/* Online dot — only shown for staff viewing customer */}
            {user?.role !== 'USER' && (
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white
                ${isOnline ? 'bg-green-400' : 'bg-gray-300'}`} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {initLoading
              ? <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              : <p className="font-semibold text-gray-900 truncate">{hotelName}</p>
            }
            {!initLoading && subtitle && (
              <p className="text-xs text-gray-400 truncate mt-0.5">
                {subtitle}
                {user?.role !== 'USER' && (
                  <span className={`ml-1.5 text-[10px] font-medium
                    ${isOnline ? 'text-green-500' : 'text-gray-400'}`}>
                    {isOnline ? '● Online' : '○ Offline'}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Search toggle */}
          <button onClick={() => setSearchOpen(o => !o)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition cursor-pointer shrink-0">
            <svg className="w-4.5 h-4.5 text-gray-500" fill="none" stroke="currentColor"
              strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 shrink-0">
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Tìm tin nhắn trong cuộc trò chuyện..."
              className="flex-1 text-sm px-3 py-1.5 bg-white border border-gray-200
                rounded-xl outline-none focus:border-blue-400 transition"
            />
            <button onClick={handleSearch} disabled={searching}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-xl
                hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer">
              {searching ? '...' : 'Tìm'}
            </button>
            <button onClick={clearSearch}
              className="text-xs px-2 py-1.5 text-gray-500 hover:text-gray-700
                rounded-xl hover:bg-gray-100 transition cursor-pointer">
              Đóng
            </button>
          </div>
        )}

        {/* Search result banner */}
        {searchResult !== null && (
          <div className="px-4 py-1.5 bg-yellow-50 border-b border-yellow-100 text-xs text-yellow-700 shrink-0">
            {searchResult.length === 0
              ? 'Không tìm thấy kết quả'
              : `${searchResult.length} kết quả cho "${searchQuery}"`}
          </div>
        )}

        {/* Messages */}
        <div ref={listRef} onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {loadingMore && (
            <div className="flex justify-center py-2">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent
                rounded-full animate-spin" />
            </div>
          )}

          {initLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  <div className="h-10 w-48 bg-gray-100 rounded-2xl animate-pulse" />
                </div>
              ))}
            </div>
          ) : displayMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
              <span className="text-4xl">💬</span>
              <p className="text-sm text-center leading-relaxed">
                {searchResult !== null
                  ? 'Không tìm thấy tin nhắn nào'
                  : 'Chưa có tin nhắn nào.\nHãy nhắn tin để được hỗ trợ!'}
              </p>
            </div>
          ) : (
            displayMessages.map((msg, i) => {
              const prev    = displayMessages[i - 1];
              const showSep = !prev || new Date(msg.createdAt).toDateString()
                                        !== new Date(prev.createdAt).toDateString();
              return (
                <div key={msg.id}>
                  {showSep && <DateSeparator iso={msg.createdAt} />}
                  {msg.isSystem
                    ? <SystemMessage content={msg.content} />
                    : <Bubble msg={msg} isMe={msg.senderId === user?.id} onReply={handleReply} userRole={user?.role} />}
                </div>
              );
            })
          )}

          {peerTyping && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center
                text-blue-700 text-xs font-bold shrink-0">
                {peerTyping[0]?.toUpperCase()}
              </div>
              <div className="flex items-center gap-1 px-4 py-2.5 bg-white rounded-2xl
                rounded-bl-md shadow-sm border border-gray-100">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Booking context banner — hiện khi mở chat từ trang BookingDetail */}
        {bookingCtx && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-indigo-50 border-t border-indigo-100 shrink-0">
            <span className="text-base shrink-0">📋</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-indigo-700">Đang hỏi về đặt phòng</p>
              <p className="text-xs text-indigo-500 font-mono truncate">
                #{bookingCtx.slice(-6).toUpperCase()}
              </p>
            </div>
            <button onClick={() => setBookingCtx(null)}
              className="shrink-0 p-1 hover:bg-indigo-100 rounded-full transition cursor-pointer"
              title="Bỏ liên kết booking">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor"
                strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Reply strip */}
        {replyTo && <ReplyQuote content={replyTo.content} onCancel={() => setReplyTo(null)} />}

        {/* Image preview */}
        {imgPreview && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-3 shrink-0">
            <img src={imgPreview.url} alt="preview"
              className="h-16 w-16 object-cover rounded-xl border border-gray-200" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 truncate">{imgPreview.file.name}</p>
              <p className="text-xs text-gray-400">
                {(imgPreview.file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button onClick={() => setImgPreview(null)}
              className="p-1.5 hover:bg-gray-200 rounded-full transition cursor-pointer">
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor"
                strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Input */}
        <div className="flex items-end gap-2 px-4 py-3 bg-white border-t border-gray-100 shrink-0">
          {/* File button */}
          <input ref={fileInputRef} type="file" accept="image/*"
            onChange={handleFilePick} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 w-10 h-10 flex items-center justify-center
              text-gray-400 hover:text-blue-500 hover:bg-blue-50
              rounded-2xl transition cursor-pointer disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor"
              strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 16l4-4a3 3 0 014.24 0L16 16m-2-2l1.59-1.59a3 3 0 014.24 0L20 14
                   M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          <textarea
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (!sentTypingRef.current) {
                sentTypingRef.current = true;
                publish('/app/chat.typing', {
                  threadId, senderName: user?.fullName, senderId: user?.id, typing: true,
                });
                setTimeout(() => {
                  sentTypingRef.current = false;
                  publish('/app/chat.typing', {
                    threadId, senderName: user?.fullName, senderId: user?.id, typing: false,
                  });
                }, 2500);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tin nhắn… (Enter để gửi)"
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 text-sm bg-gray-50 border border-gray-200
              rounded-2xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100
              focus:bg-white transition overflow-y-auto"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />

          <button
            onClick={handleSend}
            disabled={(!input.trim() && !imgPreview) || sending || uploading}
            className="shrink-0 w-10 h-10 flex items-center justify-center
              bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
              text-white rounded-2xl transition cursor-pointer disabled:cursor-not-allowed">
            {(sending || uploading)
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
