import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, UserX, Shield, KeyRound } from 'lucide-react';
import { usersAPI, APIUser } from '@/lib/users-api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function UsersPage() {
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation('common');
  const [users, setUsers] = useState<APIUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<APIUser | null>(null);
  const [showResetPassword, setShowResetPassword] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'viewer' as 'admin' | 'manager' | 'editor' | 'viewer',
    status: 'active' as 'active' | 'inactive' | 'locked',
  });
  const { hasPermission, user: currentUser } = useAuth();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersAPI.list();
      setUsers(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasPermission('admin')) {
      toast.error(t('noUsers'));
      return;
    }
    loadUsers();
  }, [hasPermission, loadUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await usersAPI.update(editingUser.id, formData.name, formData.email, formData.role);
        toast.success(t('updateSuccess'));
      } else {
        await usersAPI.create(formData.name, formData.email, formData.password, formData.role);
        toast.success(t('createSuccess'));
      }
      resetForm();
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon('error'));
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'viewer',
      status: 'active',
    });
  };

  const handleEdit = (user: APIUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
    });
    setShowForm(true);
  };

  const handleToggleStatus = async (userId: number) => {
    if (currentUser && parseInt(currentUser.id) === userId) {
      toast.error(tCommon('error'));
      return;
    }
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await usersAPI.updateStatus(userId, newStatus);
      toast.success(t('updateSuccess'));
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon('error'));
    }
  };

  const handleResetPassword = async (userId: number) => {
    if (!newPassword) {
      toast.error(t('resetPassword'));
      return;
    }
    try {
      await usersAPI.resetPassword(userId, newPassword);
      toast.success(t('resetPassword'));
      setShowResetPassword(null);
      setNewPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon('error'));
    }
  };

  const handleDelete = async (userId: number) => {
    if (currentUser && parseInt(currentUser.id) === userId) {
      toast.error(tCommon('error'));
      return;
    }
    try {
      await usersAPI.delete(userId);
      toast.success(tCommon('delete'));
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon('error'));
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-500',
      manager: 'bg-blue-500',
      editor: 'bg-green-500',
      viewer: 'bg-gray-500',
    };
    return <Badge className={colors[role] || 'bg-gray-500'}>{role}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      inactive: 'secondary',
      locked: 'destructive',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  if (!hasPermission('admin')) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">You do not have permission to access this page</p>
        </CardContent>
      </Card>
    );
  }

  if (showForm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{editingUser ? t('editUser') : t('addNew')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')} *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editingUser}
                required
              />
            </div>

            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">{t('password', { ns: 'login' })} *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">{t('role')} *</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as typeof formData.role })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t('admin')}</SelectItem>
                    <SelectItem value="manager">{t('manager')}</SelectItem>
                    <SelectItem value="editor">{t('editor')}</SelectItem>
                    <SelectItem value="viewer">{t('viewer')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">{t('status')} *</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as typeof formData.status })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('active')}</SelectItem>
                    <SelectItem value="inactive">{t('inactive')}</SelectItem>
                    <SelectItem value="locked">{t('pending')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={resetForm}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit">
                {editingUser ? t('updateUser') : t('createUser')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (showResetPassword !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('resetPassword')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">{t('newPassword')} *</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => { setShowResetPassword(null); setNewPassword(''); }}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={() => handleResetPassword(showResetPassword)}>
              <KeyRound className="mr-2 h-4 w-4" />
              {t('resetPassword')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addNew')}
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('loading')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('email')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>Last Access</TableHead>
                  <TableHead>{tCommon('edit')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t('noUsers')}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell>{user.last_access ? new Date(user.last_access).toLocaleDateString() : 'Never'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(user)} aria-label={`Edit ${user.name}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(user.id)}
                            disabled={currentUser ? parseInt(currentUser.id) === user.id : false}
                            aria-label={`Toggle status for ${user.name}`}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowResetPassword(user.id)}
                            aria-label={`Reset password for ${user.name}`}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            disabled={currentUser ? parseInt(currentUser.id) === user.id : false}
                            aria-label={`Delete ${user.name}`}
                          >
                            <UserX className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('rolePermissions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tCommon('edit')}</TableHead>
                <TableHead>{t('admin')}</TableHead>
                <TableHead>{t('manager')}</TableHead>
                <TableHead>{t('editor')}</TableHead>
                <TableHead>{t('viewer')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>{t('permissions', { ns: 'settings' })}</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Create/Edit Contracts</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>No</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Delete Contracts</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>No</TableCell>
                <TableCell>No</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Manage Supplements</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>No</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Upload Documents</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>No</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Manage Users</TableCell>
                <TableCell>Yes</TableCell>
                <TableCell>No</TableCell>
                <TableCell>No</TableCell>
                <TableCell>No</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
