import React, { useState, useEffect, useRef } from 'react';

interface EcobeeTokenGeneratorProps {
  apiKey: string;
  onTokenGenerated: (refreshToken: string) => void;
  onClose: () => void;
}

type Step = 'initializing' | 'pin-display' | 'waiting' | 'success' | 'error';

export function EcobeeTokenGenerator({
  apiKey,
  onTokenGenerated,
  onClose,
}: EcobeeTokenGeneratorProps) {
  const [step, setStep] = useState<Step>('initializing');
  const [pin, setPin] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [refreshToken, setRefreshToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);

  // Request PIN from Ecobee
  useEffect(() => {
    const requestPin = async () => {
      try {
        const response = await fetch('/api/ecobee-auth/request-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to request PIN');
        }

        setPin(data.pin);
        setSessionId(data.sessionId);
        setExpiresIn(data.expiresIn);
        setRemainingTime(data.expiresIn);
        setStep('pin-display');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to request PIN');
        setStep('error');
      }
    };

    requestPin();

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (expiryRef.current) {
        clearInterval(expiryRef.current);
        expiryRef.current = null;
      }
    };
  }, [apiKey]);

  // Countdown timer for PIN expiry
  useEffect(() => {
    if (step !== 'pin-display' && step !== 'waiting') return;

    expiryRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          if (expiryRef.current) {
            clearInterval(expiryRef.current);
          }
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
          }
          setError('PIN expired. Please request a new one.');
          setStep('error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (expiryRef.current) {
        clearInterval(expiryRef.current);
        expiryRef.current = null;
      }
    };
  }, [step]);

  // Poll for completion
  const startPolling = () => {
    if (isPolling) return;
    setIsPolling(true);
    setStep('waiting');

    const poll = async () => {
      try {
        const response = await fetch('/api/ecobee-auth/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Authorization failed');
        }

        if (data.completed) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          if (data.error) {
            setError(data.error);
            setStep('error');
          } else if (data.refreshToken) {
            setRefreshToken(data.refreshToken);
            setStep('success');
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Authorization failed';
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setError(errorMsg);
        setStep('error');
      }
    };

    // Poll every 5 seconds (respecting Ecobee's recommended interval)
    pollingRef.current = setInterval(poll, 5000);
    poll(); // Poll immediately
  };

  // Try to exchange manually
  const handleCompleteAuth = async () => {
    setIsPolling(true);
    setStep('waiting');

    try {
      const response = await fetch('/api/ecobee-auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, code: pin, sessionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authorization failed');
      }

      if (data.completed && data.refreshToken) {
        setRefreshToken(data.refreshToken);
        setStep('success');
      } else if (!data.completed) {
        // Not yet registered, start polling
        startPolling();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Authorization failed';
      // If authorization pending, start polling
      if (errorMsg.includes('pending')) {
        startPolling();
      } else {
        setError(errorMsg);
        setStep('error');
      }
    }
  };

  const handleUseToken = () => {
    onTokenGenerated(refreshToken);
    onClose();
  };

  const handleRetry = () => {
    setStep('initializing');
    setError(null);
    setPin('');
    setSessionId('');
    setRefreshToken('');
    setIsPolling(false);

    // Re-request PIN
    const requestPin = async () => {
      try {
        const response = await fetch('/api/ecobee-auth/request-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to request PIN');
        }

        setPin(data.pin);
        setSessionId(data.sessionId);
        setExpiresIn(data.expiresIn);
        setRemainingTime(data.expiresIn);
        setStep('pin-display');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to request PIN');
        setStep('error');
      }
    };

    requestPin();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Connect Ecobee Account
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
              <svg className="animate-spin w-8 h-8 mx-auto mb-4 text-green-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">Requesting authorization PIN...</p>
            </div>
          )}

          {/* PIN Display step */}
          {step === 'pin-display' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Enter PIN in Ecobee
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Log in to your Ecobee account and enter this PIN in the "My Apps" section.
                </p>
              </div>

              {/* Large PIN display */}
              <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 text-center">
                <div className="text-4xl font-mono font-bold tracking-widest text-gray-900 dark:text-white">
                  {pin}
                </div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Expires in {formatTime(remainingTime)}
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Instructions:</h5>
                <ol className="text-sm text-blue-700 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
                  <li>Go to <a href="https://www.ecobee.com/consumerportal/index.html" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">ecobee.com</a> and log in</li>
                  <li>Click on the menu icon (three lines) in the top right</li>
                  <li>Select "My Apps"</li>
                  <li>Click "Add Application"</li>
                  <li>Enter the PIN shown above</li>
                  <li>Click "Validate" then "Add Application"</li>
                </ol>
              </div>

              {/* Complete Authorization button */}
              <button
                onClick={handleCompleteAuth}
                className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
              >
                I've Entered the PIN - Complete Authorization
              </button>
            </div>
          )}

          {/* Waiting step */}
          {step === 'waiting' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <svg className="animate-spin w-10 h-10 mx-auto mb-4 text-green-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Checking Authorization...
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Waiting for you to enter the PIN in Ecobee.
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Your PIN: <span className="font-mono">{pin}</span></p>
                    <p className="mt-1">Make sure to click "Add Application" in Ecobee after validating the PIN.</p>
                    <p className="text-xs mt-1 opacity-75">Time remaining: {formatTime(remainingTime)}</p>
                  </div>
                </div>
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
                  Your Ecobee account has been authorized. Click "Use Token" to save the credentials.
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
                  className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
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
