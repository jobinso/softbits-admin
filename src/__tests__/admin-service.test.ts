/**
 * Tests for admin-service.ts
 *
 * Verifies that API calls use the correct clients:
 * - rawApi (no /api prefix) for /admin/* and /health routes
 * - api (baseURL /api) for /api/admin/* routes
 */
import axios from 'axios';

// Mock axios.create to track calls
const mockRawPost = jest.fn().mockResolvedValue({ data: {} });
const mockRawGet = jest.fn().mockResolvedValue({ data: {} });
const mockRawPut = jest.fn().mockResolvedValue({ data: {} });
const mockRawDelete = jest.fn().mockResolvedValue({ data: {} });
const mockApiGet = jest.fn().mockResolvedValue({ data: {} });
const mockApiPost = jest.fn().mockResolvedValue({ data: {} });

jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');
  return {
    ...actualAxios,
    create: jest.fn().mockImplementation((config) => {
      if (config?.baseURL === '/api') {
        // This is the `api` instance
        return {
          get: mockApiGet,
          post: mockApiPost,
          put: jest.fn().mockResolvedValue({ data: {} }),
          delete: jest.fn().mockResolvedValue({ data: {} }),
          defaults: { headers: { common: {} } },
          interceptors: {
            request: { use: jest.fn() },
            response: { use: jest.fn() },
          },
        };
      }
      // This is the rawApi instance
      return {
        get: mockRawGet,
        post: mockRawPost,
        put: mockRawPut,
        delete: mockRawDelete,
        defaults: { headers: { common: {} } },
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };
    }),
  };
});

// Must import after mocking
let adminService: typeof import('../services/admin-service');

beforeAll(async () => {
  adminService = await import('../services/admin-service');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRawGet.mockResolvedValue({ data: {} });
  mockRawPost.mockResolvedValue({ data: {} });
  mockRawPut.mockResolvedValue({ data: {} });
  mockRawDelete.mockResolvedValue({ data: {} });
});

