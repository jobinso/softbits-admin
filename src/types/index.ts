export interface User {
  UserId: string;
  UserName: string;
  FullName?: string;
  Email?: string;
  Role: string;
  AllowedTabs?: string[];
  TwoFactorEnabled?: boolean;
}

export interface AdminRole {
  RoleId: string;
  RoleName: string;
  Description?: string;
  AllowedTabs: string[];
  EntityPermissions?: Record<string, string[]>;
  IsActive: boolean;
}

export interface ApiToken {
  id: string;
  name: string;
  description?: string;
  token?: string; // Only returned on creation
  permissions?: string[];
  userId?: string | null;
  tokenType?: string;
  createdAt: string;
  expiresAt?: string | null;
  lastUsed?: string | null;
  usageCount?: number;
  active: boolean;
  expired?: boolean;
}

export interface Device {
  DeviceId: string;
  DeviceCode: string;
  DeviceName?: string;
  AppCode: string;
  Type?: string;
  Model?: string;
  Location?: string;
  SerialNumber?: string;
  Status: string;
  Notes?: string;
  PrinterName?: string;
  PrinterType?: string;
  PrinterPort?: string;
  PrinterDefaultLabel?: string;
  UserId?: string | null;
  CreatedBy?: string;
  ModifiedBy?: string;
  CreatedAt: string;
  ModifiedAt?: string;
  LastSeen?: string;
}

export interface DeviceLicenseCheck {
  appCode: string;
  activeCount: number;
  maxAllowed: number | null;
  isAtLimit: boolean;
  isOverLimit: boolean;
  gracePeriodDays: number;
  enforcement: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    count?: number;
    total?: number;
    limit?: number;
    offset?: number;
    timestamp?: string;
    requestId?: string;
  };
}

export interface AppStatus {
  name: string;
  enabled: boolean;
  healthy: boolean;
  url?: string;
}

export interface SystemHealth {
  status: string;
  uptime: number;
  version: string;
  erp?: {
    type: string;
    connected: boolean;
  };
  database?: {
    connected: boolean;
  };
  cache?: {
    enabled: boolean;
    connected: boolean;
  };
  apps?: Record<string, AppStatus>;
}

// ===== System Settings Types =====

export interface SystemSetting {
  SettingKey: string;
  SettingValue: string | null;
  Description: string | null;
  DataType: 'string' | 'number' | 'boolean' | 'json';
  IsEncrypted: boolean;
  UpdatedAt: string | null;
  UpdatedBy: string | null;
}

// ===== Cache Types =====

export interface CacheStats {
  totals?: {
    hits: number;
    misses: number;
    hitRate: string;
  };
  local?: {
    keys: number;
    hits: number;
    misses: number;
  };
  redis?: {
    available: boolean;
    keys?: number;
    memory?: string;
  };
}

export interface CacheTtlConfig {
  masterData?: Record<string, number>;
  transactionData?: Record<string, number>;
  planningData?: Record<string, number>;
  configData?: Record<string, number>;
  summaryData?: Record<string, number>;
  default?: number;
}

export interface CacheCategoryDefaults {
  [category: string]: {
    ttl: number;
    description?: string;
  };
}

export interface WarmerTarget {
  name: string;
  description: string;
  ttl: number;
  variants: number;
  stats?: {
    warmed: number;
    failed: number;
  };
}

export interface WarmerStatus {
  enabled: boolean;
  running: boolean;
  paused: boolean;
  config?: {
    intervalMs: number;
    staggerDelayMs: number;
    refreshThreshold: number;
    maxRetries?: number;
  };
  targets?: WarmerTarget[];
  lastRun?: string;
  nextRun?: string;
}

// ===== Services Types =====

export interface ServiceInfo {
  name: string;
  description: string;
  enabled: boolean;
}

export interface AppServiceInfo {
  key: string;
  name: string;
  description: string;
  envVar: string;
  enabled: boolean;
}

export interface DevTask {
  id: string;
  name: string;
  description: string;
  group: string;
  icon: string;
  confirm: boolean;
}

export interface DevTaskResult {
  success: boolean;
  output: string;
  exitCode?: number;
  duration: number;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: unknown;
}

// ===== Project Types =====

export interface ProjectType {
  Id: string;
  Name: string;
  Description?: string;
  IsDefault: boolean;
  IsActive: boolean;
  CreatedAt?: string;
}

export interface ProjectTypeStatus {
  StatusId?: string;
  Id?: string;
  DisplayLabel: string;
  StatusValue: string;
  BadgeColor?: string;
  Colour?: string;
  SortOrder?: number;
  IsDefault: boolean;
  IsFinal?: boolean;
  IsTerminal?: boolean;
}

export interface ProjectTypeField {
  FieldName: string;
  Visibility: 'visible' | 'read-only' | 'hidden';
  IsRequired: boolean;
}

// ===== Currencies & Exchange Rates =====

export interface Currency {
  Id: string;
  Code: string;
  Name: string;
  Symbol?: string;
  DecimalPlaces: number;
  SortOrder?: number;
  IsDefault: boolean;
  IsActive: boolean;
}

export interface ExchangeRateProvider {
  Name?: string;
  ApiUrl?: string;
  ApiKey?: string;
  BaseCurrency?: string;
  FetchSchedule?: string;
  FetchTime?: string;
  IsEnabled: boolean;
  LastFetchedAt?: string;
  LastFetchStatus?: string;
  LastFetchError?: string;
}

