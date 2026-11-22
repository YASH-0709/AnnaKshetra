import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ListingStatus } from '../types';

export type GpsTrackingStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'error'
  | 'unsupported';

export interface LiveGpsCoords {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedKmh: number;
  timestamp: string;
}

export interface UseLiveTrackingOptions {
  /** Active delivery / listing ID */
  deliveryId: string | null | undefined;
  /** Authenticated volunteer user ID */
  volunteerId: string | null | undefined;
  /** Current status of the delivery */
  deliveryStatus: ListingStatus | null | undefined;
  /** Whether the current user is the assigned volunteer for this delivery */
  isAuthorizedVolunteer: boolean;
  /** Optional shared WebSocket reference from the parent application */
  wsRef?: React.MutableRefObject<WebSocket | null>;
  /** WebSocket synchronization interval in milliseconds (defaults to 5000ms / 5 seconds) */
  syncIntervalMs?: number;
}

export interface UseLiveTrackingResult {
  gpsStatus: GpsTrackingStatus;
  isTracking: boolean;
  coords: LiveGpsCoords | null;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  startTracking: () => void;
  stopTracking: () => void;
}

/**
 * Custom hook that uses `navigator.geolocation.watchPosition` to track a delivery
 * volunteer's real-time GPS coordinates and synchronize them to the backend database
 * via a dedicated WebSocket event (`volunteer:location-update`) every 5 seconds
 * while a delivery is active (`CLAIMED` or `COLLECTED`).
 */
