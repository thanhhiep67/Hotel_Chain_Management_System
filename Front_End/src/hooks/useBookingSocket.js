import { useEffect, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/**
 * Subscribe to real-time booking notifications for a hotel.
 * Calls onNotification(data) whenever a new booking arrives on the topic.
 * WebSocket chỉ reconnect khi hotelId thay đổi; callback luôn dùng
 * phiên bản mới nhất qua ref — tránh reconnect thừa khi filter đổi.
 */
export default function useBookingSocket(hotelId, onNotification) {
  const callbackRef = useRef(onNotification);

  // Cập nhật ref mỗi render để callback luôn nhìn thấy state mới nhất
  useEffect(() => {
    callbackRef.current = onNotification;
  });

  useEffect(() => {
    if (!hotelId) return;

    const token = localStorage.getItem('accessToken');
    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/hotel/${hotelId}`, (message) => {
          try {
            callbackRef.current(JSON.parse(message.body));
          } catch {
            // malformed message — ignore
          }
        });
      },
    });

    client.activate();

    return () => { client.deactivate(); };
  }, [hotelId]);
}
