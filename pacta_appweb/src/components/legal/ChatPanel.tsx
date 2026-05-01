"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "./ChatMessage";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Send, Loader2, Trash2 } from "lucide-react";

interface ChatPanelProps {
  sessionId: string;
}

export function ChatPanel({ sessionId }: ChatPanelProps) {
  const { t } = useTranslation("legal");
  const [messages, setMessages] = useState<Array<{role: string; content: string; sources?: any[]}>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
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
        content: res.answer || t('chat.noResponse') || "No response",
        sources: res.sources
      }]);
    } catch (err: any) {
      toast.error(err.message || t('chat.error') || "Error sending message");
      // Remove the user message on error
      setMessages(prev => prev.filter((_, i) => i !== prev.length - 1));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg font-medium">{t('chat.welcome') || "¡Bienvenido al Asistente Legal!"}</p>
              <p className="text-sm mt-2">
                {t('chat.welcomeSubtitle') || "Pregunta sobre leyes, decretos y contratos cubanos"}
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              role={msg.role}
              content={msg.content}
              sources={msg.sources}
            />
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('chat.thinking') || "Pensando..."}</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t p-4 space-y-2">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.inputPlaceholder') || "Escribe tu pregunta sobre derecho cubano..."}
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
          {messages.length > 0 && (
            <Button variant="outline" onClick={handleClear} disabled={loading}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {t('chat.disclaimer') || "Este asistente proporciona información orientativa. No sustituye el asesoramiento legal profesional."}
        </p>
      </div>
    </div>
  );
}
