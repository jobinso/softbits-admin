import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Smartphone, Plus, Trash2, ShieldCheck, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Modal,
  DataTable,
  StatusBadge,
  LoadingSpinner,
  TableCard,
  TableFilterDropdown,
  TableColumnPicker,
} from '@/components/shared';
import type { ColumnDef, TableFilterField, TableColumnPickerColumn } from '@/components/shared';
import type { Device, DeviceLicenseCheck, ApiError } from '@/types';
import {
  getDevices,
  createDevice,
  updateDevice,
  retireDevice,
  checkDeviceLicense,
} from '@/services/admin-service';

const DEVICE_TYPES = ['terminal', 'kiosk', 'mobile', 'scanner', 'printer'] as const;
const APP_CODES = ['STACK', 'FLOOR', 'FLIP', 'CONNECT'] as const;

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDeviceStatusBadge(status: string): { status: 'success' | 'danger' | 'neutral' | 'warning'; label: string } {
  switch (status) {
    case 'Active':
      return { status: 'success', label: 'Active' };
    case 'Retired':
      return { status: 'danger', label: 'Retired' };
    case 'Grace':
      return { status: 'warning', label: 'Grace' };
    default:
      return { status: 'neutral', label: status || 'Unknown' };
  }
}

interface DeviceFormData {
  deviceCode: string;
  deviceName: string;
  appCode: string;
  type: string;
  model: string;
  location: string;
  serialNumber: string;
  notes: string;
}

const emptyForm: DeviceFormData = {
  deviceCode: '',
  deviceName: '',
  appCode: 'STACK',
  type: 'terminal',
  model: '',
  location: '',
  serialNumber: '',
  notes: '',
};

