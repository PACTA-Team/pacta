"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getAuditLogs, AuditLog } from "@/lib/audit-api";
import { profileAPI } from "@/lib/users-api";
import { toast } from "sonner";

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const { t } = useTranslation("profile");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    profileAPI.getProfile().then((profile) => {
      setUserId(profile.id);
      loadLogs(profile.id, 0);
    });
  }, []);

  const loadLogs = (uid: number, offset: number) => {
    getAuditLogs(uid, { limit: PAGE_SIZE, offset })
      .then((data) => {
        if (offset === 0) {
          setLogs(data);
        } else {
          setLogs((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === PAGE_SIZE);
        setLoading(false);
      })
      .catch(() => {
        toast.error(t("loadError"));
        setLoading(false);
      });
  };

  const loadMore = () => {
    if (!userId || !hasMore) return;
    setLoading(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadLogs(userId, nextPage * PAGE_SIZE);
  };

  const formatAction = (action: string, entityType: string) => {
    const key = `${action.toLowerCase()}.${entityType}`;
    return t(key, { defaultValue: `${action} ${entityType}` });
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container py-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("fullHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-muted-foreground">{t("noActivity")}</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("action")}</TableHead>
                    <TableHead>{t("entity")}</TableHead>
                    <TableHead>{t("details")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell className="capitalize">{log.entity_type}</TableCell>
                      <TableCell>{formatAction(log.action, log.entity_type)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {hasMore && (
                <div className="flex justify-center mt-4">
                  <Button variant="outline" onClick={loadMore} disabled={loading}>
                    {loading ? t("loading") : t("loadMore")}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}