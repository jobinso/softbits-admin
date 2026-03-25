import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAuthToken } from '../services/api';
import { verifyLogin, verifyTotp as verifyTotpApi, uploadLicense } from '../services/admin-service';
import { STORAGE_KEYS } from '../utils/constants';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  allowedTabs: string[];
  role: string | null;
  // 2FA flow
  requiresTotp: boolean;
  tempToken: string | null;

  login: (username: string, password: string) => Promise<void>;
  verifyTotp: (code: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const PENDING_LICENSE_KEY = 'pending-license-xml';

function uploadPendingLicense() {
  const pendingXml = localStorage.getItem(PENDING_LICENSE_KEY);
  if (!pendingXml) return;
  localStorage.removeItem(PENDING_LICENSE_KEY);
  uploadLicense(pendingXml).catch(() => {
    // Fire-and-forget: don't block login if license upload fails
  });
}

function completeAuth(set: (state: Partial<AuthState>) => void, data: {
  token: string;
  refreshToken?: string | null;
  user: { id: string; username: string; fullName?: string; role: string; totpEnabled?: boolean };
  tabs: string[];
  roleName: string;
}) {
  setAuthToken(data.token);

  set({
    user: {
      UserId: data.user.id,
      UserName: data.user.username,
      FullName: data.user.fullName,
      Role: data.user.role,
      TwoFactorEnabled: data.user.totpEnabled,
      AllowedTabs: data.tabs,
    },
    token: data.token,
    refreshToken: data.refreshToken || null,
    isAuthenticated: true,
    isLoading: false,
    allowedTabs: data.tabs,
    role: data.roleName,
    requiresTotp: false,
    tempToken: null,
    error: null,
  });

  // Upload any pending offline license file staged from the login page
  uploadPendingLicense();
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
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

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null, requiresTotp: false, tempToken: null });
        try {
          const data = await verifyLogin(username, password);

          if (data.status === 'pending_totp') {
            set({
              isLoading: false,
              requiresTotp: true,
              tempToken: data.tempToken,
            });
            return;
          }

          completeAuth(set, data);
        } catch (error: unknown) {
          const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
            || (error instanceof Error ? error.message : 'Login failed');
          set({ error: msg, isLoading: false });
          throw error;
        }
      },

      verifyTotp: async (code: string) => {
        const { tempToken } = get();
        if (!tempToken) {
          set({ error: 'No pending 2FA session' });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const data = await verifyTotpApi(tempToken, code);
          completeAuth(set, data);
        } catch (error: unknown) {
          const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
            || (error instanceof Error ? error.message : 'Verification failed');
          set({ error: msg, isLoading: false });
          throw error;
        }
      },

      logout: () => {
        setAuthToken(null);
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          allowedTabs: [],
          role: null,
          requiresTotp: false,
          tempToken: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: STORAGE_KEYS.AUTH,
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        allowedTabs: state.allowedTabs,
        role: state.role,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setAuthToken(state.token);
        }
      },
    }
  )
);
