"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { EmailSection } from "./SettingsPage/EmailSection";
import { NotificationsTab } from "./SettingsPage/NotificationsTab";
import { AISection } from "./SettingsPage/AISection";
import { motion, AnimatePresence } from "framer-motion";

type TabType = "email" | "notifications" | "ai";

const TABS: Array<{id: TabType; label: string; icon: string}> = [
  { id: "email", label: "Email Services", icon: "✉️" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "ai", label: "AI Configuration", icon: "🤖" }
];

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<TabType>("email");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case "email":
        return <EmailSection />;
      case "notifications":
        return <NotificationsTab />;
      case "ai":
        return isAdmin ? <AISection /> : <div>AI configuration is only available to admins.</div>;
      default:
        return <EmailSection />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/50">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <span className="text-white font-bold text-lg">⚙️</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-indigo-900 bg-clip-text text-transparent">
                  {t("systemTitle")}
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block">
                  {t("subtitle")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                {user?.role === 'admin' ? 'Admin' : 'User'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar / Tabs */}
          {isMobile ? (
            // Mobile Tabs - Horizontal scroll
            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-5 py-3 rounded-xl font-medium transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                      : "bg-white/80 text-slate-600 hover:bg-white hover:shadow-md border border-slate-200"
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          ) : (
            // Desktop Sidebar
            <div className="w-64 flex-shrink-0">
              <div className="sticky top-24">
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 p-3 shadow-xl shadow-slate-200/20">
                  <div className="space-y-2">
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all duration-300 ${
                          activeTab === tab.id
                            ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span className="text-xl">{tab.icon}</span>
                        <span className="text-left">{tab.label}</span>
                        {activeTab === tab.id && (
                          <div className="ml-auto">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/80" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Quick Stats Card */}
                <div className="mt-4 bg-white/50 backdrop-blur-xl rounded-2xl border border-slate-200/50 p-4 shadow-lg shadow-slate-200/20">
                  <p className="text-xs font-medium text-slate-500 mb-2">System Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-semibold text-slate-800">All systems operational</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Last updated: Just now</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/50 p-6 sm:p-8 shadow-xl shadow-slate-200/20"
              >
                {/* Mobile Tab Header */}
                {isMobile && (
                  <div className="mb-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {TABS.find(t => t.id === activeTab)?.icon}
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          {TABS.find(t => t.id === activeTab)?.label}
                        </h2>
                        <p className="text-xs text-slate-500">
                          Configure your settings
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {renderTabContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
