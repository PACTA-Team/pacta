"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { profileAPI, Profile } from "@/lib/users-api";
import { toast } from "sonner";

export function ProfileSection() {
  const { t } = useTranslation("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    profileAPI
      .getProfile()
      .then((data) => {
        setProfile(data);
        setName(data.name);
        setEmail(data.email);
        setLoading(false);
      })
      .catch(() => {
        toast.error(t("loadError"));
        setLoading(false);
      });
  }, [t]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await profileAPI.updateProfile(name, email);
      setProfile(updated);
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
        <CardTitle>{t("profileTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("email")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}