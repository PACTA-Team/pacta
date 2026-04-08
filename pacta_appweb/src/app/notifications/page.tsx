
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Bell, Check, CheckCheck, Settings } from 'lucide-react';
import { Notification, NotificationSettings } from '@/types';
import { getNotifications, getNotificationSettings, setNotificationSettings } from '@/lib/storage';
import { markNotificationAsRead, markNotificationAsAcknowledged } from '@/lib/notifications';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    thresholds: [30, 15, 7],
    recipients: [],
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const notifs = getNotifications().sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setNotifications(notifs);
    setSettings(getNotificationSettings());
  };

  const handleMarkAsRead = (id: string) => {
    markNotificationAsRead(id);
    toast.success('Notification marked as read');
    loadData();
  };

  const handleMarkAsAcknowledged = (id: string) => {
    markNotificationAsAcknowledged(id);
    toast.success('Notification acknowledged');
    loadData();
  };

  const handleSaveSettings = () => {
    setNotificationSettings(settings);
    toast.success('Notification settings saved');
    setShowSettings(false);
  };

  const getStatusBadge = (status: Notification['status']) => {
    const variants: Record<Notification['status'], 'default' | 'secondary' | 'outline'> = {
      unread: 'default',
      read: 'secondary',
      acknowledged: 'outline',
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const getNotificationIcon = (type: Notification['type']) => {
    const colors: Record<Notification['type'], string> = {
      expiration_30: 'text-yellow-500',
      expiration_15: 'text-orange-500',
      expiration_7: 'text-red-500',
    };
    return <Bell className={`h-5 w-5 ${colors[type]}`} />;
  };

  if (showSettings) {
    return (
      <AppLayout>
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive automatic notifications for contract expirations
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Alert Thresholds (days before expiration)</Label>
              <p className="text-sm text-muted-foreground">
                Comma-separated values (e.g., 30,15,7)
              </p>
              <Input
                value={settings.thresholds.join(',')}
                onChange={(e) => {
                  const values = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                  setSettings({ ...settings, thresholds: values });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Email Recipients</Label>
              <p className="text-sm text-muted-foreground">
                Comma-separated email addresses
              </p>
              <Input
                value={settings.recipients.join(',')}
                onChange={(e) => {
                  const emails = e.target.value.split(',').map(e => e.trim()).filter(e => e);
                  setSettings({ ...settings, recipients: emails });
                }}
                placeholder="email1@example.com, email2@example.com"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings}>
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
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
              <Card key={notification.id} className={notification.status === 'unread' ? 'border-blue-500' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{notification.contractTitle}</h3>
                          {getStatusBadge(notification.status)}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2">
                        <Link href={`/contracts/${notification.contractId}`}>
                          <Button variant="outline" size="sm">
                            View Contract
                          </Button>
                        </Link>
                        {notification.status === 'unread' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleMarkAsRead(notification.id)}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Mark as Read
                          </Button>
                        )}
                        {notification.status === 'read' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleMarkAsAcknowledged(notification.id)}
                          >
                            <CheckCheck className="mr-2 h-4 w-4" />
                            Acknowledge
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
    </AppLayout>
  );
}