export interface ExchangeRate {
  Id: string;
  BaseCurrency?: string;
  BaseCurrencyName?: string;
  ToCurrency: string;
  CurrencyName?: string;
  Rate: number;
  RateDate: string;
  Source?: string;
}

// ===== Option Sets =====

export interface OptionSet {
  Name: string;
  DisplayName?: string;
  Description?: string;
  Category?: string;
  ItemCount?: number;
  IsSystem: boolean;
  IsActive: boolean;
  AllowCustomItems?: boolean;
  AllowMultiSelect?: boolean;
  Version?: number;
}

export interface OptionSetItem {
  _id: string;
  id: string;
  name: string;
  description?: string;
  category?: string;
  type?: string;
  colour?: string;
  icon?: string;
  badgeVariant?: string;
  sortOrder?: number;
  isDefault: boolean;
  isActive: boolean;
  isSystem?: boolean;
}

// ===== Warehouses =====

export interface Warehouse {
  WarehouseId: string;
  WarehouseCode: string;
  WarehouseName: string;
  Address?: string;
  City?: string;
  State?: string;
  PostalCode?: string;
  Country?: string;
  Notes?: string;
  Status: string;
  ErpLinkCount?: number;
  CreatedAt?: string;
}

export interface WarehouseErpLink {
  LinkId: string;
  ErpWarehouseCode: string;
  ErpWarehouseName?: string;
}

export interface ErpWarehouseBrowse {
  Warehouse: string;
  Description?: string;
}

// ===== Licensing Types =====

export interface LicenseInfo {
  license?: {
    companyName?: string;
    tier?: string;
    licenseTier?: string;
    licenseKey?: string;
    expiresAt?: string;
    expirationDate?: string;
    startDate?: string;
    issueDate?: string;
    renewalDate?: string;
    daysRemaining?: number;
    enforcementMode?: string;
    gracePeriodDays?: number;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    backupContactName?: string;
    backupContactEmail?: string;
    backupContactPhone?: string;
  };
  modules?: LicenseModule[];
  status?: string;
  tier?: string;
  companyName?: string;
  licenseKey?: string;
  expiresAt?: string;
  expirationDate?: string;
  daysRemaining?: number;
  enforcement?: string;
  activeUsers?: number;
  activeSessions?: number;
  disabled?: boolean;
}

export interface LicenseModule {
  code: string;
  name?: string;
  enabled: boolean;
  maxConcurrentUsers?: number | null;
  maxNamedUsers?: number | null;
  maxWarehouses?: number | null;
  maxTerminals?: number | null;
  maxVans?: number | null;
  maxKiosks?: number | null;
  infuseMcpEnabled?: boolean | null;
  infuseN8nEnabled?: boolean | null;
  infuseQueryTier?: string | null;
  maxQueriesPerMonth?: number | null;
}

export interface LicenseUsage {
  usage?: {
    currentMonth?: {
      month?: number;
      year?: number;
      totalApiCalls?: number;
      uniqueUsers?: number;
      avgResponseTime?: number;
    };
    history?: Array<{
      ModuleCode: string;
      Year: number;
      Month: number;
      TotalApiCalls: number;
    }>;
    limits?: Record<string, {
      maxApiCallsPerMonth?: number;
      overageMode?: string;
    }>;
  };
  message?: string;
}

export interface LicenseUser {
  Id: string;
  SysproOperator: string;
  SysproCompany?: string;
  DisplayName?: string;
  Email?: string;
  UserType: string;
  MaxSessions: number;
  CurrentSessions?: number;
  Department?: string;
  AllowedModules?: string[];
  EntityPermissions?: Record<string, string[]>;
  IsActive: boolean;
}

export interface LicenseUsersSummary {
  activeUsers: number;
  totalActiveSessions: number;
}

export interface ComplianceData {
  overall: 'compliant' | 'warning' | 'over-limit';
  users: { activeCount: number; maxNamed: number | null; status: string };
  concurrent?: Record<string, { activeCount: number; maxAllowed: number | null; status: string }>;
  devices?: Record<string, { activeCount: number; maxAllowed: number | null; status: string; entitlement?: string }>;
  warehouses: { activeCount: number; maxAllowed: number | null; status: string };
  modules?: LicenseModule[];
}

// ===== Patches Types =====

export interface Patch {
  PatchCode: string;
  Category: string;
  Severity: string;
  Title: string;
  Description?: string;
  ReleaseNotes?: string;
  AffectedModules?: string;
  MinVersion?: string;
  DependsOn?: string;
  MigrationFile?: string;
  RollbackFile?: string;
  Status?: string;
  ReleasedAt?: string;
  AppliedAt?: string;
  AppliedBy?: string;
  ApplyDurationMs?: number;
  CreatedBy?: string;
}

export interface PatchLevel {
  TotalApplied: number;
  LatestPatch?: string;
  PendingCritical?: number;
}

export interface PatchHistoryEntry {
  PatchCode: string;
  PatchTitle?: string;
  Action: string;
  Status: string;
  AppliedBy?: string;
  StartedAt?: string;
  DurationMs?: number;
  ErrorMessage?: string;
}

// ===== Connect (CRM) Admin Types =====

export interface ConnectSyncStatus {
  isRunning: boolean;
  database?: string;
  syspro?: string;
  lastSync?: string;
  queuePending?: number;
  queueProcessed?: number;
  queueFailed?: number;
}

