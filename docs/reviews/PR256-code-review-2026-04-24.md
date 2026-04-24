# Code Review — PR #256: contracts-unified-2026-04-24

**Rama:** `feature/contracts-unified-2026-04-24`  
**Objetivo:** Unificar el trabajo de 3 ramas de refactor de contracts.  
**Archivos cambiados:** 35 archivos (6787 inserciones, 858 eliminaciones)  
**Fecha:** 2026-04-24  

---

## Resumen Ejecutivo

El PR introduce una nueva arquitectura de formulario de contratos dividida en tres componentes (`ContractFormWrapper`, `ContraparteForm`, `ContractDocumentUpload`) y agrega pruebas unitarias y E2E. Se identificaron **6 problemas críticos/altos** que bloquean o deberían corregirse antes del merge:

1. **CRÍTICO**: `createContract` en backend no guarda `document_url`/`document_key` (las columnas existen pero no se insertan).
2. **CRÍTICO**: Import incorrecto de `ContractSubmitData` en `ContraparteForm.tsx` (no existe en `@/types/index.ts`).
3. **ALTO**: Validación frontend incompleta — faltan `client_id`, `suplier_id`, `signer_ids`.
4. **ALTO**: Archivos temporales no se limpian tras submit exitoso (acumulación en disco).
5. **ALTO**: Endpoints GET de contratos no incluyen `document_url`/`document_key` (no se puede editar con documento existente).
6. **MEDIO**: Import no usado `useCompanyFilter` en `ContractFormWrapper`.

---

## Detalle de Problemas

### CRITICAL

#### 1. createContract no inserta document_url y document_key
**Archivo:** `internal/handlers/contracts.go:241-250`  
**Issue:** La sentencia INSERT de `createContract` no incluye las columnas `document_url` y `document_key`, aunque:
- La migración `20260424_add_contract_document_url.sql` agregó esas columnas.
- El struct `createContractRequest` incluye `DocumentURL` y `DocumentKey` con tags `json:"document_url"` y `json:"document_key"`.
- El frontend envía esos campos en el payload.
- La validación en líneas 225-232 exige que estén presentes.
Como resultado, el contrato se crea **sin referencia al documento subido**. El documento temporal queda huérfano y el contrato no muestra documento asociado.

**Fix:** Modificar el INSERT para incluir las columnas:
```go
INSERT INTO contracts (..., document_url, document_key, ...) VALUES (..., ?, ?, ...)
```
Y pasar `req.DocumentURL`, `req.DocumentKey` como argumentos.

También se recomienda:
- Validar que `document_url` sea HTTPS (como en updateContract línea 369).
- Considerar mover el archivo temporal a almacenamiento permanente y registrar en tabla `documents` si aplica.

#### 2. Import incorrecto de ContractSubmitData en ContraparteForm
**Archivo:** `pacta_appweb/src/components/contracts/ContraparteForm.tsx:9`  
**Issue:** Se importa `ContractSubmitData` desde `@/types`, pero `src/types/index.ts` **no exporta** esa interfaz (solo está en `src/types/contract.ts`). Esto producirá error de compilación en TypeScript: `Module '"@/types"' has no exported member 'ContractSubmitData'`.

**Fix:** Cambiar la línea de import a:
```ts
import { Contract, Client, Supplier, AuthorizedSigner, ContractType, ContractStatus, RenewalType, ContractSubmitData } from '@/types/contract';
```
Alternativa: agregar `export * from './contract';` en `src/types/index.ts`.

---

### HIGH

#### 3. Validación frontend incompleta — IDs de contraparte y firmantes faltan
**Archivo:** `pacta_appweb/src/components/contracts/ContractFormWrapper.tsx:236-244`  
**Issue:** La validación de campos requeridos solo verifica:
```ts
const requiredFields: (keyof ContractSubmitData)[] = ['contract_number', 'start_date', 'end_date', 'amount', 'type', 'status'];
```
Faltan campos obligatorios para el backend:
- `client_id`
- `supplier_id`
- `client_signer_id`
- `supplier_signer_id`

Esto permite enviar el formulario sin seleccionar contraparte ni firmantes, resultando en error 400 ("client not found" o "supplier not found") después de la verificación de documento.

