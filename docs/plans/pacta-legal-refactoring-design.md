
**PACTA**

Contract Lifecycle Management

**Design Document: Legal Compliance Refactoring + UX Improvements**

Version 1.0  ·  18 April 2026

*Decreto-Ley No. 304 "De la Contratación Económica" + Decreto No. 310*


# **1. Overview**
This document specifies the design for a significant refactoring of PACTA, a Contract Lifecycle Management (CLM) system. The refactoring addresses two parallel objectives:

- **Legal compliance with Decreto-Ley No. 304 “De la Contratación Económica” (Cuba, 2012) and its implementing Decreto No. 310, which define the legal framework, contract types, and required clauses for economic contracts.**
- **UX improvements reported by QA: removal of unnecessary fields from tables and forms, contextual form behavior, advanced filtering, pagination, and user-guidance tooltips.**

|<p>**Baseline Stack**</p><p>Backend: Go (Gin) — SQLite + Goose migrations — REST API at /api/\*</p><p>Frontend: React 18 + TypeScript + Vite — shadcn/ui + Tailwind CSS</p><p>Documents: Generic entity-document system (entity\_id + entity\_type) with file upload/download</p><p>Auth: Session-based with roles: admin > manager > editor > viewer</p>|
| :- |

# **2. Scope Summary**
The refactoring is organized into four groups. Implementation should proceed in this order to minimize rework.

|**Group**|**Description**|**Impact**|**Priority**|
| :- | :- | :- | :- |
|QA Bugs|Four targeted UX fixes reported by QA|Frontend only|Critical|
|Legal Types|Contract types aligned to Decreto No. 310|DB + Backend + Frontend|High|
|Legal Fields|New contract fields from Art. 32–49 of DL-304|DB + Backend + Frontend|High|
|Supplement Type|Modification type field on supplements (Art. 66.2)|DB + Backend + Frontend|Medium|
|Filters & Pagination|Advanced search, filters, and paginated table|Frontend only|High|
|Tooltips|Legal-reference tooltips on all form fields|Frontend only|Medium|

# **3. Group 1 — QA Bug Fixes**
These are precise, low-risk changes. Each maps to a specific QA report.

## **3.1  QA-1: Remove “Title” Field from Contracts**
Current state: ContractForm.tsx has a required “Contract Title” input. The contracts table shows a “Title” column. The contract\_number field already uniquely identifies a contract and is meaningful to users.

Change:

- Remove the title input from ContractForm.tsx.
- Remove the title column from the contracts table in ContractsPage.tsx.
- Remove title from the search filter logic (filterContracts function).
- In the backend, mark the title column as nullable via a migration and stop requiring it in create/update handlers. Do not drop the column — existing data must be preserved.
- The Contract detail page (ContractDetailsPage.tsx) may retain title display if already populated, shown as read-only legacy data.

## **3.2  QA-2: Remove ID Columns from Tables**
Current state: ContractsPage shows an “Internal ID” column. SupplementsPage shows an “Internal ID” column. These are system-generated UUIDs that carry no meaning to end users.

Change:

- Remove the Internal ID TableHead and TableCell from ContractsPage.tsx.
- Remove the Internal ID TableHead and TableCell from SupplementsPage.tsx.
- The internal\_id field remains available in the detail/edit view for system reference and audit purposes. It is not shown in list views.

## **3.3  QA-3: Contextual Form Based on Counterpart Role**
Current state: ContractForm always presents two fixed sections labeled “Client” and “Supplier”, regardless of context.

Required behavior: When creating a new contract, the user first selects the role of the counterpart:

|**Selection**|**Our company acts as…**|**Counterpart section label**|
| :- | :- | :- |
|Client contract|Client (we receive the service/good)|Client Information (our data)|
|Supplier contract|Supplier (we provide the service/good)|Supplier Information (our data)|

Implementation details:

- Add a role selector (radio group or segmented control) at the top of the creation form: “This company acts as → [Client] [Supplier]”.
- When editing an existing contract, this selector is read-only and derived from whether client\_id or supplier\_id maps to the current company.
- The counterpart selector (the “other party”) dynamically shows either the clients list or suppliers list based on the role selection.
- Signers are loaded and labeled according to the role: “Our Authorized Signer” vs. “Counterpart Authorized Signer”.
- The underlying data model (client\_id, supplier\_id) does not change.

## **3.4  QA-4: Advanced Filters + Pagination**
Covered in full in Group 3 (Section 6).

# **4. Group 2 — Legal Contract Types (Decreto No. 310)**
Decreto No. 310 defines fifteen contract categories. The current system uses six generic types that do not map to any legal classification. All types must be replaced.