export interface ConnectSyncConfig {
  EntityType: string;
  SyncEnabled: boolean;
  SyncDirection: string;
  SyncFrequencyMinutes?: number;
}

export interface ConnectSyncHistoryEntry {
  Id?: string;
  SyncRunId?: string;
  SyncedAt: string;
  EntityType: string;
  EntityId?: string;
  ErpId?: string;
  Operation?: string;
  Direction: string;
  Status: string;
  RecordsAffected: number;
  ErrorMessage?: string;
  Message?: string;
  DurationMs?: number;
  SyncedBy?: string;
  // API tracking
  ApiMethod?: string;
  ApiUrl?: string;
  ApiEndpoint?: string;
  ApiRequestBody?: string;
  ApiResponseStatus?: number;
  ApiResponseBody?: string;
  // Data payloads
  SourceData?: string;
  MappedData?: string;
  // Error diagnostics
  FailedField?: string;
  FailedFieldValue?: string;
  FailedFieldExpectedType?: string;
}

export interface Territory {
  Id: string;
  Name: string;
  Code?: string;
  SysproBranch?: string;
  Description?: string;
  IsActive: boolean;
  AccountCount?: number;
}

export interface SalesRep {
  Id: string;
  Name: string;
  Email?: string;
  Phone?: string;
  SysproSalesperson?: string;
  SalesTarget?: number;
  DefaultPipelineId?: string;
  IsActive: boolean;
  AccountCount?: number;
  PipelineValue?: number;
  territories?: Array<{ id: string; name: string; isPrimary: boolean }>;
}

export interface Pipeline {
  Id: string;
  Name: string;
  Description?: string;
  IsDefault: boolean;
  IsActive: boolean;
  stages?: Stage[];
}

export interface Stage {
  Id: string;
  PipelineId: string;
  PipelineName?: string;
  Name: string;
  DisplayOrder?: number;
  Probability?: number;
  Colour?: string;
  IsClosed: boolean;
  IsWon: boolean;
  IsActive: boolean;
}

export interface CaseType {
  Id: string;
  Code: string;
  Name: string;
  Description?: string;
  IconName?: string;
  Color?: string;
  Prefix: string;
  RequiresRootCause: boolean;
  RequiresContainment: boolean;
  RequiresVerification: boolean;
  RequiresApproval: boolean;
  DefaultPriority?: string;
  DefaultSlaResponseHours?: number;
  DefaultSlaResolutionHours?: number;
  DefaultAssignedTeamId?: string;
  IsPortalCreatable: boolean;
  IsCustomerFacing: boolean;
  SortOrder: number;
  IsActive: boolean;
  SubTypeCount?: number;
  CaseCount?: number;
  StepCount?: number;
}

export interface CaseTypeStep {
  Id: string;
  CaseTypeId: string;
  CaseTypeName?: string;
  Name: string;
  StatusCode?: string;
  DisplayOrder: number;
  Color?: string;
  IsTerminal: boolean;
  IsResolved: boolean;
  RequiresApproval: boolean;
  IsActive: boolean;
}

export interface RateCard {
  Id: string;
  Name: string;
  Description?: string;
  Status: string;
  Notes?: string;
  RoleCount?: number;
  Versions?: RateCardVersion[];
}

export interface RateCardVersion {
  Id: string;
  Version: number;
  Status: string;
  StartDate?: string;
  Roles?: RateCardLineItem[];
}

export interface RateCardLineItem {
  Id: string;
  RoleId?: string;
  RoleName?: string;
  RoleCode?: string;
  CurrencyId?: string;
  CurrencyCode?: string;
  Rate: number;
  Unit: string;
  Notes?: string;
}

export interface BillingRole {
  Id: string;
  Code: string;
  Name: string;
  Description?: string;
  Status: string;
}

export interface ConnectFieldMapping {
  entity: string;
  erpField: string;
  crmField: string;
  direction: string;
  enabled: boolean;
}

// ===== Stack (WMS) Admin Types =====

export interface StackStatus {
  connected: boolean;
  enabled?: boolean;
  uptime?: number;
  services?: Record<string, { running: boolean }>;
  websocket?: { enabled: boolean; connections?: number } | boolean;
}

export interface StackService {
  name: string;
  displayName?: string;
  description?: string;
  running: boolean;
  enabled: boolean;
  interval?: number;
  status?: string;
}

export interface StackDashboard {
  picksPending?: number;
  packsPending?: number;
  shipsPending?: number;
  completedToday?: number;
  picks?: { pending: number };
  packs?: { pending: number };
  ships?: { pending: number };
  completed?: { today: number };
  activeOperations?: StackActiveOperation[];
}

export interface StackActiveOperation {
  orderNumber: string;
  customer?: string;
  type: string;
  lines?: number;
  operator?: string;
  startTime?: string;
  status: string;
}

export interface StackConfig {
  [key: string]: unknown;
}

// ===== Flip (POS) Admin Types =====

export interface PosTerminal {
  TerminalCode: string;
  Description?: string;
  VanRegistration?: string;
  TruckWarehouse?: string;
  ReplenishmentWarehouse?: string;
  Salesperson?: string;
  IsActive: boolean;
  GpsTrackingEnabled: boolean;
  TodayTransactionCount?: number;
  TodaySalesTotal?: string;
  LastLoginAt?: string;
}

export interface GpsSalesData {
  summary: {
    totalTransactions: number;
    totalSales: number;
    terminalCount: number;
  };
  terminals: GpsSalesTerminal[];
  transactions: GpsTransaction[];
}

