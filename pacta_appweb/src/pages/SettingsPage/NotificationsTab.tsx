"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings on mount
  useEffect(() => {
    contractExpirySettingsAPI
      .get()
      .then((data: ContractExpirySettings) => {
        if (data.thresholds_days && data.thresholds_days.length > 0) {
          // Sort descending for consistency
          const sorted = [...data.thresholds_days].sort((a, b) => b - a);
          setThresholds(sorted);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load notification settings:", err);
        const message = err instanceof Error ? err.message : "Failed to load notification settings";
        toast.error(message);
        setLoading(false);
      });
  }, []);

  // Auto-save with debounce whenever thresholds change (after initial load)
  const triggerSave = useCallback((newThresholds: number[]) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(async () => {
      // Filter out any invalid values (<=0) before sending
      const cleaned = newThresholds.filter((t) => t > 0);
      if (cleaned.length === 0) {
        toast.error("At least one positive threshold is required");
        setSaving(false);
        return;
      }

      // Update local state if we removed invalid entries
      if (cleaned.length !== newThresholds.length) {
        setThresholds(cleaned.sort((a, b) => b - a));
      }

      setSaving(true);
      try {
        await contractExpirySettingsAPI.update({ thresholds_days: cleaned });
        toast.success(t("saveSuccess"));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to save settings";
        console.error("Save failed:", err);
        toast.error(message);
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [t]);

  // Trigger auto-save when thresholds change (skip during initial load)
  useEffect(() => {
    if (loading) return;
    // Skip save if any threshold is invalid (<=0) — wait for user to fix
    if (thresholds.some((t) => t <= 0)) return;
    triggerSave(thresholds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thresholds]);

  const handleAddThreshold = () => {
    setThresholds((prev) => {
      const next = [...prev, 30]; // 30 days is a sensible default
      next.sort((a, b) => b - a);
      return next;
    });
  };

  const handleRemoveThreshold = (index: number) => {
    if (thresholds.length > 1) {
      setThresholds((prev) => {
        const next = prev.filter((_, i) => i !== index);
        next.sort((a, b) => b - a);
        return next;
      });
    }
  };

  const handleThresholdChange = (index: number, value: string) => {
    const trimmed = value.trim();

    // Allow empty temporarily (user may be clearing)
    if (trimmed === "") {
      setThresholds((prev) => {
        const next = [...prev];
        next[index] = 0; // temporary invalid marker
        return next;
      });
      return;
    }

    const num = Number(trimmed);
    // Strict: must be integer, positive, and no extra characters (e.g. "30abc")
    const isValid = !isNaN(num) && Number.isInteger(num) && num > 0 && String(num) === trimmed;

    if (isValid) {
      setThresholds((prev) => {
        const next = [...prev];
        next[index] = num;
        next.sort((a, b) => b - a); // keep sorted descending
        return next;
      });
    }
    // Invalid input is ignored — user stays in edit mode, value not updated
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
                  step={1}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={value <= 0 ? "" : value}
                  onChange={(e) => handleThresholdChange(index, e.target.value)}
                  placeholder="30"
                  className="w-32"
                  disabled={saving}
                  aria-label={`Threshold ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleRemoveThreshold(index)}
                  disabled={thresholds.length <= 1 || saving}
                  title={t("removeThreshold")}
                  aria-label={t("removeThreshold")}
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={handleAddThreshold} disabled={saving}>
            {t("addThreshold")}
          </Button>

          {saving && (
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
              Saving...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
