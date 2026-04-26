# PACTA Security Workspace

## Overview
Esta carpeta contiene toda la información relacionada con la seguridad del proyecto PACTA, incluyendo auditorías, herramientas de testing, y planes de remediación.

## Contenido

### Auditorías de Seguridad
- **SECURITY_AUDIT_CSO.md** — Auditoría comprehensiva de seguridad (CSO mode) realizada el 2026-04-26. Incluye:
  - 1 hallazgo CRÍTICO
  - 7 hallazgos ALTO (HIGH)
  - 12 hallazgos MEDIO (MEDIUM)
  - 8 hallazgos BAJO (LOW)
  - Análisis OWASP Top 10 2021
  - Revisión GDPR y PCI-DSS
  - Resumen de dependencias vulnerables

### Herramientas de Testing
- **create_qa_user.py** — Script Python para crear un usuario de QA en la base de datos SQLite con rol admin. Útil para pruebas de penetración y validación de controles de acceso.

### Planes de Remediación
- (A crear) Plan detallado de corrección de vulnerabilidades ordenado por severidad
- (A crear) Checklist de verificación post-remediación

## Acceso Rápido

### Credenciales de QA
```bash
python3 create_qa_user.py
```
- Email: `qa@pacta.test`
- Password: `QaTest123!`
- Rol: `admin`
- Estado: `active`

### Revisar Hallazgos Críticos
1. [SQL Injection en código muerto](#1-sql-injection-vulnerability-in-dead-code)
2. [Server bind 0.0.0.0](#2-server-binds-to-all-network-interfaces-00000)
3. [No HTTPS/TLS](#3-no-httpstls-encryption)
4. [CSP con unsafe-inline/unsafe-eval](#4-content-security-policy-allows-unsafe-inline-and-unsafe-eval)
5. [gorilla/csrf CVE-2025-47909](#4-gorillacsrf-v173---cve-2025-47909-trustedorigins-bypass)
6. [User enumeration](#5-user-enumeration-via-login-error-messages)
7. [Default password hardcodeado](#6-hardcoded-default-admin-password-in-frontend-code)

## Estado de Remedación

| # | Vulnerabilidad | Severidad | Estado | Fecha Límite |
|---|----------------|-----------|--------|--------------|
| CS-001 | SQL injection (rls.go) | CRÍTICO | ⬜️ Pendiente | 48h |
| CS-002 | Bind 0.0.0.0:3000 | ALTO | ⬜️ Pendiente | 48h |
| CS-003 | No HTTPS/TLS | ALTO | ⬜️ Pendiente | 48h |
| CS-004 | CSP debil | ALTO | ⬜️ Pendiente | 48h |
| CS-005 | gorilla/csrf CVE | ALTO | ⬜️ Pendiente | 48h |
| CS-006 | User enumeration | ALTO | ⬜️ Pendiente | 48h |
| CS-007 | Hardcoded password | ALTO | ⬜️ Pendiente | 48h |
| CS-008 | Rate limiting insuficiente | MEDIO | ⬜️ Pendiente | 1-2 sem |
| CS-009 | IP logging spoofable | MEDIO | ⬜️ Pendiente | 1-2 sem |
| CS-010 | Path traversal check incompleto | MEDIO | ⬜️ Pendiente | 1-2 sem |
| ... | ... | ... | ... | ... |

> **Nota:** Las vulnerabilidades críticas y altas deben corregirse en las primeras 48 horas. Las medias/bajas en 1-2 semanas.

## Referencias
- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [CWE - Common Weakness Enumeration](https://cwe.mitre.org/)
- [GDPR Artículos relevantes](https://gdpr.eu/)
- [PCI-DSS Requirements](https://www.pcisecuritystandards.org/)
