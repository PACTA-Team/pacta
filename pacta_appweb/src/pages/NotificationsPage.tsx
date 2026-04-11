import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { notificationsAPI, APINotification } from '@/lib/notifications-api';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<APINotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const notifs = await notificationsAPI.list();
      setNotifications(notifs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsAPI.markRead(id);
      toast.success('Notification marked as read');
      loadNotifications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      toast.success('All notifications marked as read');
      loadNotifications();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update notifications');
    }
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark All Read
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} className={!notification.read_at ? 'border-blue-500' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Bell className={`h-5 w-5 ${notification.read_at ? 'text-muted-foreground' : 'text-blue-500'}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{notification.title}</h3>
                        <Badge variant={notification.read_at ? 'secondary' : 'default'}>
                          {notification.read_at ? 'read' : 'unread'}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(notification.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {notification.message && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {notification.message}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {notification.entity_id && notification.entity_type === 'contract' && (
                        <Link to={`/contracts/${notification.entity_id}`}>
                          <Button variant="outline" size="sm">
                            View Contract
                          </Button>
                        </Link>
                      )}
                      {!notification.read_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Mark as Read
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
