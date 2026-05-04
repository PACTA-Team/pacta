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

const STORAGE_KEY_PREFIX = "legal-chat-";

export function useLegalChat(initialSessionId?: string): UseLegalChatReturn {
  // Load session ID from localStorage or use initial
  const [sessionId, setSessionId] = useState(() => {
    const stored = initialSessionId || localStorage.getItem("legal-chat-session-id");
    if (stored) return stored;
    const newId = `legal-${Date.now()}`;
    localStorage.setItem("legal-chat-session-id", newId);
    return newId;
  });

  // Load messages from localStorage on mount
  const [messages, setMessages] = useState<Array<{ role: string; content: string; sources?: any[] }>>(() => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${sessionId}`, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history:", e);
    }
  }, [messages, sessionId]);

  // Save session ID to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("legal-chat-session-id", sessionId);
  }, [sessionId]);

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await api.post<{ session_id: string; answer: string; sources?: any[] }>('/api/ai/legal/chat', {
        message: userMessage,
        session_id: sessionId,
      });

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: res.answer || "No response", 
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
    const newSessionId = `legal-${Date.now()}`;
    setSessionId(newSessionId);
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
