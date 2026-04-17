"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { contractExpirySettingsAPI, ContractExpirySettings } from "@/lib/contract-expiry-settings-api";
import { toast } from "sonner";

export function NotificationsTab() {
  const { t } = useTranslation("settings");
  const [thresholds, setThresholds] = useState<number[]>([30, 15, 7]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    contractExpirySettingsAPI
      .get()
      .then((data: ContractExpirySettings) => {
        if (data.thresholds_days && data.thresholds_days.length > 0) {
          setThresholds(data.thresholds_days);
        }
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load notification settings");
        setLoading(false);
      });
  }, []);

  const handleAddThreshold = () => {
    setThresholds((prev) => [...prev, 7]);
  };

  const handleRemoveThreshold = (index: number) => {
    if (thresholds.length > 1) {
      setThresholds((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleThresholdChange = (index: number, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setThresholds((prev) => {
        const next = [...prev];
        next[index] = num;
        return next;
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await contractExpirySettingsAPI.update({ thresholds_days: thresholds });
      toast.success(t("saveSuccess"));
    } catch {
      toast.error(t("saveError"));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notificationsTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label>{t("thresholdsLabel")}</Label>
          <p className="text-xs text-muted-foreground">{t("thresholdHelp")}</p>

          <div className="space-y-3">
            {thresholds.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={value}
                  onChange={(e) => handleThresholdChange(index, e.target.value)}
                  placeholder="30"
                  className="w-32"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemoveThreshold(index)}
                  disabled={thresholds.length <= 1}
                  title={t("removeThreshold")}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={handleAddThreshold}>
            {t("addThreshold")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