export interface GpsSalesTerminal {
  terminalCode: string;
  description?: string;
  vanRegistration?: string;
  totalSales: number;
  transactionCount: number;
  locations: GpsTransaction[];
}

export interface GpsTransaction {
  terminalCode: string;
  customerName?: string;
  customerCode?: string;
  grandTotal: string;
  latitude: string;
  longitude: string;
  createdAt: string;
}

export interface GpsTerminalFilter {
  terminalId: string;
  terminalCode: string;
  description?: string;
  vanRegistration?: string;
}

// ===== Floor (FloorIT) Admin Types =====

export interface FloorStatus {
  enabled?: boolean;
  activeOperators?: number;
  activeJobs?: number;
  syncStatus?: string;
}

export interface FloorDashboard {
  activeOperators?: FloorActiveOperator[];
  activeJobs?: FloorActiveJob[];
  laborStats?: FloorLaborStats;
}

export interface FloorActiveOperator {
  employeeCode?: string;
  employeeName?: string;
  workCentre?: string;
  currentJob?: string;
  clockInTime?: string;
  duration?: string;
  status?: string;
}

export interface FloorActiveJob {
  jobNumber?: string;
  description?: string;
  stockCode?: string;
  workCentre?: string;
  operation?: string;
  operator?: string;
  startTime?: string;
  qtyRequired?: number;
  qtyCompleted?: number;
  qtyDone?: number;
  operatorCount?: number;
  status?: string;
}

export interface FloorLaborStats {
  totalHoursToday?: number;
  qtyCompletedToday?: number;
  qtyScrappedToday?: number;
  onBreak?: number;
}

export interface FloorReasonCode {
  ReasonCode: string;
  Description?: string;
  ReasonType: string;
  IsActive: boolean;
}

export interface FloorLotSerialRule {
  RuleId: number;
  RuleType: string;
  StockCode?: string;
  ProductClass?: string;
  Prefix?: string;
  DateFormat?: string;
  SequenceDigits?: number;
  ResetFrequency?: string;
  IsActive: boolean;
}

export interface FloorCheckpoint {
  CheckpointId: string;
  CheckpointName: string;
  CheckpointType: string;
  WorkCentreCode?: string;
  StockCode?: string;
  IsMandatory: boolean;
  IsActive: boolean;
}

// ===== Label (LabelIT) Admin Types =====

export interface LabelConfig {
  providerType?: string;
  baseUrl?: string;
  authType?: string;
  username?: string;
  success?: boolean;
  ProviderType?: string;
  BaseUrl?: string;
  ApiKey?: string;
}

export interface LabelPrinter {
  PrinterId: string;
  PrinterName: string;
  PrinterPath?: string;
  PrinterType?: string;
  Location?: string;
  WorkCentreCode?: string;
  Warehouse?: string;
  IsDefault: boolean;
  IsActive: boolean;
}

export interface LabelTemplate {
  TemplateId: string;
  TemplateName: string;
  TemplateFile: string;
  Context: string;
  Application: string;
  Description?: string;
  DefaultPrinterId?: string;
  IsActive: boolean;
}

export interface LabelHistoryEntry {
  PrintedAt: string;
  TemplateId?: string;
  PrinterId?: string;
  Copies: number;
  PrintedBy?: string;
  Application?: string;
  Status: string;
}

// ===== Shop (ShopIT) Admin Types =====

export interface ShopStatus {
  ecommerce?: {
    enabled?: boolean;
    connections?: { active?: number; platforms?: ShopPlatform[] };
    queue?: { ordersPending?: number; ordersError?: number; productsSynced?: number };
    sync?: { running?: boolean; lastRun?: string };
  };
  markit?: {
    enabled?: boolean;
    connections?: { active?: number; platforms?: ShopPlatform[] };
    lists?: { total?: number };
    exports?: { pending?: number };
    sync?: { running?: boolean; lastRun?: string; stats?: { contactsSynced?: number } };
  };
}

export interface ShopPlatform {
  platform?: string;
  name?: string;
  store?: string;
  status?: string;
  lastSync?: string;
}

export interface ShopConnection {
  ConnectionId: string;
  PlatformCode?: string;
  PlatformId?: string;
  StoreName?: string;
  ShopDomain?: string;
  StoreUrl?: string;
  IsActive: boolean;
  LastSyncAt?: string;
  SyncEnabled?: boolean;
  SyncOrders?: boolean;
  SyncProducts?: boolean;
  SyncCustomers?: boolean;
  SyncInventory?: boolean;
  DefaultWarehouse?: string;
  DefaultBranch?: string;
  DefaultSalesRep?: string;
  DefaultTaxCode?: string;
  stats?: {
    orders?: { total?: number };
    products?: { total?: number };
    customers?: { total?: number };
  };
}

export interface ShopConfig {
  ecommerce?: {
    syncEnabled?: boolean;
    syncIntervalMs?: number;
    batchSize?: number;
    orders?: { autoSync?: boolean; defaultWarehouse?: string; defaultBranch?: string };
    products?: { autoSync?: boolean; syncInventory?: boolean; syncPrices?: boolean };
    customers?: { autoSync?: boolean };
  };
  markit?: {
    enabled?: boolean;
    syncIntervalMs?: number;
    batchSize?: number;
    brevo?: { defaultSenderName?: string; defaultSenderEmail?: string };
    mailchimp?: { defaultFromName?: string };
  };
  webhookUrls?: Record<string, string>;
  success?: boolean;
  message?: string;
}

