"use client";

import { useLocation, Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Email, Building2, UserPlus, Settings, Bell, Mail } from "lucide-react";
import { EmailSection } from "./SettingsPage/EmailSection";
import { CompanySection } from "./SettingsPage/CompanySection";
import { RegistrationSection } from "./SettingsPage/RegistrationSection";
import { GeneralSection } from "./SettingsPage/GeneralSection";
import { NotificationsTab } from "./SettingsPage/NotificationsTab";
import { EmailSettingsTab } from "./SettingsPage/EmailSettingsTab";

const navigation = [
  { nameKey: "email", href: "/settings/email", icon: Email },
  { nameKey: "company", href: "/settings/company", icon: Building2 },
  { nameKey: "registration", href: "/settings/registration", icon: UserPlus },
  { nameKey: "general", href: "/settings/general", icon: Settings },
  { nameKey: "notifications", href: "/settings/notifications", icon: Bell },
  { nameKey: "emailSettings", href: "/settings/email-settings", icon: Mail },
];

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const location = useLocation();
  const pathname = location.pathname;

  const isActive = (href: string) => pathname === href;

  const navLabels: Record<string, string> = {
    email: t("tabs.email"),
    company: t("tabs.company"),
    registration: t("tabs.registration"),
    general: t("tabs.general"),
    notifications: t("tabs.notifications"),
    emailSettings: t("tabs.emailSettings"),
  };

  const renderContent = () => {
    if (pathname === "/settings/email" || pathname === "/settings") {
      return <EmailSection />;
    }
    if (pathname === "/settings/company") {
      return <CompanySection />;
    }
    if (pathname === "/settings/registration") {
      return <RegistrationSection />;
    }
    if (pathname === "/settings/general") {
      return <GeneralSection />;
    }
    if (pathname === "/settings/notifications") {
      return <NotificationsTab />;
    }
    if (pathname === "/settings/email-settings") {
      return <EmailSettingsTab />;
    }
    return <Navigate to="/settings/email" replace />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <div className="flex border-b overflow-x-auto">
        {navigation.map((item) => {
          const label = navLabels[item.nameKey] || item.nameKey;
          return (
            <Link
              key={item.nameKey}
              to={item.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
                isActive(item.href)
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        {renderContent()}
      </div>
    </div>
  );
}