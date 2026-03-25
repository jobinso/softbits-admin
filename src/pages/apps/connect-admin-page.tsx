import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FieldMappingEditor } from '@/components/field-mapping-editor';
import {
  RefreshCw,
  Play,
  Square,
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  Users,
  MapPin,
  GitBranch,
  CreditCard,
  Briefcase,
  Map,
  FolderTree,
  ChevronLeft,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Modal,
  StatusBadge,
  LoadingSpinner,
  Tabs,
  Card,
  PageHeader,
  TableCard,
} from '@/components/shared';
import type { ColumnDef, TabItem } from '@/components/shared';
import {
  getConnectSyncStatus,
  triggerConnectSync,
  stopConnectSync,
  getConnectConfig,
  updateConnectConfig,
  getConnectSyncHistory,
  clearConnectSyncHistory,
  getTerritories,
  createTerritory,
  updateTerritory,
  deleteTerritory as deleteTerritoryApi,
  getSalesReps,
  createSalesRep,
  updateSalesRep,
  deleteSalesRep as deleteSalesRepApi,
  getPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline as deletePipelineApi,
  getStages,
  createStage,
  updateStage,
  deleteStage as deleteStageApi,
  getRateCards,
  getRateCard,
  createRateCard,
  updateRateCard,
  deleteRateCard as deleteRateCardApi,
  createRateCardVersion,
  getRateCardVersion,
  activateRateCardVersion,
  addRateCardLineItem,
  updateRateCardLineItem,
  deleteRateCardLineItem,
  getBillingRoles,
  createBillingRole,
  updateBillingRole,
  deleteBillingRole as deleteBillingRoleApi,
  getCurrencies,
  getConnectMappings,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import { ProjectTypesPage } from '@/pages/config';
import type {
  ConnectSyncStatus,
  ConnectSyncHistoryEntry,
  Territory,
  SalesRep,
  Pipeline,
  Stage,
  RateCard,
  RateCardVersion,
  RateCardLineItem,
  BillingRole,
  Currency,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONNECT_TABS: TabItem[] = [
  { id: 'status', label: 'Dashboard', icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'sync', label: 'Sync', icon: <Play className="w-4 h-4" /> },
  { id: 'teams', label: 'Teams', icon: <Users className="w-4 h-4" /> },
  { id: 'salescycles', label: 'Sales Cycles', icon: <GitBranch className="w-4 h-4" /> },
  { id: 'rates', label: 'Rate Cards', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'roles', label: 'Billing Roles', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'mappings', label: 'Mappings', icon: <Map className="w-4 h-4" /> },
  { id: 'project-types', label: 'Project Types', icon: <FolderTree className="w-4 h-4" /> },
];

const SYNC_ENTITIES = [
  { key: 'salesreps', label: 'Sales Reps' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'customers', label: 'Customers' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'addresses', label: 'Addresses' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'activities', label: 'Activities' },
];

const SYNC_DIRECTIONS = [
  { value: 'from_syspro', label: 'ERP to CRM' },
  { value: 'to_syspro', label: 'CRM to ERP' },
  { value: 'bidirectional', label: 'Bidirectional' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeAgo(dateInput?: string | null): string {
  if (!dateInput) return 'Never';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'Never';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

interface TerritoryForm {
  name: string;
  code: string;
  sysproBranch: string;
  description: string;
  isActive: boolean;
}

interface SalesRepForm {
  name: string;
  email: string;
  phone: string;
  sysproSalesperson: string;
  salesTarget: number;
  defaultPipelineId: string;
  isActive: boolean;
}

interface PipelineForm {
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
}

interface StageForm {
  pipelineId: string;
  name: string;
  displayOrder: number;
  probability: number;
  colour: string;
  isClosed: boolean;
  isWon: boolean;
  isActive: boolean;
}

interface RateCardForm {
  name: string;
  description: string;
  status: string;
  notes: string;
}

interface BillingRoleForm {
  code: string;
  name: string;
  description: string;
  status: string;
}

interface LineItemForm {
  roleId: string;
  currencyId: string;
  rate: number;
  unit: string;
  notes: string;
}

const INITIAL_TERRITORY: TerritoryForm = { name: '', code: '', sysproBranch: '', description: '', isActive: true };
const INITIAL_SALESREP: SalesRepForm = { name: '', email: '', phone: '', sysproSalesperson: '', salesTarget: 0, defaultPipelineId: '', isActive: true };
const INITIAL_PIPELINE: PipelineForm = { name: '', description: '', isDefault: false, isActive: true };
const INITIAL_STAGE: StageForm = { pipelineId: '', name: '', displayOrder: 0, probability: 0, colour: '#3B82F6', isClosed: false, isWon: false, isActive: true };
const INITIAL_RATECARD: RateCardForm = { name: '', description: '', status: 'Draft', notes: '' };
const INITIAL_BILLINGROLE: BillingRoleForm = { code: '', name: '', description: '', status: 'Active' };
const INITIAL_LINEITEM: LineItemForm = { roleId: '', currencyId: '', rate: 0, unit: 'Hour', notes: '' };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConnectAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('status');

  // ---- State for modals ----
  const territoryModal = useModal<Territory>();
  const deleteTerritoryModal = useModal<Territory>();
  const salesRepModal = useModal<SalesRep>();
  const deleteSalesRepModal = useModal<SalesRep>();
  const pipelineModal = useModal<Pipeline>();
  const deletePipelineModal = useModal<Pipeline>();
  const stageModal = useModal<Stage>();
  const deleteStageModal = useModal<Stage>();
  const rateCardModal = useModal<RateCard>();
  const deleteRateCardModal = useModal<RateCard>();
  const billingRoleModal = useModal<BillingRole>();
  const deleteBillingRoleModal = useModal<BillingRole>();
  const lineItemModal = useModal<RateCardLineItem>();
  const syncDetailModal = useModal<ConnectSyncHistoryEntry>();

  // ---- Form state ----
  const [territoryForm, setTerritoryForm] = useState<TerritoryForm>(INITIAL_TERRITORY);
  const [isEditTerritory, setIsEditTerritory] = useState(false);
  const [salesRepForm, setSalesRepForm] = useState<SalesRepForm>(INITIAL_SALESREP);
  const [isEditSalesRep, setIsEditSalesRep] = useState(false);
  const [pipelineForm, setPipelineForm] = useState<PipelineForm>(INITIAL_PIPELINE);
  const [isEditPipeline, setIsEditPipeline] = useState(false);
  const [stageForm, setStageForm] = useState<StageForm>(INITIAL_STAGE);
  const [isEditStage, setIsEditStage] = useState(false);
  const [rateCardForm, setRateCardForm] = useState<RateCardForm>(INITIAL_RATECARD);
  const [isEditRateCard, setIsEditRateCard] = useState(false);
  const [billingRoleForm, setBillingRoleForm] = useState<BillingRoleForm>(INITIAL_BILLINGROLE);
  const [isEditBillingRole, setIsEditBillingRole] = useState(false);
  const [lineItemForm, setLineItemForm] = useState<LineItemForm>(INITIAL_LINEITEM);
  const [isEditLineItem, setIsEditLineItem] = useState(false);

  // ---- Selection state ----
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [selectedRateCard, setSelectedRateCard] = useState<RateCard | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<RateCardVersion | null>(null);
  const [selectedMappingType, setSelectedMappingType] = useState<string | null>(null);

  // ==== Queries ====

  const { data: syncStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['connect', 'sync-status'],
    queryFn: getConnectSyncStatus,
    refetchInterval: 10000,
    enabled: activeTab === 'status' || activeTab === 'sync',
  });

  const { data: syncHistory } = useQuery({
    queryKey: ['connect', 'sync-history'],
    queryFn: () => getConnectSyncHistory({ limit: 200 }),
    enabled: activeTab === 'status',
  });

  const { data: syncConfig } = useQuery({
    queryKey: ['connect', 'config'],
    queryFn: getConnectConfig,
    enabled: activeTab === 'sync',
  });

  const { data: territoriesRes } = useQuery({
    queryKey: ['connect', 'territories'],
    queryFn: () => getTerritories({ withCounts: true }),
    enabled: activeTab === 'teams',
  });

  const { data: salesRepsRes } = useQuery({
    queryKey: ['connect', 'sales-reps'],
    queryFn: () => getSalesReps({ withCounts: true, withTerritories: true }),
    enabled: activeTab === 'teams',
  });

  const { data: pipelinesRes } = useQuery({
    queryKey: ['connect', 'pipelines'],
    queryFn: () => getPipelines({ includeStages: true }),
    enabled: activeTab === 'salescycles',
  });

  const { data: stagesRes } = useQuery({
    queryKey: ['connect', 'stages', selectedPipeline?.Id],
    queryFn: () => getStages({ pipelineId: selectedPipeline?.Id }),
    enabled: activeTab === 'salescycles',
  });

  const { data: rateCardsRes } = useQuery({
    queryKey: ['connect', 'rate-cards'],
    queryFn: getRateCards,
    enabled: activeTab === 'rates',
  });

  const { data: rateCardDetail } = useQuery({
    queryKey: ['connect', 'rate-card', selectedRateCard?.Id],
    queryFn: () => getRateCard(selectedRateCard!.Id),
    enabled: !!selectedRateCard,
  });

  const { data: versionDetail } = useQuery({
    queryKey: ['connect', 'rate-card-version', selectedRateCard?.Id, selectedVersion?.Id],
    queryFn: () => getRateCardVersion(selectedRateCard!.Id, selectedVersion!.Id),
    enabled: !!selectedRateCard && !!selectedVersion,
  });

  const { data: billingRolesRes } = useQuery({
    queryKey: ['connect', 'billing-roles'],
    queryFn: getBillingRoles,
    enabled: activeTab === 'roles' || lineItemModal.isOpen,
  });

  const { data: currenciesRes } = useQuery({
    queryKey: ['admin', 'currencies'],
    queryFn: getCurrencies,
    enabled: lineItemModal.isOpen,
  });

  const { data: mappingsListRes, isLoading: mappingsLoading } = useQuery({
    queryKey: ['connect', 'mappings'],
    queryFn: () => getConnectMappings(),
    enabled: activeTab === 'mappings',
  });

  const { data: mappingDetailRes, isLoading: mappingDetailLoading } = useQuery({
    queryKey: ['connect', 'mapping-detail', selectedMappingType],
    queryFn: () => getConnectMappings(selectedMappingType!),
    enabled: activeTab === 'mappings' && !!selectedMappingType,
  });

  // Derived data
  const territories: Territory[] = territoriesRes?.data ?? [];
  const salesReps: SalesRep[] = salesRepsRes?.data ?? [];
  const pipelines: Pipeline[] = pipelinesRes?.data ?? [];
  const stages: Stage[] = stagesRes?.data ?? [];
  const rateCards: RateCard[] = rateCardsRes?.data ?? [];
  const billingRoles: BillingRole[] = billingRolesRes?.data ?? [];
  const currencies: Currency[] = currenciesRes?.data ?? [];
  const history: ConnectSyncHistoryEntry[] = syncHistory?.data ?? syncHistory?.history ?? [];
  const currentRateCard: RateCard | null = rateCardDetail?.data ?? selectedRateCard;
  const currentVersionRoles: RateCardLineItem[] = versionDetail?.data?.Roles ?? [];
  const currentVersionStatus: string = versionDetail?.data?.Status ?? selectedVersion?.Status ?? '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappingTypes: any[] = mappingsListRes?.data?.mappings ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappingDetail: any = mappingDetailRes?.data ?? null;

  // ==== Mutations ====

  const triggerSyncMut = useMutation({
    mutationFn: triggerConnectSync,
    onSuccess: (data) => {
      toast.success(data.message || 'Sync triggered');
      queryClient.invalidateQueries({ queryKey: ['connect', 'sync-status'] });
    },
    onError: () => toast.error('Failed to trigger sync'),
  });

  const stopSyncMut = useMutation({
    mutationFn: stopConnectSync,
    onSuccess: (data) => {
      toast.success(data.message || 'Sync stop requested');
      queryClient.invalidateQueries({ queryKey: ['connect', 'sync-status'] });
    },
    onError: () => toast.error('Failed to stop sync'),
  });

  const clearHistoryMut = useMutation({
    mutationFn: clearConnectSyncHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'sync-history'] });
      toast.success('Sync history cleared');
    },
    onError: () => toast.error('Failed to clear history'),
  });

  const saveConfigMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateConnectConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'config'] });
      toast.success('Config saved');
    },
    onError: () => toast.error('Failed to save config'),
  });

  // Territory mutations
  const saveTerritoryMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<Territory> }) =>
      args.id ? updateTerritory(args.id, args.data) : createTerritory(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'territories'] });
      territoryModal.close();
      toast.success(isEditTerritory ? 'Territory updated' : 'Territory created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save territory'),
  });

  const removeTerritoryMut = useMutation({
    mutationFn: (id: string) => deleteTerritoryApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'territories'] });
      deleteTerritoryModal.close();
      toast.success('Territory deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete territory'),
  });

  // SalesRep mutations
  const saveSalesRepMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<SalesRep> }) =>
      args.id ? updateSalesRep(args.id, args.data) : createSalesRep(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'sales-reps'] });
      salesRepModal.close();
      toast.success(isEditSalesRep ? 'Sales rep updated' : 'Sales rep created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save sales rep'),
  });

  const removeSalesRepMut = useMutation({
    mutationFn: (id: string) => deleteSalesRepApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'sales-reps'] });
      deleteSalesRepModal.close();
      toast.success('Sales rep deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete sales rep'),
  });

  // Pipeline mutations
  const savePipelineMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<Pipeline> }) =>
      args.id ? updatePipeline(args.id, args.data) : createPipeline(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'pipelines'] });
      pipelineModal.close();
      toast.success(isEditPipeline ? 'Pipeline updated' : 'Pipeline created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save pipeline'),
  });

  const removePipelineMut = useMutation({
    mutationFn: (id: string) => deletePipelineApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'pipelines'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'stages'] });
      deletePipelineModal.close();
      setSelectedPipeline(null);
      toast.success('Pipeline deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete pipeline'),
  });

  // Stage mutations
  const saveStageMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<Stage> }) =>
      args.id ? updateStage(args.id, args.data) : createStage(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'stages'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'pipelines'] });
      stageModal.close();
      toast.success(isEditStage ? 'Stage updated' : 'Stage created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save stage'),
  });

  const removeStageMut = useMutation({
    mutationFn: (id: string) => deleteStageApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'stages'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'pipelines'] });
      deleteStageModal.close();
      toast.success('Stage deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete stage'),
  });

  // Rate Card mutations
  const saveRateCardMut = useMutation({
    mutationFn: (args: { id?: string; data: { name: string; description?: string; status?: string; notes?: string } }) =>
      args.id ? updateRateCard(args.id, args.data as Partial<RateCard>) : createRateCard(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-cards'] });
      rateCardModal.close();
      toast.success(isEditRateCard ? 'Rate card updated' : 'Rate card created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save rate card'),
  });

  const removeRateCardMut = useMutation({
    mutationFn: (id: string) => deleteRateCardApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-cards'] });
      deleteRateCardModal.close();
      if (selectedRateCard && selectedRateCard.Id === deleteRateCardModal.data?.Id) {
        setSelectedRateCard(null);
        setSelectedVersion(null);
      }
      toast.success('Rate card deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete rate card'),
  });

  const createVersionMut = useMutation({
    mutationFn: (cardId: string) => createRateCardVersion(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card'] });
      toast.success('New version created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create version'),
  });

  const activateVersionMut = useMutation({
    mutationFn: ({ cardId, versionId }: { cardId: string; versionId: string }) => activateRateCardVersion(cardId, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card-version'] });
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-cards'] });
      toast.success('Version activated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to activate version'),
  });

  const saveLineItemMut = useMutation({
    mutationFn: (args: { cardId: string; versionId: string; lineId?: string; data: LineItemForm }) => {
      const { cardId, versionId, lineId, data } = args;
      return lineId
        ? updateRateCardLineItem(cardId, versionId, lineId, data)
        : addRateCardLineItem(cardId, versionId, { roleId: data.roleId, currencyId: data.currencyId, rate: data.rate, unit: data.unit, notes: data.notes || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card-version'] });
      lineItemModal.close();
      toast.success(isEditLineItem ? 'Line item updated' : 'Line item added');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save line item'),
  });

  const removeLineItemMut = useMutation({
    mutationFn: ({ cardId, versionId, lineId }: { cardId: string; versionId: string; lineId: string }) =>
      deleteRateCardLineItem(cardId, versionId, lineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'rate-card-version'] });
      toast.success('Line item removed');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to remove line item'),
  });

  // Billing Role mutations
  const saveBillingRoleMut = useMutation({
    mutationFn: (args: { id?: string; data: Partial<BillingRole> }) =>
      args.id ? updateBillingRole(args.id, args.data) : createBillingRole(args.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'billing-roles'] });
      billingRoleModal.close();
      toast.success(isEditBillingRole ? 'Billing role updated' : 'Billing role created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save billing role'),
  });

  const removeBillingRoleMut = useMutation({
    mutationFn: (id: string) => deleteBillingRoleApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connect', 'billing-roles'] });
      deleteBillingRoleModal.close();
      toast.success('Billing role deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete billing role'),
  });

  // ==== Handlers ====

  function openCreateTerritory() {
    setTerritoryForm(INITIAL_TERRITORY);
    setIsEditTerritory(false);
    territoryModal.open();
  }
  function openEditTerritory(t: Territory) {
    setTerritoryForm({ name: t.Name, code: t.Code || '', sysproBranch: t.SysproBranch || '', description: t.Description || '', isActive: t.IsActive });
    setIsEditTerritory(true);
    territoryModal.open(t);
  }
  function handleSaveTerritory() {
    if (!territoryForm.name.trim()) { toast.error('Name is required'); return; }
    saveTerritoryMut.mutate({
      id: isEditTerritory ? territoryModal.data?.Id : undefined,
      data: territoryForm,
    });
  }

  function openCreateSalesRep() {
    setSalesRepForm(INITIAL_SALESREP);
    setIsEditSalesRep(false);
    salesRepModal.open();
  }
  function openEditSalesRep(r: SalesRep) {
    setSalesRepForm({
      name: r.Name, email: r.Email || '', phone: r.Phone || '',
      sysproSalesperson: r.SysproSalesperson || '', salesTarget: r.SalesTarget || 0,
      defaultPipelineId: r.DefaultPipelineId || '', isActive: r.IsActive,
    });
    setIsEditSalesRep(true);
    salesRepModal.open(r);
  }
  function handleSaveSalesRep() {
    if (!salesRepForm.name.trim()) { toast.error('Name is required'); return; }
    saveSalesRepMut.mutate({
      id: isEditSalesRep ? salesRepModal.data?.Id : undefined,
      data: salesRepForm,
    });
  }

  function openCreatePipeline() {
    setPipelineForm(INITIAL_PIPELINE);
    setIsEditPipeline(false);
    pipelineModal.open();
  }
  function openEditPipeline(p: Pipeline) {
    setPipelineForm({ name: p.Name, description: p.Description || '', isDefault: p.IsDefault, isActive: p.IsActive });
    setIsEditPipeline(true);
    pipelineModal.open(p);
  }
  function handleSavePipeline() {
    if (!pipelineForm.name.trim()) { toast.error('Name is required'); return; }
    savePipelineMut.mutate({
      id: isEditPipeline ? pipelineModal.data?.Id : undefined,
      data: pipelineForm,
    });
  }

  function openCreateStage() {
    setStageForm({ ...INITIAL_STAGE, pipelineId: selectedPipeline?.Id || '' });
    setIsEditStage(false);
    stageModal.open();
  }
  function openEditStage(s: Stage) {
    setStageForm({
      pipelineId: s.PipelineId, name: s.Name, displayOrder: s.DisplayOrder || 0,
      probability: s.Probability || 0, colour: s.Colour || '#3B82F6',
      isClosed: s.IsClosed, isWon: s.IsWon, isActive: s.IsActive,
    });
    setIsEditStage(true);
    stageModal.open(s);
  }
  function handleSaveStage() {
    if (!stageForm.pipelineId) { toast.error('Pipeline is required'); return; }
    if (!stageForm.name.trim()) { toast.error('Name is required'); return; }
    saveStageMut.mutate({
      id: isEditStage ? stageModal.data?.Id : undefined,
      data: stageForm,
    });
  }

  function openCreateRateCard() {
    setRateCardForm(INITIAL_RATECARD);
    setIsEditRateCard(false);
    rateCardModal.open();
  }
  function openEditRateCard(rc: RateCard) {
    setRateCardForm({ name: rc.Name, description: rc.Description || '', status: rc.Status, notes: rc.Notes || '' });
    setIsEditRateCard(true);
    rateCardModal.open(rc);
  }
  function handleSaveRateCard() {
    if (!rateCardForm.name.trim()) { toast.error('Name is required'); return; }
    saveRateCardMut.mutate({
      id: isEditRateCard ? rateCardModal.data?.Id : undefined,
      data: rateCardForm,
    });
  }

  function openCreateBillingRole() {
    setBillingRoleForm(INITIAL_BILLINGROLE);
    setIsEditBillingRole(false);
    billingRoleModal.open();
  }
  function openEditBillingRole(r: BillingRole) {
    setBillingRoleForm({ code: r.Code, name: r.Name, description: r.Description || '', status: r.Status });
    setIsEditBillingRole(true);
    billingRoleModal.open(r);
  }
  function handleSaveBillingRole() {
    if (!billingRoleForm.name.trim()) { toast.error('Name is required'); return; }
    if (!billingRoleForm.code.trim()) { toast.error('Code is required'); return; }
    saveBillingRoleMut.mutate({
      id: isEditBillingRole ? billingRoleModal.data?.Id : undefined,
      data: billingRoleForm,
    });
  }

  function openCreateLineItem() {
    setLineItemForm(INITIAL_LINEITEM);
    setIsEditLineItem(false);
    lineItemModal.open();
  }
  function openEditLineItem(item: RateCardLineItem) {
    setLineItemForm({
      roleId: item.RoleId || '', currencyId: item.CurrencyId || '',
      rate: item.Rate, unit: item.Unit, notes: item.Notes || '',
    });
    setIsEditLineItem(true);
    lineItemModal.open(item);
  }
  function handleSaveLineItem() {
    if (!selectedRateCard || !selectedVersion) return;
    if (!lineItemForm.roleId) { toast.error('Role is required'); return; }
    saveLineItemMut.mutate({
      cardId: selectedRateCard.Id,
      versionId: selectedVersion.Id,
      lineId: isEditLineItem ? lineItemModal.data?.Id : undefined,
      data: lineItemForm,
    });
  }

  function handleSelectRateCard(rc: RateCard) {
    setSelectedRateCard(rc);
    const versions = rc.Versions || [];
    const active = versions.find(v => v.Status === 'Active') || versions[0] || null;
    setSelectedVersion(active);
  }

  // ==== Column Definitions ====

  const territoryColumns: ColumnDef<Territory>[] = [
    { key: 'Name', label: 'Name', sortable: true, render: (v) => <span className="font-medium text-semantic-text-default">{v}</span> },
    { key: 'Code', label: 'Code', width: 100, sortable: true, render: (v) => <code className="text-xs bg-surface-overlay px-1.5 py-0.5 rounded">{v || '-'}</code> },
    { key: 'SysproBranch', label: 'ERP Branch', width: 120, sortable: true, render: (v) => v || '-' },
    { key: 'AccountCount', label: 'Accounts', width: 90, sortable: true, render: (v) => v ?? 0 },
    { key: 'IsActive', label: 'Status', width: 90, sortable: true, render: (v) => <StatusBadge status={v ? 'success' : 'neutral'} label={v ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'Id', label: 'Actions', width: 100, sortable: false, noTruncate: true,
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={(e) => { e.stopPropagation(); openEditTerritory(row); }} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); deleteTerritoryModal.open(row); }} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const salesRepColumns: ColumnDef<SalesRep>[] = [
    { key: 'Name', label: 'Name', sortable: true, render: (v) => <span className="font-medium text-semantic-text-default">{v}</span> },
    { key: 'Email', label: 'Email', sortable: true, render: (v) => v || '-' },
    { key: 'SysproSalesperson', label: 'ERP Code', width: 100, sortable: true, render: (v) => v ? <code className="text-xs bg-surface-overlay px-1.5 py-0.5 rounded">{v}</code> : '-' },
    { key: 'AccountCount', label: 'Accounts', width: 90, sortable: true, render: (v) => v ?? 0 },
    { key: 'IsActive', label: 'Status', width: 90, sortable: true, render: (v) => <StatusBadge status={v ? 'success' : 'neutral'} label={v ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'Id', label: 'Actions', width: 100, sortable: false, noTruncate: true,
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={(e) => { e.stopPropagation(); openEditSalesRep(row); }} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); deleteSalesRepModal.open(row); }} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const stageColumns: ColumnDef<Stage>[] = [
    { key: 'DisplayOrder', label: '#', width: 50, sortable: true },
    { key: 'Name', label: 'Name', sortable: true, render: (v) => <span className="font-medium text-semantic-text-default">{v}</span> },
    { key: 'PipelineName', label: 'Pipeline', sortable: true, render: (v) => v || '-' },
    { key: 'Probability', label: 'Probability', width: 100, sortable: true, render: (v) => v != null ? `${v}%` : '-' },
    {
      key: 'Colour', label: 'Color', width: 70, sortable: false,
      render: (v) => <span className="inline-block w-4 h-4 rounded-full border border-border" style={{ backgroundColor: v || '#3B82F6' }} />,
    },
    {
      key: 'IsWon', label: 'Type', width: 80, sortable: true,
      render: (v, row) => v ? <StatusBadge status="success" label="Won" size="sm" /> : row.IsClosed ? <StatusBadge status="neutral" label="Closed" size="sm" /> : <span className="text-semantic-text-faint">-</span>,
    },
    {
      key: 'Id', label: 'Actions', width: 100, sortable: false, noTruncate: true,
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={(e) => { e.stopPropagation(); openEditStage(row); }} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); deleteStageModal.open(row); }} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const billingRoleColumns: ColumnDef<BillingRole>[] = [
    { key: 'Code', label: 'Code', width: 120, sortable: true, render: (v) => <code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{v}</code> },
    { key: 'Name', label: 'Name', sortable: true, render: (v) => <span className="font-medium text-semantic-text-default">{v}</span> },
    { key: 'Description', label: 'Description', sortable: false, render: (v) => v || '-' },
    { key: 'Status', label: 'Status', width: 90, sortable: true, render: (v) => <StatusBadge status={v === 'Active' ? 'success' : 'neutral'} label={v || 'Active'} size="sm" /> },
    {
      key: 'Id', label: 'Actions', width: 100, sortable: false, noTruncate: true,
      render: (_v, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={(e) => { e.stopPropagation(); openEditBillingRole(row); }} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); deleteBillingRoleModal.open(row); }} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const historyColumns: ColumnDef<ConnectSyncHistoryEntry>[] = [
    { key: 'SyncedAt', label: 'Time', width: 160, sortable: true, render: (v) => new Date(v).toLocaleString() },
    {
      key: 'EntityType', label: 'Entity', width: 110, sortable: true,
      filterable: true, filterType: 'select',
      filterOptions: SYNC_ENTITIES.map(e => ({ value: e.key, label: e.label })),
    },
    { key: 'ErpId', label: 'ERP ID', width: 120, sortable: true, filterable: true },
    { key: 'EntityId', label: 'Entity ID', width: 120, sortable: true, hidden: true },
    {
      key: 'Operation', label: 'Operation', width: 90, sortable: true,
      filterable: true, filterType: 'select',
      filterOptions: [
        { value: 'create', label: 'Create' },
        { value: 'update', label: 'Update' },
        { value: 'delete', label: 'Delete' },
        { value: 'skip', label: 'Skip' },
      ],
    },
    { key: 'Direction', label: 'Direction', width: 100, sortable: true },
    {
      key: 'Status', label: 'Status', width: 90, sortable: true,
      filterable: true, filterType: 'select',
      filterOptions: [
        { value: 'success', label: 'Success' },
        { value: 'failed', label: 'Failed' },
        { value: 'skipped', label: 'Skipped' },
      ],
      render: (v) => <StatusBadge status={v === 'success' ? 'success' : v === 'failed' ? 'danger' : 'warning'} label={v} size="sm" />,
    },
    { key: 'RecordsAffected', label: 'Records', width: 80, sortable: true },
    {
      key: 'DurationMs', label: 'Duration', width: 90, sortable: true, hidden: true,
      render: (v) => v != null ? `${(v / 1000).toFixed(2)}s` : '-',
    },
    {
      key: 'ErrorMessage', label: 'Message', sortable: false,
      render: (v, row) => <span className="text-xs truncate max-w-[300px] block" title={v || row.Message || ''}>{v || row.Message || '-'}</span>,
    },
    { key: 'SyncRunId', label: 'Run ID', width: 100, sortable: true, hidden: true },
    { key: 'SyncedBy', label: 'Synced By', width: 100, sortable: true, hidden: true },
    { key: 'ApiEndpoint', label: 'API Endpoint', width: 150, hidden: true },
    { key: 'ApiResponseStatus', label: 'API Status', width: 80, hidden: true },
  ];

  // ==== Render ====

  if (statusLoading && activeTab === 'status') {
    return <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ConnectIT"
        description="CRM application settings and data management"
      />

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-6 p-4 bg-surface-raised border border-border rounded-xl text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-semantic-text-faint">Service:</span>
          <StatusBadge status={syncStatus ? 'success' : 'danger'} label={syncStatus ? 'Connected' : 'Offline'} size="sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-semantic-text-faint">Sync:</span>
          <StatusBadge status={syncStatus?.isRunning ? 'warning' : 'success'} label={syncStatus?.isRunning ? 'Syncing...' : 'Ready'} size="sm" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-semantic-text-faint">Last Sync:</span>
          <span className="text-semantic-text-secondary font-medium">{formatTimeAgo(syncStatus?.lastSync)}</span>
        </div>
        {(syncStatus?.queuePending ?? 0) > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-semantic-text-faint">Pending:</span>
            <span className="text-warning font-medium">{syncStatus?.queuePending}</span>
          </div>
        )}
      </div>

      <Tabs tabs={CONNECT_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* ===== Status Tab ===== */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          <TableCard
            title="Sync History"
            icon={<RefreshCw className="w-4 h-4" />}
            count={history.length}
            headerActions={
              <Button variant="ghost" size="sm" onClick={() => { if (window.confirm('Clear all sync history?')) clearHistoryMut.mutate(); }} disabled={history.length === 0}>
                Clear
              </Button>
            }
          >
            <DataTable<ConnectSyncHistoryEntry>
              id="connect-sync-history"
              columns={historyColumns}
              data={history}
              rowKey={(row) => row.Id || row.SyncedAt}
              emptyMessage="No sync history"
              embedded
              showColumnPicker
              showFilters
              pageSize={25}
              pageSizeOptions={[25, 50, 100]}
              onRowClick={(row) => syncDetailModal.open(row)}
            />
          </TableCard>
        </div>
      )}

      {/* ===== Sync Tab ===== */}
      {activeTab === 'sync' && (
        <div className="space-y-4">
          <Card title="Sync Controls">
            <div className="flex items-center gap-3">
              <Button
                icon={<Play className="w-4 h-4" />}
                onClick={() => triggerSyncMut.mutate()}
                loading={triggerSyncMut.isPending}
                disabled={syncStatus?.isRunning}
              >
                {syncStatus?.isRunning ? 'Syncing...' : 'Sync Now'}
              </Button>
              {syncStatus?.isRunning && (
                <Button
                  variant="danger"
                  icon={<Square className="w-4 h-4" />}
                  onClick={() => stopSyncMut.mutate()}
                  loading={stopSyncMut.isPending}
                >
                  Stop
                </Button>
              )}
            </div>
          </Card>

          <TableCard
            title="Entity Sync Configuration"
            icon={<Settings className="w-4 h-4" />}
            count={SYNC_ENTITIES.length}
            headerActions={
              <Button
                size="sm"
                onClick={() => {
                  const config: Record<string, unknown> = {};
                  for (const entity of SYNC_ENTITIES) {
                    const enabled = (document.getElementById(`sync-${entity.key}`) as HTMLInputElement)?.checked ?? true;
                    const direction = (document.getElementById(`dir-${entity.key}`) as HTMLSelectElement)?.value || 'from_syspro';
                    config[entity.key] = { enabled, direction };
                  }
                  saveConfigMut.mutate(config);
                }}
                loading={saveConfigMut.isPending}
              >
                Save Configuration
              </Button>
            }
          >
            <div className="divide-y divide-border">
              {SYNC_ENTITIES.map((entity) => {
                const configs = syncConfig?.data?.configs ?? [];
                const cfg = configs.find((c: { EntityType: string }) => c.EntityType?.toLowerCase() === entity.key);
                return (
                  <div key={entity.key} className="flex items-center justify-between px-5 py-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" defaultChecked={cfg?.SyncEnabled ?? true} className="w-4 h-4 rounded border-border text-primary" id={`sync-${entity.key}`} />
                      <span className="text-sm text-semantic-text-default font-medium">{entity.label}</span>
                    </label>
                    <select
                      defaultValue={cfg?.SyncDirection || 'from_syspro'}
                      className="form-input text-sm w-40"
                      id={`dir-${entity.key}`}
                    >
                      {SYNC_DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </TableCard>
        </div>
      )}

      {/* ===== Teams Tab ===== */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          {/* Territories */}
          <TableCard
            title="Territories"
            icon={<MapPin className="w-4 h-4" />}
            count={territories.length}
            headerActions={
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateTerritory}>Add Territory</Button>
            }
          >
            <DataTable<Territory>
              id="connect-territories"
              columns={territoryColumns}
              data={territories}
              rowKey={(row) => row.Id}
              onRowClick={openEditTerritory}
              emptyMessage="No territories. Click Add Territory to create one."
              embedded
              showColumnPicker={false}
            />
          </TableCard>

          {/* Sales Reps */}
          <TableCard
            title="Sales Reps"
            icon={<Users className="w-4 h-4" />}
            count={salesReps.length}
            headerActions={
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateSalesRep}>Add Sales Rep</Button>
            }
          >
            <DataTable<SalesRep>
              id="connect-sales-reps"
              columns={salesRepColumns}
              data={salesReps}
              rowKey={(row) => row.Id}
              onRowClick={openEditSalesRep}
              emptyMessage="No sales reps. Click Add Sales Rep to create one."
              embedded
              showColumnPicker={false}
            />
          </TableCard>
        </div>
      )}

      {/* ===== Sales Cycles Tab ===== */}
      {activeTab === 'salescycles' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Pipelines List */}
            <div className="lg:col-span-1">
              <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-medium text-semantic-text-secondary">Pipelines ({pipelines.length})</h2>
                  <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreatePipeline}>Add</Button>
                </div>
                <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                  {pipelines.length === 0 ? (
                    <div className="p-6 text-center text-semantic-text-faint text-sm">No pipelines</div>
                  ) : pipelines.map((p) => (
                    <div
                      key={p.Id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPipeline(p)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPipeline(p); } }}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors cursor-pointer ${
                        selectedPipeline?.Id === p.Id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-interactive-hover'
                      }`}
                    >
                      <div>
                        <div className={`text-sm font-medium ${selectedPipeline?.Id === p.Id ? 'text-primary' : 'text-semantic-text-secondary'}`}>
                          {p.Name}
                        </div>
                        <div className="text-xs text-semantic-text-faint">{p.stages?.length ?? 0} stages {p.IsDefault && '(Default)'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); openEditPipeline(p); }} className="p-1 text-semantic-text-faint hover:text-primary"><Edit className="w-3.5 h-3.5" /></button>
                        {!p.IsDefault && <button type="button" onClick={(e) => { e.stopPropagation(); deletePipelineModal.open(p); }} className="p-1 text-semantic-text-faint hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>}
                        <ChevronRight className="w-4 h-4 text-semantic-text-faint" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stages */}
            <div className="lg:col-span-2">
              {!selectedPipeline ? (
                <div className="rounded-lg border border-border bg-surface-raised p-12 text-center">
                  <GitBranch className="w-12 h-12 text-semantic-text-disabled mx-auto mb-3" />
                  <p className="text-semantic-text-faint">Select a pipeline to view its stages.</p>
                </div>
              ) : (
                <TableCard
                  title={`Stages in "${selectedPipeline.Name}"`}
                  icon={<GitBranch className="w-4 h-4" />}
                  count={stages.length}
                  headerActions={<Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateStage}>Add Stage</Button>}
                >
                  <DataTable<Stage>
                    id="connect-stages"
                    columns={stageColumns}
                    data={stages}
                    rowKey={(row) => row.Id}
                    onRowClick={openEditStage}
                    emptyMessage="No stages. Click Add Stage to create one."
                    embedded
                    showColumnPicker={false}
                  />
                </TableCard>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Rate Cards Tab ===== */}
      {activeTab === 'rates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Rate Cards List */}
            <div className="lg:col-span-1">
              <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-medium text-semantic-text-secondary">Rate Cards ({rateCards.length})</h2>
                  <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateRateCard}>Add</Button>
                </div>
                <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                  {rateCards.length === 0 ? (
                    <div className="p-6 text-center text-semantic-text-faint text-sm">No rate cards</div>
                  ) : rateCards.map((rc) => (
                    <div
                      key={rc.Id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectRateCard(rc)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectRateCard(rc); } }}
                      className={`w-full px-4 py-3 text-left flex items-center justify-between transition-colors cursor-pointer ${
                        selectedRateCard?.Id === rc.Id ? 'bg-primary/10 border-l-2 border-primary' : 'hover:bg-interactive-hover'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-semantic-text-secondary">{rc.Name}</div>
                        <div className="text-xs text-semantic-text-faint">
                          <StatusBadge
                            status={rc.Status === 'Active' ? 'success' : rc.Status === 'Archived' ? 'neutral' : 'warning'}
                            label={rc.Status || 'Draft'}
                            size="sm"
                          />
                          <span className="ml-2">{rc.RoleCount ?? 0} roles</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); openEditRateCard(rc); }} className="p-1 text-semantic-text-faint hover:text-primary"><Edit className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); deleteRateCardModal.open(rc); }} className="p-1 text-semantic-text-faint hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Version Detail */}
            <div className="lg:col-span-2">
              {!selectedRateCard ? (
                <div className="rounded-lg border border-border bg-surface-raised p-12 text-center">
                  <CreditCard className="w-12 h-12 text-semantic-text-disabled mx-auto mb-3" />
                  <p className="text-semantic-text-faint">Select a rate card to view versions and line items.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Version selector */}
                  <div className="rounded-lg border border-border bg-surface-raised px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-semibold text-semantic-text-default">{currentRateCard?.Name}</h2>
                      <StatusBadge
                        status={currentRateCard?.Status === 'Active' ? 'success' : currentRateCard?.Status === 'Archived' ? 'neutral' : 'warning'}
                        label={currentRateCard?.Status || 'Draft'}
                        size="sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {(currentRateCard?.Versions || []).map((v) => (
                        <button
                          key={v.Id}
                          type="button"
                          onClick={() => setSelectedVersion(v)}
                          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                            selectedVersion?.Id === v.Id
                              ? 'bg-accent-primary text-semantic-text-on-primary font-medium'
                              : 'bg-surface-overlay text-semantic-text-subtle hover:bg-accent-secondary-hover'
                          }`}
                        >
                          v{v.Version}
                          {v.Status === 'Active' && ' *'}
                        </button>
                      ))}
                      <Button size="sm" variant="secondary" onClick={() => createVersionMut.mutate(selectedRateCard!.Id)} loading={createVersionMut.isPending}>
                        + New
                      </Button>
                    </div>
                  </div>

                  {/* Version line items */}
                  <Card
                    title={selectedVersion ? `v${selectedVersion.Version} — ${currentVersionStatus}` : 'No version selected'}
                    headerAction={
                      <div className="flex items-center gap-2">
                        {currentVersionStatus === 'Draft' && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => {
                              if (selectedRateCard && selectedVersion && window.confirm('Activate this version?')) {
                                activateVersionMut.mutate({ cardId: selectedRateCard.Id, versionId: selectedVersion.Id });
                              }
                            }}>
                              Activate
                            </Button>
                            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateLineItem}>
                              Add Line Item
                            </Button>
                          </>
                        )}
                      </div>
                    }
                  >
                    {currentVersionRoles.length === 0 ? (
                      <p className="text-center text-semantic-text-faint text-sm py-6">
                        No line items.{currentVersionStatus === 'Draft' ? ' Click "Add Line Item" to add billing roles.' : ''}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Role</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Code</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Currency</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-semantic-text-faint">Rate</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Unit</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-semantic-text-faint">Notes</th>
                              {currentVersionStatus === 'Draft' && <th className="px-3 py-2 w-20" />}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {currentVersionRoles.map((item) => (
                              <tr key={item.Id} className="hover:bg-interactive-hover">
                                <td className="px-3 py-2 font-medium text-semantic-text-default">{item.RoleName || '-'}</td>
                                <td className="px-3 py-2"><code className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{item.RoleCode || '-'}</code></td>
                                <td className="px-3 py-2 text-semantic-text-subtle">{item.CurrencyCode || '-'}</td>
                                <td className="px-3 py-2 text-right font-semibold text-primary">{Number(item.Rate || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</td>
                                <td className="px-3 py-2 text-semantic-text-subtle">{item.Unit || 'Hour'}</td>
                                <td className="px-3 py-2 text-semantic-text-faint text-xs">{item.Notes || '-'}</td>
                                {currentVersionStatus === 'Draft' && (
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1">
                                      <button type="button" onClick={() => openEditLineItem(item)} className="p-1 text-semantic-text-faint hover:text-primary"><Edit className="w-3.5 h-3.5" /></button>
                                      <button type="button" onClick={() => {
                                        if (selectedRateCard && selectedVersion && window.confirm('Remove this line item?')) {
                                          removeLineItemMut.mutate({ cardId: selectedRateCard.Id, versionId: selectedVersion.Id, lineId: item.Id });
                                        }
                                      }} className="p-1 text-semantic-text-faint hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Billing Roles Tab ===== */}
      {activeTab === 'roles' && (
        <TableCard
          title="Billing Roles"
          icon={<Briefcase className="w-4 h-4" />}
          count={billingRoles.length}
          headerActions={
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreateBillingRole}>Add Role</Button>
          }
        >
          <DataTable<BillingRole>
            id="connect-billing-roles"
            columns={billingRoleColumns}
            data={billingRoles}
            rowKey={(row) => row.Id}
            onRowClick={openEditBillingRole}
            emptyMessage="No billing roles. Click Add Role to create one."
            embedded
            showColumnPicker={false}
          />
        </TableCard>
      )}

      {/* ===== Mappings Tab ===== */}
      {activeTab === 'mappings' && (
        <div className="space-y-4">
          {!selectedMappingType ? (
            /* Mapping types list */
            <Card title="Field Mappings — ERP-to-CRM field mapping configurations">
              {mappingsLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : mappingTypes.length === 0 ? (
                <p className="text-center text-semantic-text-faint text-sm py-6">No mapping configurations found.</p>
              ) : (
                <div className="divide-y divide-border">
                  {mappingTypes.map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => setSelectedMappingType(m.name)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-interactive-hover transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium text-semantic-text-default capitalize">{m.name}</p>
                        <p className="text-xs text-semantic-text-faint mt-0.5">{m.description}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-semantic-text-subtle">v{m.version}</p>
                          <p className="text-xs text-semantic-text-faint">{m.entities?.length ?? 0} {m.entities?.length === 1 ? 'entity' : 'entities'}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-semantic-text-faint" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            /* Mapping detail view */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedMappingType(null)}
                className="flex items-center gap-1 text-sm text-semantic-text-subtle hover:text-primary transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to mappings
              </button>

              {mappingDetailLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : !mappingDetail ? (
                <p className="text-center text-semantic-text-faint text-sm py-6">Mapping not found.</p>
              ) : (
                <FieldMappingEditor
                  entityType={selectedMappingType!}
                  baseMapping={mappingDetail.baseMapping}
                  customOverrides={mappingDetail.customOverrides}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Project Types */}
      {activeTab === 'project-types' && <ProjectTypesPage />}

      {/* ===== Modals ===== */}

      {/* Territory Modal */}
      <Modal isOpen={territoryModal.isOpen} onClose={territoryModal.close} title={isEditTerritory ? 'Edit Territory' : 'Add Territory'} size="sm" footer={
        <><Button variant="secondary" onClick={territoryModal.close}>Cancel</Button>
        <Button onClick={handleSaveTerritory} loading={saveTerritoryMut.isPending}>{isEditTerritory ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Name" required><input type="text" value={territoryForm.name} onChange={(e) => setTerritoryForm({ ...territoryForm, name: e.target.value })} className="form-input" placeholder="e.g. Western Cape" /></FormField>
          <FormField label="Code"><input type="text" value={territoryForm.code} onChange={(e) => setTerritoryForm({ ...territoryForm, code: e.target.value })} className="form-input" placeholder="e.g. WC" /></FormField>
          <FormField label="ERP Branch"><input type="text" value={territoryForm.sysproBranch} onChange={(e) => setTerritoryForm({ ...territoryForm, sysproBranch: e.target.value })} className="form-input" /></FormField>
          <FormField label="Description"><textarea value={territoryForm.description} onChange={(e) => setTerritoryForm({ ...territoryForm, description: e.target.value })} className="form-input" rows={2} /></FormField>
          <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer"><input type="checkbox" checked={territoryForm.isActive} onChange={(e) => setTerritoryForm({ ...territoryForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-border" />Active</label>
        </div>
      </Modal>

      {/* Delete Territory Modal */}
      <Modal isOpen={deleteTerritoryModal.isOpen} onClose={deleteTerritoryModal.close} title="Delete Territory" size="sm" footer={
        <><Button variant="secondary" onClick={deleteTerritoryModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteTerritoryModal.data && removeTerritoryMut.mutate(deleteTerritoryModal.data.Id)} loading={removeTerritoryMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-semantic-text-subtle">Delete <strong className="text-semantic-text-default">{deleteTerritoryModal.data?.Name}</strong>?</p>
      </Modal>

      {/* Sales Rep Modal */}
      <Modal isOpen={salesRepModal.isOpen} onClose={salesRepModal.close} title={isEditSalesRep ? 'Edit Sales Rep' : 'Add Sales Rep'} size="sm" footer={
        <><Button variant="secondary" onClick={salesRepModal.close}>Cancel</Button>
        <Button onClick={handleSaveSalesRep} loading={saveSalesRepMut.isPending}>{isEditSalesRep ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Name" required><input type="text" value={salesRepForm.name} onChange={(e) => setSalesRepForm({ ...salesRepForm, name: e.target.value })} className="form-input" /></FormField>
          <FormField label="Email"><input type="email" value={salesRepForm.email} onChange={(e) => setSalesRepForm({ ...salesRepForm, email: e.target.value })} className="form-input" /></FormField>
          <FormField label="Phone"><input type="text" value={salesRepForm.phone} onChange={(e) => setSalesRepForm({ ...salesRepForm, phone: e.target.value })} className="form-input" /></FormField>
          <FormField label="ERP Salesperson Code"><input type="text" value={salesRepForm.sysproSalesperson} onChange={(e) => setSalesRepForm({ ...salesRepForm, sysproSalesperson: e.target.value })} className="form-input" /></FormField>
          <FormField label="Sales Target"><input type="number" value={salesRepForm.salesTarget} onChange={(e) => setSalesRepForm({ ...salesRepForm, salesTarget: parseFloat(e.target.value) || 0 })} className="form-input" /></FormField>
          <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer"><input type="checkbox" checked={salesRepForm.isActive} onChange={(e) => setSalesRepForm({ ...salesRepForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-border" />Active</label>
        </div>
      </Modal>

      {/* Delete Sales Rep Modal */}
      <Modal isOpen={deleteSalesRepModal.isOpen} onClose={deleteSalesRepModal.close} title="Delete Sales Rep" size="sm" footer={
        <><Button variant="secondary" onClick={deleteSalesRepModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteSalesRepModal.data && removeSalesRepMut.mutate(deleteSalesRepModal.data.Id)} loading={removeSalesRepMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-semantic-text-subtle">Delete <strong className="text-semantic-text-default">{deleteSalesRepModal.data?.Name}</strong>?</p>
      </Modal>

      {/* Pipeline Modal */}
      <Modal isOpen={pipelineModal.isOpen} onClose={pipelineModal.close} title={isEditPipeline ? 'Edit Pipeline' : 'Add Pipeline'} size="sm" footer={
        <><Button variant="secondary" onClick={pipelineModal.close}>Cancel</Button>
        <Button onClick={handleSavePipeline} loading={savePipelineMut.isPending}>{isEditPipeline ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Name" required><input type="text" value={pipelineForm.name} onChange={(e) => setPipelineForm({ ...pipelineForm, name: e.target.value })} className="form-input" /></FormField>
          <FormField label="Description"><textarea value={pipelineForm.description} onChange={(e) => setPipelineForm({ ...pipelineForm, description: e.target.value })} className="form-input" rows={2} /></FormField>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer"><input type="checkbox" checked={pipelineForm.isDefault} onChange={(e) => setPipelineForm({ ...pipelineForm, isDefault: e.target.checked })} className="w-4 h-4 rounded border-border" />Default</label>
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer"><input type="checkbox" checked={pipelineForm.isActive} onChange={(e) => setPipelineForm({ ...pipelineForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-border" />Active</label>
          </div>
        </div>
      </Modal>

      {/* Delete Pipeline Modal */}
      <Modal isOpen={deletePipelineModal.isOpen} onClose={deletePipelineModal.close} title="Delete Pipeline" size="sm" footer={
        <><Button variant="secondary" onClick={deletePipelineModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deletePipelineModal.data && removePipelineMut.mutate(deletePipelineModal.data.Id)} loading={removePipelineMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-semantic-text-subtle">Delete <strong className="text-semantic-text-default">{deletePipelineModal.data?.Name}</strong> and all its stages?</p>
      </Modal>

      {/* Stage Modal */}
      <Modal isOpen={stageModal.isOpen} onClose={stageModal.close} title={isEditStage ? 'Edit Stage' : 'Add Stage'} size="sm" footer={
        <><Button variant="secondary" onClick={stageModal.close}>Cancel</Button>
        <Button onClick={handleSaveStage} loading={saveStageMut.isPending}>{isEditStage ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Pipeline" required>
            <select value={stageForm.pipelineId} onChange={(e) => setStageForm({ ...stageForm, pipelineId: e.target.value })} className="form-input" disabled={isEditStage}>
              <option value="">Select Pipeline</option>
              {pipelines.map((p) => <option key={p.Id} value={p.Id}>{p.Name}</option>)}
            </select>
          </FormField>
          <FormField label="Name" required><input type="text" value={stageForm.name} onChange={(e) => setStageForm({ ...stageForm, name: e.target.value })} className="form-input" /></FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Order"><input type="number" value={stageForm.displayOrder} onChange={(e) => setStageForm({ ...stageForm, displayOrder: parseInt(e.target.value) || 0 })} className="form-input" /></FormField>
            <FormField label="Probability %"><input type="number" value={stageForm.probability} onChange={(e) => setStageForm({ ...stageForm, probability: parseFloat(e.target.value) || 0 })} className="form-input" min={0} max={100} /></FormField>
          </div>
          <FormField label="Color">
            <div className="flex items-center gap-2">
              <input type="color" value={stageForm.colour} onChange={(e) => setStageForm({ ...stageForm, colour: e.target.value })} className="w-8 h-8 rounded border border-border cursor-pointer" />
              <input type="text" value={stageForm.colour} onChange={(e) => setStageForm({ ...stageForm, colour: e.target.value })} className="form-input flex-1" />
            </div>
          </FormField>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer"><input type="checkbox" checked={stageForm.isClosed} onChange={(e) => setStageForm({ ...stageForm, isClosed: e.target.checked })} className="w-4 h-4 rounded border-border" />Closed</label>
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer"><input type="checkbox" checked={stageForm.isWon} onChange={(e) => setStageForm({ ...stageForm, isWon: e.target.checked })} className="w-4 h-4 rounded border-border" />Won</label>
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer"><input type="checkbox" checked={stageForm.isActive} onChange={(e) => setStageForm({ ...stageForm, isActive: e.target.checked })} className="w-4 h-4 rounded border-border" />Active</label>
          </div>
        </div>
      </Modal>

      {/* Delete Stage Modal */}
      <Modal isOpen={deleteStageModal.isOpen} onClose={deleteStageModal.close} title="Delete Stage" size="sm" footer={
        <><Button variant="secondary" onClick={deleteStageModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteStageModal.data && removeStageMut.mutate(deleteStageModal.data.Id)} loading={removeStageMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-semantic-text-subtle">Delete stage <strong className="text-semantic-text-default">{deleteStageModal.data?.Name}</strong>?</p>
      </Modal>

      {/* Rate Card Modal */}
      <Modal isOpen={rateCardModal.isOpen} onClose={rateCardModal.close} title={isEditRateCard ? 'Edit Rate Card' : 'Add Rate Card'} size="sm" footer={
        <><Button variant="secondary" onClick={rateCardModal.close}>Cancel</Button>
        <Button onClick={handleSaveRateCard} loading={saveRateCardMut.isPending}>{isEditRateCard ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Name" required><input type="text" value={rateCardForm.name} onChange={(e) => setRateCardForm({ ...rateCardForm, name: e.target.value })} className="form-input" /></FormField>
          <FormField label="Description"><textarea value={rateCardForm.description} onChange={(e) => setRateCardForm({ ...rateCardForm, description: e.target.value })} className="form-input" rows={2} /></FormField>
          <FormField label="Status">
            <select value={rateCardForm.status} onChange={(e) => setRateCardForm({ ...rateCardForm, status: e.target.value })} className="form-input">
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
              <option value="Archived">Archived</option>
            </select>
          </FormField>
          <FormField label="Notes"><textarea value={rateCardForm.notes} onChange={(e) => setRateCardForm({ ...rateCardForm, notes: e.target.value })} className="form-input" rows={2} /></FormField>
        </div>
      </Modal>

      {/* Delete Rate Card Modal */}
      <Modal isOpen={deleteRateCardModal.isOpen} onClose={deleteRateCardModal.close} title="Delete Rate Card" size="sm" footer={
        <><Button variant="secondary" onClick={deleteRateCardModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteRateCardModal.data && removeRateCardMut.mutate(deleteRateCardModal.data.Id)} loading={removeRateCardMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-semantic-text-subtle">Delete <strong className="text-semantic-text-default">{deleteRateCardModal.data?.Name}</strong> and all versions?</p>
      </Modal>

      {/* Billing Role Modal */}
      <Modal isOpen={billingRoleModal.isOpen} onClose={billingRoleModal.close} title={isEditBillingRole ? 'Edit Billing Role' : 'Add Billing Role'} size="sm" footer={
        <><Button variant="secondary" onClick={billingRoleModal.close}>Cancel</Button>
        <Button onClick={handleSaveBillingRole} loading={saveBillingRoleMut.isPending}>{isEditBillingRole ? 'Save Changes' : 'Create'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Code" required><input type="text" value={billingRoleForm.code} onChange={(e) => setBillingRoleForm({ ...billingRoleForm, code: e.target.value })} className="form-input" placeholder="e.g. DEV-SR" disabled={isEditBillingRole} /></FormField>
          <FormField label="Name" required><input type="text" value={billingRoleForm.name} onChange={(e) => setBillingRoleForm({ ...billingRoleForm, name: e.target.value })} className="form-input" placeholder="e.g. Senior Developer" /></FormField>
          <FormField label="Description"><textarea value={billingRoleForm.description} onChange={(e) => setBillingRoleForm({ ...billingRoleForm, description: e.target.value })} className="form-input" rows={2} /></FormField>
          <FormField label="Status">
            <select value={billingRoleForm.status} onChange={(e) => setBillingRoleForm({ ...billingRoleForm, status: e.target.value })} className="form-input">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </FormField>
        </div>
      </Modal>

      {/* Delete Billing Role Modal */}
      <Modal isOpen={deleteBillingRoleModal.isOpen} onClose={deleteBillingRoleModal.close} title="Delete Billing Role" size="sm" footer={
        <><Button variant="secondary" onClick={deleteBillingRoleModal.close}>Cancel</Button>
        <Button variant="danger" onClick={() => deleteBillingRoleModal.data && removeBillingRoleMut.mutate(deleteBillingRoleModal.data.Id)} loading={removeBillingRoleMut.isPending}>Delete</Button></>
      }>
        <p className="text-sm text-semantic-text-subtle">Delete billing role <strong className="text-semantic-text-default">{deleteBillingRoleModal.data?.Name}</strong>?</p>
      </Modal>

      {/* Line Item Modal */}
      <Modal isOpen={lineItemModal.isOpen} onClose={lineItemModal.close} title={isEditLineItem ? 'Edit Line Item' : 'Add Line Item'} size="sm" footer={
        <><Button variant="secondary" onClick={lineItemModal.close}>Cancel</Button>
        <Button onClick={handleSaveLineItem} loading={saveLineItemMut.isPending}>{isEditLineItem ? 'Save Changes' : 'Add'}</Button></>
      }>
        <div className="space-y-4">
          <FormField label="Billing Role" required>
            <select value={lineItemForm.roleId} onChange={(e) => setLineItemForm({ ...lineItemForm, roleId: e.target.value })} className="form-input">
              <option value="">Select a role...</option>
              {billingRoles.map((r) => <option key={r.Id} value={r.Id}>{r.Name} ({r.Code})</option>)}
            </select>
          </FormField>
          <FormField label="Currency">
            <select value={lineItemForm.currencyId} onChange={(e) => setLineItemForm({ ...lineItemForm, currencyId: e.target.value })} className="form-input">
              <option value="">Select currency...</option>
              {currencies.map((c) => <option key={c.Id} value={c.Id}>{c.Code} - {c.Name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Rate" required><input type="number" value={lineItemForm.rate} onChange={(e) => setLineItemForm({ ...lineItemForm, rate: parseFloat(e.target.value) || 0 })} className="form-input" step="0.01" min={0} /></FormField>
            <FormField label="Unit">
              <select value={lineItemForm.unit} onChange={(e) => setLineItemForm({ ...lineItemForm, unit: e.target.value })} className="form-input">
                <option value="Hour">Hour</option>
                <option value="Day">Day</option>
                <option value="Fixed">Fixed</option>
              </select>
            </FormField>
          </div>
          <FormField label="Notes"><textarea value={lineItemForm.notes} onChange={(e) => setLineItemForm({ ...lineItemForm, notes: e.target.value })} className="form-input" rows={2} /></FormField>
        </div>
      </Modal>

      {/* Sync Detail Modal */}
      <Modal isOpen={syncDetailModal.isOpen} onClose={syncDetailModal.close} title="Sync Operation Detail" size="lg">
        {syncDetailModal.data && (() => {
          const d = syncDetailModal.data;
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <DetailField label="Entity Type" value={d.EntityType} />
                <DetailField label="Entity ID" value={d.EntityId || '-'} />
                <DetailField label="ERP ID" value={d.ErpId || '-'} />
                <DetailField label="Operation" value={d.Operation || '-'} />
                <DetailField label="Direction" value={d.Direction} />
                <DetailField label="Status" value={d.Status} />
                <DetailField label="Records" value={String(d.RecordsAffected)} />
                <DetailField label="Duration" value={d.DurationMs != null ? `${(d.DurationMs / 1000).toFixed(2)}s` : '-'} />
                <DetailField label="Synced At" value={new Date(d.SyncedAt).toLocaleString()} />
                <DetailField label="Synced By" value={d.SyncedBy || '-'} />
                <DetailField label="Run ID" value={d.SyncRunId || '-'} />
              </div>

              {(d.ApiMethod || d.ApiUrl) && (
                <div>
                  <label className="block text-xs font-medium text-semantic-text-subtle mb-1">API Call</label>
                  <div className="bg-surface-overlay rounded-lg p-3 text-xs font-mono">
                    <span className="text-primary font-semibold">{d.ApiMethod}</span>{' '}
                    <span className="text-semantic-text-secondary">{d.ApiUrl || d.ApiEndpoint}</span>
                    {d.ApiResponseStatus != null && (
                      <span className={`ml-2 ${d.ApiResponseStatus >= 400 ? 'text-danger' : 'text-success'}`}>
                        [{d.ApiResponseStatus}]
                      </span>
                    )}
                  </div>
                </div>
              )}

              {d.ErrorMessage && (
                <div>
                  <label className="block text-xs font-medium text-danger mb-1">Error</label>
                  <pre className="bg-surface-overlay rounded-lg p-3 text-xs text-danger font-mono overflow-auto max-h-[150px] whitespace-pre-wrap">{d.ErrorMessage}</pre>
                </div>
              )}

              {d.FailedField && (
                <div className="grid grid-cols-3 gap-4 p-3 bg-danger/5 border border-danger/20 rounded-lg">
                  <DetailField label="Failed Field" value={d.FailedField} />
                  <DetailField label="Value" value={d.FailedFieldValue || '-'} />
                  <DetailField label="Expected Type" value={d.FailedFieldExpectedType || '-'} />
                </div>
              )}

              {d.SourceData && (
                <div>
                  <label className="block text-xs font-medium text-semantic-text-subtle mb-1">Source Data</label>
                  <pre className="bg-surface-overlay rounded-lg p-3 text-xs text-semantic-text-subtle font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">{tryFormatJson(d.SourceData)}</pre>
                </div>
              )}
              {d.MappedData && (
                <div>
                  <label className="block text-xs font-medium text-semantic-text-subtle mb-1">Mapped Data</label>
                  <pre className="bg-surface-overlay rounded-lg p-3 text-xs text-success font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">{tryFormatJson(d.MappedData)}</pre>
                </div>
              )}
              {d.ApiRequestBody && (
                <div>
                  <label className="block text-xs font-medium text-semantic-text-subtle mb-1">API Request Body</label>
                  <pre className="bg-surface-overlay rounded-lg p-3 text-xs text-semantic-text-subtle font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">{tryFormatJson(d.ApiRequestBody)}</pre>
                </div>
              )}
              {d.ApiResponseBody && (
                <div>
                  <label className="block text-xs font-medium text-semantic-text-subtle mb-1">API Response Body</label>
                  <pre className="bg-surface-overlay rounded-lg p-3 text-xs text-semantic-text-subtle font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">{tryFormatJson(d.ApiResponseBody)}</pre>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-semantic-text-faint mb-0.5">{label}</label>
      <div className="text-sm text-semantic-text-default">{value}</div>
    </div>
  );
}

function tryFormatJson(str: string): string {
  try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}

// ---------------------------------------------------------------------------
// FormField (local helper)
// ---------------------------------------------------------------------------

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-semantic-text-subtle mb-1">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
