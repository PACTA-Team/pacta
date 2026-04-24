import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Contract, Client, Supplier, AuthorizedSigner, ContractType, ContractStatus, RenewalType, ContractSubmitData } from '@/types';
import { ChevronDown, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContractDocumentUpload } from './ContractDocumentUpload';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CONTRACT_TYPE_LABELS } from '@/types';
import { RENEWAL_TYPE_LABELS } from '@/types';

interface ContraparteFormProps {
  type: 'client' | 'supplier';
  companyId: number;
  contract?: Contract | null;
  clients?: Client[];
  suppliers?: Supplier[];
  signers: AuthorizedSigner[];
  onContraparteIdChange: (id: string) => void;
  onSignerIdChange?: (id: string) => void;
  onAddContraparte: () => void;
  onAddResponsible: () => void;
  pendingDocument: { url: string; key: string; file: File } | null;
  onDocumentChange: (doc: {url:string;key:string;file:File}) => void;
  onDocumentRemove: () => void;
  isLoading?: boolean;
  loadingSigners?: boolean;
  onFieldChange?: (field: keyof ContractSubmitData, value: any) => void;
}

export default function ContraparteForm({
  type,
  companyId,
  contract,
  clients = [],
  suppliers = [],
  signers = [],
  onContraparteIdChange,
  onSignerIdChange,
  onAddContraparte,
  onAddResponsible,
  pendingDocument,
  onDocumentChange,
  onDocumentRemove,
  isLoading = false,
  loadingSigners = false,
}: ContraparteFormProps) {
  const { t } = useTranslation('contracts');

  const isClientRole = type === 'client';
  const counterpartLabel = isClientRole ? 'Proveedor' : 'Cliente';
  const signerLabel = counterpartLabel;

   // Local state for selections
   const [selectedCounterpartId, setSelectedCounterpartId] = useState<string>('');
   const [selectedSignerId, setSelectedSignerId] = useState<string>('');

   // ─── Contract field states ───
   const [contractNumber, setContractNumber] = useState(contract?.contract_number || '');
   const [title, setTitle] = useState(contract?.title || '');
   const [startDate, setStartDate] = useState(contract?.start_date || '');
   const [endDate, setEndDate] = useState(contract?.end_date || '');
   const [amount, setAmount] = useState<number | ''>(contract?.amount ?? '');
   const [type, setType] = useState<ContractType | ''>(contract?.type || '');
   const [status, setStatus] = useState<ContractStatus>(contract?.status || 'active');
   const [description, setDescription] = useState(contract?.description || '');
   const [object, setObject] = useState(contract?.object || '');
   const [hasConfidentiality, setHasConfidentiality] = useState<boolean>(
     contract?.has_confidentiality || false
   );
   const [fulfillmentPlace, setFulfillmentPlace] = useState(contract?.fulfillment_place || '');
   const [disputeResolution, setDisputeResolution] = useState(contract?.dispute_resolution || '');
   const [guarantees, setGuarantees] = useState(contract?.guarantees || '');
   const [renewalType, setRenewalType] = useState<RenewalType | ''>(contract?.renewal_type || '');

   // Initialize from contract if editing
   useEffect(() => {
     if (contract) {
       const counterpartId = isClientRole ? contract.supplier_id?.toString() : contract.client_id?.toString();
       if (counterpartId) {
         setSelectedCounterpartId(counterpartId);
         onContraparteIdChange(counterpartId);
       }
       const signerId = isClientRole ? contract.client_signer_id?.toString() : contract.supplier_signer_id?.toString();
       if (signerId) {
         setSelectedSignerId(signerId);
         onSignerIdChange?.(signerId);
       }
       // Contract fields
       setContractNumber(contract.contract_number || '');
       setTitle(contract.title || '');
       setStartDate(contract.start_date || '');
       setEndDate(contract.end_date || '');
       setAmount(contract.amount ?? '');
       setType(contract.type || '');
       setStatus(contract.status || 'active');
       setDescription(contract.description || '');
       setObject(contract.object || '');
       setHasConfidentiality(contract.has_confidentiality || false);
       setFulfillmentPlace(contract.fulfillment_place || '');
       setDisputeResolution(contract.dispute_resolution || '');
       setGuarantees(contract.guarantees || '');
       setRenewalType(contract.renewal_type || '');
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [contract, isClientRole]);

  const handleCounterpartChange = (id: string) => {
    setSelectedCounterpartId(id);
    setSelectedSignerId('');
    onContraparteIdChange(id);
    onSignerIdChange?.('');
  };

   const handleSignerChange = (id: string) => {
     setSelectedSignerId(id);
     onSignerIdChange?.(id);
   };

   // ─── Contract field change handlers ───
   const handleContractNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     setContractNumber(val);
     onFieldChange?.('contract_number', val);
   };
   const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     setTitle(val);
     onFieldChange?.('title', val);
   };
   const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     setStartDate(val);
     onFieldChange?.('start_date', val);
   };
   const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     setEndDate(val);
     onFieldChange?.('end_date', val);
   };
   const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value === '' ? '' : Number(e.target.value);
     setAmount(val);
     onFieldChange?.('amount', val);
   };
   const handleTypeChange = (value: ContractType) => {
     setType(value);
     onFieldChange?.('type', value);
   };
   const handleStatusChange = (value: ContractStatus) => {
     setStatus(value);
     onFieldChange?.('status', value);
   };
   const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     const val = e.target.value;
     setDescription(val);
     onFieldChange?.('description', val);
   };
   const handleObjectChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     const val = e.target.value;
     setObject(val);
     onFieldChange?.('object', val);
   };
   const handleHasConfidentialityChange = (checked: boolean | 'indeterminate') => {
     const bool = !!checked;
     setHasConfidentiality(bool);
     onFieldChange?.('has_confidentiality', bool);
   };
   const handleFulfillmentPlaceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const val = e.target.value;
     setFulfillmentPlace(val);
     onFieldChange?.('fulfillment_place', val);
   };
   const handleDisputeResolutionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     const val = e.target.value;
     setDisputeResolution(val);
     onFieldChange?.('dispute_resolution', val);
   };
   const handleGuaranteesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     const val = e.target.value;
     setGuarantees(val);
     onFieldChange?.('guarantees', val);
   };
   const handleRenewalTypeChange = (value: RenewalType) => {
     setRenewalType(value);
     onFieldChange?.('renewal_type', value);
   };

  const handleRemoveDocument = async () => {
    if (pendingDocument) {
      try {
        await fetch(`/api/documents/temp/${encodeURIComponent(pendingDocument.key)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      } catch (err) {
        console.error('Failed to cleanup temp document:', err);
      }
    }
    onDocumentRemove();
  };

  // Determine which options list to show
  const counterpartOptions = isClientRole ? suppliers : clients;

  // For signer select value: prefer local state, fallback to contract prop for editing
  const signerValue = selectedSignerId || (contract ? (isClientRole ? contract.client_signer_id?.toString() || '' : contract.supplier_signer_id?.toString() || '') : '');

  return (
    <div className="space-y-6">
      {/* Contraparte (Client or Supplier) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`counterpart-${type}`}>{counterpartLabel} *</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={onAddContraparte}
                  aria-label={`Add new ${isClientRole ? 'supplier' : 'client'}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add new {isClientRole ? 'supplier' : 'client'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select
          id={`counterpart-${type}`}
          value={selectedCounterpartId}
          onValueChange={handleCounterpartChange}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${counterpartLabel.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {counterpartOptions.map((option: any) => (
              <SelectItem key={option.id} value={option.id.toString()}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Authorized Signer for Contraparte */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`signer-${type}`}>{signerLabel} Authorized Signer *</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={onAddResponsible}
                  aria-label={`Add new authorized signer for ${signerLabel.toLowerCase()}`}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add new authorized signer for {signerLabel.toLowerCase()}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select
          id={`signer-${type}`}
          value={signerValue}
          onValueChange={handleSignerChange}
          disabled={!selectedCounterpartId || signers.length === 0 || loadingSigners}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select authorized signer" />
          </SelectTrigger>
          <SelectContent>
            {signers.map((signer) => (
              <SelectItem key={signer.id} value={signer.id.toString()}>
                {signer.first_name} {signer.last_name} - {signer.position}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

       {/* Contract Document Upload */}
       <ContractDocumentUpload
         required
         pendingDocument={pendingDocument}
         onUpload={onDocumentChange}
         onRemove={onDocumentRemove}
       />

       {/* Contract Basic Information */}
       <div className="space-y-4 border-b pb-4">
         <h3 className="text-lg font-medium">Contract Information</h3>
         <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
             <Label htmlFor="contract-number">Contract Number *</Label>
             <Input
               id="contract-number"
               value={contractNumber}
               onChange={handleContractNumberChange}
               required
             />
           </div>
           <div className="space-y-2">
             <Label htmlFor="title">Title</Label>
             <Input id="title" value={title} onChange={handleTitleChange} />
           </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
             <Label htmlFor="start-date">Start Date *</Label>
             <Input id="start-date" type="date" value={startDate} onChange={handleStartDateChange} required />
           </div>
           <div className="space-y-2">
             <Label htmlFor="end-date">End Date *</Label>
             <Input id="end-date" type="date" value={endDate} onChange={handleEndDateChange} required />
           </div>
         </div>

         <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
             <Label htmlFor="amount">Amount (USD) *</Label>
             <Input id="amount" type="number" step="0.01" min="0" value={amount} onChange={handleAmountChange} required />
           </div>
           <div className="space-y-2">
             <Label htmlFor="type">Contract Type *</Label>
             <Select value={type} onValueChange={(v) => handleTypeChange(v as ContractType)} required>
               <SelectTrigger id="type"><SelectValue placeholder="Select type" /></SelectTrigger>
               <SelectContent>
                 {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                   <SelectItem key={value} value={value}>{label}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
         </div>

         <div className="space-y-2">
           <Label htmlFor="status">Status *</Label>
           <Select value={status} onValueChange={(v) => handleStatusChange(v as ContractStatus)} required>
             <SelectTrigger id="status"><SelectValue placeholder="Select status" /></SelectTrigger>
             <SelectContent>
               <SelectItem value="active">Active</SelectItem>
               <SelectItem value="pending">Pending</SelectItem>
               <SelectItem value="expired">Expired</SelectItem>
               <SelectItem value="cancelled">Cancelled</SelectItem>
             </SelectContent>
           </Select>
         </div>

         <div className="space-y-2">
           <Label htmlFor="description">Description</Label>
           <Textarea id="description" value={description} onChange={handleDescriptionChange} rows={3} />
         </div>

         <div className="space-y-2">
           <Label htmlFor="object">Object (purpose)</Label>
           <Textarea id="object" value={object} onChange={handleObjectChange} rows={2} />
         </div>

         <div className="flex items-center space-x-2">
           <Checkbox id="has-confidentiality" checked={hasConfidentiality} onCheckedChange={handleHasConfidentialityChange} />
           <Label htmlFor="has-confidentiality">Confidentiality Clause</Label>
         </div>
       </div>

       {/* Legal Fields — Collapsible */}
       <Collapsible>
         <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground w-full mt-4">
           <ChevronDown className="h-4 w-4" />
           {t('additionalClauses') || 'Cláusulas Adicionales'}
         </CollapsibleTrigger>
         <CollapsibleContent className="space-y-4 pt-4">
           <div className="space-y-2">
             <Label htmlFor="fulfillment-place">Fulfillment Place</Label>
             <Input id="fulfillment-place" value={fulfillmentPlace} onChange={handleFulfillmentPlaceChange} />
           </div>
           <div className="space-y-2">
             <Label htmlFor="dispute-resolution">Dispute Resolution</Label>
             <Textarea id="dispute-resolution" value={disputeResolution} onChange={handleDisputeResolutionChange} rows={2} />
           </div>
           <div className="space-y-2">
             <Label htmlFor="guarantees">Guarantees</Label>
             <Textarea id="guarantees" value={guarantees} onChange={handleGuaranteesChange} rows={2} />
           </div>
           <div className="space-y-2">
             <Label htmlFor="renewal-type">Renewal Type</Label>
             <Select value={renewalType} onValueChange={(v) => handleRenewalTypeChange(v as RenewalType)}>
               <SelectTrigger id="renewal-type"><SelectValue placeholder="Select renewal type" /></SelectTrigger>
               <SelectContent>
                 {Object.entries(RENEWAL_TYPE_LABELS).map(([value, label]) => (
                   <SelectItem key={value} value={value}>{label}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
         </CollapsibleContent>
       </Collapsible>
     </div>
   );
 }
