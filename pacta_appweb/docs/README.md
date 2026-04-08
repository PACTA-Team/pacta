# Documentación de Pacta

Esta carpeta contiene la documentación técnica y guías de despliegue para el proyecto Pacta.

## Archivos Disponibles

### 📚 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
Guía completa de despliegue en producción que incluye:
- Configuración para redes locales
- Configuración para acceso a internet
- Requisitos del sistema
- Variables de entorno
- Comandos de construcción y despliegue
- Configuración de seguridad
- Monitoreo y mantenimiento
- Solución de problemas comunes

## Estructura del Proyecto

```
docs/
├── README.md                 # Este archivo
└── DEPLOYMENT_GUIDE.md       # Guía de despliegue completa
```

## Información del Proyecto

**Pacta** es una aplicación web construida con:
- **Framework**: Next.js 15.2.4
- **Base de Datos**: Supabase
- **Estilos**: TailwindCSS
- **Componentes**: Radix UI + shadcn/ui
- **Lenguaje**: TypeScript

## Acceso Rápido

### Para Despliegue Inmediato
1. Revisar [Requisitos del Sistema](./DEPLOYMENT_GUIDE.md#requisitos-del-sistema)
2. Configurar [Variables de Entorno](./DEPLOYMENT_GUIDE.md#configuración-de-variables-de-entorno)
3. Elegir método de despliegue:
   - [Red Local](./DEPLOYMENT_GUIDE.md#despliegue-en-red-local)
   - [Internet](./DEPLOYMENT_GUIDE.md#despliegue-con-acceso-a-internet)

### Comandos Esenciales
```bash
# Instalar dependencias
pnpm install

# Construir para producción
pnpm build

# Iniciar servidor de producción
pnpm start
```

## Soporte

Para preguntas o problemas:
1. Revisar la [guía de solución de problemas](./DEPLOYMENT_GUIDE.md#solución-de-problemas-comunes)
2. Crear un issue en el repositorio del proyecto
3. Contactar al equipo de desarrollo

---

**Última actualización**: Enero 2026
