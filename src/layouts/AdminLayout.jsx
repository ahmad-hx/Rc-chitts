import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { memberService } from '../services/dbService';

export default function AdminLayout({ children, onLogout }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [allMembers, setAllMembers] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef(null);

  const {
    selectedMonth,
    setSelectedMonth,
    availableMonths,
    addNewMonth,
    currentCalendarMonth,
    isManuallySelected,
    resetToCurrentMonth,
  } = useBillingMonth();

  const navigate = useNavigate();
  const location = useLocation();

  // Keep isFullscreen in sync with browser controls (e.g. Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement
        )
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Toggle fullscreen handler using browser Fullscreen API safely
  const toggleFullscreen = async () => {
    try {
      if (
        !document.fullscreenElement &&
        !document.webkitFullscreenElement &&
        !document.mozFullScreenElement &&
        !document.msFullscreenElement
      ) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
          await docEl.mozRequestFullScreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

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

  // Load all members for global header search
  const loadAllMembers = async () => {
    try {
      const data = await memberService.getMembers();
      if (Array.isArray(data)) {
        setAllMembers(data);
      }
    } catch (e) {
      console.warn('Global search member load error:', e.message);
    }
  };

  useEffect(() => {
    loadAllMembers();
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global member search filter with full normalization
  const searchResults = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    if (!q) return [];

    const qDigits = q.replace(/\D/g, '');

    return allMembers.filter((m) => {
      // 1. Name match
      const name = String(m.name || '').toLowerCase();
      if (name.includes(q)) return true;

      // 2. Phone / WhatsApp match (string & digits match)
      const phone = String(m.phone || '');
      const wa = String(m.whatsapp || '');
      if (phone.toLowerCase().includes(q) || wa.toLowerCase().includes(q)) return true;

      if (qDigits.length >= 2) {
        const phoneDigits = phone.replace(/\D/g, '');
        const waDigits = wa.replace(/\D/g, '');
        if (phoneDigits.includes(qDigits) || waDigits.includes(qDigits)) return true;
      }

      // 3. Member ID match
      const id = String(m.id || '').toLowerCase();
      const memberKey = String(m.memberKey || '').toLowerCase();
      if (id.includes(q) || memberKey.includes(q)) return true;

      // 4. Group Name / Chit match
      const activeChits = (m.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
      const chitMatch = activeChits.some((c) => {
        const gId = String(c.groupId || '').toLowerCase();
        const cName = String(c.name || '').toLowerCase();
        const val = Number(c.totalChitValue || 100000);
        const lakhStr = `${(val / 100000).toFixed(0)} lakh`;

        if (gId && (gId === q || `group ${gId}` === q || `group${gId}` === q || gId.includes(q))) return true;
        if (cName && cName.includes(q)) return true;
        if (lakhStr.includes(q) || String(val).includes(q)) return true;

        return false;
      });

      return chitMatch;
    });
  }, [allMembers, globalSearchQuery]);

  const handleGlobalSearchSubmit = (e) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleSelectSearchResult(searchResults[0]);
    } else if (globalSearchQuery.trim()) {
      navigate(`/members?search=${encodeURIComponent(globalSearchQuery.trim())}`);
      setIsSearchFocused(false);
    }
  };

  const handleSelectSearchResult = (member) => {
    setIsSearchFocused(false);
    setGlobalSearchQuery('');
    navigate(`/members?memberId=${encodeURIComponent(member.id)}`);
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
    <div className="min-h-screen bg-[#F7F8F7] text-[#111111] font-sans selection:bg-[#285F52] selection:text-white">
      <div className="mx-auto flex min-h-screen max-w-[1920px]">
        {/* DESKTOP SIDEBAR (DARK #171918) */}
        <aside
          className={`sidebar sticky top-0 h-screen h-[100dvh] overflow-hidden hidden shrink-0 border-r border-[#262928] bg-[#171918] text-[#B8C0BC] lg:flex lg:flex-col transition-all duration-300 ${
            isSidebarCollapsed ? 'w-20' : 'w-72'
          }`}
        >
          {/* LOGO & SIDEBAR COLLAPSE TOGGLE (FIXED HEADER) */}
          <div className="sidebar-brand sidebar-header shrink-0 border-b border-[#262928] px-5 py-4 flex items-center justify-between">
            {!isSidebarCollapsed ? (
              <Logo size="md" href="/dashboard" className="no-underline text-white" />
            ) : (
              <div className="mx-auto">
                <Logo size="sm" showText={false} href="/dashboard" className="no-underline" />
              </div>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl bg-[#262928] border border-[#333735] text-[#B8C0BC] hover:text-white hover:bg-[#333735] transition-all cursor-pointer shrink-0"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label="Toggle sidebar"
            >
              {isSidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* NAV ITEMS (SCROLLABLE NAVIGATION) */}
          <nav className="sidebar-menu sidebar-navigation flex-1 min-h-0 space-y-4 px-3 py-4 overflow-y-auto overflow-x-hidden">
            {navigationSections.map((section) => (
              <div key={section.title} className="space-y-1">
                {!isSidebarCollapsed && (
                  <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#808A85] mb-1.5 mt-3 first:mt-0">
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
                          ? 'bg-[#285F52] text-white shadow-xs'
                          : 'text-[#B8C0BC] hover:bg-[#262928] hover:text-white'
                      } ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors shrink-0 ${
                          active ? 'bg-[#214D43] text-white' : 'bg-[#262928] text-[#808A85] group-hover:text-white'
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

          {/* FOOTER USER / LOGOUT (FIXED FOOTER) */}
          <div className="shrink-0 border-t border-[#262928] bg-[#121413] p-3 space-y-3">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#262928] bg-[#1C1F1E] p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#285F52] text-xs font-black text-white shrink-0">
                  RA
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-extrabold text-white">Raghavendra Admin</p>
                  <p className="truncate text-[10px] font-medium text-[#B8C0BC]">Enterprise Control</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center" title="Raghavendra Admin">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#285F52] text-xs font-black text-white">
                  RA
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              title={isSidebarCollapsed ? 'Logout' : undefined}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border border-[#FEF3F2]/20 bg-[#FEF3F2]/10 px-3 py-2 text-xs font-bold text-[#FEE4E2] transition-colors hover:bg-[#FEF3F2]/20 cursor-pointer ${
                isSidebarCollapsed ? 'px-0' : ''
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isSidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#F7F8F7]">
          {/* MOBILE TOP BAR */}
          <div className="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white/95 px-4 py-3 backdrop-blur-xs lg:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] text-[#111111] cursor-pointer active:scale-95 transition-transform"
                  aria-label="Toggle menu"
                >
                  {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#285F52] truncate">Raghavendra Chitts</p>
                  <h1 className="text-sm font-black text-[#111111] truncate">{getPageTitle()}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] text-[#667085] hover:text-[#111111]"
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
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div
                className="h-full w-[85%] max-w-xs bg-[#171918] p-5 text-[#B8C0BC] flex flex-col shadow-xl animate-in slide-in-from-left duration-200 border-r border-[#262928]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sidebar-brand sidebar-header shrink-0 mb-6 flex items-center justify-between border-b border-[#262928] pb-4">
                  <Logo size="sm" href="/dashboard" className="no-underline text-white" />
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#262928] border border-[#333735] text-[#B8C0BC] hover:text-white cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="sidebar-menu sidebar-navigation flex-1 min-h-0 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
                  {navigationSections.map((section) => (
                    <div key={section.title} className="space-y-1">
                      <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#808A85] mb-1.5 mt-3 first:mt-0">
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
                                ? 'bg-[#285F52] text-white shadow-xs'
                                : 'text-[#B8C0BC] hover:bg-[#262928] hover:text-white'
                            }`}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors shrink-0 ${
                                active ? 'bg-[#214D43] text-white' : 'bg-[#262928] text-[#808A85]'
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

                <div className="shrink-0 pt-4 border-t border-[#262928] space-y-3">
                  <div className="flex items-center gap-2.5 rounded-xl bg-[#1C1F1E] p-3 border border-[#262928]">
                    <ShieldCheck className="h-4 w-4 text-[#285F52] shrink-0" />
                    <span className="text-xs font-bold text-[#B8C0BC] truncate">Private Admin Session</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#FEF3F2]/20 bg-[#FEF3F2]/10 px-4 py-2.5 text-xs font-bold text-[#FEE4E2] hover:bg-[#FEF3F2]/20 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TOP HEADER (PURE WHITE #FFFFFF) */}
          <header className="border-b border-[#E5E7EB] bg-white px-4 sm:px-6 lg:px-8 py-3 lg:py-3.5 relative lg:sticky lg:top-0 z-20">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-3.5 lg:gap-4 w-full">
              {/* GLOBAL SEARCH BAR WITH DROPDOWN */}
              <div ref={searchContainerRef} className="relative w-full lg:flex-1 lg:min-w-[280px] lg:max-w-[620px]">
                <form onSubmit={handleGlobalSearchSubmit} className="relative w-full">
                  <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-[#667085] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search member name, phone, chit..."
                    value={globalSearchQuery}
                    onFocus={() => {
                      setIsSearchFocused(true);
                      loadAllMembers();
                    }}
                    onChange={(e) => {
                      setGlobalSearchQuery(e.target.value);
                      setIsSearchFocused(true);
                    }}
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white pl-10 pr-9 py-2 text-xs font-semibold text-[#111111] placeholder-[#667085] focus:border-[#285F52] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#285F52] transition-all"
                  />
                  {globalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setGlobalSearchQuery('');
                        setIsSearchFocused(false);
                      }}
                      className="absolute right-3 top-2.5 text-[#667085] hover:text-[#111111] cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </form>

                {/* SEARCH RESULTS DROPDOWN */}
                {isSearchFocused && globalSearchQuery.trim() && (
                  <div className="absolute left-0 top-full mt-2 z-50 rounded-2xl bg-white border border-[#E5E7EB] shadow-2xl overflow-hidden font-sans text-xs w-full sm:w-[540px] md:w-[600px] max-w-[calc(100vw-2rem)]">
                    {searchResults.length > 0 ? (
                      <div className="max-h-[380px] overflow-y-auto divide-y divide-[#E5E7EB]">
                        <div className="px-4 py-2.5 bg-[#F7F8F7] border-b border-[#E5E7EB] flex items-center justify-between text-[11px] font-extrabold">
                          <span className="uppercase tracking-wider font-black text-[#111111]">Matching Members ({searchResults.length})</span>
                          <span className="text-[10px] font-semibold text-[#667085]">Click to open profile</span>
                        </div>
                        {searchResults.map((m) => {
                          const activeChits = (m.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');
                          const isMulti = m.classification === 'MULTIPLE' || activeChits.length > 1;

                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectSearchResult(m)}
                              className="w-full px-4 py-3.5 text-left hover:bg-[#F7F8F7] active:bg-[#EEF6F3] transition-colors flex items-start justify-between gap-3 cursor-pointer group"
                            >
                              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                <div className="w-9 h-9 rounded-xl bg-[#EEF6F3] text-[#285F52] font-black text-sm flex items-center justify-center shrink-0 border border-[#BFD8D0] group-hover:bg-[#285F52] group-hover:text-white transition-colors mt-0.5">
                                  {m.name ? m.name.charAt(0).toUpperCase() : 'M'}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  {/* PRIMARY MEMBER NAME */}
                                  <p className="text-sm font-black text-[#111111] group-hover:text-[#285F52] transition-colors leading-snug break-words">
                                    {m.name}
                                  </p>

                                  {/* PHONE NUMBER */}
                                  {m.phone && (
                                    <p className="text-xs font-bold font-mono text-[#667085] leading-tight">
                                      {m.phone}
                                    </p>
                                  )}

                                  {/* BADGES ROW */}
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    {isMulti ? (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-[#F7F8F7] text-[#111111] border border-[#E5E7EB]">
                                        Multiple Chits • {activeChits.length} Active Chits
                                      </span>
                                    ) : activeChits.length === 1 ? (
                                      (() => {
                                        const c = activeChits[0];
                                        const valLakh = (c.totalChitValue || 100000) / 100000;
                                        return (
                                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-[#EEF6F3] text-[#285F52] border border-[#BFD8D0]">
                                            ₹{valLakh} Lakh Group {c.groupId || 'I'}
                                          </span>
                                        );
                                      })()
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-[#F7F8F7] text-[#667085] border border-[#E5E7EB]">
                                        No Active Chits
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="pt-1.5 shrink-0 text-[#98A2B3] group-hover:text-[#285F52] transition-colors">
                                <ChevronRight className="h-5 w-5" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs font-bold text-[#667085] bg-white">
                        No members found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT CONTROLS WRAPPER */}
              <div className="flex flex-wrap items-center justify-between sm:justify-start lg:justify-end gap-2.5 sm:gap-3 shrink-0">
                {/* MONTH SELECTOR */}
                <div className="flex items-center gap-2 rounded-xl border border-[#BFD8D0] bg-[#EEF6F3] px-3.5 py-1.5 shadow-2xs shrink-0 w-full sm:w-[320px]">
                  <CalendarIcon className="h-4 w-4 text-[#285F52] shrink-0" />
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase text-[#285F52] tracking-wider shrink-0">MONTH:</span>
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
                      className="bg-transparent text-xs font-black text-[#111111] focus:outline-none cursor-pointer pr-1 flex-1 min-w-0 truncate"
                    >
                      {availableMonths.map((m) => (
                        <option key={m} value={m}>
                          {m === currentCalendarMonth ? `${m} (Current)` : m}
                        </option>
                      ))}
                      <option value="__NEW__">+ Add Custom Month...</option>
                    </select>
                  </div>
                  {isManuallySelected && (
                    <button
                      type="button"
                      onClick={resetToCurrentMonth}
                      title="Reset to current calendar month"
                      className="text-[10px] font-extrabold text-[#285F52] hover:bg-[#285F52] hover:text-white transition-colors shrink-0 bg-white px-1.5 py-0.5 rounded-md border border-[#BFD8D0] cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
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
                    className="flex items-center gap-1.5 sm:gap-2 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#F7F8F7] transition-colors cursor-pointer shrink-0"
                    title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                  >
                    {isSidebarCollapsed ? <ChevronsRight className="h-4 w-4 text-[#285F52]" /> : <ChevronsLeft className="h-4 w-4 text-[#285F52]" />}
                    <span>{isSidebarCollapsed ? 'Expand' : 'Collapse'}</span>
                  </button>

                  {/* FULLSCREEN BUTTON */}
                  <button
                    onClick={toggleFullscreen}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] text-[#667085] hover:text-[#111111] hover:bg-[#F7F8F7] transition-all cursor-pointer shrink-0"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Fullscreen'}
                    aria-label="Toggle fullscreen"
                  >
                    {isFullscreen ? <Minimize className="h-4 w-4 text-[#285F52]" /> : <Maximize className="h-4 w-4 text-[#285F52]" />}
                  </button>

                  {/* NOTIFICATION INDICATOR */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => navigate('/whatsapp')}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] text-[#667085] hover:text-[#111111] hover:bg-[#F7F8F7] transition-all cursor-pointer"
                      title="Notifications"
                    >
                      <Bell className="h-4 w-4 text-[#667085]" />
                    </button>
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#285F52] ring-2 ring-white"></span>
                  </div>
                </div>

                {/* ADMIN PROFILE PILL */}
                <div className="flex items-center gap-2.5 rounded-xl border border-[#E5E7EB] bg-[#F7F8F7] px-3 py-1.5 shrink-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#285F52] text-[10px] font-black text-white shrink-0">
                    RA
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-[#111111] leading-tight truncate">Raghavendra Admin</p>
                    <p className="text-[9px] font-semibold text-[#285F52] leading-tight flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#285F52] animate-pulse"></span> System Active
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* PAGE CONTENT CONTAINER */}
          <div className="flex-1 min-h-[calc(100vh-4.5rem)] p-6 md:p-10 pb-24 lg:pb-10">
            {children}
          </div>

          {/* MOBILE BOTTOM NAVIGATION BAR */}
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E7EB] bg-white/95 px-2 py-2 backdrop-blur-xs lg:hidden">
            <div className="mx-auto flex max-w-md items-center justify-around gap-1">
              {navigationItems.slice(0, 6).map((item) => {
                const Icon = item.icon;
                const active = isActivePath(item.path);

                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`flex min-h-[44px] min-w-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[9px] font-bold transition-all ${
                      active ? 'bg-[#EEF6F3] text-[#285F52] border border-[#BFD8D0]' : 'text-[#667085] hover:text-[#111111]'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-[#285F52]' : ''}`} />
                    <span className="truncate max-w-[55px]">{item.name}</span>
                  </Link>
                );
              })}

              <button
                onClick={handleLogout}
                className="flex min-h-[44px] min-w-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[9px] font-bold text-[#667085] hover:text-[#B42318] cursor-pointer"
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

