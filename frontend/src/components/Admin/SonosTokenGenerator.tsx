import React, { useState, useEffect, useRef, useCallback } from 'react';

interface SonosTokenGeneratorProps {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  onTokenGenerated: (refreshToken: string) => void;
  onClose: () => void;
}

type Step = 'initializing' | 'waiting' | 'success' | 'error';

export function SonosTokenGenerator({
  clientId,
  clientSecret,
  redirectUri,
  onTokenGenerated,
  onClose,
}: SonosTokenGeneratorProps) {
  const [step, setStep] = useState<Step>('initializing');
  const [state, setState] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Handle message from popup
  const handlePopupMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'sonos-auth-success') {
      // Popup closed successfully, poll will pick up the token
    } else if (event.data?.type === 'sonos-auth-error') {
      setError(event.data.error || 'Authorization failed');
      setStep('error');
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, []);

  // Initialize OAuth flow and open popup
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const response = await fetch('/api/sonos-auth/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, clientSecret, redirectUri }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to initialize authorization');
        }

        setState(data.state);

        // Open popup window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        popupRef.current = window.open(
          data.authUrl,
          'sonos-auth',
          `width=${width},height=${height},left=${left},top=${top},popup=yes`
        );

        if (!popupRef.current) {
          throw new Error('Failed to open popup window. Please allow popups for this site.');
        }

        setStep('waiting');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start authorization');
        setStep('error');
      }
    };

    initializeAuth();

    // Add message listener for popup communication
    window.addEventListener('message', handlePopupMessage);

    return () => {
      window.removeEventListener('message', handlePopupMessage);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, [clientId, clientSecret, redirectUri, handlePopupMessage]);

  // Poll for token completion
  useEffect(() => {
    if (step !== 'waiting' || !state) return;

    const pollForToken = async () => {
      // Check if popup is closed
      if (popupRef.current?.closed) {
        // Give the callback a moment to complete
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      try {
        const response = await fetch('/api/sonos-auth/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Authorization failed');
        }

        if (data.completed) {
          if (data.error) {
            setError(data.error);
            setStep('error');
          } else {
            setRefreshToken(data.refreshToken);
            setStep('success');
          }
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err) {
        // Only set error if it's a real error, not just "still waiting"
        const errorMsg = err instanceof Error ? err.message : 'Authorization failed';
        if (!errorMsg.includes('expired')) {
          setError(errorMsg);
          setStep('error');
        }
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    };

    // Poll every 2 seconds
    pollingRef.current = setInterval(pollForToken, 2000);

    // Also poll immediately
    pollForToken();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [step, state]);

  const handleUseToken = () => {
    onTokenGenerated(refreshToken);
    onClose();
  };

  const handleRetry = () => {
    setStep('initializing');
    setError(null);
    setState('');
    setRefreshToken('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Connect Sonos Account
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Initializing step */}
          {step === 'initializing' && (
            <div className="text-center py-8">
              <svg className="animate-spin w-8 h-8 mx-auto mb-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">Opening authorization window...</p>
            </div>
          )}

          {/* Waiting step */}
          {step === 'waiting' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Authorize Your Sonos Account
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  A popup window has been opened. Please sign in with your Sonos account and authorize this application.
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium mb-1">Can't see the popup?</p>
                    <p>Check if your browser blocked the popup window. You may need to allow popups for this site.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Waiting for authorization...
              </div>
            </div>
          )}

          {/* Success step */}
          {step === 'success' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Authorization Successful!
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your Sonos account has been authorized. Click "Use Token" to save the credentials.
                </p>
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Refresh Token (first 40 characters)
                </label>
                <code className="text-sm text-gray-800 dark:text-gray-200 break-all">
                  {refreshToken.substring(0, 40)}...
                </code>
              </div>
              <button
                onClick={handleUseToken}
                className="w-full py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                Use Token
              </button>
            </div>
          )}

          {/* Error step */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Authorization Failed
                </h4>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRetry}
                  className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