**Fix:** Agregar validación explícita:
```ts
if (!formDataRef.current.client_id || !formDataRef.current.supplier_id) {
  toast.error('Seleccione cliente y proveedor');
  return;
}
if (!formDataRef.current.client_signer_id || !formDataRef.current.supplier_signer_id) {
  toast.error('Seleccione representantes autorizados de ambas partes');
  return;
}
```
Nota: Los valores son strings; validar que no sean `''`.

#### 4. Archivos temporales no se limpian después de submit exitoso
**Archivo:** `pacta_appweb/src/components/contracts/ContractFormWrapper.tsx:229-303`  
**Issue:** Tras un submit exitoso (`await onSubmit(submitData)`), se ejecuta `setPendingDocument(null)` pero **no se llama a `upload.cleanupTemporary`**. El archivo temporal permanece en el servidor (`/api/documents/temp/{key}`), causando acumulación de archivos huérfanos.

El backend tampoco mueve el archivo a permanente ni lo elimina. El único cleanup es:
- Al hacer clic en "Remove" en la UI (`handleRemoveDocument` → DELETE).
- Al desmontar `ContractDocumentUpload` (efecto `useEffect` cleanup), solo si el componente se desmonta (no ocurre tras submit).

**Fix:** Después de `await onSubmit(submitData)` y antes de `setPendingDocument(null)`, agregar:
```ts
if (pendingDocument) {
  await upload.cleanupTemporary(pendingDocument.key);
}
```
Considera manejo de errores: `catch` para registrar pero no bloquear.

**Recomendación adicional:** Evaluar mover el archivo a almacenamiento permanente en el backend durante create/update, en lugar de confiar en temp + cleanup. Idealmente el backend debería:
1. Mover/ copiar el archivo de `temp/` a `documents/`.
2. Crear registro en tabla `documents` (si se lleva control).
3. Eliminar el archivo temporal.
Esto garantiza persistencia y evita dependencia del frontend para limpieza.

#### 5. Endpoints GET de contratos no devuelven document_url ni document_key
**Archivos:** 
- `internal/handlers/contracts.go:68-100` (`listContracts`)
- `internal/handlers/contracts.go:281-306` (`getContract`)

**Issue:** Las consultas SELECT no incluyen las columnas `document_url` y `document_key`. Esto impide que el frontend muestre el documento asociado al editar un contrato existente, ya que la interfaz espera `Contract.document_url` y `Contract.document_key` (definidos en `src/types/index.ts:126-127`). Al editar, `pendingDocument` estará vacío y el usuario tendría que volver a subir el documento.

**Fix:** Agregar `c.document_url`, `c.document_key` a la lista de columnas en ambas consultas:
```sql
SELECT c.id, c.internal_id, ..., c.document_url, c.document_key, ...
```
Y escanear en `rows.Scan`:
```go
err := rows.Scan(&c.ID, &c.InternalID, ..., &c.DocumentURL, &c.DocumentKey)
```

#### 6. Validación HTTPS inconsistente en createContract
**Archivo:** `internal/handlers/contracts.go:224-232` (creación) vs `~340-370` (actualización)  
**Issue:** En `updateContract` se valida que `document_url` empiece con `https://` (línea ~369). En `createContract` no hay tal validación. Esto puede permitir URLs inseguras (http) o con esquemas inválidos.

**Fix:** Agregar validación similar en `createContract` antes del INSERT:
```go
if req.DocumentURL != nil && *req.DocumentURL != "" {
  if !strings.HasPrefix(*req.DocumentURL, "https://") {
    h.Error(w, http.StatusBadRequest, "document_url must be HTTPS")
    return
  }
}
```

---

### MEDIUM

#### 7. Import no utilizado: `useCompanyFilter`
**Archivo:** `pacta_appweb/src/components/contracts/ContractFormWrapper.tsx:10`  
**Issue:** Se importa `useCompanyFilter` pero no se utiliza en el componente.

**Fix:** Eliminar la línea de import.

#### 8. Nombres confusos en `ContraparteForm`
**Archivo:** `pacta_appweb/src/components/contracts/ContraparteForm.tsx:18,55,56`  
**Issue:**
- Prop `type: 'client' | 'supplier'` representa el rol de **nuestra** empresa, pero el nombre `type` es ambiguo.
- Variable `isClientRole` en realidad significa "nuestra empresa es cliente", no "la contraparte es cliente". Lógica:
  ```ts
  const isClientRole = type === 'client';
  const counterpartLabel = isClientRole ? 'Proveedor' : 'Cliente';
  ```
  Esto es contraintuitivo.

