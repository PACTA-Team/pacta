"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailSection } from "./SettingsPage/EmailSection";
import { CompanySection } from "./SettingsPage/CompanySection";
import { RegistrationSection } from "./SettingsPage/RegistrationSection";
import { GeneralSection } from "./SettingsPage/GeneralSection";
import { NotificationsTab } from "./SettingsPage/NotificationsTab";
import { EmailSettingsTab } from "./SettingsPage/EmailSettingsTab";

export default function SettingsPage() {
  const { t } = useTranslation("settings");
  const [activeTab, setActiveTab] = useState("email");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto gap-1">
          <TabsTrigger value="email" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.email")}
          </TabsTrigger>
          <TabsTrigger value="company" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.company")}
          </TabsTrigger>
          <TabsTrigger value="registration" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.registration")}
          </TabsTrigger>
          <TabsTrigger value="general" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.general")}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.notifications")}
          </TabsTrigger>
          <TabsTrigger value="emailSettings" className="flex-shrink-0 px-3 py-1.5 text-sm">
            {t("tabs.emailSettings")}
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="email">
            <EmailSection />
          </TabsContent>

          <TabsContent value="company">
            <CompanySection />
          </TabsContent>

          <TabsContent value="registration">
            <RegistrationSection />
          </TabsContent>

          <TabsContent value="general">
            <GeneralSection />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>

          <TabsContent value="emailSettings">
            <EmailSettingsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}