export interface ShopMarkitConnection {
  ConnectionId: string;
  PlatformCode: string;
  Name: string;
  ApiUrl?: string;
  IsActive: boolean;
  LastSyncAt?: string;
}

export interface ShopMarkitList {
  ListId: string;
  ConnectionId: string;
  Name: string;
  ContactCount?: number;
  SyncStatus?: string;
  LastSyncAt?: string;
}

export interface ShopMarkitExport {
  ExportId?: string;
  ListId?: string;
  ListName?: string;
  Status: string;
  ProcessedContacts?: number;
  TotalContacts?: number;
  SuccessCount?: number;
  ErrorCount?: number;
  CreatedAt: string;
}

export interface ShopMarkitCampaign {
  CampaignId?: string;
  Name: string;
  Channel: string;
  Status: string;
  SentAt?: string;
  Stats?: { opens?: number; clicks?: number };
}

// ===== Infuse (AI/MCP) Admin Types =====

export interface InfuseConfig {
  enabled: boolean;
  aiProvider: string;
  providerId?: string;
  systemPrompt?: string;
  context?: {
    includeUserProfile?: boolean;
    includeCurrentView?: boolean;
    includeSelectedEntity?: boolean;
  };
  anthropic?: InfuseProviderConfig;
  openai?: InfuseProviderConfig;
  ollama?: InfuseProviderConfig;
  vllm?: InfuseProviderConfig & { multiSession?: VllmMultiSession };
  lmstudio?: InfuseProviderConfig;
  [key: string]: unknown;
}

export interface InfuseProviderConfig {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface VllmMultiSession {
  enabled: boolean;
  maxConcurrent: number;
  rateLimitPerUser: number;
  userQueueSize: number;
  requestTimeout: number;
}

export interface InfuseTestResult {
  success: boolean;
  latency?: number;
  message?: string;
  error?: string;
}

export interface McpTestConnectionResult {
  success: boolean;
  latency?: number;
  error?: string;
  tools?: Array<{ name: string }>;
}

// ===== Work (N8N) Admin Types =====

export interface WorkWorkflow {
  WorkflowId: number;
  Name: string;
  Description?: string;
  N8NWorkflowId: string;
  TriggerType: string;
  WebhookUrl?: string;
  ProviderId?: string;
  TimeoutMs: number;
  IsActive: boolean;
  LastExecutedAt?: string;
  CreatedAt?: string;
  TemplateId?: number;
  TemplateCode?: string;
  TemplateName?: string;
  ExecutionHandler?: string;
}

export interface WorkExecution {
  ExecutionId: number;
  ExecutionGuid?: string;
  WorkflowId: number;
  WorkflowName?: string;
  EventType?: string;
  SourceApp?: string;
  Status: string;
  StartedAt?: string;
  CompletedAt?: string;
  DurationMs?: number;
  ErrorMessage?: string;
  ErrorDetails?: string;
  ErrorDetailsParsed?: PipelineResult;
  InputPayload?: string;
  OutputPayload?: string;
  OutputPayloadParsed?: PipelineResult;
}

export interface PipelineStep {
  order: number;
  label: string;
  status: string;
  data?: unknown;
  durationMs: number;
}

export interface PipelineResult {
  success: boolean;
  steps: PipelineStep[];
  durationMs: number;
}

export interface WorkExecutionStats {
  summary?: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    running: number;
  };
}

export interface WorkEventMapping {
  MappingId: number;
  EventType: string;
  WorkflowId: number;
  WorkflowName?: string;
  Priority: number;
  Conditions?: string;
  TransformTemplate?: string;
  IsActive: boolean;
  CreatedAt?: string;
}

export interface WorkApiKey {
  ApiKeyId: number;
  Name: string;
  Description?: string;
  KeyPrefix: string;
  Permissions?: string[] | string;
  RateLimitPerMinute?: number;
  AllowedIPs?: string[];
  ExpiresAt?: string;
  LastUsedAt?: string;
  IsActive: boolean;
  CreatedAt?: string;
}

export interface WorkServiceHealth {
  status?: string;
  n8n?: { status: string };
}

export interface WorkTemplateConfigField {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
  options?: string[];
}

export interface WorkTemplateStep {
  order: number;
  type: string;
  action: string;
  label: string;
  configFields: WorkTemplateConfigField[];
}

export interface WorkTemplate {
  TemplateId: number;
  Code: string;
  Name: string;
  Description: string;
  Category: string;
  Icon: string;
  Version: number;
  StepDefinitions: WorkTemplateStep[];
  DefaultConfig: Record<string, unknown>;
  RequiredProviderTypes: string[];
  IsActive: boolean;
  IsSystem: boolean;
  SortOrder: number;
  ExecutionHandler?: string;
}

export interface WorkTemplateInstance {
  InstanceId: number;
  TemplateId: number;
  TemplateCode?: string;
  TemplateName?: string;
  WorkflowId: number | null;
  Name: string;
  Configuration: Record<string, unknown>;
  ProviderId: string | null;
  Status: string;
  ErrorMessage: string | null;
  CreatedAt: string;
  CreatedBy: string;
  UpdatedAt?: string;
}

// ===== PulpIT (Documents) Admin Types =====

export interface DocumentStats {
  totalDocuments: number;
  storageMB: number;
  byType?: Array<{ DocumentType: string; Count: number }>;
  stagedQueue?: Array<{ Status: string; Count: number }>;
}

