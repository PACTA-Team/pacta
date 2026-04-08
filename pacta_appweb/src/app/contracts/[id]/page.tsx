
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Download, FilePlus, Upload, Eye } from 'lucide-react';
import { Contract, Supplement, Document, AuditLog, Client, Supplier } from '@/types';
import { getContracts, getSupplements, getDocuments, getClients, getSuppliers } from '@/lib/storage';
import { getContractAuditLogs } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';

export default function ContractDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const { hasPermission } = useAuth();

  useEffect(() => {
    const contractId = params.id as string;
    const contracts = getContracts();
    const found = contracts.find((c) => c.id === contractId);

    if (found) {
      setContract(found);

      const allSupplements = getSupplements();
      setSupplements(allSupplements.filter((s) => s.contractId === contractId));

      const allDocuments = getDocuments();
      setDocuments(allDocuments.filter((d) => d.contractId === contractId));

      const logs = getContractAuditLogs(contractId);
      setAuditLogs(logs);
    }

    // Load related clients and suppliers for display
    const storedClients = getClients();
    const storedSuppliers = getSuppliers();
    setClients(storedClients);
    setSuppliers(storedSuppliers);
  }, [params.id]);

  const clientName = useMemo(() => {
    if (!contract) return '';
    const foundClient = clients.find((c) => c.id === contract.clientId);
    return foundClient?.name || '';
  }, [clients, contract]);

  const supplierName = useMemo(() => {
    if (!contract) return '';
    const foundSupplier = suppliers.find((s) => s.id === contract.supplierId);
    return foundSupplier?.name || '';
  }, [suppliers, contract]);

  if (!contract) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Contract not found</p>
          <Button onClick={() => router.push('/contracts')} className="mt-4">
            Back to Contracts
          </Button>
        </div>
      </AppLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      active: 'default',
      expired: 'destructive',
      pending: 'secondary',
      cancelled: 'outline',
      draft: 'secondary',
      approved: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{contract.title}</h1>
            <p className="text-muted-foreground">{contract.contractNumber}</p>
          </div>
          <div className="flex gap-2">
            {hasPermission('editor') && (
              <>
                <Link href={`/contracts?action=edit&id=${contract.id}`}>
                  <Button variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Contract
                  </Button>
                </Link>
                <Link href={`/supplements?action=create&contractId=${contract.id}`}>
                  <Button variant="outline">
                    <FilePlus className="mr-2 h-4 w-4" />
                    Add Supplement
                  </Button>
                </Link>
              </>
            )}
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </div>
        </div>

        {/* General Information */}
        <Card>
          <CardHeader>
            <CardTitle>General Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Contract Number</p>
                <p className="font-medium">{contract.contractNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="mt-1">{getStatusBadge(contract.status)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium capitalize">{contract.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-medium">${contract.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{clientName || 'Unknown client'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Supplier</p>
                <p className="font-medium">{supplierName || 'Unknown supplier'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">{new Date(contract.startDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Date</p>
                <p className="font-medium">{new Date(contract.endDate).toLocaleDateString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{contract.description || 'No description provided'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supplements */}
        <Card>
          <CardHeader>
            <CardTitle>Associated Supplements</CardTitle>
          </CardHeader>
          <CardContent>
            {supplements.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No supplements found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplement Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplements.map((supplement) => (
                    <TableRow key={supplement.id}>
                      <TableCell className="font-medium">{supplement.supplementNumber}</TableCell>
                      <TableCell>{supplement.description}</TableCell>
                      <TableCell>{new Date(supplement.effectiveDate).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(supplement.status)}</TableCell>
                      <TableCell>{new Date(supplement.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Document Repository</CardTitle>
            {hasPermission('editor') && (
              <Link href={`/documents?action=upload&contractId=${contract.id}`}>
                <Button size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No documents uploaded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.fileName}</TableCell>
                      <TableCell>{doc.fileType}</TableCell>
                      <TableCell>{(doc.fileSize / 1024).toFixed(2)} KB</TableCell>
                      <TableCell>{new Date(doc.uploadedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={doc.fileUrl} download={doc.fileName}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Audit Trail */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No audit logs found</p>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{log.action}</p>
                        <Badge variant="outline">{log.userName}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
