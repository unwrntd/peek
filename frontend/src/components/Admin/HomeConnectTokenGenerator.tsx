import React, { useState, useEffect, useRef } from 'react';

interface HomeConnectTokenGeneratorProps {
  clientId: string;
  clientSecret: string;
  onTokenGenerated: (refreshToken: string) => void;
  onClose: () => void;
}

type Step = 'requesting' | 'waiting' | 'success' | 'error';

export function HomeConnectTokenGenerator({
  clientId,
  clientSecret,
  onTokenGenerated,
  onClose,
}: HomeConnectTokenGeneratorProps) {
  const [step, setStep] = useState<Step>('requesting');
  const [userCode, setUserCode] = useState('');
  const [verificationUri, setVerificationUri] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState(5);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request device code on mount
  useEffect(() => {
    const requestDeviceCode = async () => {
      try {
        const response = await fetch('/api/homeconnect-auth/device-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, clientSecret }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to request device code');
        }

        setUserCode(data.userCode);
        setVerificationUri(data.verificationUri);
        setSessionId(data.sessionId);
        setPollInterval(data.interval || 5);
        setStep('waiting');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start authorization');
        setStep('error');
      }
    };

    requestDeviceCode();
  }, [clientId, clientSecret]);

  // Poll for token when in waiting step
  useEffect(() => {
    if (step !== 'waiting' || !sessionId) return;

    const pollForToken = async () => {
      try {
        const response = await fetch('/api/homeconnect-auth/poll-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Authorization failed');
        }

        if (data.completed) {
          // Success!
          setRefreshToken(data.refreshToken);
          setStep('success');
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } else if (data.slowDown) {
          // Increase polling interval
          setPollInterval((prev) => prev + 2);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authorization failed');
        setStep('error');
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    };

    // Start polling
    pollingRef.current = setInterval(pollForToken, pollInterval * 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [step, sessionId, pollInterval]);

  const handleUseToken = () => {
    onTokenGenerated(refreshToken);
    onClose();
  };

  const openVerificationUrl = () => {
    window.open(verificationUri, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Connect Home Connect Account
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
          {/* Requesting step */}
          {step === 'requesting' && (
            <div className="text-center py-8">
              <svg className="animate-spin w-8 h-8 mx-auto mb-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">Requesting authorization...</p>
            </div>
          )}

          {/* Waiting step */}
          {step === 'waiting' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Authorize Your Account
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Click the button below to open the Home Connect authorization page, then sign in with your Home Connect account.
                </p>
              </div>

              {/* User code display */}
              {userCode && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Your code</p>
                  <p className="text-2xl font-mono font-bold text-gray-900 dark:text-white tracking-wider">
                    {userCode}
                  </p>
                </div>
              )}

              <button
                onClick={openVerificationUrl}
                className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Home Connect Authorization
              </button>

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
                  Your Home Connect account has been authorized. Click "Use Token" to save the credentials.
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
              <button
                onClick={onClose}
                className="w-full py-2 px-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
