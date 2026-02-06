import React, { useEffect, useState, useRef, Suspense } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { DashboardSelector } from './components/Dashboard/DashboardSelector';
import { useThemeStore } from './stores/themeStore';
import { useBrandingStore } from './stores/brandingStore';
import { useDashboardStore } from './stores/dashboardStore';
import { useRedactStore } from './stores/redactStore';
import { WidgetRefreshProvider, WidgetRefreshContext } from './contexts/WidgetRefreshContext';

// Lazy load heavy components for code splitting
const Dashboard = React.lazy(() => import('./components/Dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const AdminPage = React.lazy(() => import('./components/Admin/AdminPage').then(m => ({ default: m.AdminPage })));
const KioskPage = React.lazy(() => import('./components/Kiosk').then(m => ({ default: m.KioskPage })));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
      </div>
    </div>
  );
}

// Edit mode toggle button component
function EditModeToggle() {
  const location = useLocation();
  const { mode, setMode } = useDashboardStore();
  const isOnDashboard = location.pathname === '/' || location.pathname.startsWith('/d/');

  if (!isOnDashboard) return null;

  const isEditMode = mode === 'edit';

  return (
    <button
      onClick={() => setMode(isEditMode ? 'view' : 'edit')}
      className={`p-2 rounded-md transition-colors ${
        isEditMode
          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      title={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
      aria-label={isEditMode ? 'Exit edit mode' : 'Enter edit mode'}
      aria-pressed={isEditMode}
    >
      {isEditMode ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      )}
    </button>
  );
}

// Refresh all widgets button
function RefreshAllButton() {
  const location = useLocation();
  const refreshContext = React.useContext(WidgetRefreshContext);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isOnDashboard = location.pathname === '/' || location.pathname.startsWith('/d/');

  if (!isOnDashboard) return null;

  const handleRefresh = async () => {
    if (!refreshContext || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshContext.refreshAll();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`p-2 rounded-md transition-colors ${
        isRefreshing
          ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      title="Refresh all widgets"
      aria-label="Refresh all widgets"
    >
      <svg
        className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    </button>
  );
}

// Redirect component for root path - redirects to current/default dashboard
function DashboardRedirect() {
  const { dashboards, currentDashboardId, fetchDashboards } = useDashboardStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (dashboards.length === 0) {
        await fetchDashboards();
      }
      setIsReady(true);
    };
    init();
  }, [dashboards.length, fetchDashboards]);

  if (!isReady) {
    return null; // Loading
  }

  // Find the dashboard to redirect to
  const targetId = currentDashboardId || dashboards.find(d => d.is_default)?.id || dashboards[0]?.id;

  if (targetId) {
    return <Navigate to={`/d/${targetId}`} replace />;
  }

  // No dashboards exist - show empty dashboard
  return <Dashboard />;
}

function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  return (
    <button
      onClick={toggleFullscreen}
      className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
      aria-pressed={isFullscreen}
    >
      {isFullscreen ? (
        // Compress icon (exit fullscreen)
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
        </svg>
      ) : (
        // Expand icon (enter fullscreen)
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
      )}
    </button>
  );
}

function RedactToggle() {
  const { isRedacted, toggleRedact } = useRedactStore();

  return (
    <button
      onClick={toggleRedact}
      className={`p-2 rounded-md transition-colors ${
        isRedacted
          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
          : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      title={isRedacted ? 'Show sensitive data' : 'Hide sensitive data'}
      aria-label={isRedacted ? 'Show sensitive data' : 'Hide sensitive data'}
      aria-pressed={isRedacted}
    >
      {/* Shield icon with checkmark when redacted, plain shield when not */}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    </button>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCurrentIcon = () => {
    switch (theme) {
      case 'light':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        );
      case 'dark':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.805A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Theme settings"
        aria-label="Theme settings"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {getCurrentIcon()}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50" role="menu" aria-label="Theme options">
          <button
            onClick={() => { setTheme('light'); setIsOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
              theme === 'light' ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-700 dark:text-gray-200'
            }`}
            role="menuitem"
            aria-current={theme === 'light' ? 'true' : undefined}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
            Light
          </button>
          <button
            onClick={() => { setTheme('dark'); setIsOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
              theme === 'dark' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-700 dark:text-gray-200'
            }`}
            role="menuitem"
            aria-current={theme === 'dark' ? 'true' : undefined}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
            Dark
          </button>
          <button
            onClick={() => { setTheme('system'); setIsOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
              theme === 'system' ? 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
            }`}
            role="menuitem"
            aria-current={theme === 'system' ? 'true' : undefined}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.805A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clipRule="evenodd" />
            </svg>
            System
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const location = useLocation();
  const { theme } = useThemeStore();
  const { branding, fetchBranding } = useBrandingStore();
  const [navCollapsed, setNavCollapsed] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const root = document.documentElement;
    const getSystemTheme = () =>
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const effectiveTheme = theme === 'system' ? getSystemTheme() : theme;

    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Fetch branding on mount
  useEffect(() => {
    fetchBranding();
  }, [fetchBranding]);

  // Check if on kiosk route - render without nav
  const isKioskRoute = location.pathname.startsWith('/k/');
  const isRedactedKioskRoute = location.pathname.startsWith('/r/');

  if (isKioskRoute || isRedactedKioskRoute) {
    return (
      <WidgetRefreshProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/k/:dashboardId" element={<KioskPage />} />
            <Route path="/r/:dashboardId" element={<KioskPage forceRedact />} />
          </Routes>
        </Suspense>
      </WidgetRefreshProvider>
    );
  }

  return (
    <WidgetRefreshProvider>
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      {/* Floating Navigation */}
      <nav className={`fixed top-4 left-4 right-4 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-lg rounded-xl transition-all duration-300 ${navCollapsed ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100'}`}>
        <div className="px-4">
          <div className="flex justify-between h-14">
            <div className="flex items-center">
              {/* Collapse button - left side */}
              <button
                onClick={() => setNavCollapsed(true)}
                className="p-2 mr-2 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Collapse menu"
                aria-label="Collapse navigation menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>

              {/* Logo and site name */}
              <div className="flex-shrink-0 flex items-center gap-2">
                <img
                  src={branding.logoUrl || '/images/peek-logo.png'}
                  alt="Logo"
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                {!branding.hideNavTitle && (
                  <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                    {branding.siteName || 'Peek'}
                  </span>
                )}
              </div>

              {/* Dashboard selector */}
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                <DashboardSelector />
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-1">
              <EditModeToggle />
              <RefreshAllButton />
              <RedactToggle />
              <FullscreenToggle />
              <ThemeToggle />
              <Link
                to="/admin"
                className={`p-2 rounded-md transition-colors ${
                  location.pathname === '/admin'
                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="Admin settings"
                aria-label="Admin settings"
                aria-current={location.pathname === '/admin' ? 'page' : undefined}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Collapsed nav expand button */}
      {navCollapsed && (
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => setNavCollapsed(false)}
            className="p-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Show menu"
            aria-label="Show navigation menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Main content */}
      <main className={`px-4 sm:px-6 lg:px-8 transition-all duration-300 ${navCollapsed ? 'pt-4' : 'pt-24'} pb-6`}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<DashboardRedirect />} />
            <Route path="/d/:dashboardId" element={<Dashboard />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
    </WidgetRefreshProvider>
  );
}

export default App;
