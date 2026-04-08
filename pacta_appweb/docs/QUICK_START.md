# Guía Rápida de Despliegue - Pacta

## 🚀 Despliegue en 5 Minutos

### Opción 1: Red Local (Más Rápido)
```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 3. Construir y ejecutar
pnpm build
pnpm start

# 4. Acceder en http://localhost:3000
```

### Opción 2: Vercel (Internet)
```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Desplegar
vercel --prod

# 3. Configurar variables de entorno en el dashboard de Vercel
```

## 📋 Checklist Mínimo

- [ ] Node.js 18+ instalado
- [ ] Cuenta de Supabase creada
- [ ] Variables de entorno configuradas
- [ ] Puerto 3000 disponible (local)

## 🔧 Variables de Entorno Esenciales
```env
SUPABASE_URL=your-project-url.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## 🆘 ¿Necesitas Ayuda?
- Ver [Guía Completa](./DEPLOYMENT_GUIDE.md)
- Issues comunes en [Solución de Problemas](./DEPLOYMENT_GUIDE.md#solución-de-problemas-comunes)
