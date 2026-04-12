import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { Company } from '@/types';
import { listCompanies, createCompany, updateCompany, deleteCompany } from '@/lib/companies-api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filtered, setFiltered] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', tax_id: '', company_type: 'subsidiary' as string });
  const { hasPermission } = useAuth();

  const canEdit = hasPermission('editor') || hasPermission('manager') || hasPermission('admin');
  const canDelete = hasPermission('manager') || hasPermission('admin');

  useEffect(() => { loadCompanies(); }, []);
  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFiltered(term ? companies.filter(c => c.name.toLowerCase().includes(term)) : companies);
  }, [companies, searchTerm]);

  const loadCompanies = async () => {
    try {
      const data = await listCompanies();
      setCompanies(data);
    } catch (err) {
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingCompany(null);
    setFormData({ name: '', address: '', tax_id: '', company_type: 'subsidiary' });
    setDialogOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditingCompany(c);
    setFormData({
      name: c.name,
      address: c.address || '',
      tax_id: c.tax_id || '',
      company_type: c.company_type,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Company name is required'); return; }
    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, {
          name: formData.name,
          address: formData.address || undefined,
          tax_id: formData.tax_id || undefined,
        });
        toast.success('Company updated');
      } else {
        await createCompany({
          name: formData.name,
          address: formData.address || undefined,
          tax_id: formData.tax_id || undefined,
          company_type: formData.company_type,
        });
        toast.success('Company created');
      }
      setDialogOpen(false);
      loadCompanies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save company');
    }
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;
    try {
      await deleteCompany(companyToDelete);
      toast.success('Company deleted');
      setDeleteDialogOpen(false);
      loadCompanies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete company');
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading companies...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Companies</h1>
        {canEdit && (
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Company</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search companies..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tax ID</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No companies found</TableCell></TableRow>
              ) : (
                filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell><span className="inline-flex rounded-full bg-secondary px-2 py-1 text-xs font-medium">{c.company_type}</span></TableCell>
                    <TableCell>{c.tax_id || '—'}</TableCell>
                    <TableCell>{c.parent_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canEdit && <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Edit className="h-4 w-4" /></Button>}
                        {canDelete && <Button variant="ghost" size="icon" onClick={() => { setCompanyToDelete(c.id); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? 'Edit Company' : 'Create Company'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="company-name">Name</Label>
              <Input id="company-name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="company-address">Address</Label>
              <Input id="company-address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="company-taxid">Tax ID</Label>
              <Input id="company-taxid" value={formData.tax_id} onChange={e => setFormData({ ...formData, tax_id: e.target.value })} />
            </div>
            {!editingCompany && (
              <div>
                <Label htmlFor="company-type">Type</Label>
                <select id="company-type" value={formData.company_type} onChange={e => setFormData({ ...formData, company_type: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="single">Single</option>
                  <option value="parent">Parent</option>
                  <option value="subsidiary">Subsidiary</option>
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCompany ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This cannot be undone if the company has no active contracts.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
