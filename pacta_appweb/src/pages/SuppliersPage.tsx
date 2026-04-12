import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { Supplier } from '@/types';
import { suppliersAPI } from '@/lib/suppliers-api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import SupplierForm from '@/components/suppliers/SupplierForm';
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

export default function SuppliersPage() {
  const [suppliers, setSuppliersState] = useState<any[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<number | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<any | null>(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    filterSuppliers();
  }, [suppliers, searchTerm]);

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await suppliersAPI.list();
      setSuppliersState(data as any[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  const filterSuppliers = () => {
    let filtered = [...suppliers];

    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.reu_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredSuppliers(filtered);
  };

  const handleCreateOrUpdate = async (data: Omit<Supplier, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingSupplier) {
        await suppliersAPI.update(editingSupplier.id, {
          name: data.name,
          address: data.address,
          reu_code: data.reuCode,
          contacts: data.contacts,
        });
        toast.success('Supplier updated successfully');
      } else {
        await suppliersAPI.create({
          name: data.name,
          address: data.address,
          reu_code: data.reuCode,
          contacts: data.contacts,
        });
        toast.success('Supplier created successfully');
      }
      setShowForm(false);
      setEditingSupplier(undefined);
      loadSuppliers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleEdit = (supplier: Supplier) => {
    if (!hasPermission('editor')) {
      toast.error('You do not have permission to edit suppliers');
      return;
    }
    setEditingSupplier(supplier);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete suppliers');
      return;
    }
    setSupplierToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;
    try {
      await suppliersAPI.delete(supplierToDelete);
      toast.success('Supplier deleted successfully');
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
      loadSuppliers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (showForm) {
    return (
      <>
        <SupplierForm
          supplier={editingSupplier}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingSupplier(undefined);
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
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasPermission('editor') && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Supplier
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>REU Code</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No suppliers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.reu_code}</TableCell>
                      <TableCell>{supplier.address}</TableCell>
                      <TableCell>{supplier.contacts}</TableCell>
                      <TableCell>
                        {supplier.document_url ? (
                          <FileText className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground text-sm">No document</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewingSupplier(supplier)} aria-label={`View supplier ${supplier.name}`}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          {hasPermission('editor') && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(supplier)} aria-label={`Edit supplier ${supplier.name}`}>
                              <Edit className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('manager') && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(supplier.id)} aria-label={`Delete supplier ${supplier.name}`}>
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
              This action cannot be undone. This will permanently delete the supplier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingSupplier} onOpenChange={() => setViewingSupplier(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Supplier Details</DialogTitle>
          </DialogHeader>
          {viewingSupplier && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company Name</p>
                  <p className="font-medium">{viewingSupplier.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">REU Code</p>
                  <p className="font-medium">{viewingSupplier.reu_code}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{viewingSupplier.address}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Contacts</p>
                  <p className="font-medium">{viewingSupplier.contacts}</p>
                </div>
                {viewingSupplier.document_url && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground mb-2">Official Document</p>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <a
                        href={viewingSupplier.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {viewingSupplier.document_name || 'View Document'}
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