**Fix sugerido (no bloqueante):**
- Renombrar prop `type` → `ourRole`.
- Renombrar `isClientRole` → `isOurRoleClient`.
- Ajustar nombres en `ContractFormWrapper` al pasar la prop.

#### 9. Validación de archivo duplicada (cliente + servidor)
**Archivos:** `ContractDocumentUpload.tsx:7-15` (cliente) y `internal/handlers/documents.go:308-315` (servidor).  
**Issue:** La validación de tamaño y extensión se repite en frontend y backend. No es un problema grave, pero aumenta mantenimiento. Puede intencional para UX inmediata.

**Fix:** Considerar mantener ambas (UX) o centralizar constants.

---

### LOW

#### 10. `console.error`/`console.warn` en código de producción
**Archivos:**
- `ContractDocumentUpload.tsx:40,90`
- `ContractFormWrapper.tsx:223,429,440`
- `ContraparteForm.tsx:202`
- `useCompanyFilter.ts:44`
- `useOwnCompanies.ts:27`

**Issue:** Uso de `console.error` y `console.warn` expone trazas en consola del usuario. Deberían usa un logger (p.ej. `logger.error`) o silenciarse en producción.

**Fix:** Reemplazar con un servicio de logging que pueda deshabilitarse en producción, o eliminar si no son críticos.

#### 11. TODO pendiente en documentación
**Archivo:** `CHANGELOG.md` (línea agregada en diff: `+- [ ] Escribir tests unitarios básicos (render) para TODOS los nuevos componentes`)  
**Issue:** Tarea pendiente de tests unitarios para todos los componentes nuevos. Ya existen tests para los tres componentes y hooks, pero puede faltar cobertura total.

**Fix:** Verificar cobertura con `npm run test:coverage` y completar.

#### 12. Uso de `any` en mapeo de opciones
**Archivo:** `ContraparteForm.tsx:250`  
**Issue:** `counterpartOptions.map((option: any) => ...)` — se puede tipar correctamente como `Client | Supplier`.

**Fix:** Cambiar a `(option: Client | Supplier)` o usar un tipo genérico consistente.

#### 13. Variable no usada: `loadingCompanies`
**Archivo:** `ContractFormWrapper.tsx:41`  
**Issue:** Se desestructura `loading: loadingCompanies` del hook `useOwnCompanies` pero la variable no se usa en el componente.

**Fix:** Eliminar `loadingCompanies` de la desestructuración o usarla para mostrar spinner de carga de empresas.

---

## Otras Observaciones

### Flujo de documentos (diseño)
Actualmente:
1. Frontend sube archivo a `/api/upload/temp` → guarda en disco en `temp/`, devuelve `{url, key}`.
2. Frontend incluye `document_url` y `document_key` en createContract.
3. Backend **valida** presence pero **no mueve** el archivo a permanente, ni crea registro en `documents`, ni limpia el temp.
4. El contrato almacena la URL `temp/...` que puede ser servida mientras el archivo exista.
5. Si el temp se limpia (por ejemplo manualmente), el documento del contrato se rompe.

**Recomendación:** Implementar en backend, durante create/update, una operación_atómica que:
- Mueva el archivo de `temp/{key}` a `documents/{contract_id}/{fila}`
- Actualice `document_url` a la nueva ruta permanente.
- Elimine el archivo temporal solo si el movimiento fue exitoso.
O bien, diseñar un proceso de "promoción" de temp a permanente.

### Manejo de errores en submit
En `ContractFormWrapper.handleSubmit`:
```ts
} catch (err) {
  const message = err instanceof Error ? err.message : 'Error al guardar contrato';
  if (message.toLowerCase().includes('document') || message.includes('document_url')) {
    toast.error('El contrato se creó, pero hubo un problema con el documento. Por favor reintente la carga.');
  } else {
    toast.error(message);
  }
  throw err;
}
```
El mensaje "El contrato se creó..." es engañoso porque el contrato **no** se creó si hay error. Debería ser: "Error al guardar el contrato: {mensaje}". El throw puede ser útil para que el componente padre maneje el error.

