
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { Client } from '@/types';
import { getClients, setClients, getCurrentUser } from '@/lib/storage';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import ClientForm from '@/components/clients/ClientForm';
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

export default function ClientsPage() {
  const [clients, setClientsState] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    filterClients();
  }, [clients, searchTerm]);

  const loadClients = () => {
    const data = getClients();
    setClientsState(data);
  };

  const filterClients = () => {
    let filtered = [...clients];

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.reuCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredClients(filtered);
  };

  const handleCreateOrUpdate = (data: Omit<Client, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    const user = getCurrentUser();
    if (!user) return;

    const allClients = getClients();

    if (editingClient) {
      const updated: Client = {
        ...editingClient,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      const newClients = allClients.map(c => c.id === updated.id ? updated : c);
      setClients(newClients);
      toast.success('Client updated successfully');
    } else {
      const newClient: Client = {
        ...data,
        id: Date.now().toString(),
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setClients([...allClients, newClient]);
      toast.success('Client created successfully');
    }

    setShowForm(false);
    setEditingClient(undefined);
    loadClients();
  };

  const handleEdit = (client: Client) => {
    if (!hasPermission('editor')) {
      toast.error('You do not have permission to edit clients');
      return;
    }
    setEditingClient(client);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete clients');
      return;
    }
    setClientToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!clientToDelete) return;

    const allClients = getClients();
    const newClients = allClients.filter(c => c.id !== clientToDelete);
    setClients(newClients);
    
    toast.success('Client deleted successfully');
    setDeleteDialogOpen(false);
    setClientToDelete(null);
    loadClients();
  };

  if (showForm) {
    return (
      <AppLayout>
        <ClientForm
          client={editingClient}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingClient(undefined);
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
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasPermission('editor') && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Client
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
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No clients found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.reuCode}</TableCell>
                      <TableCell>{client.address}</TableCell>
                      <TableCell>{client.contacts}</TableCell>
                      <TableCell>
                        {client.documentUrl ? (
                          <FileText className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground text-sm">No document</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewingClient(client)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {hasPermission('editor') && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(client)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {hasPermission('manager') && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(client.id)}>
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
              This action cannot be undone. This will permanently delete the client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingClient} onOpenChange={() => setViewingClient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Client Details</DialogTitle>
          </DialogHeader>
          {viewingClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company Name</p>
                  <p className="font-medium">{viewingClient.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">REU Code</p>
                  <p className="font-medium">{viewingClient.reuCode}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{viewingClient.address}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Contacts</p>
                  <p className="font-medium">{viewingClient.contacts}</p>
                </div>
                {viewingClient.documentUrl && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground mb-2">Official Document</p>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <a 
                        href={viewingClient.documentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {viewingClient.documentName || 'View Document'}
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
