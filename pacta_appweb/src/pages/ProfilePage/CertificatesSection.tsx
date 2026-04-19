"use client";

import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function CertificatesSection() {
  const { t } = useTranslation("profile");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("certificatesTitle")}</CardTitle>
          <Button>{t("upload")}</Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{t("certificatesEmpty")}</p>
      </CardContent>
    </Card>
  );
}