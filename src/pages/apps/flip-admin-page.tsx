import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  ShoppingCart,
  MapPin,
  Activity,
  Truck,
} from 'lucide-react';
import {
  DataTable,
  Button,
  StatusBadge,
  LoadingSpinner,
  Tabs,
  Card,
} from '@/components/shared';
import type { ColumnDef, TabItem } from '@/components/shared';
import {
  getPosTerminals,
  getGpsTerminalsFilter,
  getGpsSalesData,
} from '@/services/admin-service';
import type { PosTerminal, GpsTransaction, GpsSalesTerminal } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FLIP_TABS: TabItem[] = [
  { id: 'status', label: 'Status', icon: <Activity className="w-4 h-4" /> },
  { id: 'dashboard', label: 'GPS Dashboard', icon: <MapPin className="w-4 h-4" /> },
];

const TERMINAL_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
  '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6',
  '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FlipAdminPage() {
  const [activeTab, setActiveTab] = useState('status');
  const [gpsDate, setGpsDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedTerminalIds, setSelectedTerminalIds] = useState<string[]>([]);
  const [gpsLoaded, setGpsLoaded] = useState(false);

  // ==== Queries ====

  const { data: terminalsData, isLoading: terminalsLoading } = useQuery({
    queryKey: ['flip', 'terminals'],
    queryFn: getPosTerminals,
    enabled: activeTab === 'status',
  });

  const { data: gpsFilterData } = useQuery({
    queryKey: ['flip', 'gps-filter'],
    queryFn: getGpsTerminalsFilter,
    enabled: activeTab === 'dashboard',
    onSuccess: (data: { terminals?: Array<{ terminalId: string }> }) => {
      if (data?.terminals && selectedTerminalIds.length === 0) {
        setSelectedTerminalIds(data.terminals.map((t: { terminalId: string }) => t.terminalId));
      }
    },
  } as any);

  const { data: gpsData, refetch: refetchGps, isFetching: gpsFetching } = useQuery({
    queryKey: ['flip', 'gps-sales', gpsDate, selectedTerminalIds],
    queryFn: () => getGpsSalesData({
      date: gpsDate,
      terminalIds: selectedTerminalIds.join(','),
    }),
    enabled: gpsLoaded && selectedTerminalIds.length > 0,
  });

  // Derived data
  const terminals: PosTerminal[] = terminalsData?.terminals ?? [];
  const gpsFilterTerminals = gpsFilterData?.terminals ?? [];
  const gpsTerminalSales: GpsSalesTerminal[] = gpsData?.terminals ?? [];
  const gpsTransactions: GpsTransaction[] = gpsData?.transactions ?? [];
  const gpsSummary = gpsData?.summary;

  // Terminal stats
  const totalTerminals = terminals.length;
  const activeTerminals = terminals.filter((t) => t.IsActive).length;
  const todayTxns = terminals.reduce((sum, t) => sum + (t.TodayTransactionCount || 0), 0);
  const todaySales = terminals.reduce((sum, t) => sum + (parseFloat(t.TodaySalesTotal || '0') || 0), 0);

  // ==== Handlers ====

  function toggleTerminal(terminalId: string) {
    setSelectedTerminalIds((prev) =>
      prev.includes(terminalId) ? prev.filter((id) => id !== terminalId) : [...prev, terminalId]
    );
  }

  function selectAllTerminals() {
    if (selectedTerminalIds.length === gpsFilterTerminals.length) {
      setSelectedTerminalIds([]);
    } else {
      setSelectedTerminalIds(gpsFilterTerminals.map((t: { terminalId: string }) => t.terminalId));
    }
  }

  function handleLoadGps() {
    setGpsLoaded(true);
    refetchGps();
  }

  // ==== Column Definitions ====

  const terminalColumns: ColumnDef<PosTerminal>[] = [
    {
      key: 'TerminalCode', label: 'Terminal', sortable: true,
      render: (v, row) => (
        <div>
          <div className="font-medium text-dark-700">{v}</div>
          {row.Description && <div className="text-xs text-dark-400">{row.Description}</div>}
        </div>
      ),
    },
    { key: 'VanRegistration', label: 'Van', width: 100, sortable: true, render: (v) => v || '-' },
    {
      key: 'TruckWarehouse', label: 'Warehouse', width: 120, sortable: true,
      render: (v, row) => (
        <div>
          <div className="font-medium">{v || '-'}</div>
          {row.ReplenishmentWarehouse && <div className="text-xs text-dark-400">From: {row.ReplenishmentWarehouse}</div>}
        </div>
      ),
    },
    { key: 'Salesperson', label: 'Salesperson', width: 120, sortable: true, render: (v) => v || '-' },
    { key: 'IsActive', label: 'Status', width: 80, sortable: true, render: (v) => <StatusBadge status={v ? 'success' : 'danger'} label={v ? 'Active' : 'Inactive'} size="sm" /> },
    { key: 'GpsTrackingEnabled', label: 'GPS', width: 60, sortable: true, render: (v) => <StatusBadge status={v ? 'info' : 'neutral'} label={v ? 'On' : 'Off'} size="sm" /> },
    { key: 'TodayTransactionCount', label: 'Txns', width: 60, sortable: true, render: (v) => v || 0 },
    {
      key: 'TodaySalesTotal', label: 'Sales', width: 100, sortable: true,
      render: (v) => (v && parseFloat(v) > 0) ? `R${parseFloat(v).toFixed(2)}` : '-',
    },
    {
      key: 'LastLoginAt', label: 'Last Login', width: 100, sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString() : 'Never',
    },
  ];

  // ==== Render ====

  if (terminalsLoading && activeTab === 'status') {
    return <div className="flex items-center justify-center h-full"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <ShoppingCart className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-dark-700">FlipIT Admin</h1>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-dark-400">Terminals:</span>
          <span className="text-dark-600 font-medium">{totalTerminals}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-dark-400">Active:</span>
          <span className="text-dark-600 font-medium">{activeTerminals}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-dark-400">Today Txns:</span>
          <span className="text-dark-600 font-medium">{todayTxns}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-dark-400">Today Sales:</span>
          <span className="text-primary font-medium">R{todaySales.toFixed(2)}</span>
        </div>
      </div>

      <Tabs tabs={FLIP_TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* ===== Status Tab ===== */}
      {activeTab === 'status' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Active Terminals" value={String(activeTerminals)} />
            <StatCard label="Active Trucks" value={String(terminals.filter((t) => t.IsActive && t.VanRegistration).length)} />
            <StatCard label="Today Transactions" value={String(todayTxns)} />
            <StatCard label="Today Sales" value={`R${todaySales.toFixed(2)}`} highlight />
          </div>

          {/* Terminals Table */}
          <Card title={`POS Terminals (${terminals.length})`}>
            <DataTable<PosTerminal>
              id="flip-terminals"
              columns={terminalColumns}
              data={[...terminals].sort((a, b) => {
                if (a.IsActive !== b.IsActive) return a.IsActive ? -1 : 1;
                return (a.TerminalCode || '').localeCompare(b.TerminalCode || '');
              })}
              rowKey={(row) => row.TerminalCode}
              emptyMessage="No terminals configured"
            />
          </Card>
        </div>
      )}

      {/* ===== GPS Dashboard Tab ===== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-xs text-dark-400 mb-1">Date</label>
                <input
                  type="date"
                  value={gpsDate}
                  onChange={(e) => setGpsDate(e.target.value)}
                  className="form-input text-sm w-40"
                />
              </div>
              <div>
                <label className="block text-xs text-dark-400 mb-1">Terminals</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllTerminals}
                    className="text-xs text-primary hover:underline"
                  >
                    {selectedTerminalIds.length === gpsFilterTerminals.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs text-dark-400">
                    {selectedTerminalIds.length} of {gpsFilterTerminals.length} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1 max-w-md">
                  {gpsFilterTerminals.map((t: { terminalId: string; terminalCode: string; description?: string; vanRegistration?: string }) => (
                    <label key={t.terminalId} className="flex items-center gap-1 text-xs text-dark-500 cursor-pointer bg-dark-100 px-2 py-1 rounded">
                      <input
                        type="checkbox"
                        checked={selectedTerminalIds.includes(t.terminalId)}
                        onChange={() => toggleTerminal(t.terminalId)}
                        className="w-3 h-3 rounded border-dark-300"
                      />
                      {t.terminalCode}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-end gap-2 ml-auto">
                <Button onClick={handleLoadGps} loading={gpsFetching} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  Load Data
                </Button>
              </div>
            </div>
          </Card>

          {/* GPS Summary */}
          {gpsSummary && (
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Transactions" value={String(gpsSummary.totalTransactions)} />
              <StatCard label="Total Sales" value={`R${gpsSummary.totalSales.toFixed(2)}`} highlight />
              <StatCard label="Terminals" value={String(gpsSummary.terminalCount)} />
            </div>
          )}

          {/* GPS Transaction List */}
          {gpsLoaded && gpsTransactions.length > 0 && (
            <Card title={`GPS Transactions (${gpsTransactions.length})`}>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-dark-50">
                    <tr className="border-b border-dark-200">
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Time</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Truck</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-dark-400">Customer</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-dark-400">Amount</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-dark-400">Map</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-200">
                    {gpsTransactions.map((tx, idx) => {
                      const termIdx = gpsTerminalSales.findIndex((t) => t.terminalCode === tx.terminalCode);
                      const color = TERMINAL_COLORS[termIdx % TERMINAL_COLORS.length] || '#666';
                      return (
                        <tr key={idx} className="hover:bg-dark-100/50">
                          <td className="px-3 py-2 text-dark-500">{new Date(tx.createdAt).toLocaleTimeString()}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded text-xs text-white font-medium" style={{ backgroundColor: color }}>
                              {tx.terminalCode}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-dark-600">{tx.customerName || tx.customerCode}</td>
                          <td className="px-3 py-2 text-right font-medium text-dark-700">R{parseFloat(tx.grandTotal).toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">
                            <a
                              href={`https://www.google.com/maps?q=${tx.latitude},${tx.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-info hover:underline text-xs"
                            >
                              Pin
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Terminal Sales Breakdown */}
          {gpsLoaded && gpsTerminalSales.length > 0 && (
            <Card title="Sales by Terminal">
              <div className="space-y-3">
                {gpsTerminalSales.map((term, idx) => {
                  const color = TERMINAL_COLORS[idx % TERMINAL_COLORS.length];
                  return (
                    <div key={term.terminalCode} className="bg-dark-100/50 border border-dark-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded text-xs text-white font-medium" style={{ backgroundColor: color }}>
                            {term.terminalCode}
                          </span>
                          <span className="text-sm text-dark-400">{term.description || term.vanRegistration || ''}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-success">R{term.totalSales.toFixed(2)}</div>
                          <div className="text-xs text-dark-400">{term.transactionCount} transactions</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {gpsLoaded && gpsTransactions.length === 0 && !gpsFetching && (
            <div className="text-center py-12 text-sm text-dark-400">
              <Truck className="w-12 h-12 text-dark-300 mx-auto mb-3" />
              <p>No GPS transactions found for the selected criteria.</p>
            </div>
          )}

          {!gpsLoaded && (
            <div className="text-center py-12 text-sm text-dark-400">
              <MapPin className="w-12 h-12 text-dark-300 mx-auto mb-3" />
              <p>Select terminals and click "Load Data" to view GPS sales data.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-dark-50 border border-dark-200 rounded-xl p-4">
      <div className="text-xs text-dark-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-dark-700'}`}>{value}</div>
    </div>
  );
}