### Efectos y dependencias
- `ContractFormWrapper`: useEffect de signers depende de `formDataRef.current.client_id` y `formDataRef.current.supplier_id`. Dado que `formDataRef.current` es un objeto mutable, las dependencias causarán re-ejecución cada vez que cambien esos valores, que es el comportamiento deseado. Asegurar que no se creen closures innecesarias.

### Pagos y modales
- Los modales `ClientInlineModal`, `SupplierInlineModal`, `SignerInlineModal` se abren y al hacer `onSuccess` recargan listas. Parece correcto, pero verificar que `selectedOwnCompany` esté definido en esos contextos (sí, se pasa `companyId={selectedOwnCompany.id}`).

---

## Checklist de Revisión

| Categoría | Estado | Notas |
|-----------|--------|-------|
| Seguridad (SQL injection, XSS) | ✅ | Uso de parámetros preparados en Go, sanitización implícita en React |
| Validación de entrada frontend | ⚠️ | Incompleta (IDs requeridos no validados) |
| Validación de entrada backend | ⚠️ | Faltan columnas documento en INSERT; validación HTTPS inconsistente |
| Manejo de errores | ⚠️ | console.error en producción; mensaje engañoso |
| Duplicación de código | ✅ | Componentes separados con responsabilidades claras |
| Nombres consistentes | ⚠️ | Alguna ambigüedad en `type`/`isClientRole` |
| Imports correctos | ❌ | ContractSubmitData desde '@/types' no existe |
| Tests cubren flujo | ⚠️ | Tests unitarios ok, pero tests de integración del formulario completo con ContraparteFormmock no verifican envío de IDs |
| Docs/CHANGELOG | ⚠️ | TODO pendiente |
| Performance | ✅ | AbortController para cancelar requests obsoletas; useMemo/useCallback usados |

---

## Recomendaciones de Refactor (post-merge)

1. **Mover lógica de promoción de documento al backend** (ideal). Frontend solo debe subir a temp y notificar éxito; backend convierte a permanente.
2. **Centralizar validaciones** en un esquema (Zod) compartido entre frontend y backend, o al menos unificar mensajes.
3. **Renombrar props ambiguas** en ContraparteForm para claridad.
4. **Agregar logger** en lugar de console.*
5. **Limpiar imports no usados**.
6. **Completar cobertura de tests** para el flujo completo de envío con selección de contraparte y firmantes.

---

## ¿Listo para merge?

**NO**. Se requiere corregir al menos:

- [ ] **#1 (CRÍTICO)**: Agregar `document_url` y `document_key` al INSERT de `createContract`.
- [ ] **#2 (CRÍTICO)**: Corregir import de `ContractSubmitData` a `@/types/contract` o re-exportar en `index.ts`.
- [ ] **#3 (ALTO)**: Añadir validación de `client_id`, `supplier_id`, `client_signer_id`, `supplier_signer_id` en `ContractFormWrapper.handleSubmit`.
- [ ] **#4 (ALTO)**: Limpiar archivo temporal tras submit exitoso en `ContractFormWrapper`.
- [ ] **#5 (ALTO)**: Incluir `document_url` y `document_key` en los SELECTs de `listContracts` y `getContract`.
- [ ] **#6 (ALTO)**: Aplicar validación HTTPS en `createContract` (igual que `updateContract`).

**Acción recomendada:** Abrir issues separados para cada problema crítico/alto y corregir antes de merge. Alternativamente, solicitar al autor que realice las correcciones en el mismo PR.

---

## Comentarios Positivos

- La nueva arquitectura modular (`ContractFormWrapper` + `ContraparteForm` + `ContractDocumentUpload`) mejora separación de responsabilidades.
- Uso de hooks personalizados (`useOwnCompanies`, `useCompanyFilter`) centraliza lógica de negocio.
- Manejo de requests con `AbortController` previene race conditions.
- Verificación HEAD de documentos antes de envío previene errores por expiración.
- Cobertura de tests unitarios y E2E es sólida (aunque puede mejorarse integración).
- Migración de base de datos agregada.

---

**Revisor:** Kilo  
**Nivel de confianza:** Alto (basado en análisis estático del diff y lectura de código)  
**Sugerencia:** Realizar testing manual del flujo completo (crear contrato con documento, editar contrato existente, verificar que el documento persiste) después de correcciones.
