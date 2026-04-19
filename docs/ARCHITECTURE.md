# softBITS AdminIT - Architecture

## Overview

AdminIT is the system administration console for the softBITS platform. It is a React SPA that replaced the former vanilla HTML/JS admin console (31,000 lines across `admin.html` + 30 JS modules in Bridge).

AdminIT manages all 16 admin sections: Dashboard, Security (Users/Roles/Tokens/Devices), Services, Cache, Config (Project Types/Currencies/Option Sets/Warehouses), Licensing, Patches, and 9 app-specific admin pages (ConnectIT, StackIT, FlipIT, FloorIT, LabelIT, ShopIT, InfuseIT, WorkIT, PulpIT).

## Architecture

```mermaid
graph TB
    ADMIN[softbits-admin<br/>React SPA<br/>:3080]
    NGINX[Nginx<br/>Reverse Proxy]
    BRIDGE[softbits-bridge<br/>API Gateway<br/>:3000]
    SQL[(SQL Server)]
    ERP[SYSPRO ERP]

    ADMIN -->|Static Files| NGINX
    NGINX -->|/api/*| BRIDGE
    BRIDGE --> SQL
    BRIDGE --> ERP

    style ADMIN fill:#00d4aa,stroke:#009a7a,stroke-width:3px
    style NGINX fill:#e8eaed,stroke:#5f6368
    style BRIDGE fill:#00d4aa,stroke:#009a7a,stroke-width:2px
    style SQL fill:#e1f5fe,stroke:#01579b
    style ERP fill:#fff3e0,stroke:#e65100
```

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| TypeScript | 5.3.3 | Type safety |
| Vite | 7.3.0 | Build tool |
| Zustand | 4.4.7 | Client state (auth, sidebar) |
| TanStack Query | 5.12.2 | Server state management |
| Axios | 1.6.2 | HTTP client with JWT refresh |
| React Router | 6.21.0 | Client-side routing |
| Tailwind CSS | 3.4.0 | Utility-first styling |
| Lucide React | 0.468.0 | Icons |
| React Hot Toast | 2.4.1 | Notifications |

## Project Structure

```
softbits-admin/
├── docker/nginx.conf          # Nginx proxy (port 3080 -> Bridge:3000)
├── public/icon.svg            # Shield+gear admin icon
├── src/
│   ├── app.tsx                # Root router with auth guard
│   ├── main.tsx               # React entry (providers)
│   ├── config.ts              # VITE_BRIDGE_URL
│   ├── index.css              # Dark theme globals
│   ├── types/index.ts         # TypeScript interfaces
│   ├── services/
│   │   ├── api.ts             # Axios + JWT refresh
│   │   └── admin-service.ts   # All admin API calls
│   ├── hooks/
│   │   ├── use-auth.ts        # Zustand auth (2FA/TOTP)
│   │   ├── use-sidebar.ts     # Zustand sidebar collapse
│   │   └── use-websocket.ts   # Dashboard WebSocket
│   ├── components/
│   │   ├── shared/            # Re-exports from softbits-shared
│   │   ├── layout/            # AdminLayout, Sidebar, Header
│   │   └── dashboard/         # StatusCard, AppStatusGrid
│   ├── pages/
│   │   ├── login-page.tsx
│   │   ├── dashboard-page.tsx
│   │   ├── security/          # Users, Roles, Tokens, Devices
│   │   ├── config/            # Project Types, Currencies, etc.
│   │   ├── cache-page.tsx
│   │   ├── services-page.tsx
│   │   ├── licensing-page.tsx
│   │   ├── patches-page.tsx
│   │   └── apps/              # 9 app admin pages
│   └── utils/
│       ├── constants.ts       # ADMIN_TABS, STORAGE_KEYS
│       └── formatters.ts      # Re-exports from shared
├── Dockerfile                 # Multi-stage (Node 20 -> nginx)
├── docker-compose.yml         # Port 3080, softbits-network
└── vite.config.ts             # Dev server + proxy
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as AdminIT
    participant B as Bridge API

    U->>A: Enter username + password
    A->>B: POST /api/admin/auth/verify
    alt No 2FA required
        B-->>A: { user, token, refreshToken }
        A->>A: Store in localStorage (admin-auth)
    else 2FA required
        B-->>A: { status: 'pending_totp', tempToken }
        A->>U: Show TOTP input
        U->>A: Enter 6-digit code
        A->>B: POST /api/admin/auth/verify-totp
        B-->>A: { user, token, refreshToken }
        A->>A: Store in localStorage (admin-auth)
    end
    A->>U: Redirect to Dashboard
```

## Shared Components

AdminIT uses shared React components from `softbits-shared/components/`:

| Component | Features |
|-----------|----------|
| **DataTable** | Resizable columns, column picker, per-column filters, sorting, pagination, row selection, localStorage persistence |
| **Tabs** | Enable/disable per tab, badge counts, icons |
| **Modal** | Overlay, focus trap, Escape to close, sizes |
| **Button** | Variants, sizes, loading state |
| **Card** | Header, body, footer, header actions |
| **StatusBadge** | success, warning, danger, info, neutral |
| **SearchInput** | Debounced search with clear |
| **EmptyState** | Icon, title, description, action |
| **LoadingSpinner** | Inline and full-page variants |

## Key Features

### Collapsible Sidebar
- Expanded: 240px with icon + label
- Collapsed: 64px with icon only + tooltip
- Smooth CSS transitions
- Role-based tab visibility
- App-aware (hides disabled apps)
- Persisted to localStorage

### Page Inventory (16 sections)

| Route | Page | Source JS Module |
|-------|------|-----------------|
| `/` | Dashboard | admin-dashboard.js |
| `/security/users` | User Management | admin-security.js |
| `/security/roles` | Role Management | admin-security.js |
| `/security/tokens` | Token Management | admin-security.js |
| `/security/devices` | Device Management | admin-devices.js |
| `/services` | Service Monitoring | admin-services.js |
| `/cache` | Cache Management | admin-cache.js |
| `/config/project-types` | Project Types | admin-project-types.js |
| `/config/currencies` | Currencies | admin-currencies-config.js |
| `/config/option-sets` | Option Sets | admin-config.js |
| `/config/warehouses` | Warehouses | admin-warehouses.js |
| `/licensing` | License Management | admin-licensing.js |
| `/patches` | System Patches | admin-patches.js |
| `/apps/connect` | ConnectIT Admin | admin-connectit.js |
| `/apps/stack` | StackIT Admin | admin-stackit.js |
| `/apps/flip` | FlipIT Admin | admin-flipit.js |
| `/apps/floor` | FloorIT Admin | admin-floorit.js |
| `/apps/labels` | LabelIT Admin | admin-labelit.js |
| `/apps/shop` | ShopIT Admin | admin-shopify.js |
| `/apps/infuse` | InfuseIT Admin | admin-infuseit.js |
| `/apps/work` | WorkIT Admin | admin-workit.js |
| `/apps/pulp` | PulpIT Admin | admin-documents.js |

## Docker/Deployment

- **Dev:** `npm run dev` on port 3080, Vite proxies `/api` to Bridge:3000
- **Prod:** Multi-stage Docker (Node 20 builder -> nginx:alpine runtime)
- **Network:** `softbits-network` bridge, proxies to `softbits-bridge:3000`
- **Health:** `GET /health` returns 200 OK from nginx
