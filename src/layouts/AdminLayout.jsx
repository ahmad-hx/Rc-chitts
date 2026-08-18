import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Layers,
  IndianRupee,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import Logo from '../components/Logo';

export default function AdminLayout({ children, onLogout }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navigationItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Members', path: '/members', icon: Users },
    { name: 'Chits', path: '/chits', icon: Layers },
    { name: 'Payments', path: '/payments', icon: IndianRupee },
    { name: 'WhatsApp / SMS', path: '/whatsapp', icon: MessageSquare },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      onLogout?.();
      navigate('/login');
    }
  };

  const isActivePath = (path) => location.pathname === path;

  const getPageTitle = () => {
    const item = navigationItems.find(n => n.path === location.pathname);
    return item ? item.name : 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950 text-slate-200 lg:flex lg:flex-col shadow-2xl">
          <div className="border-b border-slate-800 px-6 py-5 flex items-center justify-between">
            <Logo size="md" href="/dashboard" className="no-underline" />
          </div>

          <nav className="flex-1 space-y-1.5 px-4 py-6">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.path);

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`group flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                    active
                      ? 'bg-sky-500/20 text-white shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)]'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${active ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400 group-hover:text-sky-300'}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                  </span>
                  <span className="flex-1 truncate">{item.name}</span>
                  {active && <ChevronRight className="h-4 w-4 text-sky-400" />}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-800 bg-slate-900/80 p-4 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-xs font-bold text-white shadow-md shadow-sky-500/20 shrink-0">
                RA
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">Raghavendra Admin</p>
                <p className="truncate text-[11px] text-slate-400">System Operator</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 min-w-0 flex flex-col bg-slate-50">
          {/* MOBILE TOP BAR */}
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl lg:hidden shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shadow-xs cursor-pointer active:scale-95 transition-transform"
                  aria-label="Toggle menu"
                >
                  {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-sky-700 truncate">Raghavendra Chitts</p>
                  <h1 className="text-sm font-black text-slate-900 truncate">{getPageTitle()}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <Logo size="sm" href="/dashboard" className="no-underline" />
              </div>
            </div>
          </div>

          {/* MOBILE NAVIGATION DRAWER */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs lg:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="h-full w-[82%] max-w-xs bg-slate-950 p-5 text-slate-200 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
                  <Logo size="sm" href="/dashboard" className="no-underline" />
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActivePath(item.path);
                    return (
                      <Link
                        key={item.name}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all cursor-pointer ${
                          active ? 'bg-sky-500/20 text-white border border-sky-500/40 shadow-xs' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0 text-sky-400" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center gap-2.5 rounded-2xl bg-slate-900/80 p-3 border border-slate-800">
                    <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-300 truncate">Private Admin Session</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-200 hover:bg-red-500/20 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* DESKTOP TOP HEADER */}
          <header className="hidden lg:flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4 sticky top-0 z-20 shadow-xs">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Raghavendra Chitts Admin</p>
              <h1 className="text-xl font-bold text-slate-900">{getPageTitle()}</h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>System Active</span>
              </div>
            </div>
          </header>

          {/* PAGE CONTENT CONTAINER */}
          <div className="flex-1 min-h-[calc(100vh-5rem)] p-4 sm:p-6 md:p-8 pb-24 lg:pb-8">
            {children}
          </div>

          {/* MOBILE BOTTOM NAVIGATION BAR */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur-xl lg:hidden shadow-lg">
            <div className="mx-auto flex max-w-md items-center justify-around gap-1">
              {navigationItems.slice(0, 5).map((item) => {
                const Icon = item.icon;
                const active = isActivePath(item.path);

                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex min-h-[44px] min-w-[54px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[10px] font-bold transition-all ${
                      active ? 'bg-sky-500/15 text-sky-800' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-sky-600' : ''}`} />
                    <span className="truncate max-w-[60px]">{item.name.replace(' / SMS', '')}</span>
                  </Link>
                );
              })}

              <button
                onClick={handleLogout}
                className="flex min-h-[44px] min-w-[54px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-red-600 cursor-pointer"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        </main>
      </div>
    </div>
  );
}
