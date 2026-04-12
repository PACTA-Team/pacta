import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { signersAPI } from '@/lib/signers-api';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import AuthorizedSignerForm from '@/components/authorized-signers/AuthorizedSignerForm';
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
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export default function AuthorizedSignersPage() {
  const [signers, setSignersState] = useState<any[]>([]);
  const [filteredSigners, setFilteredSigners] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSigner, setEditingSigner] = useState<any>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [signerToDelete, setSignerToDelete] = useState<number | null>(null);
  const [viewingSigner, setViewingSigner] = useState<any | null>(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSigners();
  }, [signers, searchTerm]);

  const loadData = useCallback(async () => {
    try {
      const [signersData, clientsData, suppliersData] = await Promise.all([
        signersAPI.list(),
        clientsAPI.list(),
        suppliersAPI.list(),
      ]);
      setSignersState(signersData as any[]);
      setClients(clientsData as any[]);
      setSuppliers(suppliersData as any[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  const filterSigners = () => {
    let filtered = [...signers];

    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.position.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSigners(filtered);
  };

  const handleCreateOrUpdate = async (data: any) => {
    try {
      if (editingSigner) {
        await signersAPI.update(editingSigner.id, {
          company_id: parseInt(data.companyId),
          company_type: data.companyType,
          first_name: data.firstName,
          last_name: data.lastName,
          position: data.position,
          phone: data.phone,
          email: data.email,
        });
        toast.success('Authorized signer updated successfully');
      } else {
        await signersAPI.create({
          company_id: parseInt(data.companyId),
          company_type: data.companyType,
          first_name: data.firstName,
          last_name: data.lastName,
          position: data.position,
          phone: data.phone,
          email: data.email,
        });
        toast.success('Authorized signer created successfully');
      }
      setShowForm(false);
      setEditingSigner(undefined);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleEdit = (signer: any) => {
    if (!hasPermission('editor')) {
      toast.error('You do not have permission to edit authorized signers');
      return;
    }
    setEditingSigner(signer);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete authorized signers');
      return;
    }
    setSignerToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!signerToDelete) return;
    try {
      await signersAPI.delete(signerToDelete);
      toast.success('Authorized signer deleted successfully');
      setDeleteDialogOpen(false);
      setSignerToDelete(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const getCompanyName = (signer: any) => {
    if (signer.company_type === 'client') {
      const client = clients.find((c: any) => c.id === signer.company_id);
      return client?.name || 'Unknown Client';
    } else {
      const supplier = suppliers.find((s: any) => s.id === signer.company_id);
      return supplier?.name || 'Unknown Supplier';
    }
  };

  if (showForm) {
    return (
      <>
        <AuthorizedSignerForm
          signer={editingSigner}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingSigner(undefined);
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search authorized signers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasPermission('editor') && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Authorized Signer
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSigners.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No authorized signers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSigners.map((signer) => (
                    <TableRow key={signer.id}>
                      <TableCell className="font-medium">
                        {signer.first_name} {signer.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={signer.company_type === 'client' ? 'default' : 'secondary'}>
                            {signer.company_type}
                          </Badge>
                          <span>{getCompanyName(signer)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{signer.position}</TableCell>
                      <TableCell>{signer.email}</TableCell>
                      <TableCell>{signer.phone}</TableCell>
                      <TableCell>
                        {signer.document_url ? (
                          <FileText className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground text-sm">No document</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewingSigner(signer)} aria-label={`View signer ${signer.firstName} ${signer.lastName}`}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          {hasPermission('editor') && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(signer)} aria-label={`Edit signer ${signer.firstName} ${signer.lastName}`}>
                              <Edit className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('manager') && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(signer.id)} aria-label={`Delete signer ${signer.firstName} ${signer.lastName}`}>
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the authorized signer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingSigner} onOpenChange={() => setViewingSigner(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Authorized Signer Details</DialogTitle>
          </DialogHeader>
          {viewingSigner && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Full Name</p>
                  <p className="font-medium">{viewingSigner.first_name} {viewingSigner.last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Position</p>
                  <p className="font-medium">{viewingSigner.position}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={viewingSigner.company_type === 'client' ? 'default' : 'secondary'}>
                      {viewingSigner.company_type}
                    </Badge>
                    <span className="font-medium">{getCompanyName(viewingSigner)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{viewingSigner.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{viewingSigner.phone}</p>
                </div>
                {viewingSigner.document_url && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground mb-2">Authorization Document</p>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <a
                        href={viewingSigner.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {viewingSigner.document_name || 'View Document'}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
