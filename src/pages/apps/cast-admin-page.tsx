import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Calendar, Layers, CheckCircle, BarChart3 } from 'lucide-react';
import {
  DataTable,
  Card,
  Tabs,
  StatusBadge,
  LoadingSpinner,
  PageHeader,
} from '@/components/shared';
import type { TabItem, ColumnDef } from '@/components/shared';
import type { CastCalendar, CastVersion, CastApprovalItem } from '@/types';
import {
  getCastDashboard,
  getCastCalendars,
  getCastVersions,
  getCastApprovalsPending,
  getCastAccuracySummary,
} from '@/services/admin-service';

// ===== Constants =====

const tabs: TabItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'calendars', label: 'Calendars', icon: <Calendar className="w-4 h-4" /> },
  { id: 'versions', label: 'Versions', icon: <Layers className="w-4 h-4" /> },
  { id: 'approvals', label: 'Approvals', icon: <CheckCircle className="w-4 h-4" /> },
  { id: 'accuracy', label: 'Accuracy', icon: <BarChart3 className="w-4 h-4" /> },
];

// ===== Component =====

export default function CastAdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // ===== Queries =====

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['admin', 'cast', 'dashboard'],
    queryFn: getCastDashboard,
    enabled: activeTab === 'dashboard',
  });

  const { data: calendars, isLoading: calendarsLoading } = useQuery({
    queryKey: ['admin', 'cast', 'calendars'],
    queryFn: getCastCalendars,
    enabled: activeTab === 'calendars',
  });

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ['admin', 'cast', 'versions'],
    queryFn: getCastVersions,
    enabled: activeTab === 'versions',
  });

  const { data: approvals, isLoading: approvalsLoading } = useQuery({
    queryKey: ['admin', 'cast', 'approvals'],
    queryFn: getCastApprovalsPending,
    enabled: activeTab === 'approvals',
  });

  const { data: accuracy, isLoading: accuracyLoading } = useQuery({
    queryKey: ['admin', 'cast', 'accuracy'],
    queryFn: getCastAccuracySummary,
    enabled: activeTab === 'accuracy',
  });

  const calendarsList: CastCalendar[] = Array.isArray(calendars) ? calendars : [];
  const versionsList: CastVersion[] = Array.isArray(versions) ? versions : [];
  const approvalsList: CastApprovalItem[] = Array.isArray(approvals) ? approvals : [];

  // ===== Column definitions =====

  const calendarColumns: ColumnDef<CastCalendar>[] = [
    { key: 'Name', label: 'Name', sortable: true, filterable: true, render: (val) => <span className="font-medium text-dark-700">{val}</span> },
    { key: 'CalendarType', label: 'Type', width: 110, sortable: true, render: (val) => <span className="text-dark-600">{val}</span> },
    { key: 'FiscalYearStart', label: 'Fiscal Start', width: 110, render: (val) => <span className="text-dark-400">{val ? `Month ${val}` : '-'}</span> },
    { key: 'WorkingDaysPerWeek', label: 'Work Days', width: 100, render: (val) => <span className="text-dark-400">{val ?? '-'}</span> },
    { key: 'IsDefault', label: 'Default', width: 80, render: (val) => val ? <span className="text-primary">Yes</span> : <span className="text-dark-400">No</span> },
    { key: 'IsActive', label: 'Active', width: 80, render: (val) => <StatusBadge status={val ? 'success' : 'danger'} label={val ? 'Active' : 'Inactive'} size="sm" /> },
    { key: 'CreatedAt', label: 'Created', width: 160, render: (val) => <span className="text-xs text-dark-400">{val ? new Date(val).toLocaleString() : '-'}</span> },
  ];

  const versionColumns: ColumnDef<CastVersion>[] = [
    { key: 'Name', label: 'Name', sortable: true, filterable: true, render: (val) => <span className="font-medium text-dark-700">{val}</span> },
    { key: 'VersionType', label: 'Type', width: 110, sortable: true, render: (val) => <span className="text-dark-600">{val}</span> },
    {
      key: 'Status', label: 'Status', width: 110, sortable: true,
      render: (val) => {
        const map: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
          DRAFT: 'info', ACTIVE: 'success', ARCHIVED: 'neutral', CLOSED: 'danger',
        };
        return <StatusBadge status={map[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    { key: 'CreatedBy', label: 'Created By', width: 140, render: (val) => <span className="text-dark-400">{val || '-'}</span> },
    { key: 'CreatedAt', label: 'Created', width: 160, sortable: true, render: (val) => <span className="text-xs text-dark-400">{val ? new Date(val).toLocaleString() : '-'}</span> },
  ];

  const approvalColumns: ColumnDef<CastApprovalItem>[] = [
    { key: 'Name', label: 'Forecast', sortable: true, filterable: true, render: (val) => <span className="font-medium text-dark-700">{val}</span> },
    { key: 'ForecastType', label: 'Type', width: 110, render: (val) => <span className="text-dark-600">{val}</span> },
    {
      key: 'Status', label: 'Status', width: 110, sortable: true,
      render: (val) => {
        const map: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral'> = {
          SUBMITTED: 'info', INREVIEW: 'warning', APPROVED: 'success', REJECTED: 'danger', DRAFT: 'neutral',
        };
        return <StatusBadge status={map[val] || 'neutral'} label={val} size="sm" />;
      },
    },
    { key: 'DimensionType', label: 'Dimension', width: 120, render: (val) => <span className="text-dark-400">{val || '-'}</span> },
    { key: 'DimensionLabel', label: 'Scope', render: (val, row) => <span className="text-dark-400">{val || row.DimensionValue || '-'}</span> },
    { key: 'Source', label: 'Source', width: 100, render: (val) => <span className="text-dark-400">{val}</span> },
    { key: 'CreatedAt', label: 'Created', width: 160, sortable: true, render: (val) => <span className="text-xs text-dark-400">{val ? new Date(val).toLocaleString() : '-'}</span> },
  ];

  // ===== Render =====

  return (
    <div className="space-y-6">
      <PageHeader
        title="CastIT Admin"
        description="Sales & inventory forecasting configuration and oversight"
        icon={<TrendingUp className="w-5 h-5" />}
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {dashboardLoading ? <LoadingSpinner size="lg" /> : dashboard ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard label="Total Forecasts" value={String(dashboard.totalForecasts ?? 0)} color="text-primary" />
                <StatCard label="Active Versions" value={String(dashboard.activeVersions ?? 0)} color="text-info" />
                <StatCard
                  label="Approval Queue"
                  value={String(
                    ((dashboard.forecastsByStatus?.SUBMITTED ?? 0) + (dashboard.forecastsByStatus?.INREVIEW ?? 0))
                  )}
                  color="text-warning"
                />
              </div>

              {/* Forecasts by status */}
              {dashboard.forecastsByStatus && Object.keys(dashboard.forecastsByStatus).length > 0 && (
                <Card title="Forecasts by Status">
                  <div className="space-y-2">
                    {Object.entries(dashboard.forecastsByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between px-3 py-2 bg-dark-100/50 rounded-lg">
                        <span className="text-sm text-dark-700">{status}</span>
                        <span className="text-sm text-dark-400">{count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-sm text-dark-400">Forecasting dashboard data unavailable</div>
          )}
        </div>
      )}

      {/* Tab: Calendars */}
      {activeTab === 'calendars' && (
        calendarsLoading ? <LoadingSpinner size="lg" /> : (
          <DataTable<CastCalendar>
            id="admin-cast-calendars"
            columns={calendarColumns}
            data={calendarsList}
            rowKey="Id"
            emptyMessage="No forecast calendars configured"
            emptyIcon={Calendar}
            showFilters
          />
        )
      )}

      {/* Tab: Versions */}
      {activeTab === 'versions' && (
        versionsLoading ? <LoadingSpinner size="lg" /> : (
          <DataTable<CastVersion>
            id="admin-cast-versions"
            columns={versionColumns}
            data={versionsList}
            rowKey="Id"
            emptyMessage="No forecast versions defined"
            emptyIcon={Layers}
            showFilters
          />
        )
      )}

      {/* Tab: Approvals */}
      {activeTab === 'approvals' && (
        approvalsLoading ? <LoadingSpinner size="lg" /> : (
          <DataTable<CastApprovalItem>
            id="admin-cast-approvals"
            columns={approvalColumns}
            data={approvalsList}
            rowKey="Id"
            emptyMessage="No forecasts awaiting approval"
            emptyIcon={CheckCircle}
            showFilters
          />
        )
      )}

      {/* Tab: Accuracy */}
      {activeTab === 'accuracy' && (
        <div className="space-y-6">
          {accuracyLoading ? <LoadingSpinner size="lg" /> : accuracy && accuracy.TotalPeriods ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard label="Total Periods" value={String(accuracy.TotalPeriods ?? 0)} color="text-primary" />
              <StatCard
                label="Avg MAPE"
                value={accuracy.AvgMAPE !== undefined && accuracy.AvgMAPE !== null ? `${Number(accuracy.AvgMAPE).toFixed(2)}%` : '-'}
                color="text-info"
              />
              <StatCard label="Over-forecast" value={String(accuracy.OverforecastCount ?? 0)} color="text-warning" />
              <StatCard label="Under-forecast" value={String(accuracy.UnderforecastCount ?? 0)} color="text-warning" />
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-dark-400">No accuracy data recorded</div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Local helpers =====

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-dark-50 border border-dark-200 rounded-xl p-5">
      <div className="text-xs text-dark-400 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-2 ${color}`}>{value}</div>
    </div>
  );
}
