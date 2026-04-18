# Mobile Notifications Button - Design

## Problem
- En vista móvil, no hay botón de notificaciones en el header
- El dropdown de perfil tiene un item "notificaciones" que no navega a ningún lado

## Solution

### 1. Añadir NotificationsDropdown en header móvil
- Mostrar icono de campana con badge de contador antes del UserDropdown
- Visible solo en móvil (`md:hidden`)
- Badge muestra número de notificaciones sin leer (ya implementado en el componente)

### 2. Fixar el item de notificaciones en UserDropdown
- Añadir navegación a `/notifications` en el dropdown de perfil

## Changes

### AppLayout.tsx
- Añadir `<NotificationsDropdown />` en la sección móvil del header, antes de UserDropdown

### UserDropdown.tsx
- Añadir `onClick={() => handleNavigation("/notifications")}` al item de notificaciones