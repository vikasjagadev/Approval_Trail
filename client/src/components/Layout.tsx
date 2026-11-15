import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  LogOut,
  User as UserIcon,
  CheckCircle,
  Inbox,
  FilePlus,
  Shield,
  Layers,
  Users,
  Menu,
  X,
  Clock,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useNotifications, useMarkNotificationsRead, useInbox } from '../api/hooks';
import { format } from 'date-fns';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { data: notifications = [] } = useNotifications();
  const { data: inboxItems = [] } = useInbox();
  const markReadMutation = useMarkNotificationsRead();

  const unreadNotifs = notifications.filter((n) => !n.read);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: Layers, roles: ['ADMIN', 'MANAGER', 'APPROVER', 'REQUESTER'] },
    { name: 'My Requests', path: '/my-requests', icon: Clock, roles: ['ADMIN', 'MANAGER', 'APPROVER', 'REQUESTER'] },
    {
      name: 'Approval Inbox',
      path: '/approvals',
      icon: Inbox,
      badge: inboxItems.length > 0 ? inboxItems.length : undefined,
      roles: ['ADMIN', 'MANAGER', 'APPROVER', 'REQUESTER'],
    },
    { name: 'Audit Log', path: '/audit', icon: Shield, roles: ['ADMIN', 'MANAGER'] },
    { name: 'Request Types', path: '/admin/request-types', icon: Layers, roles: ['ADMIN'] },
    { name: 'Users', path: '/admin/users', icon: Users, roles: ['ADMIN'] },
  ];

  const allowedNavLinks = navLinks.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/dashboard" className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  AT
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-gray-900 tracking-tight leading-none">
                    ApprovalTrail
                  </span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                    Verified Approvals
                  </span>
                </div>
              </Link>

              {/* Desktop Nav Links */}
              <div className="hidden md:ml-8 md:flex md:space-x-1">
                {allowedNavLinks.map((link) => {
                  const isActive = location.pathname === link.path;
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{link.name}</span>
                      {link.badge !== undefined && (
                        <span className="ml-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-amber-500 rounded-full">
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Right side icons */}
            <div className="flex items-center gap-3">
              <Link
                to="/requests/new"
                className="hidden sm:inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-md text-sm font-medium shadow-sm transition-colors"
              >
                <FilePlus className="h-4 w-4" />
                <span>New Request</span>
              </Link>

              {/* Notifications Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100 relative focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifs.length > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
                      {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {isNotifOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 w-80 sm:w-96 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900">Notifications</h4>
                      {unreadNotifs.length > 0 && (
                        <button
                          type="button"
                          onClick={() => markReadMutation.mutate()}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-gray-400 p-4 text-center">No notifications</p>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-3 text-xs flex gap-2 ${
                              notif.read ? 'bg-white' : 'bg-indigo-50/50'
                            }`}
                          >
                            <div className="mt-0.5">
                              <CheckCircle
                                className={`h-4 w-4 ${notif.read ? 'text-gray-400' : 'text-indigo-600'}`}
                              />
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-800">{notif.message}</p>
                              <span className="text-[10px] text-gray-400 mt-1 block">
                                {format(new Date(notif.createdAt), 'MMM d, HH:mm')}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Dropdown / Info */}
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-sm font-semibold text-gray-900 leading-tight">
                    {user?.name}
                  </span>
                  <span className="text-[11px] text-indigo-600 font-medium">{user?.role}</span>
                </div>
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                  {user?.name ? user.name.charAt(0) : <UserIcon className="h-4 w-4" />}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log out"
                  className="p-1.5 rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 focus:outline-none"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 px-2 pt-2 pb-3 space-y-1 bg-white">
            <Link
              to="/requests/new"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-white bg-indigo-600 text-center"
            >
              + New Request
            </Link>
            {allowedNavLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{link.name}</span>
                    {link.badge !== undefined && (
                      <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                        {link.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs text-gray-500">
        ApprovalTrail &copy; {new Date().getFullYear()} &mdash; Configurable Audit-Verified Approval Portal
      </footer>
    </div>
  );
};

