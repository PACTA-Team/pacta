
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { AuthorizedSigner, Client, Supplier } from '@/types';
import { getAuthorizedSigners, setAuthorizedSigners, getCurrentUser, getClients, getSuppliers } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
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
  const [signers, setSignersState] = useState<AuthorizedSigner[]>([]);
  const [filteredSigners, setFilteredSigners] = useState<AuthorizedSigner[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSigner, setEditingSigner] = useState<AuthorizedSigner | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [signerToDelete, setSignerToDelete] = useState<string | null>(null);
  const [viewingSigner, setViewingSigner] = useState<AuthorizedSigner | null>(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterSigners();
  }, [signers, searchTerm]);

  const loadData = () => {
    setSignersState(getAuthorizedSigners());
    setClients(getClients());
    setSuppliers(getSuppliers());
  };

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

  const handleCreateOrUpdate = (data: Omit<AuthorizedSigner, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    const user = getCurrentUser();
    if (!user) return;

    const allSigners = getAuthorizedSigners();

    if (editingSigner) {
      const updated: AuthorizedSigner = {
        ...editingSigner,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      const newSigners = allSigners.map(s => s.id === updated.id ? updated : s);
      setAuthorizedSigners(newSigners);
      toast.success('Authorized signer updated successfully');
    } else {
      const newSigner: AuthorizedSigner = {
        ...data,
        id: Date.now().toString(),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAuthorizedSigners([...allSigners, newSigner]);
      toast.success('Authorized signer created successfully');
    }

    setShowForm(false);
    setEditingSigner(undefined);
    loadData();
  };

  const handleEdit = (signer: AuthorizedSigner) => {
    if (!hasPermission('editor')) {
      toast.error('You do not have permission to edit authorized signers');
      return;
    }
    setEditingSigner(signer);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete authorized signers');
      return;
    }
    setSignerToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!signerToDelete) return;

    const allSigners = getAuthorizedSigners();
    const newSigners = allSigners.filter(s => s.id !== signerToDelete);
    setAuthorizedSigners(newSigners);
    
    toast.success('Authorized signer deleted successfully');
    setDeleteDialogOpen(false);
    setSignerToDelete(null);
    loadData();
  };

  const getCompanyName = (signer: AuthorizedSigner) => {
    if (signer.companyType === 'client') {
      const client = clients.find(c => c.id === signer.companyId);
      return client?.name || 'Unknown Client';
    } else {
      const supplier = suppliers.find(s => s.id === signer.companyId);
      return supplier?.name || 'Unknown Supplier';
    }
  };

  if (showForm) {
    return (
      <AppLayout>
        <AuthorizedSignerForm
          signer={editingSigner}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingSigner(undefined);
          }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
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
                        {signer.firstName} {signer.lastName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={signer.companyType === 'client' ? 'default' : 'secondary'}>
                            {signer.companyType}
                          </Badge>
                          <span>{getCompanyName(signer)}</span>
                        </div>
                      </TableCell>
                      <TableCell>{signer.position}</TableCell>
                      <TableCell>{signer.email}</TableCell>
                      <TableCell>{signer.phone}</TableCell>
                      <TableCell>
                        {signer.documentUrl ? (
                          <FileText className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground text-sm">No document</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewingSigner(signer)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {hasPermission('editor') && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(signer)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission('manager') && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(signer.id)}>
                              <Trash2 className="h-4 w-4" />
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
                  <p className="font-medium">{viewingSigner.firstName} {viewingSigner.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Position</p>
                  <p className="font-medium">{viewingSigner.position}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={viewingSigner.companyType === 'client' ? 'default' : 'secondary'}>
                      {viewingSigner.companyType}
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
                {viewingSigner.documentUrl && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground mb-2">Authorization Document</p>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <a 
                        href={viewingSigner.documentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {viewingSigner.documentName || 'View Document'}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
