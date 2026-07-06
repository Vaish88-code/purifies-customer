import { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { updateUserLocationWithPermission } from '@shared/lib/firebase/firestore';

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

const STORAGE_KEY_PERMISSION_TYPE = 'locationPermissionType';

export type PermissionOutcome = 'granted_always' | 'granted_once' | 'denied' | null;

export interface LocationPermissionModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Current user uid for Firestore update */
  userId: string | undefined;
  /** Callback when modal closes; outcome is granted_always | granted_once | denied */
  onClose: (outcome: PermissionOutcome) => void;
  /** Callback when location is successfully saved (optional) */
  onLocationSaved?: () => void;
}

export function LocationPermissionModal({
  visible,
  userId,
  onClose,
  onLocationSaved,
}: LocationPermissionModalProps) {
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAndSaveLocation = async (permissionType: 'always' | 'once') => {
    if (!('geolocation' in navigator)) {
      setError('Location is not supported in this browser.');
      return;
    }
    setFetching(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (userId) {
          try {
            await updateUserLocationWithPermission(
              userId,
              lat,
              lng,
              true
            );
            onLocationSaved?.();
          } catch (err) {
            console.error('Failed to save location to Firestore:', err);
            setError('Failed to save location.');
            setFetching(false);
            return;
          }
        }

        if (permissionType === 'always') {
          try {
            localStorage.setItem(STORAGE_KEY_PERMISSION_TYPE, 'always');
          } catch (_) {}
        }

        setFetching(false);
        onClose(permissionType === 'always' ? 'granted_always' : 'granted_once');
      },
      (err) => {
        setError(err.message || 'Unable to get location.');
        setFetching(false);
      },
      GEOLOCATION_OPTIONS
    );
  };

  const handleWhileUsingApp = () => {
    fetchAndSaveLocation('always');
  };

  const handleOnlyThisTime = () => {
    fetchAndSaveLocation('once');
  };

  const handleDeny = () => {
    onClose('denied');
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/20"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-permission-title"
    >
      {/* Full-screen dark overlay with blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Centered Android-style card */}
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}
      >
        {/* Top location icon */}
        <div className="flex justify-center pt-8 pb-2">
          <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-4">
            <MapPin className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* Title */}
        <h2
          id="location-permission-title"
          className="text-center text-lg font-medium text-zinc-900 dark:text-zinc-100 px-6 pt-2 pb-1"
        >
          Allow Purifies to access this device&apos;s location?
        </h2>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 px-6 pb-6">
          So we can show your delivery spot on the map
        </p>

        {error && (
          <p className="text-center text-sm text-red-600 dark:text-red-400 px-6 pb-2">
            {error}
          </p>
        )}

        {/* Buttons - Android style list */}
        <div className="border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            onClick={handleWhileUsingApp}
            disabled={fetching}
            className="w-full py-4 px-6 text-left text-base font-medium text-blue-600 dark:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 disabled:opacity-50 disabled:pointer-events-none transition-colors flex items-center justify-center gap-2"
          >
            {fetching ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Getting location…
              </>
            ) : (
              'While using the app'
            )}
          </button>
          <button
            type="button"
            onClick={handleOnlyThisTime}
            disabled={fetching}
            className="w-full py-4 px-6 text-left text-base font-medium text-blue-600 dark:text-blue-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 disabled:opacity-50 disabled:pointer-events-none transition-colors flex items-center justify-center gap-2 border-t border-zinc-100 dark:border-zinc-800"
          >
            {fetching ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Getting location…
              </>
            ) : (
              'Only this time'
            )}
          </button>
          <button
            type="button"
            onClick={handleDeny}
            disabled={fetching}
            className="w-full py-4 px-6 text-left text-base font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 disabled:opacity-50 transition-colors border-t border-zinc-100 dark:border-zinc-800"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
