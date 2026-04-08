# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

We take the security of PACTA seriously. If you discover a security vulnerability, please follow these steps:

1. **DO NOT** open a public GitHub issue
2. Email us at [security@pacta.app](mailto:security@pacta.app) with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
3. We will acknowledge receipt within 48 hours
4. We will provide a detailed response within 7 days
5. We will work on a fix and coordinate the release timeline

## Security Measures

### Authentication
- JWT tokens with httpOnly cookies (not accessible via JavaScript)
- bcrypt password hashing with 12 rounds
- Password complexity requirements (min 12 chars, uppercase, lowercase, number, special char)
- Admin approval workflow for new registrations

### Authorization
- Role-based access control (admin, manager, editor, viewer)
- Server-side middleware verification on all API routes
- Route-level protection in Next.js middleware

### Data Protection
- CORS restricted to local Origins only (127.0.0.1, localhost)
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Error message sanitization in production (no stack traces)
- Input validation with Zod schemas on all API endpoints

### Infrastructure
- Local-first architecture with SQLite (no external database exposure)
- File upload validation with magic byte checking
- No hardcoded credentials or secrets in source code

## Security Checklist for Deployments

- [ ] JWT_SECRET is set via environment variable (not default)
- [ ] .env file is not committed to repository
- [ ] CORS origins are explicitly configured
- [ ] Firewall rules restrict access to port 3000
- [ ] Regular backups of SQLite database
- [ ] Dependencies are kept up to date

## Acknowledgments

We appreciate responsible disclosure from the security community.

---

Last updated: April 2026