## **4.1  New Type Taxonomy**

|**Internal Value**|**Display Name (ES)**|**Legal Basis**|
| :- | :- | :- |
|compraventa|Compraventa|Decreto No. 310, Título II|
|suministro|Suministro|Título III|
|prestacion\_servicios|Prestación de Servicios|Título VII|
|agencia|Agencia|Título VIII|
|comision|Comisión|Título IX|
|consignacion|Consignación|Título X|
|arrendamiento|Arrendamiento|Título XII, Cap. I|
|leasing|Leasing|Título XII, Cap. II|
|transporte|Transporte|Título XIV|
|construccion|Construcción|Título XV|
|cooperacion|Cooperación|Título XIII|
|otro|Otro|—|

## **4.2  Migration Strategy**
Because SQLite enforces CHECK constraints at the column level, migration 022 must:

- Add a new column type\_new TEXT with the updated CHECK constraint accepting the new values.
- Run a best-effort mapping of existing values: “service” → “prestacion\_servicios”, “purchase” → “compraventa”, “lease” → “arrendamiento”, “employment” → “otro”, “nda” → “otro”, “other” → “otro”.
- Copy mapped values to type\_new, drop the old type column, rename type\_new to type.

*This migration is irreversible in its mapping; a backup of the database is required before applying it in production.*

# **5. Group 3 — Legal Fields on Contracts & Document Upload**
## **5.1  New Contract Fields (DL-304, Art. 32–49)**
Six optional fields are added to the contract model. They appear in a collapsible “Additional Clauses” section at the bottom of ContractForm to keep the primary form uncluttered.

|**Field**|**DB Column**|**UI Control**|**Legal Reference**|
| :- | :- | :- | :- |
|Contract Object|object|Textarea|Art. 32: prestaciones que conforman el contrato|
|Fulfillment Place|fulfillment\_place|Text input|Art. 7 D-310: lugar de entrega / ejecución|
|Dispute Resolution|dispute\_resolution|Text input|Art. 46: órgano judicial o arbitral pactado|
|Confidentiality Clause|has\_confidentiality|Checkbox|Art. 5: obligación de no revelar información|
|Guarantees|guarantees|Textarea|Art. 50: garantías acordadas para el cumplimiento|
|Renewal Type|renewal\_type|Select (3 options)|Art. 48: término de vigencia o prórroga|

Renewal Type select options:

- “automatica” → Prórroga automática al vencimiento
- “manual” → Renovación por acuerdo expreso de las partes
- “cumplimiento” → Expira al cumplirse las obligaciones (Art. 48 default)

## **5.2  Document Upload on Contract & Supplement Forms**
The existing documents system uses a generic entity model (entity\_id + entity\_type). This must be preserved and exposed directly in ContractForm and SupplementForm.

|<p>**Existing Document Infrastructure**</p><p>API endpoint: POST /api/documents (multipart/form-data: file + entity\_id + entity\_type)</p><p>Download: GET /api/documents/{id}/download</p><p>Delete: DELETE /api/documents/{id}</p><p>Storage: server-side path stored in documents.storage\_path column</p><p>entity\_type values in use: “client”, “supplier”, “signer” — add “contract” and “supplement”</p>|
| :- |

Behavior on ContractForm:

- When editing an existing contract, a “Attached Documents” section appears below the main fields.
- It lists existing documents (fetched via documentsAPI.list(contractId, “contract”)) with filename, size, date, and a download button.
- A file picker allows uploading additional documents (any MIME type, max 10 MB per file). Upload fires immediately on file selection via documentsAPI.upload(file, contractId, “contract”).
- Each listed document has a delete button (manager+ permission only).
- When creating a new contract, the document upload section is hidden and a helper note reads: “You can attach documents after saving the contract.”

Behavior on SupplementForm:

- Identical pattern, using entity\_type = “supplement” and the supplement’s id as entity\_id.
- Same create/edit distinction applies.

|<p>**Note: No Model Change Required**</p><p>The document model and API require no changes. Only the UI components ContractForm and SupplementForm need to integrate the existing documentsAPI calls.</p><p>The new entity\_type values “contract” and “supplement” are accepted by the current backend without code changes (entity\_type is stored as free text).</p>|
| :- |

