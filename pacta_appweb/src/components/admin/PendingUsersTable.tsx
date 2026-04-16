import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { approvalsAPI } from '@/lib/registration-api';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

interface PendingApproval {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  company_name: string;
  company_id: number | null;
  requested_role: string;
  status: string;
  created_at: string;
}

type UserRole = 'viewer' | 'editor' | 'manager' | 'admin';

interface Company {
  id: number;
  name: string;
}

export default function PendingUsersTable() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<number | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Record<number, number>>({});
  const [selectedRole, setSelectedRole] = useState<Record<number, UserRole>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [approvalsData, companiesData] = await Promise.all([
        approvalsAPI.listPending() as Promise<PendingApproval[]>,
        fetch('/api/companies', { credentials: 'include' }).then(r => r.json()) as Promise<Company[]>,
      ]);
      setApprovals(approvalsData);
      setCompanies(companiesData);
    } catch (err) {
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (approvalId: number) => {
    setActioning(approvalId);
    try {
      const companyId = selectedCompany[approvalId] || undefined;
      const role = selectedRole[approvalId] || 'viewer';
      await approvalsAPI.approve(approvalId, companyId, notes[approvalId], role);
      toast.success('User approved and activated');
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (approvalId: number) => {
    setActioning(approvalId);
    try {
      await approvalsAPI.reject(approvalId, notes[approvalId]);
      toast.success('Registration rejected');
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (approvals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No pending registrations
        </CardContent>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Registered</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {approvals.map((approval) => (
          <TableRow key={approval.id}>
            <TableCell className="font-medium">{approval.user_name}</TableCell>
            <TableCell>{approval.user_email}</TableCell>
            <TableCell>
              <Select
                value={(selectedCompany[approval.id] ?? approval.company_id ?? 0).toString()}
                onValueChange={(v) => setSelectedCompany(prev => ({ ...prev, [approval.id]: parseInt(v) }))}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select or create new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Create: {approval.company_name}</SelectItem>
                  {companies.map((c: Company) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select
                value={selectedRole[approval.id] || approval.requested_role || 'viewer'}
                onValueChange={(v) => setSelectedRole(prev => ({ ...prev, [approval.id]: v as UserRole }))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>{new Date(approval.created_at).toLocaleDateString()}</TableCell>
            <TableCell>
              <div className="flex gap-2 mb-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => handleApprove(approval.id)}
                  disabled={actioning === approval.id}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(approval.id)}
                  disabled={actioning === approval.id}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
              <Textarea
                placeholder="Notes (optional)"
                value={notes[approval.id] || ''}
                onChange={(e) => setNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                className="h-16"
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