export interface StorageProvider {
  ProviderId?: string;
  ProviderName: string;
  DisplayName: string;
  IsDefault: boolean;
  IsActive: boolean;
  MaxFileSizeBytes?: number;
}

export interface StagedDocument {
  StagedDocumentId: string;
  OriginalFileName: string;
  Status: string;
  ClassifiedType?: string;
  CaptureSource: string;
  CreatedAt: string;
}

export interface RetentionPolicy {
  PolicyId: string;
  PolicyName: string;
  DocumentType?: string;
  RetentionPeriodDays: number;
  Action: string;
  NotifyRoles?: string;
  NotifyDaysBefore?: number;
  IsActive: boolean;
}

export interface ExpiringDocument {
  DocumentId: string;
  DocumentName: string;
  DocumentType: string;
  RetentionPolicy: string;
  RetentionExpiryDate: string;
}

export interface RetentionLogEntry {
  DocumentId: string;
  DocumentName?: string;
  Action: string;
  Reason?: string;
  PerformedBy: string;
  PerformedAt: string;
}

export interface ArchivedDocument {
  DocumentId: string;
  DocumentName: string;
  DocumentTitle?: string;
  DocumentType: string;
  MimeType: string;
  FileExtension?: string;
  FileSizeBytes: number;
  StorageProvider: string;
  StorageReference: string;
  RetentionPolicy?: string;
  RetentionExpiryDate?: string;
  CreatedAt: string;
  CreatedBy: string;
  UpdatedAt?: string;
  UpdatedBy?: string;
  HasArchiveFile: boolean;
}

export interface ApprovalWorkflow {
  WorkflowId: string;
  WorkflowName: string;
  DocumentType?: string;
  RequiredApprovals: number;
  ApprovalRoles: string[];
  SequentialApproval: boolean;
  AutoPublishOnApproval: boolean;
}

export interface DocumentTypeConfig {
  DocumentTypeId: number;
  TypeCode: string;
  DisplayName: string;
  Description: string | null;
  Category: string;
  IconName: string | null;
  SortOrder: number;
  IsActive: boolean;
  // Upload control
  IsUploadEnabled: boolean;
  AllowedRoles: string | null; // JSON array string
  // Classification
  ClassificationRequired: boolean;
  AutoAdvanceClassification: boolean;
  ClassificationConfidenceThreshold: number;
  // Extraction
  ExtractionRequired: boolean;
  RequiredFields: string | null; // JSON array string
  // Entity matching
  EntityMatchRequired: boolean;
  EntityMatchMinConfidence: number;
  // Review
  ReviewRequired: boolean;
  ReviewBypassConfidence: number | null;
  ReviewBypassMaxValue: number | null;
  // Posting
  PostingEnabled: boolean;
  PostingType: string;
  AutoPostEnabled: boolean;
  AutoPostMinConfidence: number;
  AutoPostMaxValue: number | null;
  AutoPostMaxLines: number | null;
  // Audit
  CreatedAt: string;
  CreatedBy: string;
  UpdatedAt: string;
  UpdatedBy: string | null;
}

// ===== EdIT (EDI Integration) Types =====

export interface EditVanProvider {
  VanId: number;
  VanCode: string;
  VanName: string;
  VanType: string;
  BaseUrl?: string;
  ApiVersion?: string;
  AuthType: string;
  AuthConfig?: string;
  PollIntervalMs: number;
  PollEnabled: boolean;
  PollLastRun?: string;
  PollLastStatus?: string;
  DocumentFormat: string;
  SandboxMode: boolean;
  SandboxConfig?: string;
  IsActive: boolean;
  Notes?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  CreatedBy?: string;
  // Computed
  partnerCount?: number;
}

