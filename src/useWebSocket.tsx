import { useState, useEffect, useCallback } from "react";

interface WebSocketHookResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  sendMessage: (message: string) => void;
}

export function useWebSocket<T>(url: string): WebSocketHookResult<T> {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setLoading(false);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        setData(parsedData);
      } catch (e) {
        setError("Failed to parse WebSocket data");
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
    };

    ws.onclose = () => {
      setError("WebSocket connection closed");
      setLoading(true);
      // 可以在这里添加重连逻辑
      setTimeout(() => connect(), 5000);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, [url]);

  useEffect(() => {
    connect();
  }, [connect]);

  const sendMessage = useCallback(
    (message: string) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      } else {
        setError("WebSocket is not connected");
      }
    },
    [socket]
  );

  return { data, loading, error, sendMessage };
}
