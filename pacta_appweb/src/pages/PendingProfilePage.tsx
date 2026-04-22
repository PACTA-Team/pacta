"use client";

import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PendingProfilePage() {
  const { t } = useTranslation('profile');
  const { user, setupStatus } = useAuth();

  const statusMessage = setupStatus === 'pending_approval'
    ? 'Your account is pending approval from an administrator. You will be notified once your account has been approved.'
    : setupStatus === 'pending_activation'
    ? 'Your account is pending activation. Please wait while an administrator reviews your account.'
    : 'Your account is currently being set up. Please complete your profile information.';

  const statusBadgeVariant = setupStatus === 'pending_approval' ? 'outline' : 'secondary';

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>{t('status.title')}</CardTitle>
          <CardDescription>{t('status.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Info */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Account Information</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{user?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium capitalize">{user?.role}</span>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Account Status</h3>
            <div className="flex items-center gap-2">
              <Badge variant={statusBadgeVariant} className="capitalize">
                {setupStatus?.replace('_', ' ') || 'unknown'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          </div>

          {/* Help Text */}
          <div className="rounded-md bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error or you need immediate assistance, please contact your administrator.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}