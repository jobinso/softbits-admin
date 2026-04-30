# AdminIT System Administration User Guide

## Document Information

| Attribute | Value |
|-----------|-------|
| **Version** | 1.0 |
| **Last Updated** | 2026-04-07 |
| **Audience** | IT administrators, security officers, operations managers |
| **Prerequisites** | Admin-level access to the softBITS platform |

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard](#dashboard)
4. [Security Management](#security-management)
5. [Service Management](#service-management)
6. [Cache Management](#cache-management)
7. [Configuration](#configuration)
8. [ERP Configuration](#erp-configuration)
9. [Licensing](#licensing)
10. [Patch Management](#patch-management)
11. [Application Administration](#application-administration)
12. [Troubleshooting](#troubleshooting)
13. [Related Documentation](#related-documentation)

---

## Introduction

### What is AdminIT?

AdminIT is the **centralized system administration console** for the softBITS platform. It provides a single point of control for managing all aspects of the platform: users, security, services, caching, licensing, configuration, and per-application settings.

**Key Features:**
- **Dashboard** - Real-time system health overview with ERP, database, and cache status
- **Security** - User management, role-based access control, API tokens, 2FA/TOTP
- **Services** - Service health monitoring, log management, endpoint registry
- **Cache** - Redis and NodeCache statistics and monitoring
- **Configuration** - Currencies, exchange rates, system settings, options
- **ERP Config** - SYSPRO connection and company configuration
- **Licensing** - Subscription management, module control, compliance monitoring
- **Patches** - System patch application and tracking
- **App Admin** - Per-application settings for ConnectIT, StackIT, FlipIT, FloorIT, LabelIT, ShopIT, InfuseIT, WorkIT, PulpIT, EdIT

### Architecture

```
+-------------------------------------------+
|     AdminIT Frontend (Port 3080)          |
|  React SPA with Dashboard, Security,      |
|  Services, Config, Licensing, Apps         |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|     Nginx Reverse Proxy                   |
|     /api -> bridge:3000                   |
|     /admin -> bridge:3000                 |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|     softbits-bridge API (Port 3000)       |
|     /admin/* and /api/admin/* routes      |
+-------------------+-----------------------+
                    |
        +-----------+-----------+
        |           |           |
        v           v           v
 +-----------+ +--------+ +----------+
 | SQL Server| | Redis  | | SYSPRO   |
 | (adm_*)   | | Cache  | | ERP      |
 +-----------+ +--------+ +----------+
```

AdminIT has no dedicated backend. All data operations proxy through Nginx to Bridge admin routes.

---

## Getting Started

### Accessing AdminIT

**URL:** `http://localhost:3080` (default)

**Login:**
1. Navigate to the AdminIT URL in your browser
2. Enter your admin credentials (username and password)
3. Complete 2FA/TOTP verification if enabled for your account
4. You are redirected to the Dashboard

### Navigation Overview

AdminIT uses a collapsible sidebar for navigation:
- **Expanded mode** (240px) - Full labels with icons
- **Collapsed mode** (64px) - Icons only with tooltips

**Main Sections:**

| Section | Description |
|---------|-------------|
| Dashboard | System health and quick stats |
| Security | Users, Roles, Tokens |
| Services | Service status, logs, endpoints |
| Cache | Cache statistics and monitoring |
| Configuration | Currencies, exchange rates, settings, options |
| ERP Config | SYSPRO connection settings |
| Licensing | Subscription, modules, compliance, users, devices, warehouses |
| Patches | Patch management |
| Providers | External provider configuration |
| Apps | Per-application admin pages |

---

## Dashboard

The Dashboard provides a real-time overview of your softBITS platform health.

### System Status Row

Three status cards showing connection health:

**ERP Card:**
- Type: SYSPRO (or configured ERP)
- Connection status: Connected / Disconnected
- Status indicator: green (healthy), red (down), grey (unknown)

**Database Card:**
- SQL Server connection status
- Connected / Disconnected indicator

**Cache Card:**
- Cache tier status: L1 + Redis / L1 (NodeCache) / Disabled
- Cache hit rate percentage

### App Service Status Table

A table listing all platform applications with:
- App name
- Enabled/Disabled state
- Health status (Connected/Disconnected)
- Uptime

### Quick Stats

Four summary cards:
- **Users** - Total console users
- **Devices** - Registered devices
- **Tokens** - Active API tokens
- **Cache Entries** - Total cached keys

### System Info

Platform information panel:
- Bridge version number
- Node.js version
- Operating system platform
- Server uptime (formatted as days/hours/minutes)
- Total registered API endpoints

**Refresh:** The dashboard auto-refreshes every 30 seconds.

---

## Security Management

Navigate to **Security** to manage users, roles, and tokens. The page uses three tabs.

### Users Tab

**Viewing Users:**
- List all console users with username, email, role, and active status
- Search by username or email

**Creating a User:**
1. Click **Add User**
2. Fill in:
   - **Username** (required)
   - **Email** (required)
   - **First Name** and **Last Name**
   - **Role** (select from available roles)
   - **Password** (required for new users)
3. Click **Save**

**Editing a User:**
1. Click the edit icon on the user row
2. Modify fields
3. Click **Save**

**Deactivating a User:**
1. Click the edit icon
2. Toggle **Active** to off
3. Click **Save**

The user can no longer log in but their data is preserved.

### Roles Tab

**Viewing Roles:**
- List all roles with name, description, and permission count

**Creating a Role:**
1. Click **Add Role**
2. Enter role name and description
3. Select permissions from the permission matrix
4. Click **Save**

**Editing a Role:**
1. Click the edit icon
2. Modify name, description, or permissions
3. Click **Save**

### Tokens Tab

**Viewing Tokens:**
- List all active API tokens with name, creation date, and last used

**Creating a Token:**
1. Click **Generate Token**
2. Enter a descriptive name for the token
3. Click **Generate**
4. Copy the generated token (it is shown only once)

**Revoking a Token:**
1. Click the revoke icon on the token row
2. Confirm revocation

### Two-Factor Authentication (2FA)

**Setting Up 2FA:**
1. Navigate to **Security > Users**
2. Edit your user account
3. Enable 2FA/TOTP
4. Scan the QR code with your authenticator app
5. Enter the verification code to confirm setup

**Logging In with 2FA:**
1. Enter username and password
2. Enter the 6-digit code from your authenticator app
3. Access is granted

---

## Service Management

Navigate to **Services** to monitor platform services.

### Services Tab

**Service List:**
View all registered softBITS services with:
- Service name (e.g., SoftBITS Bridge, Bridge Sync, Connect Sync Engine)
- Current status (Running/Stopped)
- Version
- Last health check time

**Service Logs:**
1. Click a service to view its details
2. Navigate to the **Logs** tab
3. View recent log entries
4. Click **Clear Logs** to remove old entries

### Endpoints Tab

View all registered API endpoints across the platform:
- HTTP method
- Path
- Route file
- Authentication requirement

### Providers Tab

Manage external service providers:
- Provider name and type
- Connection URL
- Status (Connected/Disconnected)

### Dev Tasks

Execute maintenance tasks:
1. View available tasks
2. Click **Execute** on a task
3. View the result

---

## Cache Management

Navigate to **Cache** to monitor caching performance.

### Cache Overview

**L1 Cache (NodeCache):**
- In-process memory cache
- Key count and hit/miss statistics

**L2 Cache (Redis/Valkey):**
- Connection status
- Key count
- Hit rate percentage
- Memory usage

### Cache Metrics

| Metric | Description |
|--------|-------------|
| Hit Rate | Percentage of requests served from cache |
| Total Keys | Number of cached entries |
| Hits | Total cache hits |
| Misses | Total cache misses |

---

## Configuration

Navigate to **Configuration** to manage system settings. The page uses four tabs.

### Currencies Tab

**Managing Currencies:**
1. View configured currencies with code, name, and symbol
2. Click **Add Currency** to configure a new currency
3. Edit existing currencies

### Exchange Rates Tab

**Managing Exchange Rates:**
1. View current exchange rates between currencies
2. Add or update rates
3. Set effective dates

### Configuration Tab

**System Settings:**
Application-level settings stored in `adm_SystemSettings`. Settings are organized by category:

| Category | Examples |
|----------|----------|
| company.* | Company name, logo, timezone |
| modules.* | Module enable/disable flags |
| cacheWarmer.* | Cache warming configuration |
| connect.sync.* | ConnectIT sync settings |
| stack.services.* | StackIT service URLs |
| floor.* | FloorIT settings |
| documents.* | PulpIT document settings |
| email.* | Email server configuration |
| pos.* | FlipIT POS settings |
| browse.* | SQL Browse mode settings |

Edit settings using the built-in JSON editor (CodeMirror).

### Options Tab

Manage system option sets and value lists used across the platform.

---

## ERP Configuration

Navigate to **ERP Config** to manage SYSPRO/ERP connection settings.

### SYSPRO Settings

Configure the ERP connection:
- Server hostname
- Company database
- Authentication credentials
- Connection pool settings

### ERP Health

View real-time ERP connectivity:
- Connection status
- Session pool statistics (total, available, active sessions)

---

## Licensing

Navigate to **Licensing** to manage platform licensing. The page uses six tabs.

### Subscription Tab

**Viewing License:**
- License holder and type
- Expiration date
- License status (Valid/Expired/Trial)

**Validating License:**
1. Click **Validate**
2. The system checks the license against the licensing server
3. View validation result

**Uploading License:**
1. Click **Upload License**
2. Select the license file
3. Click **Upload**
4. License is applied and validated

### Modules Tab

View licensed modules:
- Module name and description
- Enabled/Disabled toggle
- License requirement (included/add-on)

### Compliance Tab

Monitor license usage:
- Licensed vs. actual user counts
- Licensed vs. actual device counts
- Module entitlement checks
- Compliance status (Compliant/Non-Compliant)

### Users Tab

Per-user license tracking:
- Licensed users list
- License type per user
- Usage summary

### Devices Tab

**Managing Devices:**
1. View registered devices with name, type, and status
2. Click **Register Device** to add a new device
3. Edit device details
4. Retire devices no longer in use

### Warehouses Tab

Configure licensed warehouse locations:
- Warehouse code and name
- Location details
- License assignment

---

## Patch Management

Navigate to **Patches** to manage system updates.

### Applying Patches

1. View available patches with version, description, and date
2. Click **Apply** on a patch
3. Confirm the patch application
4. View the result

### Patch History

View previously applied patches:
- Patch version and date applied
- Applied by (user)
- Status (Applied/Rolled Back)

---

## Application Administration

Navigate to **Apps** in the sidebar to access per-application admin pages.

### ConnectIT Admin (/apps/connect)
CRM-specific settings:
- Sync configuration and schedules
- Territory setup
- Pipeline stage configuration
- Sales rep management

### StackIT Admin (/apps/stack)
WMS-specific settings:
- Warehouse service URLs
- Picking configuration
- Batch processing settings

### FlipIT Admin (/apps/flip)
POS-specific settings:
- Terminal configuration
- Payment settings
- Receipt templates

### FloorIT Admin (/apps/floor)
Shop floor settings:
- Labor capture configuration
- Work center setup
- Shift management

### LabelIT Admin (/apps/labels)
Label printing settings:
- Printer configuration
- Label template management

### ShopIT Admin (/apps/shop)
E-commerce settings:
- Storefront configuration
- Product catalog settings

### InfuseIT Admin (/apps/infuse)
AI integration settings:
- MCP server configuration
- AI model settings

### WorkIT Admin (/apps/work)
Work queue settings:
- Queue configuration
- Job scheduling

### PulpIT Admin (/apps/pulp)
Document management settings:
- Storage configuration
- Document type setup

### EdIT Admin (/apps/edit)
EDI processing settings:
- VAN provider configuration
- Pipeline settings

### Email Poller Admin (/apps/email-poller)
Email polling settings:
- Mailbox configuration
- Polling schedule
- Processing rules

---

## Troubleshooting

### Common Issues and Solutions

| Problem | Solution |
|---------|----------|
| **Cannot access AdminIT** | Verify URL (http://localhost:3080). Check that the softbits-admin container is running. Verify Nginx proxy is configured. |
| **Login fails** | Check username/password. Verify your user account is active. If 2FA is enabled, ensure your authenticator is synced. |
| **Dashboard shows no data** | Verify Bridge API is running on port 3000. Check network connectivity between AdminIT and Bridge. |
| **ERP shows disconnected** | Check SYSPRO ERP is running. Verify connection settings in ERP Config. Review Bridge logs for connection errors. |
| **Cache shows disabled** | Check `REDIS_ENABLED` environment variable. Verify Redis/Valkey is running. Check Redis host and port configuration. |
| **License validation fails** | Verify network connectivity to the licensing server (softbits-lic:2000). Check the license file is valid. Upload a new license if expired. |
| **Cannot create users** | Verify you have Admin role permissions. Check the Security > Roles tab for your permission set. |
| **Service logs not loading** | Verify Bridge is running. Check that logging is enabled for the service. Clear old logs and retry. |
| **App admin page not loading** | Verify the app module is enabled in Bridge configuration. Check that the app's health endpoint responds. |

### Error Messages

| Error | Description | Resolution |
|-------|-------------|------------|
| `Unauthorized` | JWT token expired or invalid | Re-login to obtain a new token |
| `Forbidden` | Insufficient permissions | Contact admin to verify your role permissions |
| `Service unavailable` | Bridge API not responding | Check Bridge container status: `docker ps` |
| `License expired` | Platform license has expired | Upload a new license file |
| `TOTP verification failed` | 2FA code incorrect | Verify authenticator app time is synced, try the current code |

### Getting Help

If issues persist:
1. **Check Bridge Logs:** `docker logs softbits-bridge`
2. **Check Container Status:** `docker ps --format "table {{.Names}}\t{{.Status}}"`
3. **Verify Health:** `curl http://localhost:3000/health`
4. **Contact Support:** Include error messages, timestamps, and screenshots

---

## Related Documentation

### AdminIT Technical Reference
- [**AdminIT Functional Spec**](../../../08-Technical-Specs/adminit-functional-spec.md) - Full technical specification

### Bridge Guides
- [**Bridge User Guide**](BRIDGE-USER-GUIDE.md) - Main Bridge overview and configuration
- [**Bridge Security Guide**](BRIDGE-SECURITY-GUIDE.md) - Authentication, 2FA, RBAC
- [**Bridge Configuration Guide**](BRIDGE-CONFIG-GUIDE.md) - Environment variables and setup

### Technical Reference
- [**API Reference**](../Reference/API-REFERENCE.md) - Complete API endpoint documentation
- [**softbits-network.md**](../../../../softbits-network.md) - Service ports and network configuration
- [**softbits-cache-architecture.md**](../../../../softbits-cache-architecture.md) - Cache TTL hierarchy and patterns

---

**Support:** For additional help, contact your IT support team.
**Feedback:** Report issues or feature requests via your organization's feedback channel.

---

*Last Updated: 2026-04-07 | Version 1.0*
