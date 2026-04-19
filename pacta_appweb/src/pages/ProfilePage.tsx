"use client";

import { useTranslation } from "react-i18next";
import { ProfileSection } from "./ProfilePage/ProfileSection";
import { PasswordSection } from "./ProfilePage/PasswordSection";
import { CertificatesSection } from "./ProfilePage/CertificatesSection";

export default function ProfilePage() {
  const { t } = useTranslation("profile");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <div className="space-y-6">
        <ProfileSection />
        <PasswordSection />
        <CertificatesSection />
      </div>
    </div>
  );
}