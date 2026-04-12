import React from 'react';
import { useCompany } from '../contexts/CompanyContext';

export default function CompanySelector() {
  const { userCompanies, currentCompany, switchCompany, isMultiCompany } = useCompany();

  if (!isMultiCompany || !currentCompany) return null;

  return (
    <div className="px-3 py-2">
      <label htmlFor="company-select" className="sr-only">
        Select company
      </label>
      <select
        id="company-select"
        value={currentCompany.id}
        onChange={(e) => switchCompany(Number(e.target.value))}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        aria-label="Current company"
      >
        {userCompanies.map((uc) => (
          <option key={uc.company_id} value={uc.company_id}>
            {uc.company_name}
          </option>
        ))}
      </select>
    </div>
  );
}
