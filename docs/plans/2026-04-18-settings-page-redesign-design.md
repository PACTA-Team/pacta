# Design: Settings Page Redesign

## Overview
Rediseñar la página de configuración para que cada sesión sea una página completa con tabs horizontales y botón guardar por sesión.

## UI Structure
```
┌─────────────────────────────────────────────────────────┐
│  Email                                    [Guardar]    │
├─────────────────────────────────────────────────────────┤
│  [Formulario completo con campos de email]             │
└─────────────────────────────────────────────────────────┘
```

## Requirements

### Navigation
- Tabs horizontales en la parte superior (mantiene estructura actual)
- Las tabs navigan entre secciones: Email, Empresa, Registro, General, Notificaciones

### Layout por Sección
- Cada sección es una "página completa" visualmente
- Título de sección prominente
- Botón guardar dedicado por sección
- Más espacio para los formularios

### Componentes
1. **EmailSection** - SMTP, Brevo, email desde BD
2. **CompanySection** - Nombre, email, dirección
3. **RegistrationSection** - Métodos de registro
4. **GeneralSection** - Idioma, timezone
5. **NotificationsSection** - Notificaciones de contrato (ya existe)

### Funcionalidad
- Auto-guardado al cambiar de sección (opcional)
- Feedback visual de guardado exitoso/error
- Estados de loading/saving por sección

## Technical Approach
- Crear componentes independientes por sección
- Cada componente maneja su propio estado y guardado
- Mantener el patrón existente de tabs horizontales
- No modificar el sidebar de la aplicación