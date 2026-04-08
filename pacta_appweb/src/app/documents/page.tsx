
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, Eye, Trash2, Search, FileText } from 'lucide-react';
import { Document, Contract } from '@/types';
import { getDocuments, setDocuments, getContracts, getCurrentUser } from '@/lib/storage';
import { addAuditLog } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import AppLayout from '@/components/layout/AppLayout';
import Link from 'next/link';

export default function DocumentsPage() {
  const [documents, setDocumentsState] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { hasPermission } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm]);

  const loadData = () => {
    setDocumentsState(getDocuments());
    setContracts(getContracts());
  };

  const filterDocuments = () => {
    let filtered = [...documents];

    if (searchTerm) {
      filtered = filtered.filter(d =>
        d.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getContractInfo(d.contractId).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredDocuments(filtered);
  };

  const handleDelete = (id: string) => {
    if (!hasPermission('manager')) {
      toast.error('You do not have permission to delete documents');
      return;
    }

    const allDocuments = getDocuments();
    const document = allDocuments.find(d => d.id === id);
    const newDocuments = allDocuments.filter(d => d.id !== id);
    setDocuments(newDocuments);
    
    if (document) {
      addAuditLog(document.contractId, 'Document Deleted', `Document ${document.fileName} was deleted`);
    }
    
    toast.success('Document deleted successfully');
    loadData();
  };

  const getContractInfo = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    return contract ? `${contract.contractNumber} - ${contract.title}` : 'Unknown';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          {hasPermission('editor') && (
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Documents
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Document Repository</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Contract Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No documents found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {doc.fileName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/contracts/${doc.contractId}`} className="text-blue-600 hover:underline">
                          {getContractInfo(doc.contractId)}
                        </Link>
                      </TableCell>
                      <TableCell>{doc.fileType}</TableCell>
                      <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                      <TableCell>{doc.uploadedBy}</TableCell>
                      <TableCell>{new Date(doc.uploadedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          {hasPermission('manager') && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)}>
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

        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Document Upload Information</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Upload contract documents, amendments, and related files. Supported formats include PDF, Word documents, Excel spreadsheets, and images. Maximum file size: 5MB per file.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
