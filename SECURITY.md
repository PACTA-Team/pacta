# Security Policy

## Supported Versions

We release patches for security vulnerabilities. The following versions are currently supported:

| Version | Supported          |
| ------- | ------------------ |
| 0.42.x  | :white_check_mark: |
| 0.41.x  | :white_check_mark: |
| < 0.40  | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within PACTA, please send an email to pactateam@gmail.com. All security vulnerabilities will be promptly addressed.

Please include the following information:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Security Features

PACTA implements several security measures to protect your data:

- **Local-only binding** — Server listens on `127.0.0.1` only, making it inaccessible from network
- **httpOnly, SameSite=Strict cookies** — Prevents XSS token theft
- **bcrypt password hashing** — Cost factor 10 for secure password storage
- **Parameterized SQL queries** — No SQL injection vectors
- **Server-side session management** — Full control over session lifecycle
- **Role-based authorization** — Enforced at the API handler level
- **Input validation** — All user inputs are validated before processing
- **File upload restrictions** — Limited file types and size limits (50MB max)

## Best Practices

1. **Keep PACTA updated** — Always use the latest version
2. **Use strong passwords** — Minimum 8 characters recommended
3. **Restrict network access** — PACTA is designed for local use
4. **Regular backups** — Backup your SQLite database regularly
5. **Monitor access logs** — Check audit logs for suspicious activity

## Vulnerability Disclosure Timeline

- **Day 0**: Vulnerability reported
- **Day 1-7**: Acknowledgment and initial assessment
- **Day 8-30**: Patch development and testing
- **Day 31**: Security advisory and patch release

## Contact

For security-related issues, please contact: pactateam@gmail.com
