/**
 * Contract-specific types for the refactored contract form system.
 */

export interface PendingDocument {
  url: string;
  key: string;
  file: File;
}

export interface ContractSubmitData {
  contract_number: string;
  title?: string;
  client_id: number;
  supplier_id: number;
  client_signer_id?: number;
  supplier_signer_id?: number;
  start_date: string;
  end_date: string;
  amount: number;
  type: string;
  status: string;
  description?: string;
  object?: string;
  fulfillment_place?: string;
  dispute_resolution?: string;
  has_confidentiality?: boolean;
  guarantees?: string;
  renewal_type?: string;
  document_url?: string;
  document_key?: string;
  company_id: number;
}
