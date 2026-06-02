import { useEffect, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

/**
 * Manages the WebSocket connection for a chat thread.
 * - Subscribes to /topic/chat/{threadId} for messages
 * - Subscribes to /topic/chat/{threadId}.typing for typing events
 * - Returns { publish } to send typing events via /app/chat.typing
 */
export default function useChatSocket(threadId, onMessage, onTyping) {
  const msgRef    = useRef(onMessage);
  const typingRef = useRef(onTyping);
  const clientRef = useRef(null);

  useEffect(() => { msgRef.current    = onMessage; });
  useEffect(() => { typingRef.current = onTyping;  });

  useEffect(() => {
    if (!threadId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
      reconnectDelay: 5000,
      // beforeConnect chạy trước mỗi lần kết nối/reconnect — luôn đọc token mới nhất từ localStorage
      beforeConnect: () => {
        const token = localStorage.getItem('accessToken');
        client.connectHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      },
      onConnect: () => {
        client.subscribe(`/topic/chat/${threadId}`, (frame) => {
          try { msgRef.current?.(JSON.parse(frame.body)); } catch { /* ignore */ }
        });
        client.subscribe(`/topic/chat/${threadId}.typing`, (frame) => {
          try { typingRef.current?.(JSON.parse(frame.body)); } catch { /* ignore */ }
        });
      },
    });

    client.activate();
    clientRef.current = client;
    return () => { client.deactivate(); clientRef.current = null; };
  }, [threadId]);

  const publish = useCallback((destination, body) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish({ destination, body: JSON.stringify(body) });
    }
  }, []);

  return { publish };
}
