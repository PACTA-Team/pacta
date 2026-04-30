"use client";

import { MessageSquare, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex gap-3 max-w-[80%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser 
            ? "bg-indigo-600 text-white" 
            : "bg-gradient-to-br from-emerald-600 to-teal-600 text-white"
        }`}>
          {isUser ? <User className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
        </div>

        {/* Message Bubble */}
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-white border border-slate-200 text-slate-900"
        }`}>
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}
