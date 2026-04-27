"use client";

import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { EmailSection } from "./SettingsPage/EmailSection";
import { CompanySection } from "./SettingsPage/CompanySection";
import { RegistrationSection } from "./SettingsPage/RegistrationSection";
import { GeneralSection } from "./SettingsPage/GeneralSection";
import { NotificationsTab } from "./SettingsPage/NotificationsTab";
import { EmailSettingsTab } from "./SettingsPage/EmailSettingsTab";
import { AISection } from "./SettingsPage/AISection";

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <div className="space-y-6">
        {isAdmin && (
          <>
            <EmailSection />
            <CompanySection />
            <RegistrationSection />
            <AISection />
          </>
        )}
        <GeneralSection />
        <NotificationsTab />
      </div>
    </div>
  );
}