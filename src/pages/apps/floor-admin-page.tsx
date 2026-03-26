import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Factory, Plus, Edit, Trash2, RefreshCw, Users, Briefcase, Clock, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  DataTable,
  Button,
  Card,
  Modal,
  StatusBadge,
  Tabs,
  LoadingSpinner,
  PageHeader,
  TableCard,
  PageStatusBar,
} from '@/components/shared';
import type { ColumnDef, TabItem } from '@/components/shared';
import {
  getFloorStatus,
  getFloorDashboard,
  getFloorReasonCodes,
  createFloorReasonCode,
  updateFloorReasonCode,
  deleteFloorReasonCode,
  getFloorLotSerialRules,
  createFloorLotSerialRule,
  updateFloorLotSerialRule,
  deleteFloorLotSerialRule,
  getFloorCheckpoints,
  createFloorCheckpoint,
  updateFloorCheckpoint,
  deleteFloorCheckpoint,
} from '@/services/admin-service';
import { useModal } from '@shared/hooks';
import type {
  FloorStatus,
  FloorDashboard,
  FloorActiveOperator,
  FloorActiveJob,
  FloorReasonCode,
  FloorLotSerialRule,
  FloorCheckpoint,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Factory className="w-4 h-4" /> },
  { id: 'reason-codes', label: 'Reason Codes', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'lot-serial', label: 'Lot/Serial Rules', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'checkpoints', label: 'Checkpoints', icon: <Clock className="w-4 h-4" /> },
];