export function useLiveTracking({
  deliveryId,
  volunteerId,
  deliveryStatus,
  isAuthorizedVolunteer,
  wsRef,
  syncIntervalMs = 5000,
}: UseLiveTrackingOptions): UseLiveTrackingResult {
  const [gpsStatus, setGpsStatus] = useState<GpsTrackingStatus>('idle');
  const [coords, setCoords] = useState<LiveGpsCoords | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const latestCoordsRef = useRef<LiveGpsCoords | null>(null);
  const lastEmitTimestampRef = useRef<number>(0);
  const internalWsRef = useRef<WebSocket | null>(null);

  const isDeliveryActive =
    deliveryStatus === 'CLAIMED' || deliveryStatus === 'COLLECTED';

  const emitLocationOverWebSocket = useCallback(
    (location: LiveGpsCoords, activeStatus: ListingStatus = 'COLLECTED') => {
      if (!deliveryId || !volunteerId) return;

      const nowIso = new Date().toISOString();
      const payload = {
        type: 'volunteer:location-update',
        data: {
          delivery_id: deliveryId,
          volunteer_id: volunteerId,
          latitude: Number(location.latitude.toFixed(6)),
          longitude: Number(location.longitude.toFixed(6)),
          accuracy_meters: Math.round(location.accuracyMeters),
          speed_kmh: location.speedKmh,
          updated_at: nowIso,
          delivery_status: activeStatus,
        },
      };

      const activeSocket = wsRef?.current || internalWsRef.current;

      if (activeSocket && activeSocket.readyState === WebSocket.OPEN) {
        activeSocket.send(JSON.stringify(payload));
        lastEmitTimestampRef.current = Date.now();
        setLastSyncedAt(nowIso);
      } else {
        // Fallback to REST endpoint if WebSocket is reconnecting
        fetch(`/api/listings/${deliveryId}/live-location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.data),
        })
          .then((res) => {
            if (res.ok) {
              lastEmitTimestampRef.current = Date.now();
              setLastSyncedAt(nowIso);
            }
          })
          .catch(() => {
            // ignore transient network error
          });
      }
    },
    [deliveryId, volunteerId, wsRef]
  );

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (syncTimerRef.current !== null) {
      window.clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    // Notify backend that live device GPS stream stopped
    const activeSocket = wsRef?.current || internalWsRef.current;
    if (
      deliveryId &&
      volunteerId &&
      activeSocket &&
      activeSocket.readyState === WebSocket.OPEN
    ) {
      activeSocket.send(
        JSON.stringify({
          type: 'volunteer:tracking-stopped',
          data: {
            delivery_id: deliveryId,
            volunteer_id: volunteerId,
            updated_at: new Date().toISOString(),
          },
        })
      );
    }

    setGpsStatus((prev) => (prev === 'active' || prev === 'requesting' ? 'idle' : prev));
  }, [deliveryId, volunteerId, wsRef]);

  const startTracking = useCallback(() => {
    setErrorMessage(null);

    if (!isAuthorizedVolunteer) {
      setGpsStatus('error');
      setErrorMessage(
        'Only the assigned delivery volunteer is authorized to broadcast live GPS coordinates.'
      );
      return;
    }

    if (!deliveryId || !isDeliveryActive) {
      setGpsStatus('error');
      setErrorMessage(
        'Live GPS tracking can only be started for an active delivery (CLAIMED or COLLECTED).'
      );
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      setErrorMessage('Browser Geolocation API is not supported on this device.');
      return;
    }

    // Clear any existing watch before starting a fresh one
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (syncTimerRef.current !== null) {
      window.clearInterval(syncTimerRef.current);
    }

    setGpsStatus('requesting');

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const speedMps = position.coords.speed;
        const computedSpeedKmh =
          typeof speedMps === 'number' && !Number.isNaN(speedMps) && speedMps >= 0
            ? Math.round(speedMps * 3.6)
            : 24;

        const nextCoords: LiveGpsCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy || 12,
          speedKmh: computedSpeedKmh,
          timestamp: new Date(position.timestamp).toISOString(),
        };

        latestCoordsRef.current = nextCoords;
        setCoords(nextCoords);
        setGpsStatus('active');
        setErrorMessage(null);

        // Emit immediately on first fix or if >= syncIntervalMs has elapsed since last emit
        const elapsed = Date.now() - lastEmitTimestampRef.current;
        if (elapsed >= syncIntervalMs && deliveryStatus) {
          emitLocationOverWebSocket(nextCoords, deliveryStatus);
        }
      },
      (geoError) => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setGpsStatus('denied');
          setErrorMessage(
            'Location permission denied. Please allow GPS access in your browser settings to broadcast live delivery coordinates.'
          );
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setGpsStatus('error');
          setErrorMessage('GPS signal unavailable. Ensure device location services are enabled.');
        } else if (geoError.code === geoError.TIMEOUT) {
          setGpsStatus('error');
          setErrorMessage('GPS position request timed out. Retrying signal lock...');
        } else {
          setGpsStatus('error');
          setErrorMessage(geoError.message || 'Unable to read GPS location.');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 12000,
      }
    );

    watchIdRef.current = watchId;

    // Dedicated 5-second WebSocket heartbeat to synchronize the latest watched coordinates
    syncTimerRef.current = window.setInterval(() => {
      if (latestCoordsRef.current && deliveryStatus) {
        emitLocationOverWebSocket(latestCoordsRef.current, deliveryStatus);
      }
    }, syncIntervalMs);
  }, [
    deliveryId,
    deliveryStatus,
    emitLocationOverWebSocket,
    isAuthorizedVolunteer,
    isDeliveryActive,
    syncIntervalMs,
  ]);

  // Automatically stop GPS tracking when delivery completes (DELIVERED) or expires
  useEffect(() => {
    if (!isDeliveryActive && gpsStatus === 'active') {
      stopTracking();
    }
  }, [isDeliveryActive, gpsStatus, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (syncTimerRef.current !== null) {
        window.clearInterval(syncTimerRef.current);
      }
      if (internalWsRef.current) {
        internalWsRef.current.close();
      }
    };
  }, []);

  return {
    gpsStatus,
    isTracking: gpsStatus === 'active',
    coords,
    lastSyncedAt,
    errorMessage,
    startTracking,
    stopTracking,
  };
}
