# Sidebar Desktop - Diseño

## Problema

En la vista Desktop el sidebar sale contraído y no hay opción de expandirlo. El diseño actual es flotante con glassmorphism, lo cual no es natural visualmente en UX/UI de apps empresariales.

Además, el logo cuando el sidebar está contraído muestra un icono (FileText) en lugar del logo SVG del proyecto.

## Solución Aprobada

### Comportamiento
- **Desktop**: Sidebar expandible por usuario (botón toggle siempre visible)
- **Tablet**: Comportamiento actual (opcional: revisar después)
- **Mobile**: drawer sin cambios

### Estilo Visual
- Sidebar integrado al layout (fijo al borde izquierdo,sin glassmorphism ni efecto flotante)
- Ancho: 256px expandido, 80px contraído

### Logo
- Usar `contract_icon.svg` de `/pacta_appweb/src/images/`
- Siempre visible:
  - Expandido: Logo + texto "PACTA"
  - Contraído: Solo el logo como imagen SVG

### Botón Toggle
- Visible siempre (no oculto cuando está contraído)
- Permite expandir al usuario

## Archivos a Modificar

1. `pacta_appweb/src/components/layout/AppLayout.tsx` - margins para sidebar integrado
2. `pacta_appweb/src/components/layout/AppSidebar.tsx` - importar SVG, render logo, botón toggle