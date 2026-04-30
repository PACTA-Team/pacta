"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChatPanel } from "@/components/legal/ChatPanel";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useLegalChat } from "@/hooks/useLegalChat";

export default function AILegalChatPage() {
  const { t } = useTranslation("legal");
  const [sessionId, setSessionId] = useState<string>(() => {
    return `legal-${Date.now()}`;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/50">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/settings?tab=legal"
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Link>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-indigo-900 bg-clip-text text-transparent">
                  {t('chat.title') || "Asistente Legal Cubano"}
                </h1>
                <p className="text-xs text-slate-500">
                  {t('chat.subtitle') || "Experto en derecho cubano"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="border-slate-200/50 shadow-xl shadow-slate-200/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              {t('chat.sessionTitle') || "Chat Legal"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChatPanel sessionId={sessionId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
