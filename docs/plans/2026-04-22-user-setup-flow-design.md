# Diseño: Refactorización del Flujo de Registro y Setup de Usuario

**Fecha:** 2026-04-22
**Proyecto:** PACTA - Sistema de Gestión de Contratos
**Estado:** Aprobado

## 1. Visión General

Rediseñar el flujo de registro y activación de cuentas en PACTA para nuevos usuarios, separando el registro básico de la configuración de empresa/rol mediante un setup wizard separado que se activa tras el primer login.

## 2. Cambios en el Formulario de Registro

### 2.1 Campos del Formulario (Registro simple)
- **name**: Nombre completo del usuario (required)
- **email**: Correo electrónico (required, único)
- **password**: Contraseña (mínimo 8 caracteres)
- **confirmPassword**: Confirmación de contraseña (debe coincidir)
- **language**: Idioma preferido (es/en)

### 2.2 Eliminaciones
- ❌ Eliminar `registrationMode` (select email/approval)
- ❌ Eliminar selector de empresa (CompanySelector)
- ❌ Eliminar campo `companyName`

### 2.3 Comportamiento del Registro
- El usuario se registra con email/password
- El estado inicial del usuario siempre será `pending_approval`
- No hay verificación por email en el registro
- El sistema notifica a administradores sobre la nueva solicitud

## 3. Flujo de Login para Nuevos Usuarios

### 3.1 Verificación de Estado
Al hacer login, si el usuario tiene estado `pending_approval`:
- ✅ Puede acceder a su perfil
- ❌ No puede acceder a funcionalidades del sistema
- ✅ Se muestra el Setup Wizard de nuevos usuarios

## 4. Setup Wizard para Nuevos Usuarios

### 4.1 Pasos del Wizard

```
PASO 1: Selección de Empresa
  ├── Opción A: Seleccionar empresa existente (dropdown)
  └── Opción B: Crear nueva empresa (formulario)
  
PASO 2: Selección de Rol
  ├── manager_empresa (Manager de la empresa)
  ├── editor (Editor de contratos)
  ├── viewer (Solo lectura)
  └── ⚠️ Aviso: "Esta selección no se puede cambiar después. 
      Si está creando una nueva empresa, seleccione 'manager_empresa'. 
      Para cambiar su rol, contacte a soporte."

PASO 3: Configuración de Empresa
  ├── name: Nombre de la empresa
  ├── address: Dirección
  ├── tax_id: Identificación fiscal (NIT/RUC)
  ├── phone: Teléfono
  └── email: Email de contacto

PASO 4: Configurar Personal Autorizado
  ├── Agregar firmantes autorizados (nombre, cargo, email)
  └── Es la "ficha de cliente" de la empresa

PASO 5: Configurar Primer Proveedor (Opcional)
  ├── Skip: "Agregar después"
  └── Crear primera compañía proveedora
  └── ⚠️ Tutorial mode: explicación visual del proceso

PASO 6: Configurar Primer Cliente (Opcional)
  ├── Skip: "Agregar después"
  └── Crear primera compañía cliente
  └── ⚠️ Tutorial mode: explicar flujo de contratos cliente/proveedor

PASO 7: Resumen y Envío
  ├── Resumen de configuración
  └── Envío: estado -> "pending_activation"
```

### 4.2 Estados de Usuario Modificados

| Estado | Descripción | Permisos |
|--------|-------------|----------|
| `pending_approval` | Registro completado, esperando revisión | Perfil solo |
| `pending_activation` | Setup completado, esperando activación admin | Perfil solo |
| `active` | Cuenta fully activa | Acceso total |

## 5. Cambios en el Backend

### 5.1 Modelo de Usuario
- Eliminar campo `role` del registro inicial
- El rol se asigna durante el setup wizard
- Agregar campo `setup_completed` (boolean)

### 5.2 Nuevo Endpoint: PATCH /api/setup
- Body: { company_id, company_data, role, authorized_signers, first_supplier, first_client }

### 5.3 Cambios en /api/login
- Verificar `setup_completed` para determinar si mostrar wizard
- Si `setup_completed = false`, devolver flag `needs_setup: true`

## 6. Notificaciones

### 6.1 Registro Inicial
- Notificar admins: "Nuevo usuario registrado: [nombre] ([email]) esperando aprobación"

### 6.2 Tras Setup Wizard
- Notificar admins: "Usuario [nombre] completó setup, solicitando activación"

## 7. Interfaz de Admin

### 7.1 Panel de Usuarios Pendientes
- Mostrar usuarios con estado `pending_approval` Y `pending_activation`
- Acciones: Aprobar (activar), Rechazar
- Ver detalles del setup completado

---

## 8. Pendientes (No incluídos en esta iteración)

- Tutorial interactivo completo para creación de contratos
- Sistema de notificaciones en tiempo real
- Workflow de aprobación multi-nivel