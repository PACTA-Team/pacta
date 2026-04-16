# Modern Floating Sidebar Design

## Overview
Rediseño del sidebar tipo "flotante" con glassmorphism, efectos modernos y scroll incorporado.

## Design Specs

### Container
- `fixed top-4 left-4 bottom-4` - no toca bordes
- `w-64` expandido, `w-20` colapsado
- `rounded-2xl` - bordes redondeados
- `bg-background/80 backdrop-blur-md` - glassmorphism
- `shadow-lg shadow-black/5` - sombra sutil
- `border border-border/50` - borde sutil

### Scroll
- ScrollArea de Radix UI para navegación
- Scroll vertical cuando contenido excede altura

### Responsive
- Desktop (>1024px): siempre visible, expandido
- Tablet (768-1024px): colapsado por defecto  
- Mobile (<768px): oculto, abre como drawer/modal

### Navigation Items
- Espaciado `gap-1`, padding `px-3 py-2`
- Hover: `hover:bg-muted transition-colors`
- Active: `bg-primary/10 text-primary border-l-2 border-primary`

## Implementation

### Files to Modify
- `pacta_appweb/src/components/layout/AppSidebar.tsx`

### Changes
1. Cambiar container de `flex h-screen flex-col border-r` a `fixed rounded-2xl shadow-lg`
2. Agregar backdrop-blur y efectos glass
3. Implementar scroll con ScrollArea
4. Agregar breakpoints responsive con media queries
5. Agregar botón toggle más accesible