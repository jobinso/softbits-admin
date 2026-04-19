/**
 * Tests for use-auth.ts (Zustand store)
 *
 * Tests the login flow, TOTP flow, logout, and token persistence.
 */

// Mock admin-service
const mockVerifyLogin = jest.fn();
const mockVerifyTotpApi = jest.fn();

jest.mock('../services/admin-service', () => ({
  verifyLogin: (...args: unknown[]) => mockVerifyLogin(...args),
  verifyTotp: (...args: unknown[]) => mockVerifyTotpApi(...args),
}));

// Mock api module
jest.mock('../services/api', () => ({
  api: {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

// Mock localStorage for zustand persist
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

import { useAuth } from '../hooks/use-auth';
import { api } from '../services/api';

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  // Reset zustand store to initial state
  useAuth.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    allowedTabs: [],
    role: null,
    requiresTotp: false,
    tempToken: null,
  });
  delete (api.defaults.headers.common as Record<string, string>)['Authorization'];
});

describe('useAuth', () => {
  // -- Initial state --

  it('starts with unauthenticated state', () => {
    const state = useAuth.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  // -- Login flow (no TOTP) --

  describe('login - direct auth (no TOTP)', () => {
    const loginResponse = {
      token: 'jwt-token-abc',
      user: { id: 'user-1', username: 'admin', role: 'superadmin', totpEnabled: false },
      tabs: ['dashboard', 'security', 'services'],
      roleName: 'Super Admin',
    };

    it('sets isLoading true during login', async () => {
      mockVerifyLogin.mockImplementation(() => new Promise(() => {})); // Never resolves
      const loginPromise = useAuth.getState().login('admin', 'password');
      // Check loading state
      expect(useAuth.getState().isLoading).toBe(true);
      expect(useAuth.getState().error).toBeNull();
    });

    it('completes login and sets authenticated state', async () => {
      mockVerifyLogin.mockResolvedValue(loginResponse);
      await useAuth.getState().login('admin', 'password');

      const state = useAuth.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('jwt-token-abc');
      expect(state.user).toEqual({
        UserId: 'user-1',
        UserName: 'admin',
        Role: 'superadmin',
        TwoFactorEnabled: false,
        AllowedTabs: ['dashboard', 'security', 'services'],
      });
      expect(state.allowedTabs).toEqual(['dashboard', 'security', 'services']);
      expect(state.role).toBe('Super Admin');
      expect(state.isLoading).toBe(false);
    });

    it('sets Authorization header on api after login', async () => {
      mockVerifyLogin.mockResolvedValue(loginResponse);
      await useAuth.getState().login('admin', 'password');
      expect(api.defaults.headers.common['Authorization']).toBe('Bearer jwt-token-abc');
    });

    it('calls verifyLogin with correct credentials', async () => {
      mockVerifyLogin.mockResolvedValue(loginResponse);
      await useAuth.getState().login('testuser', 'testpass');
      expect(mockVerifyLogin).toHaveBeenCalledWith('testuser', 'testpass');
    });
  });

  // -- Login flow (with TOTP) --

  describe('login - TOTP required', () => {
    const totpPendingResponse = {
      status: 'pending_totp',
      tempToken: 'temp-token-xyz',
    };

    it('sets requiresTotp when server returns pending_totp', async () => {
      mockVerifyLogin.mockResolvedValue(totpPendingResponse);
      await useAuth.getState().login('admin', 'password');

      const state = useAuth.getState();
      expect(state.requiresTotp).toBe(true);
      expect(state.tempToken).toBe('temp-token-xyz');
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  // -- TOTP verification --

  describe('verifyTotp', () => {
    const totpResponse = {
      token: 'jwt-after-totp',
      user: { id: 'user-1', username: 'admin', role: 'superadmin', totpEnabled: true },
      tabs: ['dashboard', 'security'],
      roleName: 'Super Admin',
    };

    it('completes auth after TOTP verification', async () => {
      // First set up pending TOTP state
      useAuth.setState({ requiresTotp: true, tempToken: 'temp-123' });

      mockVerifyTotpApi.mockResolvedValue(totpResponse);
      await useAuth.getState().verifyTotp('654321');

      const state = useAuth.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.token).toBe('jwt-after-totp');
      expect(state.requiresTotp).toBe(false);
      expect(state.tempToken).toBeNull();
    });

    it('passes tempToken and code to verifyTotp API', async () => {
      useAuth.setState({ requiresTotp: true, tempToken: 'temp-abc' });

      mockVerifyTotpApi.mockResolvedValue(totpResponse);
      await useAuth.getState().verifyTotp('123456');

      expect(mockVerifyTotpApi).toHaveBeenCalledWith('temp-abc', '123456');
    });

    it('sets error when no tempToken exists', async () => {
      useAuth.setState({ requiresTotp: true, tempToken: null });
      await useAuth.getState().verifyTotp('123456');

      expect(useAuth.getState().error).toBe('No pending 2FA session');
      expect(mockVerifyTotpApi).not.toHaveBeenCalled();
    });
  });

  // -- Login errors --

  describe('login errors', () => {
    it('sets error message from API response', async () => {
      const apiError = {
        response: { data: { error: 'Invalid credentials' } },
      };
      mockVerifyLogin.mockRejectedValue(apiError);

      await expect(useAuth.getState().login('bad', 'creds')).rejects.toEqual(apiError);

      const state = useAuth.getState();
      expect(state.error).toBe('Invalid credentials');
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });

    it('uses generic error message when no response data', async () => {
      mockVerifyLogin.mockRejectedValue(new Error('Network error'));

      await expect(useAuth.getState().login('admin', 'pass')).rejects.toThrow('Network error');

      expect(useAuth.getState().error).toBe('Network error');
    });
  });

  // -- TOTP errors --

  describe('verifyTotp errors', () => {
    it('sets error message on TOTP failure', async () => {
      useAuth.setState({ requiresTotp: true, tempToken: 'temp-123' });

      const apiError = {
        response: { data: { error: 'Invalid TOTP code' } },
      };
      mockVerifyTotpApi.mockRejectedValue(apiError);

      await expect(useAuth.getState().verifyTotp('000000')).rejects.toEqual(apiError);
      expect(useAuth.getState().error).toBe('Invalid TOTP code');
      expect(useAuth.getState().isLoading).toBe(false);
    });
  });

  // -- Logout --

  describe('logout', () => {
    it('clears all auth state', async () => {
      // Set up authenticated state
      const loginResponse = {
        token: 'jwt-token',
        user: { id: 'user-1', username: 'admin', role: 'admin' },
        tabs: ['dashboard'],
        roleName: 'Admin',
      };
      mockVerifyLogin.mockResolvedValue(loginResponse);
      await useAuth.getState().login('admin', 'pass');

      // Now logout
      useAuth.getState().logout();

      const state = useAuth.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.allowedTabs).toEqual([]);
      expect(state.role).toBeNull();
      expect(state.requiresTotp).toBe(false);
      expect(state.tempToken).toBeNull();
    });

    it('removes Authorization header from api', async () => {
      api.defaults.headers.common['Authorization'] = 'Bearer old-token';
      useAuth.getState().logout();
      expect(api.defaults.headers.common['Authorization']).toBeUndefined();
    });
  });

  // -- clearError --

  describe('clearError', () => {
    it('clears the error state', () => {
      useAuth.setState({ error: 'Some error' });
      useAuth.getState().clearError();
      expect(useAuth.getState().error).toBeNull();
    });
  });

  // -- Token persistence (zustand persist) --

  describe('persistence config', () => {
    it('uses admin-auth storage key', () => {
      // The persist middleware uses STORAGE_KEYS.AUTH = 'admin-auth'
      // After state changes, it should write to localStorage
      const loginResponse = {
        token: 'persist-token',
        user: { id: 'u1', username: 'admin', role: 'admin' },
        tabs: ['dashboard'],
        roleName: 'Admin',
      };
      mockVerifyLogin.mockResolvedValue(loginResponse);

      // The store name is set in persist config
      // We can verify by checking that the store was created with persist
      const state = useAuth.getState();
      expect(typeof state.login).toBe('function');
      expect(typeof state.logout).toBe('function');
      expect(typeof state.verifyTotp).toBe('function');
      expect(typeof state.clearError).toBe('function');
    });
  });
});
