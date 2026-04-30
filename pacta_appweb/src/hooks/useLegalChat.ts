import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

interface UseLegalChatReturn {
  messages: Array<{ role: string; content: string; sources?: any[] }>;
  input: string;
  loading: boolean;
  sessionId: string;
  setInput: (value: string) => void;
  sendMessage: () => Promise<void>;
  clearMessages: () => void;
}

export function useLegalChat(initialSessionId?: string): UseLegalChatReturn {
  const [messages, setMessages] = useState<Array<{ role: string; content: string; sources?: any[] }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId || `legal-${Date.now()}`);

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await api.post<{ session_id: string; reply: string; sources?: any[] }>('/api/ai/legal/chat', {
        message: userMessage,
        session_id: sessionId,
      });

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: res.reply || "No response", 
        sources: res.sources 
      }]);

      // Update session ID if new one returned
      if (res.session_id && res.session_id !== sessionId) {
        setSessionId(res.session_id);
      }
    } catch (err: any) {
      toast.error(err.message || "Error sending message");
      // Remove the user message on error
      setMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
    } finally {
      setLoading(false);
    }
  }, [input, sessionId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSessionId(`legal-${Date.now()}`);
  }, []);

  return {
    messages,
    input,
    loading,
    sessionId,
    setInput,
    sendMessage,
    clearMessages,
  };
}