## **5.3  Backend Changes for New Fields**
- Migration 023: ALTER TABLE contracts ADD COLUMN object TEXT, ADD COLUMN fulfillment\_place TEXT, ADD COLUMN dispute\_resolution TEXT, ADD COLUMN has\_confidentiality BOOLEAN DEFAULT 0, ADD COLUMN guarantees TEXT, ADD COLUMN renewal\_type TEXT.
- Update models.Contract struct with the six new fields (all pointers/nullable).
- Update CreateContractRequest and UpdateContractRequest in handlers to accept and persist the new fields.
- No new API endpoints needed.

# **6. Group 4 — Supplement Modification Type (DL-304, Art. 66.2)**
Art. 66.2 of DL-304 defines supplements (suplementos) as documents that modify, concretize, or extend a contract. The current model does not capture which of these purposes a supplement serves.

## **6.1  New Field: modification\_type**

|**Value**|**Display Label (ES)**|**Legal Meaning**|
| :- | :- | :- |
|modificacion|Modificación de cláusulas|Alters one or more existing clauses|
|prorroga|Prórroga de vigencia|Extends the contract duration|
|concrecion|Concretización de contenido|Fills in previously undefined contract details|

Migration 024: ALTER TABLE supplements ADD COLUMN modification\_type TEXT CHECK (modification\_type IN (“modificacion”, “prorroga”, “concrecion”)).

The field is optional (nullable) to avoid breaking existing supplement records.

## **6.2  UI Changes**
- Add a “Type of Modification” select to SupplementForm, placed between the contract selector and the description field.
- Add a “Modification Type” column to the supplements table (hidden on small screens, visible md+).
- Add modification\_type to the supplements filter panel (Section 7).

# **7. Group 5 — Advanced Filters & Pagination**
Applies to both ContractsPage and SupplementsPage. Pagination is client-side (data is already loaded into memory). The backend API does not require changes in this phase.

## **7.1  Contracts Page Filters**

|**Filter**|**Control Type**|**Options / Behavior**|
| :- | :- | :- |
|Search|Text input with search icon|Matches contract\_number, client name, supplier name|
|Party type|Select (3 options)|All / Client contracts only / Supplier contracts only|
|Contract type|Select|All + 12 legal types from Section 4|
|Status|Select|All / Active / Pending / Expired / Cancelled|
|Date range|Two date inputs (from/to)|Filters by start\_date within range|

"Party type" filter logic: a contract is a “Client contract” if the current company’s id appears as client\_id; “Supplier contract” if it appears as supplier\_id. This requires the frontend to know the current company’s id (already available via CompanyContext).

## **7.2  Supplements Page Filters**

|**Filter**|**Control Type**|**Options / Behavior**|
| :- | :- | :- |
|Search|Text input|Matches supplement\_number, parent contract number|
|Status|Select|All / Draft / Approved / Active|
|Modification type|Select|All / Modificación / Prórroga / Concretización|
|Parent contract|Select (searchable)|All + list of contracts by number|

## **7.3  Pagination Component**
A shared Pagination component is created and reused in both pages.

- Default page size: 10 records.
- Page size selector: 10 / 25 / 50 / 100 (rendered as a Select to the right of the pagination controls).
- Navigation: « First | ‹ Prev | [page numbers, max 5 visible] | Next › | Last ».
- Status indicator: “Showing 1–10 of 47 contracts” above the table on the right.
- When filters change, page resets to 1.
- Component interface: <Pagination data={T[]} pageSize={n} onPageChange={(slice: T[]) => void} />.

# **8. Group 6 — Legal Reference Tooltips**
## **8.1  FieldTooltip Component**
A new reusable component FieldTooltip wraps a Radix UI Tooltip around a small Info icon (lucide-react). It is placed inline next to the field Label.

Interface:

- <FieldTooltip content="Tooltip text" /> — renders as an Info icon that shows the tooltip on hover/focus.
- Props: content: string, link?: string (optional link to the specific article for power users).

## **8.2  Tooltip Assignments**

