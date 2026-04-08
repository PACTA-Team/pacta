# Guía de Despliegue en Producción - Pacta

## Tabla de Contenidos
1. [Requisitos del Sistema](#requisitos-del-sistema)
2. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
3. [Despliegue en Red Local](#despliegue-en-red-local)
4. [Despliegue con Acceso a Internet](#despliegue-con-acceso-a-internet)
5. [Configuración de Seguridad](#configuración-de-seguridad)
6. [Comandos de Construcción y Despliegue](#comandos-de-construcción-y-despliegue)
7. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)
8. [Solución de Problemas Comunes](#solución-de-problemas-comunes)

## Requisitos del Sistema

### Mínimos
- **Node.js**: 18.17.0 o superior
- **pnpm**: 8.0.0 o superior
- **Memoria RAM**: 2GB mínimo
- **Espacio en disco**: 10GB disponibles
- **Sistema Operativo**: Windows 10/11, macOS 10.15+, Ubuntu 18.04+

### Recomendados
- **Node.js**: 20.x LTS
- **Memoria RAM**: 4GB o más
- **CPU**: 2 núcleos o más
- **Espacio en disco**: 20GB disponibles

## Configuración de Variables de Entorno

### 1. Crear archivo `.env.local`
```bash
cp .env.example .env.local
```

### 2. Configurar variables esenciales
```env
# Supabase Configuration
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Production Settings
NODE_ENV=production
PORT=3000

# Optional: Custom Domain
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Variables de seguridad adicionales (opcional)
```env
# Security Headers
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://your-domain.com

# Analytics (opcional)
NEXT_PUBLIC_GA_ID=your-google-analytics-id
```

## Despliegue en Red Local

### Opción 1: Desarrollo Local con Acceso de Red
```bash
# Instalar dependencias
pnpm install

# Construir aplicación
pnpm build

# Iniciar servidor en modo producción
pnpm start
```

### Opción 2: Docker para Red Local
Crear `docker-compose.yml`:
```yaml
version: '3.8'
services:
  pacta-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    restart: unless-stopped
```

Crear `Dockerfile`:
```dockerfile
FROM node:20-alpine AS base
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

Comandos Docker:
```bash
# Construir imagen
docker build -t pacta-app .

# Ejecutar con Docker Compose
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### Configuración de Acceso en Red Local
1. **Firewall**: Abrir puerto 3000
   - Windows: `netsh advfirewall firewall add rule name="Pacta" dir=in action=allow protocol=TCP localport=3000`
   - Linux: `sudo ufw allow 3000`

2. **Acceso desde otros dispositivos**:
   - Usar IP local: `http://192.168.1.XXX:3000`
   - Configurar router para redirección de puerto si es necesario

## Despliegue con Acceso a Internet

### Opción 1: Vercel (Recomendado)
```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel --prod

# Configurar dominio personalizado
vercel domains add your-domain.com
```

### Opción 2: Railway
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login y despliegue
railway login
railway init
railway up
```

### Opción 3: DigitalOcean App Platform
1. Crear cuenta en DigitalOcean
2. Conectar repositorio GitHub
3. Configurar variables de entorno
4. Desplegar automáticamente

### Opción 4: Servidor Privado (VPS)
```bash
# En servidor VPS
sudo apt update
sudo apt install -y nodejs npm

# Clonar repositorio
git clone your-repo-url
cd pactajs

# Instalar y construir
pnpm install
pnpm build

# Configurar PM2 para gestión de procesos
npm install -g pm2
pm2 start npm --name "pacta" -- start
pm2 startup
pm2 save
```

### Configuración de Dominio y SSL
1. **Configurar DNS**:
   ```
   A Record: @ -> IP_DEL_SERVIDOR
   A Record: www -> IP_DEL_SERVIDOR
   ```

2. **Configurar SSL con Let's Encrypt** (VPS):
   ```bash
   sudo apt install certbot
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

## Configuración de Seguridad

### 1. Headers de Seguridad (Ya configurados en next.config.ts)
- X-Frame-Options
- Content-Security-Policy
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security

### 2. Variables de Entorno Seguras
```bash
# Usar secrets en producción
echo "SUPABASE_URL=tu-url" > .env.local
chmod 600 .env.local
```

### 3. Configuración CORS
En `next.config.ts`, restringir orígenes en producción:
```typescript
{
  key: "Access-Control-Allow-Origin",
  value: "https://your-domain.com", // En lugar de "*"
}
```

## Comandos de Construcción y Despliegue

### Flujo Completo de Despliegue
```bash
# 1. Limpiar caché
pnpm clean || rm -rf .next

# 2. Instalar dependencias
pnpm install --frozen-lockfile

# 3. Verificar código
pnpm lint

# 4. Construir aplicación
pnpm build

# 5. Probar construcción localmente
pnpm start

# 6. Desplegar a producción
# (Depende del método elegido)
```

### Scripts Útiles
```bash
# Verificar salud de la aplicación
curl -f http://localhost:3000/api/health || exit 1

# Reiniciar aplicación (PM2)
pm2 restart pacta

# Ver logs en tiempo real
pm2 logs pacta --lines 100
```

## Monitoreo y Mantenimiento

### 1. Monitoreo Básico
```bash
# Ver uso de recursos
htop  # Linux
# Task Manager # Windows

# Ver logs de aplicación
tail -f /var/log/nginx/access.log
pm2 logs pacta
```

### 2. Health Check Endpoint
Crear `src/app/api/health/route.ts`:
```typescript
export async function GET() {
  return Response.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version 
  });
}
```

### 3. Backup Automático
```bash
# Script de backup (ejemplo)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backups/pacta_$DATE.tar.gz /path/to/pactajs
find /backups -name "pacta_*.tar.gz" -mtime +7 -delete
```

## Solución de Problemas Comunes

### Problema: Puerto en uso
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/macOS
lsof -ti:3000 | xargs kill -9
```

### Problema: Variables de entorno no cargadas
```bash
# Verificar variables
printenv | grep SUPABASE

# Recargar en sesión actual
source .env.local
```

### Problema: Construcción fallida
```bash
# Limpiar completamente
rm -rf .next node_modules
pnpm install
pnpm build
```

### Problema: Acceso denegado en red
```bash
# Verificar firewall
sudo ufw status
# Windows
netsh advfirewall show allprofiles

# Verificar escucha en todas las interfaces
netstat -an | grep :3000
```

### Problema: SSL/TLS
```bash
# Verificar certificado
openssl s_client -connect your-domain.com:443

# Renovar certificado Let's Encrypt
sudo certbot renew
```

## Checklist de Despliegue

### Pre-Despliegue
- [ ] Variables de entorno configuradas
- [ ] Código probado en staging
- [ ] Backup de base de datos
- [ ] SSL certificado configurado
- [ ] DNS apuntando correctamente

### Post-Despliegue
- [ ] Verificar health endpoint
- [ ] Probar flujo completo de usuario
- [ ] Configurar monitoreo
- [ ] Documentar cambios
- [ ] Comunicar a equipo

## Contacto y Soporte

- **Documentación oficial**: [Next.js Deployment](https://nextjs.org/docs/deployment)
- **Soporte Supabase**: [Supabase Docs](https://supabase.com/docs)
- **Issues del proyecto**: Crear issue en GitHub

---

**Nota**: Esta guía se actualiza regularmente. Verificar la versión más reciente en el repositorio.
