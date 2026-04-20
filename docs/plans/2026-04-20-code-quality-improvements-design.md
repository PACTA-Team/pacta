# Code Quality Improvements Design

**Date**: 2026-04-20  
**Project**: Pacta Frontend + Backend  
**Context**: Code review findings + backend analysis

## Executive Summary

Este documento diseña las soluciones para los 14 issues encontrados en el code review del frontend, considerando también el estado del backend para asegurar consistencia.

## Análisis Frontend vs Backend

| Aspect | Frontend Type | Backend Go | Código Real | Estado |
|--------|--------------|------------|-------------|--------|
| Contratos | camelCase (Contract) | snake_case | snake_case | **INCONSISTENTE** |
| Supplement | snake_case | snake_case | snake_case | ✅ Consistente |
| Client | camelCase | snake_case | snake_case | **INCONSISTENTE** |

**Descubrimiento crítico**: El tipo `Contract` en `types/index.ts` usa camelCase (`contractNumber`, `clientId`), PERO:
- El backend Go devuelve snake_case (`contract_number`, `client_id`)
- El código real del frontend YA usa snake_case (`c.client_id`, `c.contract_number`)
- Los `any[]` ocultan este error de tipos

**La solución**: Actualizar los tipos de frontend para usar snake_case (matching con backend y código real)

---

## Phase 1: Type Safety (Critical)

### 1.1 Usar Tipos del Backend como Fuente de Verdad

**Problema**: 
- Frontend usa `any[]` 
- Tipos mezclados: algunos camelCase (`Contract`), otros snake_case (`Supplement`)
- Backend usa consistentemente snake_case

**Solución**: Los tipos del frontend deben reflejar exactamente los del backend Go (snake_case):

```typescript
// pacta_appweb/src/types/index.ts - CORREGIR Contract para usar snake_case
export interface Contract {
  id: number;
  company_id: number;
  internal_id: string;
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
  created_by?: number;
  created_at: string;
  updated_at: string;
}
```

**Regla**: Todos los tipos que vienen del API deben usar **snake_case** para mantener consistencia con backend Go

### 1.2 Reemplazar todos los `any[]` con tipos propios

Archivos a modificar:
- `ContractsPage.tsx`
- `DashboardPage.tsx`
- `ContractForm.tsx`
- `SupplementsPage.tsx`
- Todos los pages que usan `any[]`

---

## Phase 2: Input Validation (High)

### 2.1 Schemas de validación (Zod)

Zod ya está en package.json. Crear schemas en `src/lib/validation-schemas.ts`

### 2.2 Integración en Forms

- `LoginForm.tsx` - usar loginSchema
- `RegistrationPage.tsx` - usar registerSchema
- `ContractForm.tsx` - usar contractSchema

---

## Phase 3: Error Handling (Critical)

### 3.1 Fix Empty Catch Block

**Ubicación**: `pacta_appweb/src/contexts/AuthContext.tsx`

**Solución**: Cambiar `catch {}` vacío por `catch (error) { console.warn(...) }`

### 3.2 Console en Producción

Agregar condición para mostrar errors solo en dev

---

## Phase 4: DRY - Hooks Reutilizables (Medium)

### 4.1 useListFilter Hook

Crear hook reutilizable para filtering

### 4.2 Centralizar Constantes

Crear `src/lib/constants.ts`

---

## Phase 5: Performance (Medium)

### 5.1 useCallback/useMemo

Wrappear funciones con `useCallback`, resultados con `useMemo`

---

## Phase 6: Accessibility (Low)

### 6.1 ARIA Labels

Agregar `aria-label` a icon buttons

---

## Backend: Sin Cambios Necesarios

El backend ya tiene buena validación. No se requiere modificar.

---

## Implementation Order

1. **Phase 1** (Critical): DTOs + reemplazar any[]
2. **Phase 3** (Critical): Fix empty catch
3. **Phase 2** (High): Validation schemas
4. **Phase 4** (Medium): Hooks + constantes
5. **Phase 5** (Medium): useCallback/useMemo
6. **Phase 6** (Low): Accessibility