export default function DevicesPage() {
  const queryClient = useQueryClient();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [confirmRetire, setConfirmRetire] = useState<Device | null>(null);
  const [formData, setFormData] = useState<DeviceFormData>(emptyForm);
  const [search, setSearch] = useState('');

  // ---- Filters & column visibility ----

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };
  const handleClearAllFilters = () => setFilters({});
  const toggleColumnVisibility = (key: string) => {
    setColumnVisibility((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const filterFields: TableFilterField[] = useMemo(() => [
    { key: 'AppCode', label: 'App', type: 'select', options: APP_CODES.map((c) => ({ value: c, label: c })) },
    { key: 'Type', label: 'Type', type: 'select', options: DEVICE_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })) },
    { key: 'Status', label: 'Status', type: 'select', options: [{ value: 'Active', label: 'Active' }, { value: 'Retired', label: 'Retired' }, { value: 'Grace', label: 'Grace' }] },
    { key: 'DeviceCode', label: 'Code', type: 'text' },
    { key: 'DeviceName', label: 'Device Name', type: 'text' },
    { key: 'Location', label: 'Location', type: 'text' },
  ], []);

  const pickerColumns: TableColumnPickerColumn[] = useMemo(() => [
    { key: 'DeviceCode', label: 'Code' },
    { key: 'DeviceName', label: 'Device Name' },
    { key: 'AppCode', label: 'App' },
    { key: 'Type', label: 'Type' },
    { key: 'Status', label: 'Status' },
    { key: 'Location', label: 'Location' },
    { key: 'LastSeen', label: 'Last Seen' },
    { key: 'CreatedAt', label: 'Registered' },
  ], []);

  const { data: devicesResponse, isLoading } = useQuery({
    queryKey: ['admin', 'devices'],
    queryFn: () => getDevices(),
  });

  const devices: Device[] = useMemo(() => devicesResponse?.data || [], [devicesResponse]);

  // ---- Filtered data ----

  const filteredDevices = useMemo(() => {
    let result = devices;

    // Apply search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (d) =>
          (d.DeviceCode && d.DeviceCode.toLowerCase().includes(s)) ||
          (d.DeviceName && d.DeviceName.toLowerCase().includes(s)) ||
          (d.Location && d.Location.toLowerCase().includes(s))
      );
    }

    // Apply column filters
    const activeFilters = Object.entries(filters).filter(([, v]) => v);
    if (activeFilters.length > 0) {
      result = result.filter((row) =>
        activeFilters.every(([key, value]) => {
          const rowVal = (row as any)[key];
          if (rowVal == null) return false;
          const field = filterFields.find((f) => f.key === key);
          if (field?.type === 'select') return String(rowVal) === value;
          return String(rowVal).toLowerCase().includes(value.toLowerCase());
        })
      );
    }

    return result;
  }, [devices, search, filters, filterFields]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Device>) => createDevice(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] });
      const warning = data.meta?.licenseWarning;
      if (warning) {
        toast.success(`Device registered. ${warning}`, { duration: 6000 });
      } else {
        toast.success('Device registered successfully');
      }
      handleCloseRegister();
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to register device');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ deviceId, data }: { deviceId: string; data: Partial<Device> }) =>
      updateDevice(deviceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] });
      toast.success('Device updated successfully');
      setEditDevice(null);
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to update device');
    },
  });

  const retireMutation = useMutation({
    mutationFn: retireDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'devices'] });
      toast.success('Device retired');
      setConfirmRetire(null);
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to retire device');
    },
  });

  const licenseMutation = useMutation({
    mutationFn: checkDeviceLicense,
    onSuccess: (data: { data: DeviceLicenseCheck }) => {
      const check = data.data;
      if (check.isOverLimit) {
        toast.error(
          `${check.appCode}: Over limit (${check.activeCount}/${check.maxAllowed}). Enforcement: ${check.enforcement}`,
          { duration: 5000 }
        );
      } else if (check.isAtLimit) {
        toast(`${check.appCode}: At limit (${check.activeCount}/${check.maxAllowed})`, {
          icon: '!',
          duration: 4000,
        });
      } else if (check.maxAllowed !== null) {
        toast.success(`${check.appCode}: ${check.activeCount}/${check.maxAllowed} devices used`);
      } else {
        toast.success(`${check.appCode}: ${check.activeCount} active devices (no limit set)`);
      }
    },
    onError: (error: ApiError) => {
      toast.error(error.response?.data?.error || 'Failed to check license');
    },
  });

  const handleCloseRegister = () => {
    setShowRegisterModal(false);
    setFormData(emptyForm);
  };

  const handleRegister = () => {
    if (!formData.deviceCode.trim()) {
      toast.error('Device code is required');
      return;
    }
    if (!formData.appCode) {
      toast.error('App code is required');
      return;
    }
    createMutation.mutate({
      deviceCode: formData.deviceCode.trim(),
      deviceName: formData.deviceName.trim() || undefined,
      appCode: formData.appCode,
      type: formData.type || undefined,
      model: formData.model.trim() || undefined,
      location: formData.location.trim() || undefined,
      serialNumber: formData.serialNumber.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    } as any);
  };

  const handleOpenEdit = (device: Device) => {
    setEditDevice(device);
    setFormData({
      deviceCode: device.DeviceCode,
      deviceName: device.DeviceName || '',
      appCode: device.AppCode,
      type: device.Type || 'terminal',
      model: device.Model || '',
      location: device.Location || '',
      serialNumber: device.SerialNumber || '',
      notes: device.Notes || '',
    });
  };

  const handleUpdate = () => {
    if (!editDevice) return;
    updateMutation.mutate({
      deviceId: editDevice.DeviceId,
      data: {
        deviceName: formData.deviceName.trim() || undefined,
        appCode: formData.appCode,
        type: formData.type || undefined,
        model: formData.model.trim() || undefined,
        location: formData.location.trim() || undefined,
        serialNumber: formData.serialNumber.trim() || undefined,
        notes: formData.notes.trim() || undefined,
      } as any,
    });
  };

  const handleCloseEdit = () => {
    setEditDevice(null);
    setFormData(emptyForm);
  };

  const updateField = (field: keyof DeviceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const columns: ColumnDef<Device>[] = useMemo(
    () => [
      {
        key: 'DeviceCode',
        label: 'Code',
        sortable: true,
        hidden: columnVisibility.DeviceCode === false,
        width: 140,
      },
      {
        key: 'DeviceName',
        label: 'Device Name',
        sortable: true,
        hidden: columnVisibility.DeviceName === false,
        width: 180,
        render: (val: string) => val || '-',
      },
      {
        key: 'AppCode',
        label: 'App',
        sortable: true,
        hidden: columnVisibility.AppCode === false,
        width: 100,
      },
      {
        key: 'Type',
        label: 'Type',
        sortable: true,
        hidden: columnVisibility.Type === false,
        width: 110,
        render: (val: string) => (
          <span className="capitalize">{val || '-'}</span>
        ),
      },
      {
        key: 'Status',
        label: 'Status',
        sortable: true,
        hidden: columnVisibility.Status === false,
        width: 110,
        render: (val: string) => {
          const { status, label } = getDeviceStatusBadge(val);
          return <StatusBadge status={status} label={label} size="sm" />;
        },
      },
      {
        key: 'Location',
        label: 'Location',
        sortable: true,
        hidden: columnVisibility.Location === false,
        width: 140,
        render: (val: string) => val || '-',
      },
      {
        key: 'LastSeen',
        label: 'Last Seen',
        sortable: true,
        hidden: columnVisibility.LastSeen === false,
        width: 160,
        render: (val: string | null) => formatDate(val),
      },
      {
        key: 'CreatedAt',
        label: 'Registered',
        sortable: true,
        hidden: columnVisibility.CreatedAt === false,
        width: 160,
        render: (val: string) => formatDate(val),
      },
      {
        key: '_actions',
        label: 'Actions',
        width: 200,
        noTruncate: true,
        sortable: false,
        render: (_val: unknown, row: Device) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
              className="p-1.5 text-semantic-text-faint hover:text-primary rounded hover:bg-interactive-hover"
              title="Edit"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <Button
              variant="ghost"
              size="sm"
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              onClick={(e) => { e.stopPropagation(); licenseMutation.mutate(row.AppCode); }}
              loading={licenseMutation.isPending}
            >
              License
            </Button>
            {row.Status !== 'Retired' && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5 text-danger" />}
                onClick={(e) => { e.stopPropagation(); setConfirmRetire(row); }}
              />
            )}
          </div>
        ),
      },
    ],
    [licenseMutation, columnVisibility]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const formFields = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Device Code *</label>
          <input
            type="text"
            value={formData.deviceCode}
            onChange={(e) => updateField('deviceCode', e.target.value)}
            disabled={!!editDevice}
            placeholder="e.g. WH-TERM-01"
            className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Device Name</label>
          <input
            type="text"
            value={formData.deviceName}
            onChange={(e) => updateField('deviceName', e.target.value)}
            placeholder="e.g. Warehouse Terminal 1"
            className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="device-appCode" className="block text-sm font-medium text-semantic-text-secondary mb-1">App Code *</label>
          <select
            id="device-appCode"
            value={formData.appCode}
            onChange={(e) => updateField('appCode', e.target.value)}
            className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
          >
            {APP_CODES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="device-type" className="block text-sm font-medium text-semantic-text-secondary mb-1">Device Type</label>
          <select
            id="device-type"
            value={formData.type}
            onChange={(e) => updateField('type', e.target.value)}
            className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Model</label>
          <input
            type="text"
            value={formData.model}
            onChange={(e) => updateField('model', e.target.value)}
            placeholder="e.g. Zebra TC21"
            className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="e.g. Warehouse A"
            className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Serial Number</label>
        <input
          type="text"
          value={formData.serialNumber}
          onChange={(e) => updateField('serialNumber', e.target.value)}
          placeholder="Device serial number"
          className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-semantic-text-secondary mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Additional notes about this device"
          rows={3}
          className="w-full px-3 py-2 bg-surface-overlay border border-border rounded-lg text-sm text-semantic-text-default placeholder:text-semantic-text-faint focus:outline-none focus:ring-2 focus:ring-interactive-focus-ring resize-none"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <TableCard
        title="All Devices"
        icon={<Smartphone className="w-4 h-4" />}
        count={filteredDevices.length}
        search={{ value: search, onChange: setSearch, placeholder: "Search devices by code, name, or location..." }}
        headerActions={
          <div className="flex items-center gap-1">
            <TableFilterDropdown
              fields={filterFields}
              values={filters}
              onChange={handleFilterChange}
              onClearAll={handleClearAllFilters}
            />
            <TableColumnPicker
              columns={pickerColumns}
              visibility={columnVisibility}
              onToggle={toggleColumnVisibility}
            />
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowRegisterModal(true)}>
              Register Device
            </Button>
          </div>
        }
      >
        <DataTable<Device>
          id="admin-devices"
          columns={columns}
          data={filteredDevices}
          rowKey="DeviceId"
          onRowClick={handleOpenEdit}
          emptyMessage="No devices registered"
          emptyIcon={Smartphone}
          embedded
          showColumnPicker={false}
          showFilters={false}
        />
      </TableCard>

      {/* Register Device Modal */}
      <Modal
        isOpen={showRegisterModal}
        onClose={handleCloseRegister}
        title="Register Device"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseRegister}>
              Cancel
            </Button>
            <Button onClick={handleRegister} loading={createMutation.isPending}>
              Register
            </Button>
          </>
        }
      >
        {formFields}
      </Modal>

      {/* Edit Device Modal */}
      <Modal
        isOpen={!!editDevice}
        onClose={handleCloseEdit}
        title={`Edit Device: ${editDevice?.DeviceCode || ''}`}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={handleCloseEdit}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </>
        }
      >
        {formFields}
      </Modal>

      {/* Confirm Retire Modal */}
      <Modal
        isOpen={!!confirmRetire}
        onClose={() => setConfirmRetire(null)}
        title="Retire Device"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRetire(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmRetire && retireMutation.mutate(confirmRetire.DeviceId)}
              loading={retireMutation.isPending}
            >
              Retire
            </Button>
          </>
        }
      >
        <p className="text-sm text-semantic-text-secondary">
          Are you sure you want to retire the device <strong>{confirmRetire?.DeviceName || confirmRetire?.DeviceCode}</strong>?
          Retired devices will no longer be able to connect.
        </p>
      </Modal>
    </div>
  );
}