describe('admin-service', () => {
  // ===== Auth routes use rawApi (no /api prefix) =====

  describe('Auth endpoints (rawApi)', () => {
    it('verifyLogin posts to /admin/auth/verify', async () => {
      await adminService.verifyLogin('admin', 'password');
      expect(mockRawPost).toHaveBeenCalledWith('/admin/auth/verify', {
        username: 'admin',
        password: 'password',
      });
    });

    it('verifyTotp posts to /admin/auth/verify-totp', async () => {
      await adminService.verifyTotp('temp-token', '123456');
      expect(mockRawPost).toHaveBeenCalledWith('/admin/auth/verify-totp', {
        tempToken: 'temp-token',
        code: '123456',
      });
    });

    it('setupTotp posts to /admin/auth/setup-totp', async () => {
      await adminService.setupTotp('temp-token');
      expect(mockRawPost).toHaveBeenCalledWith('/admin/auth/setup-totp', {
        tempToken: 'temp-token',
      });
    });

    it('confirmTotp posts to /admin/auth/confirm-totp', async () => {
      await adminService.confirmTotp('temp-token', '654321');
      expect(mockRawPost).toHaveBeenCalledWith('/admin/auth/confirm-totp', {
        tempToken: 'temp-token',
        code: '654321',
      });
    });

    it('getMyTwoFactorStatus gets /admin/auth/my-2fa-status', async () => {
      await adminService.getMyTwoFactorStatus();
      expect(mockRawGet).toHaveBeenCalledWith('/admin/auth/my-2fa-status');
    });
  });

  // ===== Health/Dashboard use rawApi =====

  describe('Dashboard endpoints (rawApi)', () => {
    it('getHealth gets /health', async () => {
      await adminService.getHealth();
      expect(mockRawGet).toHaveBeenCalledWith('/health');
    });

    it('getDashboard gets /admin/dashboard', async () => {
      await adminService.getDashboard();
      expect(mockRawGet).toHaveBeenCalledWith('/admin/dashboard');
    });

    it('getAbout gets /admin/about', async () => {
      await adminService.getAbout();
      expect(mockRawGet).toHaveBeenCalledWith('/admin/about');
    });
  });

  // ===== Console Users use rawApi =====

  describe('Console User endpoints (rawApi)', () => {
    it('getUsers gets /admin/console-users', async () => {
      await adminService.getUsers();
      expect(mockRawGet).toHaveBeenCalledWith('/admin/console-users');
    });

    it('getUser gets /admin/console-users/:id', async () => {
      await adminService.getUser('user-123');
      expect(mockRawGet).toHaveBeenCalledWith('/admin/console-users/user-123');
    });

    it('createUser posts to /admin/console-users', async () => {
      const userData = { UserName: 'newuser', Role: 'admin' };
      await adminService.createUser(userData);
      expect(mockRawPost).toHaveBeenCalledWith('/admin/console-users', userData);
    });

    it('updateUser puts to /admin/console-users/:id', async () => {
      const userData = { UserName: 'updated' };
      await adminService.updateUser('user-123', userData);
      expect(mockRawPut).toHaveBeenCalledWith('/admin/console-users/user-123', userData);
    });

    it('deleteUser deletes /admin/console-users/:id', async () => {
      await adminService.deleteUser('user-123');
      expect(mockRawDelete).toHaveBeenCalledWith('/admin/console-users/user-123');
    });

    it('changeUserPassword posts to /admin/console-users/:id/change-password', async () => {
      await adminService.changeUserPassword('user-123', { password: 'newpass' });
      expect(mockRawPost).toHaveBeenCalledWith(
        '/admin/console-users/user-123/change-password',
        { password: 'newpass' }
      );
    });
  });

  // ===== Roles use rawApi =====

  describe('Role endpoints (rawApi)', () => {
    it('getRoles gets /admin/roles', async () => {
      await adminService.getRoles();
      expect(mockRawGet).toHaveBeenCalledWith('/admin/roles');
    });

    it('createRole posts to /admin/roles', async () => {
      const roleData = { RoleName: 'viewer', AllowedTabs: ['dashboard'] };
      await adminService.createRole(roleData);
      expect(mockRawPost).toHaveBeenCalledWith('/admin/roles', roleData);
    });

    it('deleteRole deletes /admin/roles/:id', async () => {
      await adminService.deleteRole('role-1');
      expect(mockRawDelete).toHaveBeenCalledWith('/admin/roles/role-1');
    });
  });

  // ===== Devices use rawApi =====

  describe('Device endpoints (rawApi)', () => {
    it('getDevices gets /admin/devices with optional params', async () => {
      await adminService.getDevices({ appCode: 'STACK', status: 'active' });
      expect(mockRawGet).toHaveBeenCalledWith('/admin/devices', {
        params: { appCode: 'STACK', status: 'active' },
      });
    });

    it('getDevice gets /admin/devices/:id', async () => {
      await adminService.getDevice('dev-456');
      expect(mockRawGet).toHaveBeenCalledWith('/admin/devices/dev-456');
    });

    it('checkDeviceLicense gets /admin/devices/license-check/:appCode', async () => {
      await adminService.checkDeviceLicense('FLIP');
      expect(mockRawGet).toHaveBeenCalledWith('/admin/devices/license-check/FLIP');
    });
  });

  // ===== Tokens use rawApi =====

  describe('Token endpoints (rawApi)', () => {
    it('getTokens gets /admin/tokens', async () => {
      await adminService.getTokens();
      expect(mockRawGet).toHaveBeenCalledWith('/admin/tokens');
    });

    it('createToken posts to /admin/tokens', async () => {
      await adminService.createToken({ name: 'test-token', expiresIn: '30d' });
      expect(mockRawPost).toHaveBeenCalledWith('/admin/tokens', {
        name: 'test-token',
        expiresIn: '30d',
      });
    });

    it('deactivateToken posts to /admin/tokens/:id/deactivate', async () => {
      await adminService.deactivateToken('tok-789');
      expect(mockRawPost).toHaveBeenCalledWith('/admin/tokens/tok-789/deactivate');
    });
  });
});