|**Field**|**Tooltip Text**|
| :- | :- |
|Contract Number|Identificador único del contrato asignado por la entidad. Art. 10, DL-304.|
|Contract Type|Clasificación del contrato según Decreto No. 310. Determina las obligaciones específicas de cada parte.|
|Object|Art. 32, DL-304: el objeto debe describir claramente las prestaciones. Incluya cantidades, especificaciones técnicas y condiciones de calidad.|
|Fulfillment Place|Lugar donde se ejecutará la prestación o se entregarán los bienes. Relevant para contratos de compraventa, transporte y construcción.|
|Dispute Resolution|Art. 46, DL-304: las partes deben pactar el órgano judicial o arbitral. Las partes deben agotar la vía amigable antes de acudir a este.|
|Confidentiality|Art. 5, DL-304: las partes están obligadas a no revelar información confidencial intercambiada durante la negociación o ejecución.|
|Guarantees|Art. 50, DL-304: se puede emplear cualquier garantía reconocida en la legislación vigente. Especifique el tipo y condiciones.|
|Renewal Type|Art. 48, DL-304: corresponde a las partes determinar el término de vigencia o la prórroga. Sin pacto expreso, el contrato expira al cumplirse las obligaciones.|
|Modification Type (Supplement)|Art. 66.2, DL-304: el suplemento puede modificar cláusulas, prorrogar la vigencia o concretar contenido pendiente del contrato principal.|
|Effective Date (Supplement)|Fecha desde la cual las modificaciones del suplemento producen efectos jurídicos. Debe ser igual o posterior a la fecha del contrato principal.|
|Status|Ciclo de vida del contrato: Pendiente (sin iniciar) → Activo (en ejecución) → Vencido (fecha de fin superada) / Cancelado (terminado por acuerdo o incumplimiento).|

# **9. Data Model Changes**
## **9.1  Database Migrations Summary**

|**Migration**|**Table**|**Change**|
| :- | :- | :- |
|022|contracts|Remap type column to new legal values via type\_new intermediary|
|023|contracts|ADD COLUMN object, fulfillment\_place, dispute\_resolution, has\_confidentiality, guarantees, renewal\_type; ALTER title to nullable|
|024|supplements|ADD COLUMN modification\_type TEXT CHECK IN (modificacion, prorroga, concrecion)|

## **9.2  Go Model Updates**
models.Contract — add fields:

- Object \*string json:"object,omitempty"
- FulfillmentPlace \*string json:"fulfillment\_place,omitempty"
- DisputeResolution \*string json:"dispute\_resolution,omitempty"
- HasConfidentiality bool json:"has\_confidentiality"
- Guarantees \*string json:"guarantees,omitempty"
- RenewalType \*string json:"renewal\_type,omitempty"
- Title \*string json:"title,omitempty" — change from string to \*string

models.Supplement — add field:

- ModificationType \*string json:"modification\_type,omitempty"

## **9.3  TypeScript Type Updates (types/index.ts)**
ContractType union: replace current six values with the twelve legal types from Section 4.

Contract interface: remove required title, add optional fields:

- object?: string
- fulfillment\_place?: string
- dispute\_resolution?: string
- has\_confidentiality?: boolean
- guarantees?: string
- renewal\_type?: “automatica” | “manual” | “cumplimiento”

Supplement interface: add modification\_type?: “modificacion” | “prorroga” | “concrecion”

New type ModificationType = “modificacion” | “prorroga” | “concrecion”

# **10. Frontend Component Changes**

|**File**|**Changes**|
| :- | :- |
|src/types/index.ts|New ContractType values, new fields on Contract, ModificationType, modification\_type on Supplement|
|src/pages/ContractsPage.tsx|Remove ID column & title column; add party-type, type, status, date-range filters; add Pagination component|
|src/pages/SupplementsPage.tsx|Remove ID column; add status, modification-type, parent-contract filters; add Pagination component|
|src/components/contracts/ContractForm.tsx|Remove title field; add role selector (client/supplier); add legal fields section; add document upload section; add FieldTooltip on all fields|
|src/components/supplements/SupplementForm.tsx|Add modification\_type select; add document upload section; add FieldTooltip on key fields|
|src/components/ui/FieldTooltip.tsx|New component: Info icon + Radix Tooltip wrapper|
|src/components/ui/Pagination.tsx|New shared pagination component|
|src/lib/contracts-api.ts|Add new fields to CreateContractRequest and UpdateContractRequest|
|src/lib/supplements-api.ts|Add modification\_type to CreateSupplementRequest and UpdateSupplementRequest|

# **11. Out of Scope (Next Phases)**
- Per-contract-type field validation (e.g., transport contracts requiring origin/destination places).
- PDF document generation from contract data using the legal templates.
- Digital signature workflow.
- Server-side pagination and filtering (API query parameters).
- Contract renewal automation based on renewal\_type field.

# **12. Design Approval**
This document represents the agreed design for the PACTA legal compliance refactoring. Implementation should proceed group by group in the order presented. Each group can be implemented and deployed independently.

|**Role**|**Name**|**Date**|
| :- | :- | :- |
|Product Owner|||
|Lead Developer|||
|QA Lead|||

*Document path: docs/plans/2026-04-18-legal-compliance-ux-refactoring-design.md*
PACTA — Documento de Diseño	Legal Compliance + UX Refactoring	pág.
