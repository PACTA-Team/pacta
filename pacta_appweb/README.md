# Pacta - Contract Management Application

[![Build Binaries](https://github.com/PACTA-Team/pacta_appweb/actions/workflows/build-binaries.yml/badge.svg)](https://github.com/PACTA-Team/pacta_appweb/actions/workflows/build-binaries.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Policy-brightgreen)](SECURITY.md)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

Pacta is a comprehensive contract management web application designed to streamline the lifecycle of business agreements. It serves as a digital platform for organizations to manage contracts between clients and suppliers, including tracking contract details, authorized signers, supplements (modifications), and generating various reports. The application provides role-based access control, automated notifications for expiring contracts, and a dashboard for key performance indicators.

## Key Features

- **Contracts Management**: Create, view, edit, and delete contracts with details such as contract number, title, client/supplier information, authorized signers, start/end dates, monetary amount, contract type, status, and description.
- **Clients and Suppliers**: Manage business entities involved in contracts and associate authorized signers.
- **Authorized Signers**: Handle personnel authorized to sign contracts on behalf of clients or suppliers.
- **Supplements**: Track contract modifications or amendments with approval workflows and status tracking.
- **Reports**: Comprehensive reporting system including contract status distribution, financial analysis, upcoming expirations, client/supplier analysis, supplements overview, and export capabilities.
- **Dashboard**: Overview with KPI cards, status distribution charts, and quick action buttons.
- **Notifications**: Automated alerts for expiring contracts and other events.
- **Documents**: Repository for storing contract-related documents.
- **Users Management**: User accounts with role-based permissions (admin, manager, editor, viewer).
- **Audit Logging**: Change tracking system for contract operations.
- **Responsive Design**: Mobile-first approach with responsive layouts.

## Installation

### Pre-built Binaries (Recommended)

Download the latest release from [GitHub Releases](https://github.com/PACTA-Team/pacta_appweb/releases).

#### Linux (Ubuntu/Debian)

```bash
# Download the latest .deb package
sudo dpkg -i pacta_*.deb

# Fix any missing dependencies
sudo apt -f install

# Service starts automatically
# Access at: http://127.0.0.1:3000
```

#### Windows

1. Download `pacta-setup-*.exe` from the latest release
2. Run as Administrator
3. The installer will:
   - Install to `%ProgramFiles%\PACTA\`
   - Register a Windows service (auto-start)
   - Start the server automatically
4. Access at: http://127.0.0.1:3000

### From Source

```bash
# Clone the repository
git clone https://github.com/PACTA-Team/pacta_appweb.git
cd pacta_appweb

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env and set JWT_SECRET (openssl rand -base64 32)

# Start development server
npm run dev
```

### Service Management

**Linux:**
```bash
sudo systemctl status pacta    # Check status
sudo systemctl restart pacta   # Restart
sudo journalctl -u pacta -f    # View logs
```

**Windows:**
```powershell
nssm status Pacta              # Check status
nssm restart Pacta             # Restart
```

### LAN Access

To allow network access:
- **Linux:** `sudo ufw allow 3000/tcp`
- **Windows:** Add inbound rule for port 3000 in Windows Defender Firewall

## Technology Stack

- **Frontend Framework**: Next.js 15.5 with App Router
- **UI Library**: React 19 with TypeScript
- **Styling**: Tailwind CSS 4 with Radix UI components (shadcn/ui)
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Date Handling**: date-fns
- **Database**: SQLite (better-sqlite3)
- **Authentication**: bcrypt + JWT (jose library)
- **State Management**: React Context (AuthContext)
- **Build Tools**: Turbopack, PostCSS, ESLint

## Getting Started

### Prerequisites

- Node.js 18+

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env and set JWT_SECRET
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The SQLite database will be created automatically in `data/pacta.db`

5. Open http://127.0.0.1:3000 in your browser and complete the setup wizard to create your admin account.

### API Endpoints

- `POST /next_api/auth/login` - Login with email/password
- `POST /next_api/auth/register` - Register new user (pending approval)
- `POST /next_api/auth/setup` - Initial admin setup wizard
- `GET /next_api/health` - Health check
- `POST /next_api/upload` - File upload (requires auth)

## Usage Guide

1. **First Setup**: Complete the setup wizard to create your admin account.
2. **Dashboard**: View KPIs, contract status distribution, and quick actions.
3. **Manage Contracts**: Navigate to Contracts to create, edit, or view contracts with full lifecycle tracking.
4. **Clients & Suppliers**: Manage business entities and their authorized signers.
5. **Supplements**: Track contract modifications with approval workflows.
6. **Reports**: Generate financial analysis, expiration reports, and export data.
7. **Documents**: Upload and organize contract-related documents.
8. **Notifications**: Monitor alerts for expiring contracts and system events.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── contracts/          # Contract management pages
│   ├── clients/            # Client management pages
│   ├── suppliers/          # Supplier management pages
│   ├── authorized-signers/ # Authorized signer pages
│   ├── supplements/        # Supplement management pages
│   ├── reports/            # Reporting pages
│   ├── dashboard/          # Dashboard page
│   ├── notifications/      # Notifications page
│   ├── documents/          # Document repository
│   ├── users/              # User management
│   └── next_api/           # API routes
├── components/             # Reusable React components
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Layout components
│   ├── auth/               # Authentication components
│   └── [feature]/          # Feature-specific components
├── contexts/               # React contexts (AuthContext)
├── hooks/                  # Custom hooks
├── lib/                    # Utility libraries
│   ├── db.ts               # SQLite database layer
│   ├── schema.sql          # Database schema
│   ├── seed.ts             # Seed data
│   ├── auth.ts             # bcrypt + JWT auth
│   ├── auth-middleware.ts  # API auth middleware
│   ├── crud-operations.ts  # SQLite CRUD operations
│   ├── validation-schemas.ts # Zod schemas
│   └── utils.ts            # General utilities
├── middlewares/            # Next.js middlewares
├── types/                  # TypeScript type definitions
└── ...
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature-name`.
3. Commit your changes: `git commit -m 'Add some feature'`.
4. Push to the branch: `git push origin feature/your-feature-name`.
5. Open a pull request.

Please ensure your code follows the project's coding standards and includes appropriate tests.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Security

See [SECURITY.md](SECURITY.md) for our security policy and vulnerability disclosure process.

## Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel.
2. Set environment variables in Vercel dashboard (`JWT_SECRET`).
3. Deploy the application.

Note: SQLite database is file-based. For multi-instance deployments, consider a shared database solution.
