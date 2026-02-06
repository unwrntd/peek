import React, { useState, useEffect, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useDashboardStore } from '../../stores/dashboardStore';
import { useRedactStore } from '../../stores/redactStore';
import { dashboardsApi } from '../../api/client';
import { Dashboard } from '../Dashboard/Dashboard';
import { KioskControls } from './KioskControls';

// Check if a string is a valid UUID
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

interface KioskPageProps {
  forceRedact?: boolean;
}

export function KioskPage({ forceRedact = false }: KioskPageProps) {
  const { dashboardId: paramValue } = useParams<{ dashboardId: string }>();
  const { setMode, setCurrentDashboard, dashboards, fetchDashboards } = useDashboardStore();
  const { setRedacted } = useRedactStore();
  const [controlsVisible, setControlsVisible] = useState(true);
  const [resolvedDashboardId, setResolvedDashboardId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const hideTimeoutRef = useRef<number | null>(null);

  // Resolve the dashboard ID from param (either UUID or slug)
  useEffect(() => {
    async function resolveDashboard() {
      if (!paramValue) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // If it looks like a UUID, use it directly
      if (isUUID(paramValue)) {
        setResolvedDashboardId(paramValue);
        setLoading(false);
        return;
      }

      // Otherwise, try to look it up as a slug
      try {
        const dashboard = await dashboardsApi.getBySlug(paramValue);
        setResolvedDashboardId(dashboard.id);
        setLoading(false);
      } catch {
        setNotFound(true);
        setLoading(false);
      }
    }

    resolveDashboard();
  }, [paramValue]);

  // Set the current dashboard once resolved
  useEffect(() => {
    if (resolvedDashboardId) {
      setCurrentDashboard(resolvedDashboardId);
    }
  }, [resolvedDashboardId, setCurrentDashboard]);

  // Load dashboards list if not loaded
  useEffect(() => {
    if (dashboards.length === 0) {
      fetchDashboards();
    }
  }, [dashboards.length, fetchDashboards]);

  // Always force view mode in kiosk
  useEffect(() => {
    setMode('view');
  }, [setMode]);

  // Force redaction when forceRedact prop is true
  useEffect(() => {
    if (forceRedact) {
      setRedacted(true);
    }
  }, [forceRedact, setRedacted]);

  // Auto-hide controls after inactivity
  useEffect(() => {
    const handleActivity = () => {
      setControlsVisible(true);

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      hideTimeoutRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    };

    // Track mouse movement and touch
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Start the timer
    handleActivity();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Redirect if dashboard not found
  if (notFound || !resolvedDashboardId) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Dashboard content - full viewport */}
      <div className="p-4">
        <Dashboard isKioskMode />
      </div>

      {/* Floating controls */}
      <KioskControls visible={controlsVisible} />
    </div>
  );
}
