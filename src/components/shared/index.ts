// Re-export shared components from softbits-shared
export { Button, Card, Modal, LoadingSpinner, FullPageSpinner, EmptyState, StatusBadge, Tabs, SearchInput, DataTable, PageHeader, TableCard, TableFilterDropdown, TableColumnPicker } from '@shared/components';
export type { ButtonProps, CardProps, ModalProps, LoadingSpinnerProps, EmptyStateProps, StatusBadgeProps, TabsProps, TabItem, SearchInputProps, DataTableProps, ColumnDef, PageHeaderProps, TableCardProps, TableCardSearchProps, TableFilterDropdownProps, TableFilterField, TableColumnPickerProps, TableColumnPickerColumn } from '@shared/components';

// Admin-local shared components
export { PageStatusBar } from './page-status-bar';
export type { PageStatusBarProps, StatusBarItem, StatusBarBadgeItem, StatusBarTextItem } from './page-status-bar';