export interface EditTradingPartner {
  PartnerId: number;
  PartnerCode: string;
  CompanyName: string;
  VanId?: number;
  VanPartnerId?: string;
  VanCode?: string;
  VanName?: string;
  QualifierId?: string;
  InterchangeId?: string;
  ABN?: string;
  GLN?: string;
  SysproCustomer?: string;
  SysproSupplier?: string;
  DirectCommProtocol?: string;
  DirectCommConfig?: string;
  DefaultFormat: string;
  DefaultVersion?: string;
  WorkflowProvider: string;
  IsActive: boolean;
  Notes?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface EditTransaction {
  TransactionId: number;
  TransactionGuid: string;
  PartnerId: number;
  PartnerCode?: string;
  CompanyName?: string;
  VanId?: number;
  VanCode?: string;
  TypeId: number;
  TypeCode?: string;
  TypeName?: string;
  Direction: string;
  ControlNumber?: string;
  DocumentRef?: string;
  VanDocumentId?: string;
  Status: string;
  SourceFormat?: string;
  SysproDocNumber?: string;
  ErrorMessage?: string;
  WorkflowProvider?: string;
  RetryCount: number;
  MaxRetries: number;
  ReceivedAt?: string;
  CompletedAt?: string;
  DurationMs?: number;
  CreatedAt?: string;
  // Attached on detail view
  stages?: EditDocumentStage[];
}

export interface EditDocumentStage {
  StageId: number;
  TransactionId: number;
  StageName: string;
  StageOrder: number;
  Status: string;
  StartedAt?: string;
  CompletedAt?: string;
  DurationMs?: number;
  InputData?: string;
  OutputData?: string;
  ErrorMessage?: string;
  ErrorDetails?: string;
}

export interface EditErrorLog {
  ErrorId: number;
  TransactionId?: number;
  PartnerId?: number;
  PartnerCode?: string;
  CompanyName?: string;
  VanId?: number;
  StageName?: string;
  ErrorCode?: string;
  ErrorMessage: string;
  ErrorDetails?: string;
  Severity: string;
  IsResolved: boolean;
  ResolvedAt?: string;
  ResolvedBy?: string;
  ResolutionNotes?: string;
  CreatedAt?: string;
  DocumentRef?: string;
}

export interface EditTransactionType {
  TypeId: number;
  TypeCode: string;
  EdifactCode?: string;
  RsxDocType?: string;
  Name: string;
  Direction: string;
  SysproBO?: string;
  Description?: string;
  IsActive: boolean;
}

export interface EditFormatSpec {
  SpecId: number;
  PartnerId?: number;
  PartnerCode?: string;
  TypeId?: number;
  TypeCode?: string;
  VanId?: number;
  VanCode?: string;
  SpecName: string;
  SpecVersion?: string;
  ImportedFrom?: string;
  ImportedFileName?: string;
  FieldCount: number;
  RequiredFieldCount: number;
  MappingStatus: string;
  GeneratedMapsCount: number;
  Notes?: string;
  ImportedAt?: string;
  ImportedBy?: string;
  IsActive: boolean;
}

export interface EditFormatSpecField {
  FieldId: number;
  SpecId: number;
  FieldPosition: number;
  SegmentId?: string;
  ElementId?: string;
  FieldName?: string;
  DataType?: string;
  MinLength?: number;
  MaxLength?: number;
  IsRequired: boolean;
  IsMapped: boolean;
  MappedToXPath?: string;
  SampleValue?: string;
  Notes?: string;
}

export interface EditWorkflowProviderConfig {
  ProviderId: number;
  ProviderCode: string;
  ProviderName: string;
  IsEnabled: boolean;
  Configuration?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface EditDashboardSummary {
  byStatus: Array<{ Status: string; count: number }>;
  byType: Array<{ TypeCode: string; count: number }>;
  byVan: Array<{ VanCode: string; count: number }>;
}

export interface EditDashboardStats {
  today: number;
  week: number;
  month: number;
  successRate: number;
  avgDurationMs: number;
}

export interface EditFieldMap {
  MapId: number;
  TypeId: number;
  PartnerId?: number;
  SourcePath: string;
  TargetXPath: string;
  TransformRule: string;
  TransformConfig?: string;
  IsRequired: boolean;
  DefaultValue?: string;
  Description?: string;
  SortOrder: number;
}

export interface EditPartnerTransactionConfig {
  ConfigId: number;
  PartnerId: number;
  TypeId: number;
  TypeCode?: string;
  TypeName?: string;
  IsEnabled: boolean;
  WorkflowProvider?: string;
  WorkflowId?: string;
  ValidationRules?: string;
  FieldMapOverrides?: string;
  PostingConfig?: string;
  AckRequired: boolean;
  AutoProcess: boolean;
}

// ===== ERP Config Types =====

export type ErpConfigFolder = 'query' | 'build' | 'fieldmap' | 'warmer';

export interface ErpConfigFile {
  filename: string;
  folder: ErpConfigFolder;
  size: number;
  modified: string;
}

export interface ErpConfigFileContent {
  filename: string;
  folder: ErpConfigFolder;
  content: string;
}

// ===== Endpoint Types =====

export interface ApiEndpoint {
  EndpointId: string;
  Path: string;
  Method: string;
  Entity?: string;
  Action?: string;
  Description?: string;
  GroupId?: string;
  GroupName?: string;
  IsActive: boolean;
}

export interface EndpointGroup {
  GroupId: string;
  Name: string;
  Entity?: string;
  EndpointCount?: number;
}

// ===== Provider Types =====

export interface ProviderType {
  TypeCode: string;
  DisplayName: string;
  Category: string;
  Description?: string;
  ConfigSchema?: string;
  IsActive: boolean;
  IsBuiltIn?: boolean;
}

export interface Provider {
  ProviderId: string;
  ProviderTypeCode: string;
  TypeDisplayName?: string;
  Category?: string;
  Name: string;
  Description?: string;
  Configuration?: Record<string, unknown> | null;
  Credentials?: Record<string, unknown> | null;
  IsDefault: boolean;
  IsActive: boolean;
  Scope?: 'internal' | 'external';
  LastTestStatus?: string | null;
  LastTestError?: string | null;
  LastTestedAt?: string | null;
  LastUsedAt?: string | null;
  CreatedBy?: string;
  UpdatedBy?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  Applications?: string[];
}

export interface ProviderApiDetails {
  connectionUrl?: string | null;
  healthEndpoint?: string | null;
  webhookPaths?: string[];
  oauth?: {
    enabled: boolean;
    scopes: string[];
    resourceUri: string | null;
  } | null;
  ipWhitelist: string[];
  lastTestStatus?: string | null;
  lastTestError?: string | null;
  lastTestedAt?: string | null;
  lastUsedAt?: string | null;
  linkedOAuthClients: number;
  scope: string;
  allowedCallbackUrls?: string[];
}

// ===== Internal Services Types =====

export interface SystemService {
  key: string;
  name: string;
  description: string;
  type: 'BRIDGE_MODE' | 'BRIDGE_SERVICE';
  enabled: boolean;
  connectionUrl?: string;
  healthEndpoint?: string;
  status?: string | null;
}

export interface OAuthServerInfo {
  enabled: boolean;
  issuer: string;
  allowedCallbackUrls: string[];
  mcpResourceUri: string;
  accessTokenTtl: number;
  refreshTokenTtl: number;
  authCodeTtl: number;
}

export interface InternalServicesResponse {
  providers: Provider[];
  systemServices: SystemService[];
  oauthServer: OAuthServerInfo;
}

export interface InfuseSessionInfo {
  active: number;
  persistenceEnabled: boolean;
  persistenceAvailable: boolean;
}

export interface InfuseExecutionSummary {
  total: number;
  success: number;
  failed: number;
  pending: number;
  running: number;
  timeout: number;
}

export interface InfuseWorkflowStat {
  workflowName: string;
  total: number;
  success: number;
  failed: number;
  avgDuration: number;
}

export interface InfuseChatStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  activeRequests: number;
  queueSize: number;
  circuitBreaker: {
    isOpen: boolean;
    consecutiveFailures: number;
    threshold: number;
    lastFailure: number | null;
  };
}

export interface InfuseDashboardData {
  services: Record<string, { status: string; uptime?: number; error?: string }>;
  aiProvider: {
    name: string;
    type: string;
    model: string;
    healthStatus: string | null;
  } | null;
  oauthServer: {
    enabled: boolean;
    issuer: string;
    allowedCallbackUrls: string[];
    mcpResourceUri: string;
  };
  config: {
    enabled: boolean;
    contextSettings: Record<string, boolean>;
  };
  sessions: {
    mcp: InfuseSessionInfo | null;
    app: InfuseSessionInfo | null;
  } | null;
  workload: {
    executions: InfuseExecutionSummary | null;
    workflows: InfuseWorkflowStat[] | null;
    work: { pendingExecutions: number; database: { status: string }; n8n: { status: string; connected: boolean } } | null;
    chat: InfuseChatStats | null;
  } | null;
}

// ===== EdIT (EDI) Types =====

export interface EditVanProvider {
  VanId: string;
  VanCode: string;
  VanName: string;
  VanType: string;
  ConnectionConfig: Record<string, unknown> | null;
  DocumentFormat: string;
  PollEnabled: boolean;
  PollIntervalMinutes: number;
  PollLastRun: string | null;
  PollLastStatus: string | null;
  PollLastError: string | null;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string | null;
}

export interface EditTradingPartner {
  PartnerId: string;
  PartnerCode: string;
  CompanyName: string;
  VanId: string | null;
  VanName: string | null;
  DefaultFormat: string;
  WorkflowProvider: string | null;
  ContactEmail: string | null;
  ContactPhone: string | null;
  Notes: string | null;
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string | null;
}

export interface EditTransaction {
  TransactionId: number;
  PartnerCode: string;
  CompanyName: string | null;
  TypeCode: string;
  TypeName: string | null;
  Direction: string;
  DocumentRef: string | null;
  Status: string;
  ReceivedAt: string;
  CompletedAt: string | null;
  DurationMs: number | null;
  ErrorMessage: string | null;
}

export interface EditDocumentStage {
  StageId: number;
  TransactionId: number;
  StageName: string;
  StageOrder: number;
  Status: string;
  StartedAt: string | null;
  CompletedAt: string | null;
  DurationMs: number | null;
  ErrorMessage: string | null;
  ErrorDetails: string | null;
}

export interface EditErrorLog {
  ErrorId: number;
  TransactionId: number | null;
  StageName: string | null;
  Severity: string;
  ErrorMessage: string;
  ErrorDetails: string | null;
  PartnerCode: string | null;
  IsResolved: boolean;
  ResolvedBy: string | null;
  ResolvedAt: string | null;
  CreatedAt: string;
}

export interface EditTransactionType {
  TypeCode: string;
  TypeName: string;
  Direction: string;
  Description: string | null;
  IsActive: boolean;
}

export interface EditFormatSpec {
  SpecId: string;
  SpecName: string;
  PartnerCode: string | null;
  TypeCode: string | null;
  ImportedFrom: string | null;
  FieldCount: number;
  MappingStatus: string;
  ImportedAt: string;
  UpdatedAt: string | null;
}

export interface EditFormatSpecField {
  FieldId: string;
  SpecId: string;
  FieldName: string;
  FieldPosition: number;
  DataType: string | null;
  MaxLength: number | null;
  IsRequired: boolean;
  MappedTo: string | null;
  MappingStatus: string;
}

export interface EditWorkflowProviderConfig {
  ProviderId: string;
  ProviderName: string;
  ProviderType: string;
  BaseUrl: string | null;
  IsActive: boolean;
  LastTestStatus: string | null;
  LastTestedAt: string | null;
}

export interface EditDashboardSummary {
  totalTransactionsToday: number;
  successRate: number;
  activeVans: number;
  activePartners: number;
  recentErrors: number;
}

export interface EditDashboardStats {
  byStatus: Array<{ Status: string; Count: number }>;
  byPartner: Array<{ PartnerCode: string; Count: number }>;
  byType: Array<{ TypeCode: string; Count: number }>;
}

// ===== About Types =====

export interface AboutInfo {
  version: string;
  name: string;
  description?: string;
  nodeVersion: string;
  uptime: number;
  platform: string;
  apps: Record<string, { enabled: boolean; label: string }>;
  endpoints: { total: number; groups: Array<{ Name: string; Entity: string; EndpointCount: number }> };
}
