import { createContext, useContext, useState, useEffect } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getMyHotels } from '../api/hotels';
import { getMyNotifications, markAllNotifRead, clearAllNotifs } from '../api/notifications';

const NotificationContext = createContext(null);

/* ── Chuyển BookingNotification (WebSocket) sang format NotificationResponse (DB) ── */
const FMT_DATE = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('vi-VN') : '—';

const TITLES = {
  BOOKING_CREATED:    { user: 'Booking mới',              hotel: 'Booking mới'             },
  BOOKING_CONFIRMED:  { user: 'Đặt phòng được xác nhận',  hotel: 'Đặt phòng được xác nhận' },
  BOOKING_REJECTED:   { user: 'Đặt phòng bị từ chối',    hotel: 'Đặt phòng bị từ chối'    },
  BOOKING_CANCELLED:  { user: 'Đặt phòng đã hủy',        hotel: 'Khách hủy đặt phòng'     },
  BOOKING_CHECKED_IN: { user: 'Đã nhận phòng',           hotel: 'Khách đã nhận phòng'      },
  BOOKING_CHECKED_OUT:{ user: 'Đã trả phòng',            hotel: 'Khách đã trả phòng'       },
  BOOKING_PAID:       { user: 'Thanh toán thành công',   hotel: 'Khách đã thanh toán'      },
  PAYMENT_SUCCESS:    { user: 'Thanh toán thành công',   hotel: 'Khách đã thanh toán'      },
  PAYMENT_FAILED:     { user: 'Thanh toán thất bại',     hotel: 'Thanh toán thất bại'      },
  NEW_MESSAGE:        { user: 'Tin nhắn mới',            hotel: 'Tin nhắn mới'             },
};

const METHOD_LABEL = { VNPAY: 'VNPay', MOMO: 'MoMo', ZALOPAY: 'ZaloPay', CASH: 'Tiền mặt', CREDIT_CARD: 'Thẻ tín dụng', BANK_TRANSFER: 'Chuyển khoản' };

function normalizeWsEvent(raw, isForUser) {
  const key   = isForUser ? 'user' : 'hotel';
  const title = TITLES[raw.eventType]?.[key] ?? 'Thông báo';

  let message;
  if (raw.eventType?.startsWith('PAYMENT_')) {
    const amt    = raw.amount != null ? raw.amount.toLocaleString('vi-VN') + ' ₫' : '—';
    const method = raw.method ? ` · ${METHOD_LABEL[raw.method] ?? raw.method}` : '';
    message = `${amt}${method}`;
  } else {
    const room   = raw.roomNumber ? `Phòng ${raw.roomNumber}` : '—';
    const dates  = `${FMT_DATE(raw.checkIn)} → ${FMT_DATE(raw.checkOut)}`;
    const guests = raw.guestCount ? `, ${raw.guestCount} khách` : '';
    const reason = raw.cancelReason ? `. Lý do: ${raw.cancelReason}` : '';
    message = `${room}, ${dates}${guests}${reason}`;
  }

  return {
    id:            null,
    type:          raw.eventType,
    title,
    message,
    referenceId:   raw.bookingId,
    referenceType: raw.eventType?.startsWith('PAYMENT_') ? 'PAYMENT' : 'BOOKING',
    hotelId:       raw.hotelId,
    isRead:        false,
    createdAt:     raw.paidAt ?? raw.createdAt ?? new Date().toISOString(),
    receivedAt:    Date.now(),
    paymentId:     raw.paymentId,
    paymentStatus: raw.status,
    amount:        raw.amount,
  };
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [topics,        setTopics]        = useState([]);

  const user    = JSON.parse(localStorage.getItem('user') ?? 'null');
  const isOwner = user?.role === 'OWNER';
  const isStaff = user?.role === 'STAFF';
  const isUser  = user?.role === 'USER';

  /* ── Load từ DB khi mount ── */
  useEffect(() => {
    if (!user) return;
    getMyNotifications({ page: 0, size: 50 })
      .then((res) => {
        const saved = res.data.data?.content ?? [];
        setNotifications(saved.map((n) => ({ ...n, receivedAt: n.createdAt })));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Resolve WebSocket topics ── */
  useEffect(() => {
    if (isStaff && user?.hotelId) {
      setTopics([`/topic/hotel/${user.hotelId}`]);
    } else if (isOwner) {
      getMyHotels()
        .then((res) => {
          const t = (res.data.data ?? []).map((h) => `/topic/hotel/${h.id}`);
          setTopics(t);
        })
        .catch(() => {});
    } else if (isUser) {
      setTopics(['/user/queue/notifications']);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── STOMP clients ── */
  useEffect(() => {
    if (topics.length === 0) return;

    const token = localStorage.getItem('accessToken');
    const connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const clients = topics.map((topic) => {
      const client = new Client({
        webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
        connectHeaders,
        reconnectDelay: 5000,
        onConnect: () => {
          client.subscribe(topic, (message) => {
            try {
              const raw = JSON.parse(message.body);
              const normalized = normalizeWsEvent(raw, isUser);
              setNotifications((prev) => [normalized, ...prev].slice(0, 50));
            } catch {
              // malformed message — ignore
            }
          });
        },
      });
      client.activate();
      return client;
    });

    return () => { clients.forEach((c) => c.deactivate()); };
  }, [topics, isUser]);

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try { await markAllNotifRead(); } catch { /* best-effort */ }
  };

  const clearAll = async () => {
    setNotifications([]);
    try { await clearAllNotifs(); } catch { /* best-effort */ }
  };

  const unreadCount    = notifications.filter((n) => !n.isRead && n.type !== 'NEW_MESSAGE').length;
  const msgUnreadCount = notifications.filter((n) => !n.isRead && n.type === 'NEW_MESSAGE').length;

  // Đánh dấu đã đọc toàn bộ NEW_MESSAGE notifications (gọi khi mở trang chat/messages)
  const clearMsgNotifs = () => {
    setNotifications((prev) =>
      prev.map((n) => n.type === 'NEW_MESSAGE' ? { ...n, isRead: true } : n)
    );
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, markAllRead, clearAll, unreadCount, msgUnreadCount, clearMsgNotifs }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
