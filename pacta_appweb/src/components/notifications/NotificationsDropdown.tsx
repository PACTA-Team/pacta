"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, ExternalLink, CheckCheck, Clock, AlertCircle, Info, CheckCircle } from "lucide-react";
import { notificationsAPI, APINotification } from "@/lib/notifications-api";
import { toast } from "sonner";

const TYPE_ICONS: Record<string, React.ElementType> = {
  contract_expiry: Clock,
  approval: AlertCircle,
  system: Info,
  success: CheckCircle,
};

const TYPE_LABELS: Record<string, string> = {
  contract_expiry: "Contract Expiry",
  approval: "Approval Required",
  system: "System",
  success: "Success",
};

// Simple relative time formatter without external deps
function timeAgo(dateString: string, locale: string = "en"): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffSec < 60) return rtf.format(-diffSec, "second");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  if (diffDay < 7) return rtf.format(-diffDay, "day");
  return date.toLocaleDateString(locale);
}

export function NotificationsDropdown() {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<APINotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Fetch unread notifications when dropdown opens
  useEffect(() => {
    if (!open) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const data = await notificationsAPI.list(true); // unread only
        setNotifications(data);
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [open]);

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMarkingAllRead(true);
    try {
      await notificationsAPI.markAllRead();
      setNotifications([]); // clear local state
      toast.success(t("success") || "All notifications marked as read");
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      toast.error(t("error") || "Failed to mark all as read");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = async (notification: APINotification) => {
    // Mark as read if unread
    if (!notification.read_at) {
      try {
        await notificationsAPI.markRead(notification.id);
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }

    // Navigate to entity if present
    if (notification.entity_type && notification.entity_id) {
      const routes: Record<string, string> = {
        contract: `/contracts/${notification.entity_id}`,
        supplement: `/supplements/${notification.entity_id}`,
        client: `/clients/${notification.entity_id}`,
        supplier: `/suppliers/${notification.entity_id}`,
        company: `/companies/${notification.entity_id}`,
      };
      const route = routes[notification.entity_type];
      if (route) {
        navigate(route);
        setOpen(false);
        return;
      }
    }

    // Fallback: go to notifications page
    navigate("/notifications");
    setOpen(false);
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 rounded-md hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t("notifications")}
          title={t("notifications")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 md:w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("notifications")}</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {markingAllRead ? t("saving") : t("markAllRead") || "Mark all as read"}
            </button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t("noNotifications") || "No notifications"}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] || Info;
              return (
                <DropdownMenuItem
                  key={notification.id}
                  onSelect={() => handleNotificationClick(notification)}
                  className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                    !notification.read_at ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">{notification.title}</span>
                    </div>
                    {!notification.read_at && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1.5" />
                    )}
                  </div>
                  {notification.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2 w-full">
                      {notification.message}
                    </p>
                  )}
                  <div className="flex items-center justify-between w-full mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(notification.created_at, i18n.language === "es" ? "es" : "en")}
                    </span>
                    {notification.type && (
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {TYPE_LABELS[notification.type] || notification.type}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                to="/notifications"
                className="flex items-center gap-2 cursor-pointer text-primary"
                onClick={() => setOpen(false)}
              >
                <ExternalLink className="h-4 w-4" />
                <span>{t("viewAllNotifications") || "View all notifications"}</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
    };

    fetchNotifications();
  }, [open]);

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMarkingAllRead(true);
    try {
      await notificationsAPI.markAllRead();
      setNotifications([]); // clear local state
      toast.success(t("success") || "All notifications marked as read");
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      toast.error(t("error") || "Failed to mark all as read");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleNotificationClick = async (notification: APINotification) => {
    // Mark as read if unread
    if (!notification.read_at) {
      try {
        await notificationsAPI.markRead(notification.id);
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }

    // Navigate to entity if present
    if (notification.entity_type && notification.entity_id) {
      const routes: Record<string, string> {
        contract: `/contracts/${notification.entity_id}`,
        supplement: `/supplements/${notification.entity_id}`,
        client: `/clients/${notification.entity_id}`,
        supplier: `/suppliers/${notification.entity_id}`,
        company: `/companies/${notification.entity_id}`,
      };
      const route = routes[notification.entity_type];
      if (route) {
        navigate(route);
        setOpen(false);
        return;
      }
    }

    // Fallback: go to notifications page
    navigate("/notifications");
    setOpen(false);
  };

  const getLocale = () => (i18n.language === "es" ? es : en);

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: getLocale() });
    } catch {
      return dateString;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2 rounded-md hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={t("notifications")}
          title={t("notifications")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 md:w-96">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t("notifications")}</span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {markingAllRead ? t("saving") : t("markAllRead") || "Mark all as read"}
            </button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t("noNotifications") || "No notifications"}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type] || Info;
              return (
                <DropdownMenuItem
                  key={notification.id}
                  onSelect={() => handleNotificationClick(notification)}
                  className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                    !notification.read_at ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium text-sm truncate">{notification.title}</span>
                    </div>
                    {!notification.read_at && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1.5" />
                    )}
                  </div>
                  {notification.message && (
                    <p className="text-xs text-muted-foreground line-clamp-2 w-full">
                      {notification.message}
                    </p>
                  )}
                  <div className="flex items-center justify-between w-full mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(notification.created_at)}
                    </span>
                    {notification.type && (
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {TYPE_LABELS[notification.type] || notification.type}
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                to="/notifications"
                className="flex items-center gap-2 cursor-pointer text-primary"
                onClick={() => setOpen(false)}
              >
                <ExternalLink className="h-4 w-4" />
                <span>{t("viewAllNotifications") || "View all notifications"}</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
