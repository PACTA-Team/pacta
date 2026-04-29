import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Download, FilePlus, Upload, Eye, Trash2, Sparkles } from 'lucide-react';
import { contractsAPI } from '@/lib/contracts-api';
import { supplementsAPI } from '@/lib/supplements-api';
import { documentsAPI, APIDocument } from '@/lib/documents-api';
import { clientsAPI } from '@/lib/clients-api';
import { suppliersAPI } from '@/lib/suppliers-api';
import { getContractAuditLogs } from '@/lib/audit';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AuditLog } from '@/types';
import { api } from '@/lib/api-client';

interface ReviewResponse {
  summary: string;
  risks: Array<{
    clause: string;
    risk: 'high' | 'medium' | 'low';
    suggestion: string;
  }>;
  missing_clauses: string[];
  overall_risk: 'high' | 'medium' | 'low';
}

export default function ContractDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<any | null>(null);
  const [supplements, setSupplements] = useState<any[]>([]);
  const [documents, setDocuments] = useState<APIDocument[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const { hasPermission } = useAuth();
  const { t } = useTranslation('contracts');
  const { t: tCommon } = useTranslation('common');

  // AI review state
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResponse | null>(null);

  const contractId = id ? parseInt(id) : 0;

  const loadDocuments = useCallback(async (cid: number) => {
    if (cid <= 0) return;
    try {
      const docs = await documentsAPI.list(cid, 'contract');
      setDocuments(docs);
    } catch {
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    const loadContract = async () => {
      try {
        const contractData = await contractsAPI.getById(contractId);
        setContract(contractData);

        const [allSupplements, clientsData, suppliersData] = await Promise.all([
          supplementsAPI.list(),
          clientsAPI.list(),
          suppliersAPI.list(),
        ]);
        setSupplements((allSupplements as any[]).filter((s: any) => s.contract_id === contractId));
        setClients(clientsData as any[]);
        setSuppliers(suppliersData as any[]);

        loadDocuments(contractId);

        try {
          const logs = await getContractAuditLogs(contractId);
          setAuditLogs(logs);
        } catch {
          setAuditLogs([]);
        }
      } catch {
        toast.error('Failed to load contract data');
      }
    };
    loadContract();
  }, [id, contractId, loadDocuments]);

  const clientName = useMemo(() => {
    if (!contract) return '';
    const foundClient = clients.find((c: any) => c.id === contract.client_id);
    return foundClient?.name || '';
  }, [clients, contract]);

  const supplierName = useMemo(() => {
    if (!contract) return '';
    const foundSupplier = suppliers.find((s: any) => s.id === contract.supplier_id);
    return foundSupplier?.name || '';
  }, [suppliers, contract]);

  if (!contract) {
    return (
      
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('notFound')}</p>
          <Button onClick={() => navigate('/contracts')} className="mt-4">
            {t('backToList')}
          </Button>
        </div>
      
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

  const handleReviewWithAI = async () => {
    if (!contract || !documents.length) {
      toast.error(t('ai.review.no_document'));
      return;
    }

    setReviewing(true);
    try {
      // For now, use a placeholder - in future: extract text from document
      const text = `Contract: ${contract.title}\nType: ${contract.type}\nAmount: ${contract.amount}\n\nFull contract text would be extracted from the attached document.`;

      const result = await api.post<ReviewResponse>('/ai/review-contract', {
        text,
      });
      setReviewResult(result);
      toast.success(t('ai.review.success'));
    } catch (err: any) {
      toast.error(err.message || t('ai.review.error'));
    } finally {
      setReviewing(false);
    }
  };

  return (
    
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{contract.title}</h1>
            <p className="text-muted-foreground">{contract.contract_number}</p>
          </div>
          <div className="flex gap-2">
            {hasPermission('editor') && (
              <>
                <Link to={`/contracts?action=edit&id=${contract.id}`}>
                  <Button variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    {t('edit')}
                  </Button>
                </Link>
                <Link to={`/supplements?action=create&contractId=${contract.id}`}>
                  <Button variant="outline">
                    <FilePlus className="mr-2 h-4 w-4" />
                    {t('addSupplement')}
                  </Button>
                </Link>
              </>
            )}
            <Button 
              variant="outline" 
              onClick={handleReviewWithAI}
              disabled={reviewing || !documents.length}
            >
              {reviewing ? t('ai.review.analyzing') : t('ai.review.button')}
              <Badge variant="secondary" className="ml-2">{t('ai.experimental')}</Badge>
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t('generateReport')}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('generalInfo')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">{t('contractNumber', 'Contract Number')}</p>
                <p className="font-medium">{contract.contract_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('status')}</p>
                <div className="mt-1">{getStatusBadge(contract.status)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('type')}</p>
                <p className="font-medium capitalize">{contract.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('amount')}</p>
                <p className="font-medium">${contract.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('client')}</p>
                <p className="font-medium">{clientName || 'Unknown client'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('supplier')}</p>
                <p className="font-medium">{supplierName || 'Unknown supplier'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('startDate')}</p>
                <p className="font-medium">{new Date(contract.start_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('endDate')}</p>
                <p className="font-medium">{new Date(contract.end_date).toLocaleDateString()}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">{t('description')}</p>
                <p className="font-medium">{contract.description || t('noDescription')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('supplements')}</CardTitle>
          </CardHeader>
          <CardContent>
            {supplements.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">{t('noSupplements')}</p>
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
                      <TableCell className="font-medium">{supplement.supplement_number}</TableCell>
                      <TableCell>{supplement.description}</TableCell>
                      <TableCell>{new Date(supplement.effective_date).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(supplement.status)}</TableCell>
                      <TableCell>{new Date(supplement.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('documents')}</CardTitle>
            {hasPermission('editor') && (
              <Link to={`/documents?action=upload&contractId=${contract.id}`}>
                <Button size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  {t('uploadDocument')}
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">{t('noDocuments')}</p>
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
                      <TableCell className="font-medium">{doc.filename}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.mime_type || '—'}</TableCell>
                      <TableCell>{doc.size_bytes ? (doc.size_bytes / 1024).toFixed(2) + ' KB' : '—'}</TableCell>
                      <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => documentsAPI.download(doc.id)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            documentsAPI.delete(doc.id).then(() => {
                              toast.success('Document deleted');
                              loadDocuments(contractId);
                            }).catch(() => toast.error('Failed to delete document'));
                          }}>
                            <Trash2 className="h-4 w-4" />
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

        {reviewResult && (
          <Card>
            <CardHeader>
              <CardTitle>{t('ai.review.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Summary:</h4>
                <p className="text-sm">{reviewResult.summary}</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Overall Risk: 
                  <Badge 
                    variant={reviewResult.overall_risk === 'high' ? 'destructive' : 
                            reviewResult.overall_risk === 'medium' ? 'secondary' : 'default'}
                  >
                    {reviewResult.overall_risk}
                  </Badge>
                </h4>
              </div>

              {reviewResult.risks && reviewResult.risks.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Risk Clauses:</h4>
                  <ul className="space-y-3">
                    {reviewResult.risks.map((risk: any, i: number) => (
                      <li key={i} className="border-l-4 border-red-500 pl-4 py-1 bg-red-50 dark:bg-red-950/20 rounded-r">
                        <p className="font-medium">{risk.clause}</p>
                        <p className="text-sm text-muted-foreground">
                          Risk level: <span className="font-semibold">{risk.risk}</span>
                        </p>
                        <p className="text-sm mt-1">{risk.suggestion}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {reviewResult.missing_clauses && reviewResult.missing_clauses.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Missing Clauses:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {reviewResult.missing_clauses.map((clause: string, i: number) => (
                      <li key={i} className="text-sm">{clause}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('auditTrail')}</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">{t('noAuditLogs')}</p>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{log.action}</p>
                        <Badge variant="outline">{log.user_id ? 'User #' + log.user_id : 'System'}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{log.new_state || log.action}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    
  );
}
