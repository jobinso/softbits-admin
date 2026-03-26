# softBITS AdminIT

**System administration console for the softBITS platform**

AdminIT is a React SPA that provides centralized management of all softBITS platform services, users, security, configuration, caching, licensing, and per-application settings. It replaced the former vanilla HTML/JS admin console (31,000 lines) with a modern React + TypeScript architecture.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Features](#features)
- [API Routes](#api-routes)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

## Overview

### Purpose

softbits-admin is the **system administration console** for the softBITS suite. It:

- **Manages users and security** - Console users, roles, API tokens, devices, 2FA/TOTP enrollment
- **Monitors services** - Real-time health dashboard, service status, cache statistics
- **Configures the platform** - Currencies, exchange rates, system configuration, option sets, ERP config
- **Controls licensing** - License upload, validation, module management, compliance checks
- **Administers applications** - Per-app admin pages for ConnectIT, StackIT, FlipIT, FloorIT, LabelIT, ShopIT, InfuseIT, WorkIT, PulpIT
- **Manages system patches** - Apply, rollback, and track patch levels

### Key Features

- 19 admin sections covering all platform administration needs
- Role-based tab visibility with per-user access control
- 2FA/TOTP authentication with setup and verification flows
- Collapsible sidebar (240px expanded, 64px collapsed) with icon tooltips
- Shared component library from softbits-shared (DataTable, Modal, Tabs, etc.)
- Lazy-loaded pages for optimal bundle size
- Real-time dashboard via WebSocket connection to Bridge
- Dark theme UI with teal/mint primary colors

### Technology Stack

**Frontend:**
- **React 18** with **TypeScript** and **Vite 7** build tool
- **React Router v6** for client-side routing
- **Zustand 5.x** for client state management (auth, sidebar)
- **TanStack Query 5.x** for server state management
- **Axios** for HTTP client with JWT refresh interceptor
- **Tailwind CSS 3.4** for styling
- **Lucide React** for icons
- **CodeMirror** for JSON config editing
- **softbits-shared** component library (DataTable, Modal, Tabs, Button, Card, etc.)

**Backend:**
- No separate backend server exists in this project
- All data operations proxy to **softbits-bridge:3000** via Nginx
- Admin API routes are in Bridge: `/admin/*` and `/api/admin/*`

## Architecture

### System Architecture

```
+--------------------------+     +---------------------------+
|  React Frontend (Vite)   |     |  softbits-bridge:3000     |
|  Port: 3080              |     |  Admin Routes             |
|                          |     |  (/admin/*, /api/admin/*) |
|  Pages -> Hooks -> API   |     +---------------------------+
+----------+---------------+                 |
           |                                 |
           | Axios HTTP calls                +---> SQL Server
           |                                 |
+----------v---------------+                 +---> SYSPRO ERP
|  Nginx Reverse Proxy     |                 |
|  /api -> bridge:3000     |                 +---> infuse-work:3990
|  /admin -> bridge:3000   |
|  /work -> work:3990      |
+--------------------------+
```

AdminIT has **no separate backend server**. The frontend is a static React app served by Nginx. All API calls are proxied to softbits-bridge or infuse-work.

### Service Dependencies

**Required:**
- **softbits-bridge:3000** - REST API for all admin operations (must be running)
- **SQL Server** - Database for admin, CRM, licensing data (accessed via Bridge)

**Optional:**
- **infuse-work:3990** - Workflow engine (proxied via `/work/*` route)

**Network:**
- All services communicate via `softbits-network` Docker bridge
- See [softbits-network.md](../softbits-network.md) for complete topology

### Project Structure

```
softbits-admin/
├── docker/
│   └── nginx.conf                  # Nginx proxy config (port 3080)
├── public/
│   └── icon.svg                    # Shield+gear admin icon
├── src/
│   ├── app.tsx                     # Root router with auth guard + lazy loading
│   ├── main.tsx                    # React entry (providers: QueryClient, Router, Toaster)
│   ├── index.css                   # Dark theme globals + Tailwind imports
│   ├── types/
│   │   └── index.ts                # All TypeScript interfaces
│   ├── services/
│   │   ├── api.ts                  # Axios + JWT refresh interceptor
│   │   └── admin-service.ts        # All admin API calls (100+ functions)
│   ├── hooks/
│   │   ├── use-auth.ts             # Zustand auth store (2FA/TOTP)
│   │   ├── use-sidebar.ts          # Zustand sidebar collapse state
│   │   └── use-websocket.ts        # Dashboard WebSocket connection
│   ├── components/
│   │   ├── shared/                 # Re-exports from softbits-shared
│   │   ├── layout/                 # AdminLayout, Sidebar, Header
│   │   └── dashboard/              # StatusCard, AppStatusGrid
│   ├── pages/
│   │   ├── login-page.tsx          # Authentication (2FA/TOTP)
│   │   ├── dashboard-page.tsx      # System health dashboard
│   │   ├── security-page.tsx       # Tabbed: Users, Roles, Tokens, Devices, Endpoints, Providers
│   │   ├── services-page.tsx       # Service monitoring
│   │   ├── cache-page.tsx          # Cache management + warmer
│   │   ├── config-page.tsx         # Tabbed: Currencies, Exchange Rates, Configuration, Options
│   │   ├── config/
│   │   │   ├── currencies-page.tsx     # Currencies table
│   │   │   ├── exchange-rates-page.tsx # Provider settings + exchange rates table
│   │   │   ├── configuration-page.tsx  # System settings
│   │   │   ├── options-page.tsx        # Option sets
│   │   │   ├── project-types-page.tsx  # Project types
│   │   │   └── warehouses-page.tsx     # Warehouses
│   │   ├── erp-config-page.tsx     # ERP configuration file editor
│   │   ├── licensing-page.tsx      # License management
│   │   ├── patches-page.tsx        # System patches
│   │   ├── providers-page.tsx      # Provider management
│   │   └── apps/                   # 9 app-specific admin pages
│   │       ├── connect-admin-page.tsx
│   │       ├── stack-admin-page.tsx
│   │       ├── flip-admin-page.tsx
│   │       ├── floor-admin-page.tsx
│   │       ├── label-admin-page.tsx
│   │       ├── shop-admin-page.tsx
│   │       ├── infuse-admin-page.tsx
│   │       ├── work-admin-page.tsx
│   │       └── pulp-admin-page.tsx
│   └── utils/
│       ├── constants.ts            # ADMIN_TABS, STORAGE_KEYS
│       └── formatters.ts           # Re-exports from softbits-shared
├── Dockerfile                      # Multi-stage (Node 20 -> nginx:alpine)
├── docker-compose.yml              # Port 3080, softbits-network
├── vite.config.ts                  # Dev server + proxy to Bridge
├── tsconfig.json                   # TypeScript configuration
├── tailwind.config.js              # Tailwind with softBITS theme
└── VERSION                         # Current version (1.2.0)
```

## Getting Started

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Docker Desktop** (for containerized deployment)
- **softbits-bridge** - Must be running (AdminIT depends on Bridge API)
- SQL Server (accessed via Bridge)

### Local Development

1. **Start Bridge (required dependency):**
   ```bash
   cd ../softbits-bridge
   docker-compose up -d
   curl http://localhost:3000/health
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open browser:**
   ```
   http://localhost:3080
   ```
   Vite dev server runs on port 3080 and proxies `/api/*` and `/admin/*` to Bridge.

### Docker Deployment

1. **Start Bridge first (required):**
   ```bash
   cd ../softbits-bridge
   docker-compose up -d
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Set INTERNAL_SERVICE_SECRET to match Bridge's value
   ```

3. **Start AdminIT:**
   ```bash
   docker-compose up -d
   ```

4. **Verify health:**
   ```bash
   curl http://localhost:3080/nginx-health
   ```

5. **Check logs:**
   ```bash
   docker logs -f softbits-admin
   ```

**Ports:**
- **3080** - Frontend UI (Nginx serving React app)
- **No separate API port** - All API calls proxy to Bridge:3000

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `INTERNAL_SERVICE_SECRET` | *(required)* | Pre-shared token for Bridge internal service auth |
| `VITE_BRIDGE_URL` | `http://localhost:3000` | Bridge API URL (dev server proxy target) |
| `VITE_WORK_URL` | `http://localhost:3990` | Infuse Work URL (dev server proxy target) |

**Build-time variables (VITE_*):**
- All `VITE_*` variables are embedded at build time, not runtime
- Changing env vars requires rebuilding: `npm run build`

### Nginx Proxy Configuration

The Dockerfile uses a multi-stage build:
1. **Stage 1:** Vite build with Node 20 generates static files in `dist/`
2. **Stage 2:** Nginx Alpine serves static files and proxies API calls

**Proxy routes:**

| Path | Proxied To | Purpose |
|------|-----------|---------|
| `/api/*` | `softbits-bridge:3000` | REST API calls |
| `/admin/*` | `softbits-bridge:3000` | Admin-specific API routes |
| `/health` | `softbits-bridge:3000` | Bridge health (for dashboard) |
| `/ws` | `softbits-bridge:3000` | WebSocket (dashboard updates) |
| `/work/*` | `infuse-work:3990` | Workflow engine API |
| `/nginx-health` | *(local)* | Docker healthcheck endpoint |

Internal service headers added to proxied requests:
- `X-Internal-Service: softbits-admin`
- `X-Internal-Token: ${INTERNAL_SERVICE_SECRET}`

## Features

### Admin Sections (19 pages)

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | System health, app status grid, service monitoring |
| `/security` | Security | Tabbed: Users, Roles, Tokens, Devices, Endpoints, Providers |
| `/services` | Services | Service health monitoring, environment variables, logs |
| `/cache` | Cache | Cache stats, TTL config, category defaults, cache warmer controls |
| `/config` | Configuration | Tabbed: Currencies, Exchange Rates, Configuration, Options |
| `/erp-config` | ERP Config | JSON file editor for ERP query/mapping configs |
| `/licensing` | Licensing | License upload, validation, modules, compliance, user seat tracking |
| `/patches` | Patches | Patch levels, apply/rollback patches, history |
| `/providers` | Providers | Provider management (storage, email, etc.) |
| `/apps/connect` | ConnectIT Admin | CRM sync, territories, pipelines, rate cards |
| `/apps/stack` | StackIT Admin | WMS status, services, users |
| `/apps/flip` | FlipIT Admin | POS terminals, GPS tracking, sales data |
| `/apps/floor` | FloorIT Admin | Reason codes, lot/serial rules, checkpoints, devices |
| `/apps/labels` | LabelIT Admin | Label config, printers, templates, history |
| `/apps/shop` | ShopIT Admin | E-commerce connections, sync, MarkIT marketing |
| `/apps/infuse` | InfuseIT Admin | AI integration config and status |
| `/apps/work` | WorkIT Admin | Workflow management |
| `/apps/pulp` | PulpIT Admin | Document stats, storage providers, staging, retention, approvals |

### Authentication Flow

AdminIT authenticates via Bridge admin auth endpoints with 2FA/TOTP support:

1. User enters username and password
2. `POST /admin/auth/verify` returns either tokens (no 2FA) or `pending_totp` status
3. If 2FA required, user enters TOTP code via `POST /admin/auth/verify-totp`
4. If first-time 2FA setup, `POST /admin/auth/setup-totp` returns QR code, then `POST /admin/auth/confirm-totp`
5. Tokens stored in Zustand with localStorage persistence (`admin-auth` key)
6. Automatic JWT refresh on 401 responses with queue-and-retry pattern

### Shared Components

AdminIT uses shared React components from `softbits-shared/components/`:

| Component | Features |
|-----------|----------|
| **DataTable** | Resizable columns, column picker, per-column filters, sorting, pagination, row selection |
| **Tabs** | Enable/disable per tab, badge counts, icons |
| **Modal** | Overlay, focus trap, Escape to close, sizes |
| **Button** | Variants (primary, secondary, danger, ghost), sizes, loading state |
| **Card** | Header, body, footer, header actions |
| **StatusBadge** | success, warning, danger, info, neutral variants |
| **SearchInput** | Debounced search with clear button |
| **EmptyState** | Icon, title, description, action button |
| **LoadingSpinner** | Inline and full-page variants |

## API Routes

AdminIT consumes the following Bridge API routes. All routes require authentication unless noted.

### Auth (`/admin/auth/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/auth/verify` | Login with username + password |
| POST | `/admin/auth/verify-totp` | Verify TOTP code |
| POST | `/admin/auth/setup-totp` | Begin TOTP enrollment |
| POST | `/admin/auth/confirm-totp` | Confirm TOTP setup |
| GET | `/admin/auth/my-2fa-status` | Current user 2FA status |

### Dashboard & Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Bridge health status |
| GET | `/admin/dashboard` | Admin dashboard metrics |
| GET | `/admin/about` | System version info |

### Console Users (`/admin/console-users/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/console-users` | List all users |
| GET | `/admin/console-users/:id` | Get user details |
| POST | `/admin/console-users` | Create user |
| PUT | `/admin/console-users/:id` | Update user |
| DELETE | `/admin/console-users/:id` | Delete user |
| POST | `/admin/console-users/:id/change-password` | Change password |
| POST | `/admin/console-users/:id/sync-erp` | Sync user with ERP |
| POST | `/admin/console-users/:id/disable-2fa` | Disable 2FA |
| POST | `/admin/console-users/:id/reregister-2fa` | Re-register 2FA |
| POST | `/admin/console-users/:id/unlock` | Unlock account |

### Roles (`/admin/roles/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/roles` | List roles |
| POST | `/admin/roles` | Create role |
| PUT | `/admin/roles/:id` | Update role |
| DELETE | `/admin/roles/:id` | Delete role |

### Tokens (`/admin/tokens/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/tokens` | List API tokens |
| GET | `/admin/tokens/:id` | Get token details |
| POST | `/admin/tokens` | Create token |
| POST | `/admin/tokens/:id/deactivate` | Deactivate token |
| POST | `/admin/tokens/:id/reactivate` | Reactivate token |
| DELETE | `/admin/tokens/:id` | Delete token |

### Devices (`/admin/devices/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/devices` | List devices (filter by appCode, status, type) |
| GET | `/admin/devices/:id` | Get device details |
| POST | `/admin/devices` | Register device |
| PUT | `/admin/devices/:id` | Update device |
| DELETE | `/admin/devices/:id` | Retire device |
| GET | `/admin/devices/license-check/:appCode` | Check device license |

### Services (`/admin/services/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/services` | List services |
| PUT | `/admin/services/:name` | Enable/disable service |

### Cache (`/api/cache/*`, `/admin/cache/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cache/stats` | Cache statistics |
| POST | `/api/cache/clear` | Clear cache (optional pattern) |
| GET | `/api/cache/smart/stats` | SmartCache statistics |
| GET | `/admin/cache/ttl-config` | TTL configuration |
| PUT | `/admin/cache/ttl-config` | Update TTL config |
| GET | `/admin/cache/category-defaults` | Category default TTLs |
| PUT | `/admin/cache/category-defaults` | Update category defaults |

### Cache Warmer (`/admin/cache-warmer/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/cache-warmer/status` | Warmer status |
| POST | `/admin/cache-warmer/start` | Start warmer |
| POST | `/admin/cache-warmer/stop` | Stop warmer |
| POST | `/admin/cache-warmer/pause` | Pause warmer |
| POST | `/admin/cache-warmer/resume` | Resume warmer |
| POST | `/admin/cache-warmer/trigger` | Trigger warming cycle |
| POST | `/admin/cache-warmer/warm/:target` | Warm specific target |
| PUT | `/admin/cache-warmer/config` | Save warmer config |

### Licensing (`/admin/license/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/license` | Get license info |
| POST | `/admin/license/validate` | Validate license |
| GET | `/admin/license/usage` | License usage stats |
| GET | `/admin/license/modules` | Licensed modules |
| GET | `/admin/license/users` | Licensed users |
| GET | `/admin/license/users-summary` | User seat summary |
| POST | `/admin/license/upload` | Upload license XML |
| PUT | `/admin/license/details` | Update license details |
| GET | `/admin/compliance` | Compliance check |

### Patches (`/admin/patches/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/patches` | List patches (filter by category, severity, status) |
| GET | `/admin/patches/level` | Current patch level |
| GET | `/admin/patches/history` | Patch history |
| GET | `/admin/patches/summary` | Patch summary |
| POST | `/admin/patches/:code/apply` | Apply patch |
| POST | `/admin/patches/:code/rollback` | Rollback patch |

### Configuration (`/admin/config/*`, `/admin/env`, `/admin/endpoints`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/config/files` | List config files |
| GET | `/admin/config/files/:name` | Read config file |
| PUT | `/admin/config/files/:name` | Update config file |
| GET | `/admin/env` | Get environment config |
| PUT | `/admin/env` | Update environment config |
| GET | `/admin/endpoints` | List registered endpoints |
| GET | `/admin/endpoint-groups` | List endpoint groups |
| POST | `/admin/endpoints/discover` | Discover endpoints |

### Currencies (`/api/admin/currencies/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/currencies` | List all currencies |
| POST | `/api/admin/currencies` | Create currency |
| PUT | `/api/admin/currencies/:id` | Update currency |
| DELETE | `/api/admin/currencies/:id` | Delete currency (soft) |
| POST | `/api/admin/currencies/:id/set-default` | Set default currency |

### Exchange Rates (`/api/admin/exchange-rates/*`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/exchange-rates/provider` | Get provider config |
| PUT | `/api/admin/exchange-rates/provider` | Update provider settings |
| POST | `/api/admin/exchange-rates/provider/fetch` | Trigger rate fetch |
| GET | `/api/admin/exchange-rates/rates` | Get rates (optional ?date=) |
| POST | `/api/admin/exchange-rates/rates` | Create exchange rate |
| PUT | `/api/admin/exchange-rates/rates/:id` | Update exchange rate |
| DELETE | `/api/admin/exchange-rates/rates/:id` | Delete exchange rate |

### App-Specific Admin Routes

Additional routes are used by per-application admin pages. See the [Bridge README](../softbits-bridge/README.md) for the full route inventory.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Manual Testing

**Prerequisites:** Bridge must be running on port 3000.

**1. Login:**
```
Open http://localhost:3080
Enter admin credentials
Complete 2FA if prompted
Verify dashboard loads
```

**2. User Management:**
```
Navigate to Security tab
Click Users sub-tab
Create a new user
Verify user appears in list
```

**3. Cache Management:**
```
Navigate to Cache tab
Verify stats load
Click Clear Cache
Verify cache clears
```

## Troubleshooting

### Frontend Won't Load

**Symptom:** Blank page, build errors, or "Cannot GET /"

| Issue | Check | Solution |
|-------|-------|----------|
| Bridge not running | `curl http://localhost:3000/health` | Start Bridge: `cd ../softbits-bridge && docker-compose up -d` |
| Build failed | `docker logs softbits-admin` | Rebuild: `docker-compose up -d --build` |
| Port 3080 in use | `docker ps \| grep 3080` | Stop conflicting container or change `ADMIN_UI_PORT` |
| Stale build | Browser shows old version | Clear cache: `rm -rf dist && npm run build` |

### API Calls Fail

**Symptom:** "Failed to fetch", network errors, or 500 errors

1. **Bridge is not running:**
   ```bash
   curl http://localhost:3000/health
   ```
   Solution: Start Bridge first.

2. **Nginx proxy misconfigured:**
   ```bash
   docker exec softbits-admin cat /etc/nginx/conf.d/default.conf
   ```
   Should contain `proxy_pass http://$bridge_server:3000;`

3. **Network connectivity:**
   ```bash
   docker network inspect softbits-network
   ```
   Both `softbits-bridge` and `softbits-admin` should be listed.

### Authentication Issues

**Symptom:** Login fails or redirects to login after authenticating

1. Check Bridge logs for auth errors: `docker logs softbits-bridge 2>&1 | grep auth`
2. Verify admin user exists in `adm_Users` table
3. If 2FA is failing, admin can disable via `POST /admin/console-users/:id/disable-2fa`
4. Clear localStorage: `admin-auth` key may have stale tokens

### Viewing Logs

```bash
# Real-time logs
docker logs -f softbits-admin

# Nginx access logs
docker exec softbits-admin tail -f /var/log/nginx/access.log

# Nginx error logs
docker exec softbits-admin tail -f /var/log/nginx/error.log
```

## Related Documentation

### Project Documentation
- [CLAUDE.md](../CLAUDE.md) - Workspace overview, coding standards, and development guidelines
- [softbits-network.md](../softbits-network.md) - Service ports, Docker network, health checks
- [softbits-rest-api-design.md](../softbits-rest-api-design.md) - REST API standards and response formats
- [softbits-cache-architecture.md](../softbits-cache-architecture.md) - Cache TTL hierarchy and patterns
- [softbits-code-conventions.md](../softbits-code-conventions.md) - Naming conventions and file structure

### Component Documentation
- [softbits-shared README](../softbits-shared/README.md) - Shared component library and utilities
- [softbits-bridge README](../softbits-bridge/README.md) - Central API gateway (required dependency)

### AdminIT-Specific Documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Detailed architecture, auth flow, page inventory

---

**Version:** 1.2.0
**Last Updated:** 2026-03-27
**Maintainer:** softBITS Team
