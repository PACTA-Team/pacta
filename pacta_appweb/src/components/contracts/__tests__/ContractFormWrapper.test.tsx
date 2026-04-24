// Mock i18next before any imports that use it
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Mock global fetch for HEAD verification tests
global.fetch = vi.fn();

// Mock hooks and APIs
vi.mock('@/hooks/useOwnCompanies', () => ({
  useOwnCompanies: () => ({
    ownCompanies: [{ id: 1, name: 'Company 1', company_type: 'single', address: '', tax_id: '', created_at: '', updated_at: '' }],
    selectedOwnCompany: { id: 1, name: 'Company 1', company_type: 'single', address: '', tax_id: '', created_at: '', updated_at: '' },
    setSelectedOwnCompany: vi.fn(),
    loading: false,
    error: null,
  }),
}));

vi.mock('@/lib/clients-api', () => ({
  clientsAPI: {
    listByCompany: vi.fn(),
  },
}));

vi.mock('@/lib/suppliers-api', () => ({
  suppliersAPI: {
    listByCompany: vi.fn(),
  },
}));

vi.mock('@/lib/signers-api', () => ({
  signersAPI: {
    listByCompany: vi.fn(),
  },
}));

vi.mock('@/lib/upload', () => ({
  upload: {
    cleanupTemporary: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock child components - enhance to allow field population via onFieldChange
vi.mock('../ContraparteForm', () => ({
  default: ({ onAddContraparte, onAddResponsible, onDocumentRemove, pendingDocument, onDocumentChange, isLoading, loadingSigners, onFieldChange }: any) => (
    <div data-testid="contraparte-form">
      <button data-testid="add-counterpart" onClick={onAddContraparte}>Add Counterpart</button>
      <button data-testid="add-signer" onClick={onAddResponsible}>Add Signer</button>
      <button data-testid="remove-doc" onClick={onDocumentRemove}>Remove Doc</button>
      {pendingDocument && <div data-testid="pending-doc">{pendingDocument.file.name}</div>}
      <div data-testid="loading-states" data-is-loading={isLoading} data-signers-loading={loadingSigners}></div>
      {/* Hidden inputs to simulate form fields for validation */}
      <input data-testid="field-contract_number" type="text" onChange={(e) => onFieldChange?.('contract_number', e.target.value)} />
      <input data-testid="field-start_date" type="date" onChange={(e) => onFieldChange?.('start_date', e.target.value)} />
      <input data-testid="field-end_date" type="date" onChange={(e) => onFieldChange?.('end_date', e.target.value)} />
      <input data-testid="field-amount" type="number" onChange={(e) => onFieldChange?.('amount', parseFloat(e.target.value))} />
      <select data-testid="field-type" onChange={(e) => onFieldChange?.('type', e.target.value)}>
        <option value="">Select...</option>
        <option value="service">Service</option>
        <option value="supply">Supply</option>
      </select>
      <select data-testid="field-status" onChange={(e) => onFieldChange?.('status', e.target.value)}>
        <option value="">Select...</option>
        <option value="active">Active</option>
        <option value="draft">Draft</option>
      </select>
    </div>
  ),
}));

vi.mock('../ContractDocumentUpload', () => ({
  __esModule: true,
  default: ({ pendingDocument, onUpload, onRemove }: any) => (
    <div data-testid="contract-document-upload">
      {pendingDocument && <span data-testid="uploaded-doc">{pendingDocument.file.name}</span>}
      <button data-testid="upload-btn" onClick={() => onUpload({ url: 'http://temp', key: 'k', file: new File([''], 'f') })}>Upload</button>
      <button data-testid="remove-doc-btn" onClick={onRemove}>Remove</button>
    </div>
  ),
}));

vi.mock('@/components/modals/ClientInlineModal', () => ({
  ClientInlineModal: () => <div data-testid="client-modal">Client Modal</div>,
}));

vi.mock('@/components/modals/SupplierInlineModal', () => ({
  SupplierInlineModal: () => <div data-testid="supplier-modal">Supplier Modal</div>,
}));

vi.mock('@/components/modals/SignerInlineModal', () => ({
  SignerInlineModal: () => <div data-testid="signer-modal">Signer Modal</div>,
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContractFormWrapper from '../ContractFormWrapper';
import { toast as sonnerToast } from 'sonner';

// Alias toast to avoid conflict with mock? Already mocked.

describe('ContractFormWrapper', () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset DOM and fetch mock
    document.body.innerHTML = '';
    (global.fetch as any).mockReset();
  });

  it('renders with all child components', () => {
    render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    expect(screen.getByText('newContract')).toBeInTheDocument();
    expect(screen.getByTestId('contraparte-form')).toBeInTheDocument();
    expect(screen.getByTestId('contract-document-upload')).toBeInTheDocument();
    expect(screen.queryByTestId('client-modal')).not.toBeInTheDocument();
  });

  it('shows loading indicator in counterpart select when loadingClients/suppliers is true', async () => {
    const { container } = render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    await act(async () => {});
    const select = screen.getByRole('combobox', { name: /proveedor/i });
    expect(select).toBeDisabled();
  });

  it('shows error and does not submit when required fields are missing', async () => {
    const user = userEvent.setup();
    render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    // Click submit button with form empty
    await user.click(screen.getByRole('button', { name: /crear contrato/i }));
    await waitFor(() => {
      expect(sonnerToast.error).toHaveBeenCalled();
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates all required fields individually', async () => {
    const user = userEvent.setup();
    render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Fill only some fields
    const contractNumInput = screen.getByTestId('field-contract_number');
    const amountInput = screen.getByTestId('field-amount');
    
    await user.type(contractNumInput, 'CTR-001');
    await user.type(amountInput, '5000');
    
    // Submit should fail
    await user.click(screen.getByRole('button', { name: /crear contrato/i }));
    
    await waitFor(() => {
      expect(sonnerToast.error).toHaveBeenCalledWith(expect.stringContaining('start_date'));
    });
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('disables submit button while submitting', async () => {
    const user = userEvent.setup();
    let resolveSubmit: () => void;
    const slowPromise = new Promise<void>((resolve) => { resolveSubmit = resolve; });
    const slowOnSubmit = vi.fn().mockImplementation(() => slowPromise);
    
    render(<ContractFormWrapper onSubmit={slowOnSubmit} onCancel={mockOnCancel} />);
    
    // Fill required fields using the test inputs
    await user.type(screen.getByTestId('field-contract_number'), 'CTR-001');
    await user.type(screen.getByTestId('field-start_date'), '2026-01-01');
    await user.type(screen.getByTestId('field-end_date'), '2026-12-31');
    await user.type(screen.getByTestId('field-amount'), '5000');
    await user.selectOptions(screen.getByTestId('field-type'), 'service');
    await user.selectOptions(screen.getByTestId('field-status'), 'active');
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /crear contrato/i }));
    
    // Button should be disabled immediately after click
    await waitFor(() => {
      const submitBtn = screen.getByRole('button', { name: /crear contrato|saving/i });
      expect(submitBtn).toBeDisabled();
    });
    
    // Resolve the promise to complete submission
    resolveSubmit();
    await waitFor(() => {
      expect(slowOnSubmit).toHaveBeenCalled();
    });
    
    // Button should be enabled again
    await waitFor(() => {
      const submitBtn = screen.getByRole('button', { name: /crear contrato/i });
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it('performs HEAD verification and blocks submission on 404', async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValue({ ok: false, status: 404 });
    
    render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Fill required fields
    await user.type(screen.getByTestId('field-contract_number'), 'CTR-001');
    await user.type(screen.getByTestId('field-start_date'), '2026-01-01');
    await user.type(screen.getByTestId('field-end_date'), '2026-12-31');
    await user.type(screen.getByTestId('field-amount'), '5000');
    await user.selectOptions(screen.getByTestId('field-type'), 'service');
    await user.selectOptions(screen.getByTestId('field-status'), 'active');
    
    // Upload a document (sets pendingDocument)
    await user.click(screen.getByTestId('upload-btn'));
    
    // Verify document is uploaded
    expect(screen.getByTestId('uploaded-doc')).toBeInTheDocument();
    expect(screen.getByTestId('pending-doc')).toBeInTheDocument();
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /crear contrato/i }));
    
    // Wait for fetch HEAD call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('http://temp'),
        expect.objectContaining({ method: 'HEAD' })
      );
    });
    
    // Should show error about expired document
    await waitFor(() => {
      expect(sonnerToast.error).toHaveBeenCalledWith('El documento ha expirado. Por favor, súbalo nuevamente.');
    });
    
    // onSubmit should NOT be called
    expect(mockOnSubmit).not.toHaveBeenCalled();
    
    // pendingDocument should be cleared
    expect(screen.queryByTestId('pending-doc')).not.toBeInTheDocument();
  });

  it('allows submission when document HEAD succeeds (200)', async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });
    
    render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Fill required fields
    await user.type(screen.getByTestId('field-contract_number'), 'CTR-001');
    await user.type(screen.getByTestId('field-start_date'), '2026-01-01');
    await user.type(screen.getByTestId('field-end_date'), '2026-12-31');
    await user.type(screen.getByTestId('field-amount'), '5000');
    await user.selectOptions(screen.getByTestId('field-type'), 'service');
    await user.selectOptions(screen.getByTestId('field-status'), 'active');
    
    // Upload a document
    await user.click(screen.getByTestId('upload-btn'));
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /crear contrato/i }));
    
    // Wait for HEAD verification to succeed
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('http://temp'),
        expect.objectContaining({ method: 'HEAD' })
      );
    });
    
    // Wait for onSubmit to be called
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    });
    
    // Verify submit data structure
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        contract_number: 'CTR-001',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        amount: 5000,
        type: 'service',
        status: 'active',
        company_id: 1,
        document_url: 'http://temp',
        document_key: 'k',
      })
    );
  });

  it('preserves pendingDocument when partial error occurs after HEAD verification', async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });
    const failingOnSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
    
    render(<ContractFormWrapper onSubmit={failingOnSubmit} onCancel={mockOnCancel} />);
    
    // Fill required fields
    await user.type(screen.getByTestId('field-contract_number'), 'CTR-001');
    await user.type(screen.getByTestId('field-start_date'), '2026-01-01');
    await user.type(screen.getByTestId('field-end_date'), '2026-12-31');
    await user.type(screen.getByTestId('field-amount'), '5000');
    await user.selectOptions(screen.getByTestId('field-type'), 'service');
    await user.selectOptions(screen.getByTestId('field-status'), 'active');
    
    // Upload a document
    await user.click(screen.getByTestId('upload-btn'));
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /crear contrato/i }));
    
    // Wait for HEAD verification to succeed and onSubmit to be called
    await waitFor(() => {
      expect(failingOnSubmit).toHaveBeenCalled();
    });
    
    // pendingDocument should still be present after error (not cleared)
    expect(screen.getByTestId('pending-doc')).toBeInTheDocument();
    
    // Error toast should be shown
    expect(sonnerToast.error).toHaveBeenCalledWith('Network error');
  });

  it('clears pendingDocument on successful submission', async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockResolvedValue({ ok: true, status: 200 });
    
    render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Fill required fields
    await user.type(screen.getByTestId('field-contract_number'), 'CTR-001');
    await user.type(screen.getByTestId('field-start_date'), '2026-01-01');
    await user.type(screen.getByTestId('field-end_date'), '2026-12-31');
    await user.type(screen.getByTestId('field-amount'), '5000');
    await user.selectOptions(screen.getByTestId('field-type'), 'service');
    await user.selectOptions(screen.getByTestId('field-status'), 'active');
    
    // Upload a document
    await user.click(screen.getByTestId('upload-btn'));
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /crear contrato/i }));
    
    // Wait for successful submission
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalled();
    });
    
    // pendingDocument should be cleared
    expect(screen.queryByTestId('pending-doc')).not.toBeInTheDocument();
  });

  it('handles HEAD verification network error gracefully', async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
    
    render(<ContractFormWrapper onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    // Fill required fields
    await user.type(screen.getByTestId('field-contract_number'), 'CTR-001');
    await user.type(screen.getByTestId('field-start_date'), '2026-01-01');
    await user.type(screen.getByTestId('field-end_date'), '2026-12-31');
    await user.type(screen.getByTestId('field-amount'), '5000');
    await user.selectOptions(screen.getByTestId('field-type'), 'service');
    await user.selectOptions(screen.getByTestId('field-status'), 'active');
    
    // Upload a document
    await user.click(screen.getByTestId('upload-btn'));
    
    // Submit form
    await user.click(screen.getByRole('button', { name: /crear contrato/i }));
    
    // Should show network error toast
    await waitFor(() => {
      expect(sonnerToast.error).toHaveBeenCalledWith('Error al verificar documento. Intente nuevamente.');
    });
    
    // onSubmit should NOT be called
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
