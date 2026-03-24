import { api, getAuthToken, setAuthToken } from './api';
import axios from 'axios';
import { STORAGE_KEYS } from '../utils/constants';
import type { ApiResponse, User, AdminRole, Device, SystemHealth, SystemSetting, ProjectType, ProjectTypeStatus, ProjectTypeField, Currency, ExchangeRateProvider, ExchangeRate, OptionSet, OptionSetItem, Warehouse, WarehouseErpLink, ErpWarehouseBrowse, Patch, PatchLevel, PatchHistoryEntry, ComplianceData, ConnectSyncStatus, ConnectSyncHistoryEntry, Territory, SalesRep, Pipeline, Stage, RateCard, BillingRole, PosTerminal, GpsSalesData, GpsTerminalFilter, InfuseTestResult, McpTestConnectionResult, DocumentStats, StorageProvider, StagedDocument, RetentionPolicy, ExpiringDocument, RetentionLogEntry, ApprovalWorkflow, Provider, ProviderType } from '../types';

// Raw API for routes mounted at /admin/* (without /api prefix)
const rawApi = axios.create({ headers: { 'Content-Type': 'application/json' } });
rawApi.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Token refresh state for rawApi (mirrors api.ts pattern)
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

// Handle 401s with token refresh, then retry
rawApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';

    // Don't intercept non-401s, already-retried requests, or auth routes
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      url.includes('/admin/auth/')
    ) {
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return rawApi(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Read refresh token from Zustand's persisted state in localStorage
      let refreshToken: string | null = null;
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.AUTH);
        if (stored) {
          const parsed = JSON.parse(stored);
          refreshToken = parsed.state?.refreshToken || null;
        }
      } catch { /* ignore */ }

      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Call the Bridge refresh endpoint
      const response = await rawApi.post('/api/auth/refresh', { refreshToken });
      const data = response.data?.data || response.data;
      const { token, refreshToken: newRefreshToken } = data;

      // Update module-level auth token
      setAuthToken(token);

      // Update localStorage so Zustand stays in sync
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.AUTH);
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.state = { ...parsed.state, token, refreshToken: newRefreshToken };
          localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(parsed));
        }
      } catch { /* ignore */ }

      processQueue(null, token);

      // Retry the original request with the new token
      originalRequest.headers['Authorization'] = `Bearer ${token}`;
      return rawApi(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // Refresh failed — clear auth and redirect to login
      localStorage.removeItem(STORAGE_KEYS.AUTH);
      setAuthToken(null);
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// ===== Auth =====

export async function verifyLogin(username: string, password: string) {
  const response = await rawApi.post('/admin/auth/verify', { username, password });
  return response.data;
}

export async function verifyTotp(tempToken: string, code: string) {
  const response = await rawApi.post('/admin/auth/verify-totp', { tempToken, code });
  return response.data;
}

export async function setupTotp(tempToken: string) {
  const response = await rawApi.post('/admin/auth/setup-totp', { tempToken });
  return response.data;
}

export async function confirmTotp(tempToken: string, code: string) {
  const response = await rawApi.post('/admin/auth/confirm-totp', { tempToken, code });
  return response.data;
}

export async function getMyTwoFactorStatus() {
  const response = await rawApi.get('/admin/auth/my-2fa-status');
  return response.data;
}

// ===== Dashboard / Health =====

export async function getHealth(): Promise<ApiResponse<SystemHealth>> {
  const response = await rawApi.get('/health');
  return response.data;
}

export async function getDashboard() {
  const response = await rawApi.get('/admin/dashboard');
  return response.data;
}

// ===== ERP Operator Lookup =====

export async function getErpOperator(operatorCode: string) {
  const response = await api.get(`/operators/${encodeURIComponent(operatorCode)}`);
  return response.data;
}

export async function getErpOperators() {
  const response = await api.get('/operators');
  return response.data;
}

export async function getAbout() {
  const response = await rawApi.get('/admin/about');
  return response.data;
}

// ===== Console Users =====

export async function getUsers() {
  const response = await rawApi.get('/admin/console-users');
  return response.data;
}

export async function getUser(userId: string) {
  const response = await rawApi.get(`/admin/console-users/${userId}`);
  return response.data;
}

export async function createUser(data: Partial<User>) {
  const response = await rawApi.post('/admin/console-users', data);
  return response.data;
}

export async function updateUser(userId: string, data: Partial<User>) {
  const response = await rawApi.put(`/admin/console-users/${userId}`, data);
  return response.data;
}

export async function deleteUser(userId: string) {
  const response = await rawApi.delete(`/admin/console-users/${userId}`);
  return response.data;
}

export async function changeUserPassword(userId: string, data: { password: string }) {
  const response = await rawApi.post(`/admin/console-users/${userId}/change-password`, data);
  return response.data;
}

export async function syncUserErp(userId: string) {
  const response = await rawApi.post(`/admin/console-users/${userId}/sync-erp`);
  return response.data;
}

export async function disableUser2fa(userId: string) {
  const response = await rawApi.post(`/admin/console-users/${userId}/disable-2fa`);
  return response.data;
}

export async function reregisterUser2fa(userId: string) {
  const response = await rawApi.post(`/admin/console-users/${userId}/reregister-2fa`);
  return response.data;
}

export async function unlockUser(userId: string) {
  const response = await rawApi.post(`/admin/console-users/${userId}/unlock`);
  return response.data;
}

// ===== Roles =====

export async function getRoles() {
  const response = await rawApi.get('/admin/roles');
  return response.data;
}

export async function createRole(data: Partial<AdminRole>) {
  const response = await rawApi.post('/admin/roles', data);
  return response.data;
}

export async function updateRole(roleId: string, data: Partial<AdminRole>) {
  const response = await rawApi.put(`/admin/roles/${roleId}`, data);
  return response.data;
}

export async function deleteRole(roleId: string) {
  const response = await rawApi.delete(`/admin/roles/${roleId}`);
  return response.data;
}

// ===== Tokens =====

export async function getTokens() {
  const response = await rawApi.get('/admin/tokens');
  return response.data;
}

export async function getToken(tokenId: string) {
  const response = await rawApi.get(`/admin/tokens/${tokenId}`);
  return response.data;
}

export async function createToken(data: { name: string; description?: string; expiresInDays?: number; userId?: string; permissions?: string[] }) {
  const response = await rawApi.post('/admin/tokens', data);
  return response.data;
}

export async function deactivateToken(tokenId: string) {
  const response = await rawApi.post(`/admin/tokens/${tokenId}/deactivate`);
  return response.data;
}

export async function reactivateToken(tokenId: string) {
  const response = await rawApi.post(`/admin/tokens/${tokenId}/reactivate`);
  return response.data;
}

export async function deleteToken(tokenId: string) {
  const response = await rawApi.delete(`/admin/tokens/${tokenId}`);
  return response.data;
}

// ===== Devices =====

export async function getDevices(params?: { appCode?: string; status?: string; type?: string }) {
  const response = await rawApi.get('/admin/devices', { params });
  return response.data;
}

export async function getDevice(deviceId: string) {
  const response = await rawApi.get(`/admin/devices/${deviceId}`);
  return response.data;
}

export async function createDevice(data: Partial<Device>) {
  const response = await rawApi.post('/admin/devices', data);
  return response.data;
}

export async function updateDevice(deviceId: string, data: Partial<Device>) {
  const response = await rawApi.put(`/admin/devices/${deviceId}`, data);
  return response.data;
}

export async function retireDevice(deviceId: string) {
  const response = await rawApi.delete(`/admin/devices/${deviceId}`);
  return response.data;
}

export async function checkDeviceLicense(appCode: string) {
  const response = await rawApi.get(`/admin/devices/license-check/${appCode}`);
  return response.data;
}

// ===== Services =====

export async function getServices() {
  const response = await rawApi.get('/admin/services');
  return response.data;
}

export async function updateService(serviceName: string, data: { enabled: boolean }) {
  const response = await rawApi.put(`/admin/services/${serviceName}`, data);
  return response.data;
}

// ===== Cache =====

export async function getCacheStats() {
  const response = await api.get('/cache/stats');
  return response.data;
}

export async function clearCache(pattern?: string) {
  const response = await api.post('/cache/clear', { pattern });
  return response.data;
}

export async function getCacheTtlConfig() {
  const response = await rawApi.get('/admin/cache/ttl-config');
  return response.data;
}

export async function updateCacheTtlConfig(data: Record<string, unknown>) {
  const response = await rawApi.put('/admin/cache/ttl-config', data);
  return response.data;
}

export async function getCacheCategoryDefaults() {
  const response = await rawApi.get('/admin/cache/category-defaults');
  return response.data;
}

export async function updateCacheCategoryDefaults(data: Record<string, unknown>) {
  const response = await rawApi.put('/admin/cache/category-defaults', data);
  return response.data;
}

// ===== Cache Warmer =====

export async function getWarmerStatus() {
  const response = await rawApi.get('/admin/cache-warmer/status');
  return response.data;
}

export async function startWarmer() {
  const response = await rawApi.post('/admin/cache-warmer/start');
  return response.data;
}

export async function stopWarmer() {
  const response = await rawApi.post('/admin/cache-warmer/stop');
  return response.data;
}

export async function pauseWarmer() {
  const response = await rawApi.post('/admin/cache-warmer/pause');
  return response.data;
}

export async function resumeWarmer() {
  const response = await rawApi.post('/admin/cache-warmer/resume');
  return response.data;
}

export async function triggerWarmer() {
  const response = await rawApi.post('/admin/cache-warmer/trigger');
  return response.data;
}

export async function warmTarget(targetName: string) {
  const response = await rawApi.post(`/admin/cache-warmer/warm/${targetName}`, {});
  return response.data;
}

export async function saveWarmerConfig(data: Record<string, unknown>) {
  const response = await rawApi.put('/admin/cache-warmer/config', data);
  return response.data;
}

export async function getSmartCacheStats() {
  const response = await api.get('/cache/smart/stats');
  return response.data;
}

// ===== Dev Tasks =====

export async function getDevTasks() {
  const response = await rawApi.get('/admin/dev-tasks');
  return response.data;
}

export async function executeDevTask(taskId: string) {
  const response = await rawApi.post('/admin/dev-tasks/execute', { task: taskId });
  return response.data;
}

// ===== Config =====

export async function getConfigFiles(folder: string = 'query') {
  const response = await rawApi.get('/admin/config/files', { params: { folder } });
  return response.data;
}

export async function getConfigFile(filename: string, folder: string = 'query') {
  const response = await rawApi.get(`/admin/config/files/${encodeURIComponent(filename)}`, { params: { folder } });
  return response.data;
}

export async function updateConfigFile(filename: string, content: string, folder: string = 'query') {
  const response = await rawApi.put(`/admin/config/files/${encodeURIComponent(filename)}`, { content }, { params: { folder } });
  return response.data;
}

export async function getMappings(mappingType?: string) {
  const url = mappingType ? `/connect/config/mappings/${mappingType}` : '/connect/config/mappings';
  const response = await api.get(url);
  return response.data;
}

export async function updateMappings(mappingType: string, data: Record<string, unknown>) {
  const response = await api.put(`/connect/config/mappings/${mappingType}`, data);
  return response.data;
}

// ===== Licensing =====

export async function getLicense() {
  const response = await rawApi.get('/admin/license');
  return response.data;
}

export async function validateLicense() {
  const response = await rawApi.post('/admin/license/validate');
  return response.data;
}

export async function getLicenseUsage() {
  const response = await rawApi.get('/admin/license/usage');
  return response.data;
}

export async function getLicenseModules() {
  const response = await rawApi.get('/admin/license/modules');
  return response.data;
}

export async function getLicenseUsers() {
  const response = await rawApi.get('/admin/license/users');
  return response.data;
}

export async function getLicenseUsersSummary() {
  const response = await rawApi.get('/admin/license/users-summary');
  return response.data;
}

export async function uploadLicense(licenseXml: string) {
  const response = await rawApi.post('/admin/license/upload', { licenseXml });
  return response.data;
}

export async function updateLicenseDetails(data: Record<string, unknown>) {
  const response = await rawApi.put('/admin/license/details', data);
  return response.data;
}

export async function getLicenseCompliance(): Promise<ApiResponse<ComplianceData>> {
  const response = await rawApi.get('/admin/compliance');
  return response.data;
}

// ===== Patches =====

export async function getPatches(params?: { category?: string; severity?: string; status?: string }): Promise<ApiResponse<Patch[]>> {
  const response = await rawApi.get('/admin/patches', { params });
  return response.data;
}

export async function getPatchLevel(): Promise<ApiResponse<PatchLevel>> {
  const response = await rawApi.get('/admin/patches/level');
  return response.data;
}

export async function getPatchHistory(params?: { limit?: number }): Promise<ApiResponse<PatchHistoryEntry[]>> {
  const response = await rawApi.get('/admin/patches/history', { params });
  return response.data;
}

export async function getPatchSummary() {
  const response = await rawApi.get('/admin/patches/summary');
  return response.data;
}

export async function applyPatch(patchCode: string, data?: { notes?: string }) {
  const response = await rawApi.post(`/admin/patches/${patchCode}/apply`, data || {});
  return response.data;
}

export async function rollbackPatch(patchCode: string, data?: { notes?: string }) {
  const response = await rawApi.post(`/admin/patches/${patchCode}/rollback`, data || {});
  return response.data;
}

// ===== Endpoints =====

export async function getEndpoints(params?: { entity?: string; action?: string; group?: string; search?: string }) {
  const response = await rawApi.get('/admin/endpoints', { params });
  return response.data;
}

export async function getEndpointGroups() {
  const response = await rawApi.get('/admin/endpoint-groups');
  return response.data;
}

export async function discoverEndpoints() {
  const response = await rawApi.post('/admin/endpoints/discover');
  return response.data;
}

// ===== Logs =====

export async function getServiceLogs(service: string, params?: { limit?: number; level?: string }) {
  const response = await rawApi.get(`/admin/logs/${service}`, { params });
  return response.data;
}

export async function clearServiceLogs(service: string) {
  const response = await rawApi.delete(`/admin/logs/${service}`);
  return response.data;
}

// ===== Environment =====

export async function getEnvConfig() {
  const response = await rawApi.get('/admin/env');
  return response.data;
}

export async function updateEnvConfig(data: Record<string, string>) {
  const response = await rawApi.put('/admin/env', data);
  return response.data;
}

// ===== Stack Admin =====

export async function getStackStatus() {
  const response = await rawApi.get('/admin/stack/status');
  return response.data;
}

export async function getStackDashboard() {
  const response = await rawApi.get('/admin/stack/dashboard');
  return response.data;
}

export async function getStackServices() {
  const response = await rawApi.get('/admin/stack/services');
  return response.data;
}

export async function getStackUsers(params?: { limit?: number; offset?: number }) {
  const response = await rawApi.get('/admin/stack/users', { params });
  return response.data;
}

// ===== Floor Admin =====

export async function getFloorStatus() {
  const response = await rawApi.get('/admin/floor/status');
  return response.data;
}

export async function getFloorDashboard() {
  const response = await rawApi.get('/admin/floor/dashboard');
  return response.data;
}

export async function getFloorReasonCodes(params?: { type?: string }) {
  const response = await rawApi.get('/admin/floor/reason-codes', { params });
  return response.data;
}

export async function createFloorReasonCode(data: Record<string, unknown>) {
  const response = await rawApi.post('/admin/floor/reason-codes', data);
  return response.data;
}

export async function updateFloorReasonCode(code: string, data: Record<string, unknown>) {
  const response = await rawApi.put(`/admin/floor/reason-codes/${code}`, data);
  return response.data;
}

export async function deleteFloorReasonCode(code: string) {
  const response = await rawApi.delete(`/admin/floor/reason-codes/${code}`);
  return response.data;
}

export async function getFloorLotSerialRules() {
  const response = await rawApi.get('/admin/floor/lot-serial-rules');
  return response.data;
}

export async function createFloorLotSerialRule(data: Record<string, unknown>) {
  const response = await rawApi.post('/admin/floor/lot-serial-rules', data);
  return response.data;
}

export async function updateFloorLotSerialRule(ruleId: number, data: Record<string, unknown>) {
  const response = await rawApi.put(`/admin/floor/lot-serial-rules/${ruleId}`, data);
  return response.data;
}

export async function deleteFloorLotSerialRule(ruleId: number) {
  const response = await rawApi.delete(`/admin/floor/lot-serial-rules/${ruleId}`);
  return response.data;
}

export async function getFloorCheckpoints() {
  const response = await rawApi.get('/admin/floor/checkpoints');
  return response.data;
}

export async function createFloorCheckpoint(data: Record<string, unknown>) {
  const response = await rawApi.post('/admin/floor/checkpoints', data);
  return response.data;
}

export async function updateFloorCheckpoint(checkpointId: string, data: Record<string, unknown>) {
  const response = await rawApi.put(`/admin/floor/checkpoints/${checkpointId}`, data);
  return response.data;
}

export async function deleteFloorCheckpoint(checkpointId: string) {
  const response = await rawApi.delete(`/admin/floor/checkpoints/${checkpointId}`);
  return response.data;
}

export async function getFloorDevices() {
  const response = await rawApi.get('/admin/floor/devices');
  return response.data;
}

// ===== Label Admin =====

export async function getLabelConfig() {
  const response = await api.get('/labels/config');
  return response.data;
}

export async function saveLabelConfig(data: Record<string, unknown>) {
  const response = await api.post('/labels/config', data);
  return response.data;
}

export async function testLabelConnection() {
  const response = await api.get('/labels/test');
  return response.data;
}

export async function getLabelPrinters() {
  const response = await api.get('/labels/printers');
  return response.data;
}

export async function createLabelPrinter(data: Record<string, unknown>) {
  const response = await api.post('/labels/printers', data);
  return response.data;
}

export async function updateLabelPrinter(printerId: string, data: Record<string, unknown>) {
  const response = await api.post(`/labels/printers/${printerId}`, data);
  return response.data;
}

export async function deleteLabelPrinter(printerId: string) {
  const response = await api.delete(`/labels/printers/${printerId}`);
  return response.data;
}

export async function getLabelTemplates() {
  const response = await api.get('/labels/templates');
  return response.data;
}

export async function createLabelTemplate(data: Record<string, unknown>) {
  const response = await api.post('/labels/templates', data);
  return response.data;
}

export async function updateLabelTemplate(templateId: string, data: Record<string, unknown>) {
  const response = await api.post(`/labels/templates/${templateId}`, data);
  return response.data;
}

export async function deleteLabelTemplate(templateId: string) {
  const response = await api.delete(`/labels/templates/${templateId}`);
  return response.data;
}

export async function getLabelHistory(params?: { limit?: number; date?: string }) {
  const response = await api.get('/labels/history', { params });
  return response.data;
}

// ===== Shop Admin =====

export async function getShopStatus() {
  const response = await rawApi.get('/admin/shopit/status');
  return response.data;
}

export async function getShopConfig() {
  const response = await rawApi.get('/admin/shopit/config');
  return response.data;
}

export async function updateShopConfig(data: Record<string, unknown>) {
  const response = await rawApi.put('/admin/shopit/config', data);
  return response.data;
}

export async function getShopConnections() {
  const response = await rawApi.get('/admin/shopit/connections');
  return response.data;
}

export async function createShopConnection(data: Record<string, unknown>) {
  const response = await rawApi.post('/admin/shopit/connections', data);
  return response.data;
}

export async function updateShopConnection(connectionId: string, data: Record<string, unknown>) {
  const response = await rawApi.put(`/admin/shopit/connections/${connectionId}`, data);
  return response.data;
}

export async function deleteShopConnection(connectionId: string) {
  const response = await rawApi.delete(`/admin/shopit/connections/${connectionId}`);
  return response.data;
}

export async function testShopConnection(connectionId: string) {
  const response = await rawApi.post(`/admin/shopit/connections/${connectionId}/test`);
  return response.data;
}

export async function triggerShopSync(connectionId: string, type: string) {
  const response = await rawApi.post(`/admin/shopit/connections/${connectionId}/sync`, { type });
  return response.data;
}

export async function getShopQueue() {
  const response = await rawApi.get('/admin/shopit/queue');
  return response.data;
}

export async function getShopActivity() {
  const response = await rawApi.get('/admin/shopit/activity');
  return response.data;
}

export async function getShopMarkitConnections() {
  const response = await rawApi.get('/admin/shopit/markit/connections');
  return response.data;
}

export async function createShopMarkitConnection(data: Record<string, unknown>) {
  const response = await rawApi.post('/admin/shopit/markit/connections', data);
  return response.data;
}

export async function updateShopMarkitConnection(connectionId: string, data: Record<string, unknown>) {
  const response = await rawApi.put(`/admin/shopit/markit/connections/${connectionId}`, data);
  return response.data;
}

export async function deleteShopMarkitConnection(connectionId: string) {
  const response = await rawApi.delete(`/admin/shopit/markit/connections/${connectionId}`);
  return response.data;
}

export async function testShopMarkitConnection(connectionId: string) {
  const response = await rawApi.post(`/admin/shopit/markit/connections/${connectionId}/test`);
  return response.data;
}

export async function getShopMarkitLists() {
  const response = await rawApi.get('/admin/shopit/markit/lists');
  return response.data;
}

export async function syncShopMarkitList(listId: string) {
  const response = await rawApi.post(`/admin/shopit/markit/lists/${listId}/sync`);
  return response.data;
}

export async function getShopMarkitExports() {
  const response = await rawApi.get('/admin/shopit/markit/exports');
  return response.data;
}

export async function getShopMarkitCampaigns() {
  const response = await rawApi.get('/admin/shopit/markit/campaigns');
  return response.data;
}

export async function startShopSyncService() {
  const response = await rawApi.post('/admin/shopit/sync/start');
  return response.data;
}

export async function stopShopSyncService() {
  const response = await rawApi.post('/admin/shopit/sync/stop');
  return response.data;
}

export async function triggerShopSyncNow() {
  const response = await rawApi.post('/admin/shopit/sync/trigger');
  return response.data;
}

// ===== Infuse Admin =====

export async function getInfuseConfig() {
  const response = await rawApi.get('/admin/infuse/config');
  return response.data;
}

export async function updateInfuseConfig(data: Record<string, unknown>) {
  const response = await rawApi.post('/admin/infuse/config', data);
  return response.data;
}

export async function getInfuseStatus() {
  const response = await rawApi.get('/admin/infuse/status');
  return response.data;
}

// ===== Project Types =====

export async function getProjectTypes(): Promise<ApiResponse<ProjectType[]>> {
  const response = await api.get('/admin/project-types');
  return response.data;
}

export async function createProjectType(data: { name: string; description?: string; isDefault?: boolean }) {
  const response = await api.post('/admin/project-types', data);
  return response.data;
}

export async function updateProjectType(id: string, data: { name?: string; description?: string; isDefault?: boolean }) {
  const response = await api.put(`/admin/project-types/${id}`, data);
  return response.data;
}

export async function deleteProjectType(id: string) {
  const response = await api.delete(`/admin/project-types/${id}`);
  return response.data;
}

export async function getProjectTypeStatuses(projectTypeId: string, taskType: string): Promise<ApiResponse<ProjectTypeStatus[]>> {
  const response = await api.get(`/admin/project-types/${projectTypeId}/statuses/${taskType}`);
  return response.data;
}

export async function createProjectTypeStatus(projectTypeId: string, taskType: string, data: Partial<ProjectTypeStatus>) {
  const response = await api.post(`/admin/project-types/${projectTypeId}/statuses/${taskType}`, data);
  return response.data;
}

export async function updateProjectTypeStatus(projectTypeId: string, statusId: string, data: Partial<ProjectTypeStatus>) {
  const response = await api.put(`/admin/project-types/${projectTypeId}/statuses/${statusId}`, data);
  return response.data;
}

export async function deleteProjectTypeStatus(projectTypeId: string, statusId: string) {
  const response = await api.delete(`/admin/project-types/${projectTypeId}/statuses/${statusId}`);
  return response.data;
}

export async function getProjectTypeFields(projectTypeId: string, taskType: string): Promise<ApiResponse<ProjectTypeField[]>> {
  const response = await api.get(`/admin/project-types/${projectTypeId}/fields/${taskType}`);
  return response.data;
}

export async function updateProjectTypeField(projectTypeId: string, data: { taskType: string; fieldName: string; visibility?: string; isRequired?: boolean }) {
  const response = await api.put(`/admin/project-types/${projectTypeId}/fields`, data);
  return response.data;
}

// ===== Currencies =====

export async function getCurrencies(): Promise<ApiResponse<Currency[]>> {
  const response = await api.get('/admin/currencies');
  return response.data;
}

export async function createCurrency(data: { code: string; name: string; symbol: string; decimalPlaces?: number; isDefault?: boolean }) {
  const response = await api.post('/admin/currencies', data);
  return response.data;
}

export async function updateCurrency(id: string, data: Partial<Currency>) {
  const response = await api.put(`/admin/currencies/${id}`, data);
  return response.data;
}

export async function deleteCurrency(id: string) {
  const response = await api.delete(`/admin/currencies/${id}`);
  return response.data;
}

export async function setDefaultCurrency(id: string) {
  const response = await api.post(`/admin/currencies/${id}/set-default`);
  return response.data;
}

// ===== Exchange Rates =====

export async function getExchangeRateProvider(): Promise<ApiResponse<ExchangeRateProvider>> {
  const response = await api.get('/admin/exchange-rates/provider');
  return response.data;
}

export async function updateExchangeRateProvider(data: Partial<ExchangeRateProvider>) {
  const response = await api.put('/admin/exchange-rates/provider', data);
  return response.data;
}

export async function fetchExchangeRatesNow() {
  const response = await api.post('/admin/exchange-rates/provider/fetch');
  return response.data;
}

export async function getExchangeRates(date?: string): Promise<ApiResponse<ExchangeRate[]>> {
  const params = date ? { date } : {};
  const response = await api.get('/admin/exchange-rates/rates', { params });
  return response.data;
}

export async function createExchangeRate(data: { toCurrency: string; rate: number; rateDate: string }) {
  const response = await api.post('/admin/exchange-rates/rates', data);
  return response.data;
}

export async function updateExchangeRate(id: string, data: { toCurrency?: string; rate?: number; rateDate?: string }) {
  const response = await api.put(`/admin/exchange-rates/rates/${id}`, data);
  return response.data;
}

export async function deleteExchangeRate(id: string) {
  const response = await api.delete(`/admin/exchange-rates/rates/${id}`);
  return response.data;
}

// ===== Option Sets =====

export async function getOptionSets(): Promise<ApiResponse<{ optionSets: OptionSet[] }>> {
  const response = await api.get('/lookups/admin/option-sets');
  return response.data;
}

export async function getOptionSet(name: string): Promise<ApiResponse<{ optionSet: OptionSet & { items: OptionSetItem[] } }>> {
  const response = await api.get(`/lookups/admin/option-sets/${name}`);
  return response.data;
}

export async function createOptionSet(data: Partial<OptionSet>) {
  const response = await api.post('/lookups/admin/option-sets', data);
  return response.data;
}

export async function updateOptionSet(name: string, data: Partial<OptionSet>) {
  const response = await api.put(`/lookups/admin/option-sets/${name}`, data);
  return response.data;
}

export async function createOptionSetItem(setName: string, data: Partial<OptionSetItem>) {
  const response = await api.post(`/lookups/admin/option-sets/${setName}/items`, data);
  return response.data;
}

export async function updateOptionSetItem(setName: string, itemId: string, data: Partial<OptionSetItem>) {
  const response = await api.put(`/lookups/admin/option-sets/${setName}/items/${itemId}`, data);
  return response.data;
}

export async function deleteOptionSetItem(setName: string, itemId: string) {
  const response = await api.delete(`/lookups/admin/option-sets/${setName}/items/${itemId}`);
  return response.data;
}

export async function reorderOptionSetItems(setName: string, items: Array<{ _id: string; sortOrder: number }>) {
  const response = await api.put(`/lookups/admin/option-sets/${setName}/reorder`, { items });
  return response.data;
}

// ===== Warehouses =====

export async function getWarehouses(): Promise<ApiResponse<Warehouse[]>> {
  const response = await rawApi.get('/admin/warehouses');
  return response.data;
}

export async function getWarehouse(id: string): Promise<ApiResponse<Warehouse>> {
  const response = await rawApi.get(`/admin/warehouses/${id}`);
  return response.data;
}

export async function createWarehouse(data: Partial<Warehouse>) {
  const response = await rawApi.post('/admin/warehouses', data);
  return response.data;
}

export async function updateWarehouse(id: string, data: Partial<Warehouse>) {
  const response = await rawApi.put(`/admin/warehouses/${id}`, data);
  return response.data;
}

export async function deactivateWarehouse(id: string) {
  const response = await rawApi.delete(`/admin/warehouses/${id}`);
  return response.data;
}

export async function getWarehouseErpLinks(warehouseId: string): Promise<ApiResponse<WarehouseErpLink[]>> {
  const response = await rawApi.get(`/admin/warehouses/${warehouseId}/erp-links`);
  return response.data;
}

export async function linkErpWarehouse(warehouseId: string, data: { erpWarehouseCode: string; erpWarehouseName?: string }) {
  const response = await rawApi.post(`/admin/warehouses/${warehouseId}/erp-links`, data);
  return response.data;
}

export async function unlinkErpWarehouse(warehouseId: string, linkId: string) {
  const response = await rawApi.delete(`/admin/warehouses/${warehouseId}/erp-links/${linkId}`);
  return response.data;
}

export async function getErpWarehouseBrowse(filter?: string): Promise<ApiResponse<ErpWarehouseBrowse[]>> {
  const params = filter ? { filter } : {};
  const response = await rawApi.get('/admin/warehouses/erp-browse', { params });
  return response.data;
}

// ===== Connect (CRM) Admin =====

export async function getConnectSyncStatus(): Promise<ConnectSyncStatus> {
  const response = await api.get('/connect/sync/status');
  return response.data;
}

export async function triggerConnectSync() {
  const response = await api.post('/connect/sync/trigger');
  return response.data;
}

export async function stopConnectSync() {
  const response = await api.post('/connect/sync/stop');
  return response.data;
}

export async function getConnectConfig() {
  const response = await api.get('/connect/config');
  return response.data;
}

export async function updateConnectConfig(data: Record<string, unknown>) {
  const response = await api.put('/connect/config', data);
  return response.data;
}

export async function getConnectSyncHistory(params?: { limit?: number; entityType?: string; status?: string; fromDate?: string; toDate?: string }): Promise<{ history: ConnectSyncHistoryEntry[] }> {
  const response = await api.get('/connect/history', { params });
  return response.data;
}

export async function clearConnectSyncHistory() {
  const response = await api.delete('/connect/history/all');
  return response.data;
}

export async function getConnectQueueStats() {
  const response = await api.get('/connect/queue/stats');
  return response.data;
}

export async function getTerritories(params?: { withCounts?: boolean }): Promise<ApiResponse<Territory[]>> {
  const response = await api.get('/connect/territories', { params });
  return response.data;
}

export async function getTerritory(id: string): Promise<ApiResponse<Territory>> {
  const response = await api.get(`/connect/territories/${id}`);
  return response.data;
}

export async function createTerritory(data: Partial<Territory>) {
  const response = await api.post('/connect/territories', data);
  return response.data;
}

export async function updateTerritory(id: string, data: Partial<Territory>) {
  const response = await api.put(`/connect/territories/${id}`, data);
  return response.data;
}

export async function deleteTerritory(id: string) {
  const response = await api.delete(`/connect/territories/${id}`);
  return response.data;
}

export async function getSalesReps(params?: { withCounts?: boolean; withTerritories?: boolean }): Promise<ApiResponse<SalesRep[]>> {
  const response = await api.get('/connect/sales-reps', { params });
  return response.data;
}

export async function getSalesRep(id: string): Promise<ApiResponse<SalesRep>> {
  const response = await api.get(`/connect/sales-reps/${id}`);
  return response.data;
}

export async function createSalesRep(data: Partial<SalesRep>) {
  const response = await api.post('/connect/sales-reps', data);
  return response.data;
}

export async function updateSalesRep(id: string, data: Partial<SalesRep>) {
  const response = await api.put(`/connect/sales-reps/${id}`, data);
  return response.data;
}

export async function deleteSalesRep(id: string) {
  const response = await api.delete(`/connect/sales-reps/${id}`);
  return response.data;
}

export async function getPipelines(params?: { includeStages?: boolean; includeInactive?: boolean }): Promise<ApiResponse<Pipeline[]>> {
  const response = await api.get('/connect/pipelines', { params });
  return response.data;
}

export async function createPipeline(data: Partial<Pipeline>) {
  const response = await api.post('/connect/pipelines', data);
  return response.data;
}

export async function updatePipeline(id: string, data: Partial<Pipeline>) {
  const response = await api.put(`/connect/pipelines/${id}`, data);
  return response.data;
}

export async function deletePipeline(id: string) {
  const response = await api.delete(`/connect/pipelines/${id}`);
  return response.data;
}

export async function getStages(params?: { pipelineId?: string; includeInactive?: boolean }): Promise<ApiResponse<Stage[]>> {
  const response = await api.get('/connect/stages', { params });
  return response.data;
}

export async function createStage(data: Partial<Stage>) {
  const response = await api.post('/connect/stages', data);
  return response.data;
}

export async function updateStage(id: string, data: Partial<Stage>) {
  const response = await api.put(`/connect/stages/${id}`, data);
  return response.data;
}

export async function deleteStage(id: string) {
  const response = await api.delete(`/connect/stages/${id}`);
  return response.data;
}

export async function getRateCards(): Promise<ApiResponse<RateCard[]>> {
  const response = await api.get('/connect/rate-cards');
  return response.data;
}

export async function getRateCard(id: string): Promise<ApiResponse<RateCard>> {
  const response = await api.get(`/connect/rate-cards/${id}`);
  return response.data;
}

export async function createRateCard(data: { name: string; description?: string; status?: string; notes?: string }) {
  const response = await api.post('/connect/rate-cards', data);
  return response.data;
}

export async function updateRateCard(id: string, data: Partial<RateCard>) {
  const response = await api.put(`/connect/rate-cards/${id}`, data);
  return response.data;
}

export async function deleteRateCard(id: string) {
  const response = await api.delete(`/connect/rate-cards/${id}`);
  return response.data;
}

export async function createRateCardVersion(cardId: string) {
  const response = await api.post(`/connect/rate-cards/${cardId}/versions`);
  return response.data;
}

export async function getRateCardVersion(cardId: string, versionId: string) {
  const response = await api.get(`/connect/rate-cards/${cardId}/versions/${versionId}`);
  return response.data;
}

export async function activateRateCardVersion(cardId: string, versionId: string) {
  const response = await api.post(`/connect/rate-cards/${cardId}/versions/${versionId}/activate`);
  return response.data;
}

export async function addRateCardLineItem(cardId: string, versionId: string, data: { roleId: string; currencyId: string; rate: number; unit: string; notes?: string }) {
  const response = await api.post(`/connect/rate-cards/${cardId}/versions/${versionId}/roles`, data);
  return response.data;
}

export async function updateRateCardLineItem(cardId: string, versionId: string, lineId: string, data: { roleId?: string; currencyId?: string; rate?: number; unit?: string; notes?: string }) {
  const response = await api.put(`/connect/rate-cards/${cardId}/versions/${versionId}/roles/${lineId}`, data);
  return response.data;
}

export async function deleteRateCardLineItem(cardId: string, versionId: string, lineId: string) {
  const response = await api.delete(`/connect/rate-cards/${cardId}/versions/${versionId}/roles/${lineId}`);
  return response.data;
}

export async function getBillingRoles(): Promise<ApiResponse<BillingRole[]>> {
  const response = await api.get('/connect/billing-roles');
  return response.data;
}

export async function createBillingRole(data: Partial<BillingRole>) {
  const response = await api.post('/connect/billing-roles', data);
  return response.data;
}

export async function updateBillingRole(id: string, data: Partial<BillingRole>) {
  const response = await api.put(`/connect/billing-roles/${id}`, data);
  return response.data;
}

export async function deleteBillingRole(id: string) {
  const response = await api.delete(`/connect/billing-roles/${id}`);
  return response.data;
}

export async function getConnectMappings(entity?: string) {
  const url = entity ? `/connect/config/mappings/${entity}` : '/connect/config/mappings';
  const response = await api.get(url);
  return response.data;
}

export async function updateConnectMappings(entity: string, data: Record<string, unknown>) {
  const response = await api.put(`/connect/config/mappings/${entity}`, data);
  return response.data;
}

export async function getConnectSysproFields(entityType: string, subEntity?: string) {
  const response = await api.get(`/connect/config/fields/syspro/${entityType}`, { params: { subEntity } });
  return response.data;
}

export async function getConnectFields(entityType: string) {
  const response = await api.get(`/connect/config/fields/connect/${entityType}`);
  return response.data;
}

export async function saveConnectMappingOverrides(entityType: string, data: { overrides: Record<string, unknown>; disabled: string[]; custom: Record<string, unknown> }) {
  const response = await api.put(`/connect/config/mappings/${entityType}`, data);
  return response.data;
}

export async function resetConnectMapping(entityType: string) {
  const response = await api.post(`/connect/config/mappings/${entityType}/reset`);
  return response.data;
}

// ===== Stack (WMS) Admin — extended =====

export async function getStackConfig() {
  const response = await rawApi.get('/admin/stack/config');
  return response.data;
}

export async function getStackWebsocket() {
  const response = await rawApi.get('/admin/stack/websocket');
  return response.data;
}

export async function updateStackService(serviceName: string, data: { enabled?: boolean; interval?: number }) {
  const response = await rawApi.put(`/admin/stack/services/${serviceName}`, data);
  return response.data;
}

export async function restartStackService(serviceName: string) {
  const response = await rawApi.post(`/admin/stack/services/${serviceName}/restart`);
  return response.data;
}

export async function toggleStackServiceApi(serviceName: string) {
  const response = await rawApi.post(`/admin/stack/services/${serviceName}/toggle`);
  return response.data;
}

// ===== Flip (POS) Admin =====

export async function getPosTerminals(): Promise<{ success: boolean; terminals: PosTerminal[] }> {
  const response = await rawApi.get('/admin/pos/terminals');
  return response.data;
}

export async function getGpsTerminalsFilter(): Promise<{ success: boolean; terminals: GpsTerminalFilter[] }> {
  const response = await rawApi.get('/admin/pos/dashboard/terminals-for-filter');
  return response.data;
}

export async function getGpsSalesData(params?: { date?: string; terminalIds?: string }): Promise<{ success: boolean } & GpsSalesData> {
  const response = await rawApi.get('/admin/pos/dashboard/gps-sales', { params });
  return response.data;
}

// ===== Infuse (AI/MCP) Admin — extended =====

export async function testInfuseConnection(data: { provider: string; model: string; apiKey?: string | null; baseUrl?: string }): Promise<InfuseTestResult> {
  const response = await rawApi.post('/admin/infuse/test', data);
  return response.data;
}

export async function testMcpConnection(data: { serverUrl?: string | null; authType?: string | null; authValue?: string | null }): Promise<McpTestConnectionResult> {
  const response = await rawApi.post('/admin/infuse/mcp/test-connection', data);
  return response.data;
}

export async function getMcpDefaultConfig() {
  const response = await rawApi.get('/admin/infuse/mcp/default-config');
  return response.data;
}

// ===== Work (N8N) Admin =====

// Work service is proxied through nginx at /work/ to avoid CORS issues
async function workApiFetch(endpoint: string, options?: { method?: string; data?: unknown }) {
  const method = options?.method || 'GET';
  const config: Record<string, unknown> = { params: {} };
  if (options?.data) config.data = options.data;
  let response;
  switch (method) {
    case 'POST': response = await rawApi.post(`/work${endpoint}`, options?.data); break;
    case 'PUT': response = await rawApi.put(`/work${endpoint}`, options?.data); break;
    case 'DELETE': response = await rawApi.delete(`/work${endpoint}`); break;
    default: response = await rawApi.get(`/work${endpoint}`);
  }
  return response.data;
}

export async function getWorkHealth() {
  return workApiFetch('/api/health');
}

export async function getWorkWorkflows() {
  return workApiFetch('/api/workflows');
}

export async function createWorkWorkflow(data: Record<string, unknown>) {
  return workApiFetch('/api/workflows', { method: 'POST', data });
}

export async function updateWorkWorkflow(id: number, data: Record<string, unknown>) {
  return workApiFetch(`/api/workflows/${id}`, { method: 'PUT', data });
}

export async function deleteWorkWorkflow(id: number) {
  return workApiFetch(`/api/workflows/${id}`, { method: 'DELETE' });
}

export async function executeWorkWorkflow(id: number) {
  return workApiFetch(`/api/workflows/${id}/execute`, { method: 'POST', data: { payload: {}, options: { sourceApp: 'admin' } } });
}

export async function getWorkExecutions(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return workApiFetch(`/api/executions${qs}`);
}

export async function getWorkExecutionStats() {
  return workApiFetch('/api/executions/stats');
}

export async function getWorkExecution(id: number) {
  return workApiFetch(`/api/executions/${id}`);
}

export async function retryWorkExecution(id: number) {
  return workApiFetch(`/api/executions/${id}/retry`, { method: 'POST' });
}

export async function getWorkEventTypes() {
  return workApiFetch('/api/events/types');
}

export async function getWorkEventMappings() {
  return workApiFetch('/api/events/mappings');
}

export async function createWorkEventMapping(data: Record<string, unknown>) {
  return workApiFetch('/api/events/mappings', { method: 'POST', data });
}

export async function updateWorkEventMapping(id: number, data: Record<string, unknown>) {
  return workApiFetch(`/api/events/mappings/${id}`, { method: 'PUT', data });
}

export async function deleteWorkEventMapping(id: number) {
  return workApiFetch(`/api/events/mappings/${id}`, { method: 'DELETE' });
}

export async function getWorkApiKeys() {
  return workApiFetch('/api/api-keys');
}

export async function createWorkApiKey(data: Record<string, unknown>) {
  return workApiFetch('/api/api-keys', { method: 'POST', data });
}

export async function rotateWorkApiKey(id: number) {
  return workApiFetch(`/api/api-keys/${id}/rotate`, { method: 'POST' });
}

export async function revokeWorkApiKey(id: number) {
  return workApiFetch(`/api/api-keys/${id}/revoke`, { method: 'POST' });
}

export async function deleteWorkApiKey(id: number) {
  return workApiFetch(`/api/api-keys/${id}`, { method: 'DELETE' });
}

// ===== PulpIT (Documents) Admin =====

export async function getDocumentStats(): Promise<DocumentStats> {
  const response = await api.get('/documents/config/stats');
  return response.data?.data ?? response.data;
}

export async function getStorageProviders(): Promise<StorageProvider[]> {
  const response = await api.get('/documents/config/providers');
  return response.data;
}

export async function getStagedDocuments(limit = 50): Promise<StagedDocument[]> {
  const response = await api.get('/documents/staged', { params: { limit } });
  return response.data?.data ?? response.data;
}

export async function approveStagedDocument(id: string) {
  const response = await api.put(`/documents/staged/${id}/approve`, {});
  return response.data?.data ?? response.data;
}

export async function rejectStagedDocument(id: string, notes?: string) {
  const response = await api.put(`/documents/staged/${id}/reject`, { notes });
  return response.data?.data ?? response.data;
}

export async function getRetentionPolicies(): Promise<RetentionPolicy[]> {
  const response = await api.get('/documents/retention/policies');
  return response.data?.data ?? response.data;
}

export async function createRetentionPolicy(data: { policyName: string; documentType?: string | null; retentionPeriodDays: number; action: string; notifyRoles?: string | null; notifyDaysBefore: number }) {
  const response = await api.post('/documents/retention/policies', data);
  return response.data?.data ?? response.data;
}

export async function updateRetentionPolicy(id: string, data: Partial<{ policyName: string; documentType: string | null; retentionPeriodDays: number; action: string; notifyRoles: string | null; notifyDaysBefore: number }>) {
  const response = await api.put(`/documents/retention/policies/${id}`, data);
  return response.data?.data ?? response.data;
}

export async function deleteRetentionPolicy(id: string) {
  const response = await api.delete(`/documents/retention/policies/${id}`);
  return response.data?.data ?? response.data;
}

export async function getExpiringDocuments(days = 30): Promise<ExpiringDocument[]> {
  const response = await api.get('/documents/retention/expiring', { params: { days } });
  return response.data?.data ?? response.data;
}

export async function extendDocumentRetention(documentId: string, newExpiryDate: string) {
  const response = await api.post(`/documents/${documentId}/extend-retention`, { newExpiryDate });
  return response.data;
}

export async function exemptDocumentRetention(documentId: string) {
  const response = await api.post(`/documents/${documentId}/exempt-retention`, {});
  return response.data;
}

export async function getRetentionLog(limit = 50): Promise<RetentionLogEntry[]> {
  const response = await api.get('/documents/retention/log', { params: { limit } });
  return response.data?.data ?? response.data;
}

export async function triggerRetentionEnforcement() {
  const response = await api.post('/documents/retention/enforce', {});
  return response.data?.data ?? response.data;
}

export async function getArchivedDocuments(params?: { limit?: number; offset?: number; search?: string }) {
  const response = await api.get('/documents/archive', { params });
  return response.data?.data ?? response.data;
}

export async function getApprovalWorkflows(): Promise<ApprovalWorkflow[]> {
  const response = await api.get('/documents/approval/workflows');
  return response.data?.data ?? response.data;
}

export async function createApprovalWorkflow(data: { workflowName: string; documentType?: string | null; requiredApprovals: number; approvalRoles: string[]; sequentialApproval: boolean; autoPublishOnApproval: boolean }) {
  const response = await api.post('/documents/approval/workflows', data);
  return response.data?.data ?? response.data;
}

export async function deleteApprovalWorkflow(id: string) {
  const response = await api.delete(`/documents/approval/workflows/${id}`);
  return response.data?.data ?? response.data;
}

// ===== Providers =====

export async function getProviders(params?: { category?: string; typeCode?: string; isActive?: boolean }): Promise<ApiResponse<Provider[]>> {
  const response = await rawApi.get('/api/admin/providers', { params });
  return response.data;
}

export async function getProviderTypes(category?: string): Promise<ApiResponse<ProviderType[]>> {
  const response = await rawApi.get('/api/admin/providers/types', { params: category ? { category } : {} });
  return response.data;
}

export async function getProvidersByType(typeCode: string): Promise<ApiResponse<Provider[]>> {
  const response = await rawApi.get(`/api/admin/providers/by-type/${encodeURIComponent(typeCode)}`);
  return response.data;
}

export async function getProvidersByApp(appCode: string): Promise<ApiResponse<Provider[]>> {
  const response = await rawApi.get(`/api/admin/providers/by-app/${encodeURIComponent(appCode)}`);
  return response.data;
}

export async function getProvider(id: string): Promise<ApiResponse<Provider>> {
  const response = await rawApi.get(`/api/admin/providers/${id}`);
  return response.data;
}

export async function createProvider(data: Record<string, unknown>): Promise<ApiResponse<Provider>> {
  const response = await rawApi.post('/api/admin/providers', data);
  return response.data;
}

export async function updateProvider(id: string, data: Record<string, unknown>): Promise<ApiResponse<Provider>> {
  const response = await rawApi.put(`/api/admin/providers/${id}`, data);
  return response.data;
}

export async function deleteProvider(id: string): Promise<ApiResponse<Provider>> {
  const response = await rawApi.delete(`/api/admin/providers/${id}`);
  return response.data;
}

export async function destroyProvider(id: string): Promise<ApiResponse<{ deleted: boolean; name: string }>> {
  const response = await rawApi.delete(`/api/admin/providers/${id}/permanent`);
  return response.data;
}

export async function testProvider(id: string): Promise<{ ok: boolean; message: string }> {
  const response = await rawApi.post(`/api/admin/providers/${id}/test`);
  return response.data?.data || response.data;
}

export async function setProviderDefault(id: string): Promise<ApiResponse<Provider>> {
  const response = await rawApi.put(`/api/admin/providers/${id}/default`);
  return response.data;
}

export async function updateProviderApplications(id: string, applications: string[]) {
  const response = await rawApi.put(`/api/admin/providers/${id}/applications`, { applications });
  return response.data;
}

export async function getProviderApiDetails(id: string) {
  const response = await rawApi.get(`/api/admin/providers/${id}/api-details`);
  return response.data;
}

// ===== System Settings =====

export async function getSystemSettings(): Promise<ApiResponse<SystemSetting[]>> {
  const response = await rawApi.get('/admin/settings');
  return response.data;
}

export async function getSystemSetting(key: string): Promise<ApiResponse<SystemSetting>> {
  const response = await rawApi.get(`/admin/settings/${encodeURIComponent(key)}`);
  return response.data;
}

export async function updateSystemSetting(key: string, data: { value: string; description?: string }): Promise<ApiResponse<SystemSetting>> {
  const response = await rawApi.put(`/admin/settings/${encodeURIComponent(key)}`, data);
  return response.data;
}

export async function createSystemSetting(data: { key: string; value: string; description?: string; dataType?: string }): Promise<ApiResponse<SystemSetting>> {
  const response = await rawApi.post('/admin/settings', data);
  return response.data;
}

export async function deleteSystemSetting(key: string): Promise<ApiResponse<unknown>> {
  const response = await rawApi.delete(`/admin/settings/${encodeURIComponent(key)}`);
  return response.data;
}
