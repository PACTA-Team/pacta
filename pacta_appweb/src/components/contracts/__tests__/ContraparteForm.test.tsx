import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContraparteForm from '../ContraparteForm';
import { Contract } from '@/types';
import { toast } from 'sonner';

// Mock the ContractDocumentUpload to avoid its internal complexity
vi.mock('../ContractDocumentUpload', () => ({
  ContractDocumentUpload: ({ pendingDocument, onUpload, onRemove }: any) => (
    <div data-testid="contract-document-upload">
      <button data-testid="mock-upload-btn" onClick={() => onUpload({ url: 'http://test', key: 'k', file: new File([], 'f') })}>
        Upload
      </button>
      {pendingDocument && <button data-testid="mock-remove-btn" onClick={onRemove}>Remove</button>}
    </div>
  ),
}));

// Mock shadcn/ui components partially to avoid needing providers? They are simple.
// We'll render with default theme; they should work.

// Mock i18 next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('ContraparteForm', () => {
  const defaultClients = [
    { id: '1', name: 'Client A', address: '', reu_code: '', contacts: '', created_by: '', created_at: '', updated_at: '' },
  ];
  const defaultSuppliers = [
    { id: '1', name: 'Supplier A', address: '', reu_code: '', contacts: '', created_by: '', created_at: '', updated_at: '' },
  ];
  const defaultSigners = [
    { id: '1', first_name: 'John', last_name: 'Doe', position: 'Manager', email: 'john@example.com', phone: '123', company_id: '1', company_type: 'client' as const, created_by: '', created_at: '', updated_at: '' },
  ];

  const baseProps = {
    type: 'client' as const,
    companyId: 1,
    clients: defaultClients,
    suppliers: defaultSuppliers,
    signers: defaultSigners,
    onContraparteIdChange: vi.fn(),
    onSignerIdChange: vi.fn(),
    onAddContraparte: vi.fn(),
    onAddResponsible: vi.fn(),
    pendingDocument: null,
    onDocumentChange: vi.fn(),
    onDocumentRemove: vi.fn(),
    isLoading: false,
    loadingSigners: false,
    onFieldChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correct label based on type', () => {
    const { rerender } = render(<ContraparteForm {...baseProps} type="client" />);
    expect(screen.getByText('Proveedor *')).toBeInTheDocument();

    rerender(<ContraparteForm {...baseProps} type="supplier" />);
    expect(screen.getByText('Cliente *')).toBeInTheDocument();
  });

  it('displays correct counterpart options based on type', () => {
    const { rerender } = render(<ContraparteForm {...baseProps} type="client" />);
    // Should display suppliers options
    expect(screen.getByText('Supplier A')).toBeInTheDocument();

    rerender(<ContraparteForm {...baseProps} type="supplier" />);
    expect(screen.getByText('Client A')).toBeInTheDocument();
  });

  it('calls onAddContraparte when counterpart + button clicked', () => {
    render(<ContraparteForm {...baseProps} type="client" />);
    const addButtons = screen.getAllByRole('button', { name: /add new/i });
    // First button for counterpart
    fireEvent.click(addButtons[0]);
    expect(baseProps.onAddContraparte).toHaveBeenCalled();
  });

  it('calls onAddResponsible when signer + button clicked', () => {
    render(<ContraparteForm {...baseProps} type="client" />);
    const addButtons = screen.getAllByRole('button', { name: /add new/i });
    // Second button for signer
    fireEvent.click(addButtons[1]);
    expect(baseProps.onAddResponsible).toHaveBeenCalled();
  });

  it('passes through document upload props', () => {
    render(<ContraparteForm {...baseProps} />);
    // Check that our mock component rendered
    expect(screen.getByTestId('contract-document-upload')).toBeInTheDocument();
  });

  it('disables counterpart select when isLoading is true', () => {
    render(<ContraparteForm {...baseProps} isLoading={true} />);
    const selectTrigger = screen.getByRole('combobox', { name: /proveedor/i });
    expect(selectTrigger).toBeDisabled();
  });

  it('disables signer select when no counterpart selected', () => {
    render(<ContraparteForm {...baseProps} />);
    const signerSelect = screen.getByRole('combobox', { name: /authorized signer/i });
    expect(signerSelect).toBeDisabled();
  });

  it('renders all required contract fields', () => {
    render(<ContraparteForm {...baseProps} />);
    // Basic info section
    expect(screen.getByText('Contract Information')).toBeInTheDocument();
    expect(screen.getByLabelText(/contract number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contract type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/object/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confidentiality/i)).toBeInTheDocument();
    // Collapsible legal fields
    expect(screen.getByText('Cláusulas Adicionales')).toBeInTheDocument();
    expect(screen.getByLabelText(/fulfillment place/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dispute resolution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/guarantees/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/renewal type/i)).toBeInTheDocument();
  });

  it('calls onFieldChange when contract number changes', async () => {
    const user = userEvent.setup();
    render(<ContraparteForm {...baseProps} />);
    const input = screen.getByLabelText(/contract number/i);
    await user.type(input, 'CTR-001');
    expect(baseProps.onFieldChange).toHaveBeenCalledWith('contract_number', 'CTR-001');
  });

  it('calls onFieldChange when amount changes', async () => {
    const user = userEvent.setup();
    render(<ContraparteForm {...baseProps} />);
    const input = screen.getByLabelText(/amount/i);
    await user.type(input, '1000');
    expect(baseProps.onFieldChange).toHaveBeenCalledWith('amount', 1000);
  });

  it('calls onFieldChange when contract type changes', async () => {
    const user = userEvent.setup();
    render(<ContraparteForm {...baseProps} />);
    const select = screen.getByLabelText(/contract type/i);
    await user.click(select);
    const option = screen.getByRole('option', { name: 'Compraventa' });
    await user.click(option);
    expect(baseProps.onFieldChange).toHaveBeenCalledWith('type', 'compraventa');
  });

  it('calls onFieldChange when has_confidentiality toggles', async () => {
    const user = userEvent.setup();
    render(<ContraparteForm {...baseProps} />);
    const checkbox = screen.getByLabelText(/confidentiality/i);
    await user.click(checkbox);
    expect(baseProps.onFieldChange).toHaveBeenCalledWith('has_confidentiality', true);
  });

  it('initializes all fields from contract when editing', () => {
    const contract: Contract = {
      id: 1,
      internal_id: 'INT-001',
      contract_number: 'CTR-100',
      title: 'Test Contract',
      client_id: 1,
      supplier_id: 2,
      company_id: 1,
      client_signer_id: 5,
      supplier_signer_id: 6,
      start_date: '2025-01-01',
      end_date: '2025-12-31',
      amount: 5000,
      type: 'compraventa',
      status: 'active',
      description: 'A test contract',
      object: 'Goods sale',
      fulfillment_place: 'Office A',
      dispute_resolution: 'Arbitration',
      has_confidentiality: true,
      guarantees: 'Bank guarantee',
      renewal_type: 'automatica',
      created_by: 1,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    render(<ContraparteForm {...baseProps} contract={contract} type="client" />);
    expect(screen.getByLabelText(/contract number/i)).toHaveValue('CTR-100');
    expect(screen.getByLabelText(/title/i)).toHaveValue('Test Contract');
    expect(screen.getByLabelText(/amount/i)).toHaveValue(5000);
    expect(screen.getByLabelText(/contract type/i)).toHaveValue('compraventa');
    expect(screen.getByLabelText(/status/i)).toHaveValue('active');
    expect(screen.getByLabelText(/fulfillment place/i)).toHaveValue('Office A');
    expect(screen.getByLabelText(/dispute resolution/i)).toHaveValue('Arbitration');
  });
});
