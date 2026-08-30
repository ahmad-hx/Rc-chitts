import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Calculator,
  Users,
  Layers,
  IndianRupee,
  MessageSquare,
  History as HistoryIcon,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck,
  Search,
  Maximize,
  Minimize,
  Bell,
  Clock,
  CircleDollarSign,
} from 'lucide-react';
import { Calendar as CalendarIcon } from 'lucide-react';
import Logo from '../components/Logo';
import { useBillingMonth } from '../context/BillingMonthContext';

export default function AdminLayout({ children, onLogout }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  const { selectedMonth, setSelectedMonth, availableMonths, addNewMonth } = useBillingMonth();

  const navigate = useNavigate();
  const location = useLocation();

  const navigationSections = [
    {
      title: 'MAIN',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Members', path: '/members', icon: Users },
        { name: 'Chit Groups', path: '/chits', icon: Layers },
        { name: 'Payments', path: '/payments', icon: IndianRupee },
        { name: 'Pending Payments', path: '/pending-payments', icon: Clock },
        { name: 'Pending History', path: '/pending-history', icon: HistoryIcon },
      ],
    },
    {
      title: 'TOOLS',
      items: [
        { name: 'Calculations', path: '/calculations', icon: Calculator },
        { name: 'WhatsApp', path: '/whatsapp', icon: MessageSquare },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { name: 'Settings', path: '/settings', icon: Settings },
        { name: 'History', path: '/history', icon: HistoryIcon },
      ],
    },
  ];

  const navigationItems = navigationSections.flatMap((s) => s.items);
  const allNavigationItems = navigationItems;

  // Browser Fullscreen Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen mode error:', err.message);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Exit fullscreen error:', err.message);
        });
      }
    }
  };

  const handleGlobalSearchSubmit = (e) => {
    e.preventDefault();
    if (globalSearchQuery.trim()) {
      navigate(`/members?search=${encodeURIComponent(globalSearchQuery.trim())}`);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      onLogout?.();
      navigate('/login');
    }
  };

  const isActivePath = (path) => {
    if (path.includes('?')) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };

  const getPageTitle = () => {
    const item = allNavigationItems.find((n) => n.path === location.pathname);
    return item ? item.name : 'Dashboard';
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#1C1C1A] font-sans selection:bg-[#2F5D50] selection:text-white">
      <div className="mx-auto flex min-h-screen max-w-[1920px]">
        {/* DESKTOP SIDEBAR (CHARCOAL #1C1C1A) */}
        <aside
          className={`hidden shrink-0 border-r border-[#2A2A28] bg-[#1C1C1A] text-[#D8D8D3] lg:flex lg:flex-col transition-all duration-300 ${
            isSidebarCollapsed ? 'w-20' : 'w-72'
          }`}
        >
          {/* LOGO & SIDEBAR COLLAPSE TOGGLE */}
          <div className="border-b border-[#2A2A28] px-5 py-4 flex items-center justify-between">
            {!isSidebarCollapsed ? (
              <Logo size="md" href="/dashboard" className="no-underline text-white" />
            ) : (
              <div className="mx-auto">
                <Logo size="sm" showText={false} href="/dashboard" className="no-underline" />
              </div>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl bg-[#2A2A28] border border-[#3A3A36] text-[#D8D8D3] hover:text-white hover:bg-[#3A3A36] transition-all cursor-pointer"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label="Toggle sidebar"
            >
              {isSidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* NAV ITEMS */}
          <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto">
            {navigationSections.map((section) => (
              <div key={section.title} className="space-y-1">
                {!isSidebarCollapsed && (
                  <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#80807B] mb-1.5 mt-3 first:mt-0">
                    {section.title}
                  </p>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActivePath(item.path);

                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      title={isSidebarCollapsed ? item.name : undefined}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all duration-150 ${
                        active
                          ? 'bg-[#2F5D50] text-white shadow-xs'
                          : 'text-[#D8D8D3] hover:bg-[#2A2A28] hover:text-white'
                      } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors shrink-0 ${
                          active ? 'bg-[#24493F] text-white' : 'bg-[#2A2A28] text-[#959590] group-hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </span>
                      {!isSidebarCollapsed && <span className="flex-1 truncate">{item.name}</span>}
                      {!isSidebarCollapsed && active && <ChevronRight className="h-3.5 w-3.5 text-emerald-200 shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* FOOTER USER / LOGOUT */}
          <div className="border-t border-[#2A2A28] bg-[#171715] p-3 space-y-3">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#2A2A28] bg-[#222220] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2F5D50] text-xs font-black text-white shrink-0">
                  RA
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-white">Raghavendra Admin</p>
                  <p className="truncate text-[10px] font-medium text-[#959590]">Enterprise Control</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center" title="Raghavendra Admin">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2F5D50] text-xs font-black text-white">
                  RA
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              title={isSidebarCollapsed ? 'Logout' : undefined}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border border-[#A33A3A]/30 bg-[#A33A3A]/10 px-3 py-2 text-xs font-bold text-red-300 transition-colors hover:bg-[#A33A3A]/20 cursor-pointer ${
                isSidebarCollapsed ? 'px-0' : ''
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA (WARM OFF-WHITE #F7F7F5) */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#F7F7F5]">
          {/* MOBILE TOP BAR */}
          <div className="sticky top-0 z-30 border-b border-[#E5E5E1] bg-white/95 px-4 py-3 backdrop-blur-xs lg:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] text-[#1C1C1A] cursor-pointer active:scale-95 transition-transform"
                  aria-label="Toggle menu"
                >
                  {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#2F5D50] truncate">Raghavendra Chitts</p>
                  <h1 className="text-sm font-black text-[#1C1C1A] truncate">{getPageTitle()}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] text-[#6B6B67] hover:text-[#1C1C1A]"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
                <Logo size="sm" href="/dashboard" className="no-underline" />
              </div>
            </div>
          </div>

          {/* MOBILE NAVIGATION DRAWER */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 z-50 bg-[#1C1C1A]/60 backdrop-blur-xs lg:hidden transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div
                className="h-full w-[85%] max-w-xs bg-[#1C1C1A] p-5 text-[#D8D8D3] flex flex-col shadow-xl animate-in slide-in-from-left duration-200 border-r border-[#2A2A28]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-6 flex items-center justify-between border-b border-[#2A2A28] pb-4">
                  <Logo size="sm" href="/dashboard" className="no-underline text-white" />
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2A2A28] border border-[#3A3A36] text-[#D8D8D3] hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="flex-1 space-y-4 overflow-y-auto pr-1">
                  {navigationSections.map((section) => (
                    <div key={section.title} className="space-y-1">
                      <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#80807B] mb-1.5 mt-3 first:mt-0">
                        {section.title}
                      </p>
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActivePath(item.path);
                        return (
                          <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                              active
                                ? 'bg-[#2F5D50] text-white shadow-xs'
                                : 'text-[#D8D8D3] hover:bg-[#2A2A28] hover:text-white'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors shrink-0 ${
                                active ? 'bg-[#24493F] text-white' : 'bg-[#2A2A28] text-[#959590]'
                              }`}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                            </span>
                            <span className="truncate flex-1">{item.name}</span>
                            {active && <ChevronRight className="h-3.5 w-3.5 text-emerald-200 shrink-0" />}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                </nav>

                <div className="pt-4 border-t border-[#2A2A28] space-y-3">
                  <div className="flex items-center gap-2.5 rounded-xl bg-[#222220] p-3 border border-[#2A2A28]">
                    <ShieldCheck className="h-4 w-4 text-[#2F6B4F] shrink-0" />
                    <span className="text-xs font-bold text-[#D8D8D3] truncate">Private Admin Session</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#A33A3A]/30 bg-[#A33A3A]/10 px-4 py-2.5 text-xs font-bold text-red-200 hover:bg-[#A33A3A]/20 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TOP HEADER (PURE WHITE #FFFFFF) */}
          <header className="border-b border-[#E5E5E1] bg-white px-4 sm:px-6 lg:px-8 py-3 lg:py-3.5 relative lg:sticky lg:top-0 z-20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-3.5 lg:gap-4 w-full">
              {/* GLOBAL SEARCH BAR */}
              <form onSubmit={handleGlobalSearchSubmit} className="relative w-full lg:flex-1 lg:min-w-[280px] lg:max-w-[620px]">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#959590] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search member name, phone, chit..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] pl-10 pr-4 py-2 text-xs font-semibold text-[#1C1C1A] placeholder-[#959590] focus:border-[#2F5D50] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2F5D50] transition-all"
                />
              </form>

              {/* RIGHT CONTROLS WRAPPER */}
              <div className="flex flex-wrap items-center justify-between sm:justify-start lg:justify-end gap-2.5 sm:gap-3 shrink-0">
                {/* EDITABLE ACTIVE BILLING MONTH SELECTOR */}
                <div className="flex items-center gap-2 rounded-xl border border-[#2F5D50]/30 bg-[#EDF7F0] px-3.5 py-1.5 shadow-2xs shrink-0 w-full sm:w-[300px]">
                  <CalendarIcon className="h-4 w-4 text-[#2F5D50] shrink-0" />
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase text-[#2F5D50] tracking-wider shrink-0">Month:</span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          const m = window.prompt('Enter new billing month name (e.g. November 2026):');
                          if (m) addNewMonth(m);
                        } else {
                          setSelectedMonth(e.target.value);
                        }
                      }}
                      className="bg-transparent text-xs font-black text-[#1C1C1A] focus:outline-none cursor-pointer pr-1 flex-1 min-w-0 truncate"
                    >
                      {availableMonths.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                      <option value="__NEW__">+ Add New Month...</option>
                    </select>
                  </div>
                </div>

                {/* ACTION BUTTONS GROUP */}
                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                  {/* SIDEBAR COLLAPSE / EXPAND CONTROL BUTTON */}
                  <button
                    onClick={() => {
                      if (window.innerWidth < 1024) {
                        setIsMobileMenuOpen(!isMobileMenuOpen);
                      } else {
                        setIsSidebarCollapsed(!isSidebarCollapsed);
                      }
                    }}
                    className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-1.5 text-xs font-bold text-[#1C1C1A] hover:bg-[#F2F2EF] transition-colors cursor-pointer shrink-0"
                    title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                  >
                    {isSidebarCollapsed ? <ChevronsRight className="h-4 w-4 text-[#2F5D50]" /> : <ChevronsLeft className="h-4 w-4 text-[#2F5D50]" />}
                    <span>{isSidebarCollapsed ? 'Expand' : 'Collapse'}</span>
                  </button>

                  {/* FULLSCREEN BUTTON */}
                  <button
                    onClick={toggleFullscreen}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] text-[#6B6B67] hover:text-[#1C1C1A] hover:bg-[#F2F2EF] transition-all cursor-pointer shrink-0"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Fullscreen'}
                    aria-label="Toggle fullscreen"
                  >
                    {isFullscreen ? <Minimize className="h-4 w-4 text-[#2F5D50]" /> : <Maximize className="h-4 w-4 text-[#2F5D50]" />}
                  </button>

                  {/* NOTIFICATION INDICATOR */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => navigate('/whatsapp')}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] text-[#6B6B67] hover:text-[#1C1C1A] hover:bg-[#F2F2EF] transition-all cursor-pointer"
                      title="Notifications"
                    >
                      <Bell className="h-4 w-4 text-[#6B6B67]" />
                    </button>
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#2F6B4F] ring-2 ring-white"></span>
                  </div>
                </div>

                {/* ADMIN PROFILE PILL */}
                <div className="flex items-center gap-2.5 rounded-xl border border-[#E5E5E1] bg-[#F7F7F5] px-3 py-1.5 shrink-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2F5D50] text-[10px] font-black text-white shrink-0">
                    RA
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-[#1C1C1A] leading-tight truncate">Raghavendra Admin</p>
                    <p className="text-[9px] font-semibold text-[#2F6B4F] leading-tight flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2F6B4F] animate-pulse"></span> System Active
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* PAGE CONTENT CONTAINER WITH GENEROUS 32PX / 40PX SPACING */}
          <div className="flex-1 min-h-[calc(100vh-4.5rem)] p-6 md:p-10 pb-24 lg:pb-10">
            {children}
          </div>

          {/* MOBILE BOTTOM NAVIGATION BAR */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E5E1] bg-white/95 px-2 py-2 backdrop-blur-xs lg:hidden">
            <div className="mx-auto flex max-w-md items-center justify-around gap-1">
              {navigationItems.slice(0, 6).map((item) => {
                const Icon = item.icon;
                const active = isActivePath(item.path);

                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex min-h-[44px] min-w-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[9px] font-bold transition-all ${
                      active ? 'bg-[#DDE8E2] text-[#2F5D50] border border-[#2F5D50]/30' : 'text-[#6B6B67] hover:text-[#1C1C1A]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-[#2F5D50]' : ''}`} />
                    <span className="truncate max-w-[55px]">{item.name}</span>
                  </Link>
                );
              })}

              <button
                onClick={handleLogout}
                className="flex min-h-[44px] min-w-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[9px] font-bold text-[#6B6B67] hover:text-[#A33A3A] cursor-pointer"
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

