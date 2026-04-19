import { Outlet } from 'react-router-dom';
import Sidebar from './sidebar';
import Header from './header';
import { useSidebar } from '@/hooks/use-sidebar';

export default function AdminLayout() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex h-screen bg-dark overflow-hidden">
      <Sidebar />
      <div
        className="flex-1 flex flex-col min-w-0 transition-all duration-200 ease-in-out"
        style={{ marginLeft: isCollapsed ? 64 : 240 }}
      >
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
