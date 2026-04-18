# QA Bugs Fix Design

## Problema

Múltiples bugs reportados por usuarios QA que necesitan ser resueltos:

1. Pantallas en blanco en escritorio
2. Opciones de Settings amontonadas en móvil
3. Sesión de notificaciones/temas/traducción perdida con nuevo header
4. Traducciones en español con mayúsculas/minúsculas incorrectas
5. Textos en español sin traducción en header
6. No se puede deshabilitar inicio de sesión por verificación de correo

---

## Análisis de Causas Raíz

### Bug 1: Pantallas en blanco en escritorio

**Síntoma**: En desktop las pantallas aparecen en blanco, pero en móvil carga bien.

**Causa raíz**: En `AppLayout.tsx`, el estado `device` se detecta en un `useEffect` que corre después del primer render. Esto significa que:
- El primer render usa `device = 'desktop'` (valor inicial useState)
- El sidebar puede no renders correctamente porque `sidebarCollapsed` también es `false` inicialmente
- Hay una condición de carrera entre el resize handler y el render del sidebar

**Código problemático** (líneas 41-60):
```typescript
const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
// ...
useEffect(() => {
  const handleResize = () => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      setDevice('mobile');
    }
    // etc...
  };
  handleResize(); // Llamado después del primer render
}, []);
```

### Bug 2: Opciones de Settings amontonadas en móvil

**Síntoma**: En móvil, las 6 tabs de Settings aparecen una encima de otra.

**Causa raíz**: En `SettingsPage.tsx:100`:
```tsx
<TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
```

- `grid-cols-6` fuerza 6 columnas en todos los tamaños
- En móvil cada tab es 1/6 del ancho - demasiado pequeño
- Las tabs se stackean verticalmente debido al espacio insuficiente

### Bug 3: Sesión de notificaciones/temas/traducción perdida

**Síntoma**: Después de los cambios del header, los usuarios no encuentran notificaciones, themes, o toggle de idioma.

**Causa raíz**: En `AppLayout.tsx:134-138`:
```tsx
<div className="hidden md:flex items-center gap-2 flex-shrink-0">
  <NotificationsDropdown />
  <LanguageToggle />
  <ThemeToggle />
</div>
```

 Estos 3 componentes tienen `hidden md:flex` - solo visibles en pantallas ≥768px. En móvil los usuarios no tienen acceso a estas funciones.

### Bug 4: Traducciones en minúsculas

**Síntoma**: Las traducciones en español aparecen en minúsculas.

**Causa raíz**: Los valores en `es/settings.json` están en minúsculas:
```json
"title": "Configuración del Sistema",
```

No hay aplicación de capitalización CSS.

### Bug 5: Textos sin traducción en header

**Síntoma**: Algunos textos en el UserDropdown no se traducen correctamente.

**Causa raíz**: En `UserDropdown.tsx:110,118,127`:
```tsx
t("settings") || "Settings"
t("users") || "Users"
t("logout") || "Logout"
```

Las claves "settings" y "users" NO existen en `common.json` - solo en `settings.json`.

### Bug 6: Email verification toggle no funciona

**Síntoma**: No se puede deshabilitar el inicio de sesión por verificación de correo.

**Causa raíz**: La tabla de system-settings y la UI no tienen opción para `registration_requires_verification`. La lógica de registration está hardcodeada en el backend.

---

## Solución Propuesta

### Fix 1: Pantallas en blanco

**Estrategia**: Inicializar device detection antes del primer render usando un efecto de medición del tamaño de ventana同期.

**Cambios**:
- Usar `window.innerWidth` directamente en el render inicial (con typeof check para SSR)
- Eliminar dependencia del useEffect para la detección inicial

### Fix 2: Settings mobile UX

**Estrategia**: Hacer los tabs responsivoscon scroll horizontal en móvil.

**Cambios**:
- Reemplazar `grid-cols-6` con `flex overflow-x-auto`
- Permitir scroll horizontal en móvil
- Mantener tabs visibles en todas las pantallas

### Fix 3: Componentes ocultos en móvil

**Estrategia**: Agregar menú móvil o mover los componentes a un lugar accesible.

**Cambios**:
- Agregar botón de menú en header para móvil que muestre un dropdown con estas opciones
- O mover ThemeToggle, LanguageToggle, NotificationsDropdown al UserDropdown en móvil

### Fix 4: Capitalización de traducciones

**Estrategia**: Applicar CSS de capitalización en componentes o añadir capitalize en los archivos JSON.

**Cambios**:
- Añadir `className="capitalize"` a los elementos que usan traducciones
- O asegurar que los valores en JSON tengan la capitalización correcta

### Fix 5: Traducciones faltantes

**Estrategia**: Agregar las claves faltantes a common.json.

**Cambios**:
- Añadir `"settings"` y `"users"` a `es/common.json` y `en/common.json`

### Fix 6: Email verification toggle

**Estrategia**: Agregar opción en la pestaña Registration o Email Settings.

**Cambios**:
- Añadir toggles de `registration_email_verification_enabled` a la UI
- Añadir la configuración对应的 en la database

---

## Alternativas Consideradas

### Fix 1 - Alternativas:

1. **A1**: Usar `ResizeObserver` en lugar del evento resize - más preciso pero más código
2. **A2**: Usar CSS media queries directamente (`@media`) - más performante pero menos control
3. **A3**: Usar un hook personalizado de detección de tamaño - más reusable

### Fix 3 - Alternativas:

1. **A1**: Duplicar los componentes en ambosheader y UserDropdown - más código pero más simple
2. **A2**: Agregar un menú desplegable en móvil para estas opciones - diseño más limpio
3. **A3**: Mover todo al UserDropdown - cambio más significativo

### Recommended Fix 1: **Usar inicialización del tamaño antes del render**
- Más simple porque solo requiere pequeña modificación
- Resolve el problema de condición de carrera inmediatamente
- Compatible con la arquitectura actual

### Recommended Fix 3: **Duplicar componentes en UserDropdown para móvil**
- Resolución más directa 
- Los usuarios ya esperan encontrar estas opciones en el dropdown
- Mantiene funcionalidad existente

---

## Impacto y Dependencies

### Dependencies
- No se agregannuevas dependencias
- Compatible con React 19 existente

### Riesgo
- Bajo riesgo para Fix 1-5
- Medio para Fix 6 (puede requerir cambios en el backend)

### Testing Necesario
- Verificar que desktop carga correctamente
- Verificar que móvil muestra las opciones de settings
- Verificar traducciones aparecen correctamente
- Verificaremail verification toggle funciona

---

## Próximos Pasos

1. Obtener aprobación del diseño
2. Usar `writing-plans` para crear plan de implementación detallado
3. Implementar cambios
4. QA testing