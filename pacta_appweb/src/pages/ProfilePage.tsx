"use client";

import { useLocation, Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { User, Key, Award } from "lucide-react";
import { ProfileSection } from "./ProfilePage/ProfileSection";
import { PasswordSection } from "./ProfilePage/PasswordSection";
import { CertificatesSection } from "./ProfilePage/CertificatesSection";

const navigation = [
  { nameKey: "profile", href: "/profile/profile", icon: User },
  { nameKey: "password", href: "/profile/password", icon: Key },
  { nameKey: "certificates", href: "/profile/certificates", icon: Award },
];

export default function ProfilePage() {
  const { t } = useTranslation("profile");
  const location = useLocation();
  const pathname = location.pathname;

  const isActive = (href: string) => pathname === href;

  const navLabels: Record<string, string> = {
    profile: t("tabs.profile"),
    password: t("tabs.password"),
    certificates: t("tabs.certificates"),
  };

  const renderContent = () => {
    if (pathname === "/profile/profile" || pathname === "/profile") {
      return <ProfileSection />;
    }
    if (pathname === "/profile/password") {
      return <PasswordSection />;
    }
    if (pathname === "/profile/certificates") {
      return <CertificatesSection />;
    }
    return <Navigate to="/profile/profile" replace />;
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