const REASON_TYPES = ['SCRAP', 'DOWNTIME', 'NON_PRODUCTIVE', 'QUALITY'];
const RULE_TYPES = ['LOT', 'SERIAL'];
const RESET_FREQUENCIES = ['NEVER', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const CHECKPOINT_TYPES = ['MEASUREMENT', 'VISUAL', 'CHECKLIST', 'PHOTO'];

interface ReasonCodeForm {
  reasonCode: string;
  description: string;
  reasonType: string;
  isActive: boolean;
}

const INITIAL_REASON_FORM: ReasonCodeForm = {
  reasonCode: '', description: '', reasonType: 'SCRAP', isActive: true,
};

interface LotSerialForm {
  ruleType: string;
  stockCode: string;
  productClass: string;
  prefix: string;
  dateFormat: string;
  sequenceDigits: number;
  resetFrequency: string;
  isActive: boolean;
}

const INITIAL_LOT_SERIAL_FORM: LotSerialForm = {
  ruleType: 'LOT', stockCode: '', productClass: '', prefix: '',
  dateFormat: '', sequenceDigits: 4, resetFrequency: 'NEVER', isActive: true,
};

interface CheckpointForm {
  checkpointName: string;
  checkpointType: string;
  workCentreCode: string;
  stockCode: string;
  isMandatory: boolean;
  isActive: boolean;
}

const INITIAL_CHECKPOINT_FORM: CheckpointForm = {
  checkpointName: '', checkpointType: 'MEASUREMENT', workCentreCode: '',
  stockCode: '', isMandatory: false, isActive: true,
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function getReasonTypeBadge(type: string): 'danger' | 'warning' | 'info' | 'neutral' {
  switch (type) {
    case 'SCRAP': return 'danger';
    case 'DOWNTIME': return 'warning';
    case 'NON_PRODUCTIVE': return 'info';
    case 'QUALITY': return 'info';
    default: return 'neutral';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FloorAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Modals
  const reasonModal = useModal<FloorReasonCode>();
  const deleteReasonModal = useModal<FloorReasonCode>();
  const lotSerialModal = useModal<FloorLotSerialRule>();
  const deleteLotSerialModal = useModal<FloorLotSerialRule>();
  const checkpointModal = useModal<FloorCheckpoint>();
  const deleteCheckpointModal = useModal<FloorCheckpoint>();

  // Forms
  const [reasonForm, setReasonForm] = useState<ReasonCodeForm>(INITIAL_REASON_FORM);
  const [isEditingReason, setIsEditingReason] = useState(false);
  const [lotSerialForm, setLotSerialForm] = useState<LotSerialForm>(INITIAL_LOT_SERIAL_FORM);
  const [isEditingLotSerial, setIsEditingLotSerial] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [checkpointForm, setCheckpointForm] = useState<CheckpointForm>(INITIAL_CHECKPOINT_FORM);
  const [isEditingCheckpoint, setIsEditingCheckpoint] = useState(false);
  const [editingCheckpointId, setEditingCheckpointId] = useState<string | null>(null);

  // ---- Queries ----

  const { data: statusData } = useQuery({
    queryKey: ['admin', 'floor', 'status'],
    queryFn: getFloorStatus,
    refetchInterval: 15000,
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['admin', 'floor', 'dashboard'],
    queryFn: getFloorDashboard,
    refetchInterval: 15000,
  });

  const { data: reasonCodesData, isLoading: reasonCodesLoading } = useQuery({
    queryKey: ['admin', 'floor', 'reason-codes'],
    queryFn: () => getFloorReasonCodes(),
    enabled: activeTab === 'reason-codes',
  });

  const { data: lotSerialData, isLoading: lotSerialLoading } = useQuery({
    queryKey: ['admin', 'floor', 'lot-serial-rules'],
    queryFn: getFloorLotSerialRules,
    enabled: activeTab === 'lot-serial',
  });

  const { data: checkpointsData, isLoading: checkpointsLoading } = useQuery({
    queryKey: ['admin', 'floor', 'checkpoints'],
    queryFn: getFloorCheckpoints,
    enabled: activeTab === 'checkpoints',
  });

  // ---- Derived data ----

  const status: FloorStatus = statusData || {};
  const dashboard: FloorDashboard = dashboardData?.data || dashboardData || {};
  const reasonCodes: FloorReasonCode[] = reasonCodesData?.data || [];
  const lotSerialRules: FloorLotSerialRule[] = lotSerialData?.data || [];
  const checkpoints: FloorCheckpoint[] = checkpointsData?.data || [];

  // ---- Mutations: Reason Codes ----

  const createReasonMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createFloorReasonCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'reason-codes'] });
      reasonModal.close();
      toast.success('Reason code created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create reason code'),
  });

  const updateReasonMutation = useMutation({
    mutationFn: ({ code, data }: { code: string; data: Record<string, unknown> }) => updateFloorReasonCode(code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'reason-codes'] });
      reasonModal.close();
      toast.success('Reason code updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update reason code'),
  });

  const deleteReasonMutation = useMutation({
    mutationFn: (code: string) => deleteFloorReasonCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'reason-codes'] });
      deleteReasonModal.close();
      toast.success('Reason code deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete reason code'),
  });

  // ---- Mutations: Lot/Serial ----

  const createLotSerialMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createFloorLotSerialRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'lot-serial-rules'] });
      lotSerialModal.close();
      toast.success('Rule created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create rule'),
  });

  const updateLotSerialMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => updateFloorLotSerialRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'lot-serial-rules'] });
      lotSerialModal.close();
      toast.success('Rule updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update rule'),
  });

  const deleteLotSerialMutation = useMutation({
    mutationFn: (id: number) => deleteFloorLotSerialRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'lot-serial-rules'] });
      deleteLotSerialModal.close();
      toast.success('Rule deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete rule'),
  });

  // ---- Mutations: Checkpoints ----

  const createCheckpointMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createFloorCheckpoint(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'checkpoints'] });
      checkpointModal.close();
      toast.success('Checkpoint created');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create checkpoint'),
  });

  const updateCheckpointMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateFloorCheckpoint(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'checkpoints'] });
      checkpointModal.close();
      toast.success('Checkpoint updated');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update checkpoint'),
  });

  const deleteCheckpointMutation = useMutation({
    mutationFn: (id: string) => deleteFloorCheckpoint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'checkpoints'] });
      deleteCheckpointModal.close();
      toast.success('Checkpoint deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete checkpoint'),
  });

  // ---- Handlers: Reason Codes ----

  function openCreateReason() {
    setReasonForm(INITIAL_REASON_FORM);
    setIsEditingReason(false);
    reasonModal.open();
  }

  function openEditReason(rc: FloorReasonCode) {
    setReasonForm({
      reasonCode: rc.ReasonCode,
      description: rc.Description || '',
      reasonType: rc.ReasonType,
      isActive: rc.IsActive,
    });
    setIsEditingReason(true);
    reasonModal.open(rc);
  }

  function handleSaveReason() {
    if (!reasonForm.reasonCode.trim()) { toast.error('Reason code is required'); return; }
    const data = { ...reasonForm };
    if (isEditingReason) {
      updateReasonMutation.mutate({ code: reasonForm.reasonCode, data });
    } else {
      createReasonMutation.mutate(data);
    }
  }

  // ---- Handlers: Lot/Serial ----

  function openCreateLotSerial() {
    setLotSerialForm(INITIAL_LOT_SERIAL_FORM);
    setIsEditingLotSerial(false);
    setEditingRuleId(null);
    lotSerialModal.open();
  }

  function openEditLotSerial(rule: FloorLotSerialRule) {
    setLotSerialForm({
      ruleType: rule.RuleType,
      stockCode: rule.StockCode || '',
      productClass: rule.ProductClass || '',
      prefix: rule.Prefix || '',
      dateFormat: rule.DateFormat || '',
      sequenceDigits: rule.SequenceDigits || 4,
      resetFrequency: rule.ResetFrequency || 'NEVER',
      isActive: rule.IsActive,
    });
    setIsEditingLotSerial(true);
    setEditingRuleId(rule.RuleId);
    lotSerialModal.open(rule);
  }

  function handleSaveLotSerial() {
    const data = { ...lotSerialForm };
    if (isEditingLotSerial && editingRuleId !== null) {
      updateLotSerialMutation.mutate({ id: editingRuleId, data });
    } else {
      createLotSerialMutation.mutate(data);
    }
  }

  // ---- Handlers: Checkpoints ----

  function openCreateCheckpoint() {
    setCheckpointForm(INITIAL_CHECKPOINT_FORM);
    setIsEditingCheckpoint(false);
    setEditingCheckpointId(null);
    checkpointModal.open();
  }

  function openEditCheckpoint(cp: FloorCheckpoint) {
    setCheckpointForm({
      checkpointName: cp.CheckpointName,
      checkpointType: cp.CheckpointType,
      workCentreCode: cp.WorkCentreCode || '',
      stockCode: cp.StockCode || '',
      isMandatory: cp.IsMandatory,
      isActive: cp.IsActive,
    });
    setIsEditingCheckpoint(true);
    setEditingCheckpointId(cp.CheckpointId);
    checkpointModal.open(cp);
  }

  function handleSaveCheckpoint() {
    if (!checkpointForm.checkpointName.trim()) { toast.error('Name is required'); return; }
    const data = { ...checkpointForm };
    if (isEditingCheckpoint && editingCheckpointId) {
      updateCheckpointMutation.mutate({ id: editingCheckpointId, data });
    } else {
      createCheckpointMutation.mutate(data);
    }
  }

  // ---- Column Definitions ----

  const operatorColumns: ColumnDef<FloorActiveOperator>[] = [
    { key: 'employeeCode', label: 'Employee', sortable: true, render: (_v, row) => <span className="font-medium text-semantic-text-default">{row.employeeCode} - {row.employeeName || ''}</span> },
    { key: 'workCentre', label: 'Work Centre', sortable: true, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'clockInTime', label: 'Clock In', width: 100, render: (val) => <span className="text-semantic-text-faint">{val ? new Date(val).toLocaleTimeString() : '-'}</span> },
    { key: 'currentJob', label: 'Current Job', sortable: true, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'status', label: 'Status', width: 100, render: (val) => <StatusBadge status={val === 'Working' ? 'success' : val === 'Break' ? 'warning' : 'neutral'} label={val || 'Unknown'} size="sm" /> },
  ];

  const jobColumns: ColumnDef<FloorActiveJob>[] = [
    { key: 'jobNumber', label: 'Job #', width: 120, sortable: true, render: (val) => <span className="font-medium text-semantic-text-default">{val || '-'}</span> },
    { key: 'stockCode', label: 'Stock Code', sortable: true, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'workCentre', label: 'Work Centre', sortable: true, render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'operator', label: 'Operator', render: (val) => <span className="text-semantic-text-faint">{val || '-'}</span> },
    { key: 'qtyDone', label: 'Qty Done', width: 80, render: (val) => <span className="text-semantic-text-faint">{val || 0}</span> },
    { key: 'status', label: 'Status', width: 110, render: (val) => <StatusBadge status={val === 'In Progress' ? 'success' : val === 'Paused' ? 'warning' : 'neutral'} label={val || 'Unknown'} size="sm" /> },
  ];

  const reasonCodeColumns: ColumnDef<FloorReasonCode>[] = [
    { key: 'ReasonCode', label: 'Code', width: 120, sortable: true, filterable: true, render: (val) => <span className="font-semibold text-semantic-text-default">{val}</span> },
    { key: 'Description', label: 'Description', sortable: true, render: (val) => <span className="text-semantic-text-subtle">{val || '-'}</span> },
    { key: 'ReasonType', label: 'Type', width: 140, sortable: true, filterable: true, filterType: 'select', filterOptions: REASON_TYPES.map(t => ({ value: t, label: t })), render: (val) => <StatusBadge status={getReasonTypeBadge(val)} label={val} size="sm" /> },
    { key: 'IsActive', label: 'Status', width: 90, sortable: true, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'ReasonCode', label: 'Actions', width: 100, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditReason(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteReasonModal.open(row)} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const lotSerialColumns: ColumnDef<FloorLotSerialRule>[] = [
    { key: 'RuleType', label: 'Type', width: 90, sortable: true, render: (val) => <StatusBadge status={val === 'LOT' ? 'info' : 'success'} label={val} size="sm" /> },
    { key: 'StockCode', label: 'Stock Code', sortable: true, render: (val) => <span className={val ? 'text-semantic-text-default' : 'text-semantic-text-faint'}>{val || 'Any'}</span> },
    { key: 'ProductClass', label: 'Product Class', sortable: true, render: (val) => <span className={val ? 'text-semantic-text-default' : 'text-semantic-text-faint'}>{val || 'Any'}</span> },
    { key: 'Prefix', label: 'Pattern', render: (_val, row) => <span className="font-mono text-semantic-text-faint">{row.Prefix || ''}{row.DateFormat ? `[${row.DateFormat}]` : ''}[{row.SequenceDigits || 4}]</span> },
    { key: 'ResetFrequency', label: 'Reset', width: 100, render: (val) => <span className="text-semantic-text-faint text-xs">{val || 'NEVER'}</span> },
    { key: 'IsActive', label: 'Status', width: 90, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'RuleId', label: 'Actions', width: 100, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditLotSerial(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteLotSerialModal.open(row)} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const checkpointColumns: ColumnDef<FloorCheckpoint>[] = [
    { key: 'CheckpointName', label: 'Name', sortable: true, filterable: true, render: (val) => <span className="font-semibold text-semantic-text-default">{val}</span> },
    { key: 'CheckpointType', label: 'Type', width: 130, sortable: true, filterable: true, filterType: 'select', filterOptions: CHECKPOINT_TYPES.map(t => ({ value: t, label: t })), render: (val) => <StatusBadge status="info" label={val} size="sm" /> },
    { key: 'WorkCentreCode', label: 'Work Centre', width: 120, render: (val) => <span className={val ? 'text-semantic-text-default' : 'text-semantic-text-faint'}>{val || 'Any'}</span> },
    { key: 'StockCode', label: 'Stock Code', width: 120, render: (val) => <span className={val ? 'text-semantic-text-default' : 'text-semantic-text-faint'}>{val || 'Any'}</span> },
    { key: 'IsMandatory', label: 'Mandatory', width: 90, render: (val) => <span className={val ? 'text-danger font-medium' : 'text-semantic-text-faint'}>{val ? 'Yes' : 'No'}</span> },
    { key: 'IsActive', label: 'Status', width: 90, render: (val) => <StatusBadge status={val ? 'success' : 'neutral'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    {
      key: 'CheckpointId', label: 'Actions', width: 100, sortable: false,
      render: (_val, row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openEditCheckpoint(row)} className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
          <button type="button" onClick={() => deleteCheckpointModal.open(row)} className="p-1.5 text-semantic-text-faint hover:text-danger rounded hover:bg-interactive-hover transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  // ---- Render ----

  return (
    <div className="space-y-6">
      <PageHeader
        title="FloorIT"
        description="Shop floor labor tracking configuration"
      />

      {/* Status Bar */}
      <PageStatusBar items={[
        { type: 'badge', label: 'Service', status: status.enabled !== false ? 'success' : 'danger', badgeLabel: status.enabled !== false ? 'Connected' : 'Offline' },
        { type: 'text', label: 'Active Operators', value: status.activeOperators ?? '-' },
        { type: 'text', label: 'Active Jobs', value: status.activeJobs ?? '-' },
        { type: 'text', label: 'Hours Today', value: dashboard.laborStats?.totalHoursToday?.toFixed(1) || '-' },
        { type: 'text', label: 'Qty Completed', value: dashboard.laborStats?.qtyCompletedToday ?? '-' },
        { type: 'text', label: 'On Break', value: dashboard.laborStats?.onBreak ?? '-' },
      ]} />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Labor Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Hours Today" value={dashboard.laborStats?.totalHoursToday?.toFixed(1) || '-'} />
            <StatCard label="Qty Completed" value={String(dashboard.laborStats?.qtyCompletedToday ?? '-')} />
            <StatCard label="Qty Scrapped" value={String(dashboard.laborStats?.qtyScrappedToday ?? '-')} />
            <StatCard label="On Break" value={String(dashboard.laborStats?.onBreak ?? '-')} />
          </div>

          {/* Active Operators */}
          <TableCard
            title="Active Operators"
            icon={<Users className="w-4 h-4" />}
            count={Array.isArray(dashboard.activeOperators) ? dashboard.activeOperators.length : 0}
            headerActions={
              <Button variant="ghost" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'floor', 'dashboard'] })}>Refresh</Button>
            }
          >
            {dashboardLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
              <DataTable<FloorActiveOperator>
                id="floor-active-operators"
                columns={operatorColumns}
                data={Array.isArray(dashboard.activeOperators) ? dashboard.activeOperators : []}
                rowKey="employeeCode"
                emptyMessage="No active operators"
                emptyIcon={Users}
                embedded
                showColumnPicker={false}
              />
            )}
          </TableCard>

          {/* Active Jobs */}
          <TableCard
            title="Active Jobs"
            icon={<Briefcase className="w-4 h-4" />}
            count={Array.isArray(dashboard.activeJobs) ? dashboard.activeJobs.length : 0}
          >
            {dashboardLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
              <DataTable<FloorActiveJob>
                id="floor-active-jobs"
                columns={jobColumns}
                data={Array.isArray(dashboard.activeJobs) ? dashboard.activeJobs : []}
                rowKey="jobNumber"
                emptyMessage="No active jobs"
                emptyIcon={Briefcase}
                embedded
                showColumnPicker={false}
              />
            )}
          </TableCard>
        </div>
      )}

      {/* Tab: Reason Codes */}
      {activeTab === 'reason-codes' && (
        <TableCard
          title="Reason Codes"
          icon={<AlertTriangle className="w-4 h-4" />}
          count={reasonCodes.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateReason}>Add Reason Code</Button>
          }
        >
          {reasonCodesLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
            <DataTable<FloorReasonCode>
              id="floor-reason-codes"
              columns={reasonCodeColumns}
              data={reasonCodes}
              rowKey="ReasonCode"
              onRowClick={openEditReason}
              emptyMessage="No reason codes configured"
              emptyIcon={AlertTriangle}
              showFilters
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: Lot/Serial Rules */}
      {activeTab === 'lot-serial' && (
        <TableCard
          title="Lot/Serial Rules"
          icon={<Briefcase className="w-4 h-4" />}
          count={lotSerialRules.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateLotSerial}>Add Rule</Button>
          }
        >
          {lotSerialLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
            <DataTable<FloorLotSerialRule>
              id="floor-lot-serial-rules"
              columns={lotSerialColumns}
              data={lotSerialRules}
              rowKey="RuleId"
              onRowClick={openEditLotSerial}
              emptyMessage="No lot/serial rules configured"
              emptyIcon={Briefcase}
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Tab: Checkpoints */}
      {activeTab === 'checkpoints' && (
        <TableCard
          title="Quality Checkpoints"
          icon={<Clock className="w-4 h-4" />}
          count={checkpoints.length}
          headerActions={
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreateCheckpoint}>Add Checkpoint</Button>
          }
        >
          {checkpointsLoading ? <div className="flex justify-center py-8"><LoadingSpinner /></div> : (
            <DataTable<FloorCheckpoint>
              id="floor-checkpoints"
              columns={checkpointColumns}
              data={checkpoints}
              rowKey="CheckpointId"
              onRowClick={openEditCheckpoint}
              emptyMessage="No quality checkpoints configured"
              emptyIcon={Clock}
              showFilters
              embedded
              showColumnPicker={false}
            />
          )}
        </TableCard>
      )}

      {/* Reason Code Modal */}
      <Modal
        isOpen={reasonModal.isOpen}
        onClose={reasonModal.close}
        title={isEditingReason ? 'Edit Reason Code' : 'Add Reason Code'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={reasonModal.close}>Cancel</Button>
            <Button onClick={handleSaveReason} loading={createReasonMutation.isPending || updateReasonMutation.isPending}>
              {isEditingReason ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Reason Code" required>
            <input type="text" value={reasonForm.reasonCode} onChange={(e) => setReasonForm({ ...reasonForm, reasonCode: e.target.value })} className="form-input" placeholder="e.g. SCR01" disabled={isEditingReason} />
          </FormField>
          <FormField label="Description">
            <input type="text" value={reasonForm.description} onChange={(e) => setReasonForm({ ...reasonForm, description: e.target.value })} className="form-input" placeholder="Description" />
          </FormField>
          <FormField label="Type" required>
            <select value={reasonForm.reasonType} onChange={(e) => setReasonForm({ ...reasonForm, reasonType: e.target.value })} className="form-input" title="Type">
              {REASON_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
            <input type="checkbox" checked={reasonForm.isActive} onChange={(e) => setReasonForm({ ...reasonForm, isActive: e.target.checked })} className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring" />
            Active
          </label>
        </div>
      </Modal>

      {/* Delete Reason Code Modal */}
      <Modal isOpen={deleteReasonModal.isOpen} onClose={deleteReasonModal.close} title="Delete Reason Code" size="sm" footer={
        <>
          <Button variant="secondary" onClick={deleteReasonModal.close}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteReasonModal.data && deleteReasonMutation.mutate(deleteReasonModal.data.ReasonCode)} loading={deleteReasonMutation.isPending}>Delete</Button>
        </>
      }>
        <p className="text-sm text-semantic-text-subtle">Are you sure you want to delete <strong className="text-semantic-text-default">{deleteReasonModal.data?.ReasonCode}</strong>?</p>
      </Modal>

      {/* Lot/Serial Rule Modal */}
      <Modal
        isOpen={lotSerialModal.isOpen}
        onClose={lotSerialModal.close}
        title={isEditingLotSerial ? 'Edit Lot/Serial Rule' : 'Add Lot/Serial Rule'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={lotSerialModal.close}>Cancel</Button>
            <Button onClick={handleSaveLotSerial} loading={createLotSerialMutation.isPending || updateLotSerialMutation.isPending}>
              {isEditingLotSerial ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Rule Type" required>
              <select value={lotSerialForm.ruleType} onChange={(e) => setLotSerialForm({ ...lotSerialForm, ruleType: e.target.value })} className="form-input" title="Rule type">
                {RULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="Reset Frequency">
              <select value={lotSerialForm.resetFrequency} onChange={(e) => setLotSerialForm({ ...lotSerialForm, resetFrequency: e.target.value })} className="form-input" title="Reset frequency">
                {RESET_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Stock Code"><input type="text" value={lotSerialForm.stockCode} onChange={(e) => setLotSerialForm({ ...lotSerialForm, stockCode: e.target.value })} className="form-input" placeholder="Any" /></FormField>
            <FormField label="Product Class"><input type="text" value={lotSerialForm.productClass} onChange={(e) => setLotSerialForm({ ...lotSerialForm, productClass: e.target.value })} className="form-input" placeholder="Any" /></FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Prefix"><input type="text" value={lotSerialForm.prefix} onChange={(e) => setLotSerialForm({ ...lotSerialForm, prefix: e.target.value })} className="form-input" placeholder="LOT-" /></FormField>
            <FormField label="Date Format"><input type="text" value={lotSerialForm.dateFormat} onChange={(e) => setLotSerialForm({ ...lotSerialForm, dateFormat: e.target.value })} className="form-input" placeholder="YYYYMMDD" /></FormField>
            <FormField label="Seq. Digits"><input type="number" value={lotSerialForm.sequenceDigits} onChange={(e) => setLotSerialForm({ ...lotSerialForm, sequenceDigits: parseInt(e.target.value) || 4 })} className="form-input" min={1} max={10} /></FormField>
          </div>
          <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
            <input type="checkbox" checked={lotSerialForm.isActive} onChange={(e) => setLotSerialForm({ ...lotSerialForm, isActive: e.target.checked })} className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring" />
            Active
          </label>
        </div>
      </Modal>

      {/* Delete Lot/Serial Modal */}
      <Modal isOpen={deleteLotSerialModal.isOpen} onClose={deleteLotSerialModal.close} title="Delete Rule" size="sm" footer={
        <>
          <Button variant="secondary" onClick={deleteLotSerialModal.close}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteLotSerialModal.data && deleteLotSerialMutation.mutate(deleteLotSerialModal.data.RuleId)} loading={deleteLotSerialMutation.isPending}>Delete</Button>
        </>
      }>
        <p className="text-sm text-semantic-text-subtle">Are you sure you want to delete this {deleteLotSerialModal.data?.RuleType} rule?</p>
      </Modal>

      {/* Checkpoint Modal */}
      <Modal
        isOpen={checkpointModal.isOpen}
        onClose={checkpointModal.close}
        title={isEditingCheckpoint ? 'Edit Checkpoint' : 'Add Checkpoint'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={checkpointModal.close}>Cancel</Button>
            <Button onClick={handleSaveCheckpoint} loading={createCheckpointMutation.isPending || updateCheckpointMutation.isPending}>
              {isEditingCheckpoint ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Name" required>
            <input type="text" value={checkpointForm.checkpointName} onChange={(e) => setCheckpointForm({ ...checkpointForm, checkpointName: e.target.value })} className="form-input" placeholder="Checkpoint name" />
          </FormField>
          <FormField label="Type" required>
            <select value={checkpointForm.checkpointType} onChange={(e) => setCheckpointForm({ ...checkpointForm, checkpointType: e.target.value })} className="form-input" title="Checkpoint type">
              {CHECKPOINT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Work Centre"><input type="text" value={checkpointForm.workCentreCode} onChange={(e) => setCheckpointForm({ ...checkpointForm, workCentreCode: e.target.value })} className="form-input" placeholder="Any" /></FormField>
            <FormField label="Stock Code"><input type="text" value={checkpointForm.stockCode} onChange={(e) => setCheckpointForm({ ...checkpointForm, stockCode: e.target.value })} className="form-input" placeholder="Any" /></FormField>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
              <input type="checkbox" checked={checkpointForm.isMandatory} onChange={(e) => setCheckpointForm({ ...checkpointForm, isMandatory: e.target.checked })} className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring" />
              Mandatory
            </label>
            <label className="flex items-center gap-2 text-sm text-semantic-text-secondary cursor-pointer">
              <input type="checkbox" checked={checkpointForm.isActive} onChange={(e) => setCheckpointForm({ ...checkpointForm, isActive: e.target.checked })} className="rounded border-border bg-surface-subtle text-primary focus:ring-interactive-focus-ring" />
              Active
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Checkpoint Modal */}
      <Modal isOpen={deleteCheckpointModal.isOpen} onClose={deleteCheckpointModal.close} title="Delete Checkpoint" size="sm" footer={
        <>
          <Button variant="secondary" onClick={deleteCheckpointModal.close}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteCheckpointModal.data && deleteCheckpointMutation.mutate(deleteCheckpointModal.data.CheckpointId)} loading={deleteCheckpointMutation.isPending}>Delete</Button>
        </>
      }>
        <p className="text-sm text-semantic-text-subtle">Are you sure you want to delete <strong className="text-semantic-text-default">{deleteCheckpointModal.data?.CheckpointName}</strong>?</p>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-raised border border-border rounded-xl p-4">
      <p className="text-xs text-semantic-text-faint mb-1">{label}</p>
      <p className="text-xl font-semibold text-semantic-text-default">{value}</p>
    </div>
  );
}

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
