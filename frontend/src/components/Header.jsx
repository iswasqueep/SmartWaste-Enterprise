import { Bell, Menu, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const names = {
  '/': 'Dashboard',
  '/requests': 'Collection Requests',
  '/recycling': 'Recycling Management',
  '/reports': 'Reports & Analytics',
  '/users': 'User Management',
  '/settings': 'System Settings',
};

export default function Header() {
  const location = useLocation();
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button className="icon-btn mobile-menu" aria-label="Open navigation"><Menu size={20} /></button>
        <div>
          <h1>{names[location.pathname] || 'WasteMS'}</h1>
          <p>Smart, sustainable and connected waste operations</p>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="search-box">
          <Search size={18} />
          <input placeholder="Search..." />
        </div>
        <button className="date-chip">May 20 – May 26, 2025</button>
        <button className="icon-btn" aria-label="Notifications"><Bell size={19} /></button>
      </div>
    </header>
  );
}
