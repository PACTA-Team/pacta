import { test, expect } from '@playwright/test';

test.describe('Contract Form — New', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contracts/new', { waitUntil: 'networkidle' });
    // If redirected to login, skip test (requires valid auth state)
    if (page.url().includes('/login') || page.url().includes('/auth')) {
      test.skip();
    }
  });

  test('shows loading indicator in counterpart select while fetching', async ({ page }) => {
    // Mock the clientsAPI/suppliersAPI to delay
    await page.route('**/api/clients/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });
    await page.route('**/api/suppliers/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.continue();
    });

    // Select company (if multi-company) and role to trigger load
    // The select should be disabled or show a loading spinner while fetching
    const select = page.locator('[role="combobox"]').first();
    await expect(select).toBeDisabled();
  });

  test('prevents submission when document expires (HEAD 404)', async ({ page }) => {
    // Mock upload endpoint to return temp URL
    await page.route('**/api/documents/temp/**', async (route) => {
      if (route.request().method() === 'HEAD') {
        route.fulfill({ status: 404 });
      } else {
        route.continue();
      }
    });

    // Navigate and fill minimal required fields
    await page.fill('input[id="contract-number"]', 'CTR-001');
    await page.fill('input[id="start-date"]', '2026-01-01');
    await page.fill('input[id="end-date"]', '2026-12-31');
    await page.fill('input[id="amount"]', '5000');
    await page.selectOption('select[id="type"]', 'compraventa');
    await page.selectOption('select[id="status"]', 'active');

    // Upload document via the upload button (mock returns temp URL)
    await page.click('button[data-testid="upload-btn"]');

    // Submit
    await page.click('button:has-text("Crear Contrato")');

    // Expect error toast about expired document
    await expect(page.locator('[data-testid="toast-error"]')).toContainText('documento ha expirado');
  });

  test('allows submission when document HEAD succeeds', async ({ page }) => {
    await page.route('**/api/documents/temp/**', async (route) => {
      if (route.request().method() === 'HEAD') {
        route.fulfill({ status: 200, headers: { 'Content-Length': '123' } });
      } else {
        route.continue();
      }
    });

    // Fill all required fields
    await page.fill('input[id="contract-number"]', 'CTR-001');
    await page.fill('input[id="start-date"]', '2026-01-01');
    await page.fill('input[id="end-date"]', '2026-12-31');
    await page.fill('input[id="amount"]', '5000');
    await page.selectOption('select[id="type"]', 'compraventa');
    await page.selectOption('select[id="status"]', 'active');

    // Upload document
    await page.click('button[data-testid="upload-btn"]');

    // Submit
    await page.click('button:has-text("Crear Contrato")');

    // Expect success toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('fetches signers using optimized endpoint with query params', async ({ page }) => {
    const signersRequests: any[] = [];
    await page.route('**/api/signers**', (route) => {
      signersRequests.push(route.request());
      route.continue();
    });

    // Select a counterpart (supplier if ourRole=client)
    // First, ensure company and role selected
    // The counterpart select triggers signers fetch
    await page.selectOption('select[id="counterpart-client"]', '1'); // assuming supplier id=1 exists in mock

    // Wait for signers request
    await page.waitForTimeout(500);

    expect(signersRequests.length).toBeGreaterThan(0);
    const url = new URL(signersRequests[0].url);
    expect(url.searchParams.has('company_id')).toBeTruthy();
    expect(url.searchParams.has('company_type')).toBeTruthy();
    expect(['client', 'supplier']).toContain(url.searchParams.get('company_type'));
  });
});
