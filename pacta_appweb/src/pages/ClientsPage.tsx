import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { Client } from '@/types';
import { clientsAPI } from '@/lib/clients-api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
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
  const [clients, setClientsState] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<number | null>(null);
  const [viewingClient, setViewingClient] = useState<any | null>(null);
  const { hasPermission } = useAuth();
  const { t } = useTranslation('clients');
  const { t: tCommon } = useTranslation('common');

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    filterClients();
  }, [clients, searchTerm]);

  const loadClients = useCallback(async () => {
    try {
      const data = await clientsAPI.list();
      setClientsState(data as any[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  const filterClients = () => {
    let filtered = [...clients];

    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.reu_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredClients(filtered);
  };

  const handleCreateOrUpdate = async (data: Omit<Client, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingClient) {
        await clientsAPI.update(editingClient.id, {
          name: data.name,
          address: data.address,
          reu_code: data.reu_code,
          contacts: data.contacts,
        });
        toast.success(t('updateSuccess'));
      } else {
        await clientsAPI.create({
          name: data.name,
          address: data.address,
          reu_code: data.reu_code,
          contacts: data.contacts,
        });
        toast.success(t('createSuccess'));
      }
      setShowForm(false);
      setEditingClient(undefined);
      loadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleEdit = (client: Client) => {
    if (!hasPermission('editor')) {
      toast.error('You do not have permission to edit clients');
      return;
    }
    setEditingClient(client);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete clients');
      return;
    }
    setClientToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    try {
      await clientsAPI.delete(clientToDelete);
      toast.success(t('updateSuccess'));
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      loadClients();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (showForm) {
    return (
      <>
        <ClientForm
          client={editingClient}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false);
            setEditingClient(undefined);
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
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasPermission('editor') && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addNew')}
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
                      {t('noClients')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>{client.reu_code}</TableCell>
                      <TableCell>{client.address}</TableCell>
                      <TableCell>{client.contacts}</TableCell>
                      <TableCell>
                        {client.document_url ? (
                          <FileText className="h-4 w-4 text-green-600" />
                        ) : (
                          <span className="text-muted-foreground text-sm">{t('noDocument')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setViewingClient(client)} aria-label={`View client ${client.name}`}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          {hasPermission('editor') && (
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(client)} aria-label={`Edit client ${client.name}`}>
                              <Edit className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                          {hasPermission('manager') && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(client.id)} aria-label={`Delete client ${client.name}`}>
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
            <AlertDialogTitle>{tCommon('areYouSure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirm')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{tCommon('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewingClient} onOpenChange={() => setViewingClient(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('clientDetails')}</DialogTitle>
          </DialogHeader>
          {viewingClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('name')}</p>
                  <p className="font-medium">{viewingClient.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('taxId')}</p>
                  <p className="font-medium">{viewingClient.reu_code}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">{t('address')}</p>
                  <p className="font-medium">{viewingClient.address}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">{t('phone')}</p>
                  <p className="font-medium">{viewingClient.contacts}</p>
                </div>
                {viewingClient.document_url && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground mb-2">{t('officialDocument')}</p>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <a
                        href={viewingClient.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {viewingClient.document_name || t('viewDocument')}
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
