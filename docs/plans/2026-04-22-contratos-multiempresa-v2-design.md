# Diseño: Contratos Multiempresa - Refactor Completo

**Fecha:** 2026-04-22
**Estado:** Aprobado
**Proyecto:** PACTA

---

## 1. Contexto

Sistema multiempresa donde el usuario gestiona múltiples empresas propias. Al crear contrato, debe especificar:
- Qué empresa propia usa (dropdown si hay múltiples)
- Si esa empresa actúa como cliente o proveedor
- Qué contraparte usar (filtrada por la empresa propia seleccionada)

### 1.1 Reglas de Negocio

1. **Empresa propia**: Empresas que el usuario agregó en setup
2. **Cada empresa puede actuar como cliente O proveedor** en diferentes contratos
3. **No hay restricción de rol** - se selecciona al crear cada contrato

---

## 2. Arquitectura

### 2.1 Flujo de Datos

```
ContractForm
├── 1. Seleccionar rol: "Esta empresa actúa como..." → cliente | supplier
├── 2. Seleccionar empresa propia
│   └── 1 empresa → auto-seleccionar
│   └── múltiples → dropdown
├── 3. Cargar contrapartes según empresa + rol
│   └── client → suppliers API.listByCompany(empresaId)
│   └── supplier → clients API.listByCompany(empresaId)
└── 4. Seleccionar contraparte
```

### 2.2 Componentes Modificados

| Archivo | Acción |
|---------|--------|
| `pacta_appweb/src/components/contracts/ContractForm.tsx` | Fix: company_id en submit, reset al cambiar empresa |
| `pacta_appweb/src/pages/ContractsPage.tsx` | Filter + columna empresa |
| `pacta_appweb/src/pages/SupplementsPage.tsx` | Filter + columna empresa |
| `pacta_appweb/src/pages/ReportsPage.tsx` | Filter por empresa |
| `internal/handlers/contracts.go` | Validación FK |

---

## 3. Comportamiento Esperado

| Escenario | Comportamiento |
|----------|----------------|
| 1 empresa propia | Auto-seleccionar, mostrarse normal |
| Múltiples empresas propias | Dropdown para seleccionar |
| Cambia empresa seleccionada | **LIMPIAR** client_id, supplier_id, ambos signers |
| Edición de contrato existente | No mostrar selector de empresa (solo lectura) |

---

## 4. Fixes Críticos

### 4.1 Fix #1: Enviar company_id al crear contrato

**Problema:** Al crear contrato, no se envía `company_id`. El backend lo obtiene de sesión, puede ser incorrecto.

**Solución:** Enviar `selectedOwnCompany?.id` en onSubmit

```typescript
onSubmit({
  ...formData,
  company_id: selectedOwnCompany?.id,
});
```

### 4.2 Fix #2: Reset contraparte al cambiar empresa

**Problema:** Si usuario cambia empresa propia, la contraparte seleccionada ya no es válida.

**Solución:** Limpiar client_id, supplier_id, y ambos signers cuando cambia empresa

```typescript
onValueChange={(value) => {
  const company = ownCompanies.find(c => c.id === parseInt(value));
  setSelectedOwnCompany(company || null);
  // LIMPIAR estado relacionado
  setFormData(prev => ({
    ...prev,
    client_id: '',
    supplier_id: '',
    client_signer_id: '',
    supplier_signer_id: ''
  }));
  setClientSigners([]);
  setSupplierSigners([]);
}}
```

### 4.3 Fix #3: Validar FK en backend

**Problema:** No se valida que client/supplier pertenezca a la empresa correcta.

**Solución:** En handler createContract, verificar que client_id o supplier_id tenga company_id correcto.

---

## 5. Extensiones a Otras Páginas

### 5.1 ContractsPage

- **Columna empresa**: Mostrar nombre de empresa en tabla
- **Filter dropdown**: [Todas + lista de empresas propias]

### 5.2 SupplementsPage

- **Columna empresa**: Mostrar nombre de empresa en tabla  
- **Filter dropdown**: [Todas + lista de empresas propias]

### 5.3 ReportsPage

- **Filter dropdown**: [Todas + lista de empresas propias]
- Aplica a reportes relevantes (contracts, no supplements)

---

## 6. Fallback (Backward Compatibility)

Si hay 1 sola empresa propia:
- Comportamiento original (sin cambios visibles)
-auto-seleccionar la única empresa

---

## 7. Testing Strategy

```
- [ ] Crear contrato con empresa específica → company_id persiste correcto
- [ ] Cambiar empresa en dropdown → contraparte se limpia  
- [ ] Múltiples empresas → dropdown funciona correctamente
- [ ] 1 sola empresa → auto-selecciona, sin dropdown visible
- [ ] Filter en ContractsPage filtra correctamente
- [ ] Filter en SupplementsPage filtra correctamente
- [ ] Filter en ReportsPage filtra correctamente
```

---

## 8. Estado Actual del Código

| Feature | Estado |
|---------|--------|
| Backend filtrado por company_id (clients, suppliers) | ✅ Implementado |
| Frontend APIs listByCompany() | ✅ Implementado |
| ContractForm selector empresa propia | ✅ Implementado |
| company_id en creación de contrato | ❌ FALTA |
| Reset al cambiar empresa | ❌ FALTA |
| Filter en otras páginas | ⚠️ Parcial |

---

## 9. Notas

- El modelo Contract ya tiene campo `company_id` - no necesita migración
- No se requiere campo `our_role` explícito - el rol se infiere de cuál campo (client_id o supplier_id) está populated