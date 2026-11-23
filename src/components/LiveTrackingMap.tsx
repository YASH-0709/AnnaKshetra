import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Clock,
  History,
  KeyRound,
  LocateFixed,
  MapPin,
  Navigation,
  Route,
  ShieldAlert,
  Square,
} from 'lucide-react';
import type { Coordinates, ListingStatus } from '../types';

export interface LiveTrackingMapProps {
  deliveryId: string;
  volunteerId: string;
  isVolunteer: boolean;
  active: boolean;
  currentUserId: string;
  authToken?: string | null;
  pickupCoords?: Coordinates;
  dropoffCoords?: Coordinates;
  donorOrg?: string;
  receiverOrg?: string;
  batchCode?: string;
  pickupOtp?: string;
  dropoffOtp?: string;
  deliveryStatus?: ListingStatus;
  initialLocation?: {
    latitude: number;
    longitude: number;
    updatedAt?: string;
  } | null;
  wsRef?: React.MutableRefObject<WebSocket | null>;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  updatedAt?: string;
  accuracyMeters?: number;
  speedKmh?: number;
}

interface OsrmRouteData {
  coordinates: [number, number][];
  distanceKm: number;
  durationMins: number;
}

const volunteerIcon = L.divIcon({
  className: 'volunteer-marker',
  html: '<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:#EA580C;border:3px solid #fff;box-shadow:0 4px 12px rgba(234,88,12,0.45);font-size:18px;">🚴</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const pickupIcon = L.divIcon({
  className: 'leaflet-div-icon',
  html: '<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);"><div style="background:#0284C7;color:#fff;font-family:\'JetBrains Mono\',monospace;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.25);white-space:nowrap;">Pickup (Donor)</div><div style="width:12px;height:12px;border-radius:9999px;background:#0284C7;border:2px solid #fff;margin-top:2px;"></div></div>',
  iconSize: [110, 34],
});

const dropoffIcon = L.divIcon({
  className: 'leaflet-div-icon',
  html: '<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);"><div style="background:#16A34A;color:#fff;font-family:\'JetBrains Mono\',monospace;font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.25);white-space:nowrap;">Drop-off (NGO)</div><div style="width:12px;height:12px;border-radius:9999px;background:#16A34A;border:2px solid #fff;margin-top:2px;"></div></div>',
  iconSize: [110, 34],
});

function MapCameraController({
  location,
  autoFollow,
  boundsPoints,
  fitTrigger,
}: {
  location: LocationPoint | null;
  autoFollow: boolean;
  boundsPoints: [number, number][];
  fitTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (autoFollow && location) {
      map.flyTo([location.latitude, location.longitude], 15, {
        duration: 0.75,
      });
    }
  }, [location?.latitude, location?.longitude, autoFollow, map]);

  useEffect(() => {
    if (fitTrigger === 0 || boundsPoints.length === 0) return;
    if (boundsPoints.length === 1) {
      map.flyTo(boundsPoints[0], 14, { duration: 0.7 });
      return;
    }
    const bounds = L.latLngBounds(boundsPoints);
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true });
  }, [fitTrigger, boundsPoints, map]);

  return null;
}

export default function LiveTrackingMap({
  deliveryId,
  volunteerId,
  isVolunteer,
  active,
  currentUserId,
  authToken,
  pickupCoords,
  dropoffCoords,
  donorOrg,
  receiverOrg,
  batchCode,
  pickupOtp,
  dropoffOtp,
  deliveryStatus,
  initialLocation,
  wsRef,
}: LiveTrackingMapProps) {
  const [location, setLocation] = useState<LocationPoint | null>(
    initialLocation || null
  );
  const [historyTrail, setHistoryTrail] = useState<[number, number][]>([]);
  const [showTrail, setShowTrail] = useState<boolean>(true);
  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [fitTrigger, setFitTrigger] = useState<number>(1);
  const [isGpsRunning, setIsGpsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [osrmRoute, setOsrmRoute] = useState<OsrmRouteData | null>(null);
  const [osrmStatus, setOsrmStatus] = useState<
    'idle' | 'loading' | 'ready' | 'unavailable'
  >('idle');

  const watchIdRef = useRef<number | null>(null);
  const lastOsrmFetchRef = useRef<number>(0);

  // Sync incoming listing coordinates seamlessly (from real-time WebSocket state)
  useEffect(() => {
    if (initialLocation) {
      setLocation((prev) => {
        if (
          prev &&
          prev.latitude === initialLocation.latitude &&
          prev.longitude === initialLocation.longitude &&
          prev.updatedAt === initialLocation.updatedAt
        ) {
          return prev;
        }
        return {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          updatedAt: initialLocation.updatedAt,
        };
      });
    }
  }, [
    initialLocation?.latitude,
    initialLocation?.longitude,
    initialLocation?.updatedAt,
  ]);

  // Load persisted live location & tracking history for authorized participants
  const fetchPersistedLocation = useCallback(async () => {
    if (!deliveryId) return;
    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch(
        `/api/live-locations/${encodeURIComponent(
          deliveryId
        )}?userId=${encodeURIComponent(currentUserId)}`,
        { headers }
      );
      if (res.status === 403) {
        setError(
          'Access restricted: Only the assigned donor, volunteer, or receiving NGO can view this delivery location.'
        );
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (
        data.location &&
        data.location.latitude != null &&
        data.location.longitude != null
      ) {
        setLocation({
          latitude: Number(data.location.latitude),
          longitude: Number(data.location.longitude),
          updatedAt: data.location.updated_at,
          accuracyMeters: data.location.accuracy_meters,
          speedKmh: data.location.speed_kmh,
        });
      }
      if (Array.isArray(data.history)) {
        setHistoryTrail(
          data.history.map((pt: { latitude: number; longitude: number }) => [
            Number(pt.latitude),
            Number(pt.longitude),
          ])
        );
      }
      setError('');
    } catch {
      // Non-blocking fallback
    }
  }, [deliveryId, currentUserId, authToken]);

  useEffect(() => {
    if (active && deliveryId) {
      fetchPersistedLocation();
    }
  }, [active, deliveryId, fetchPersistedLocation]);

  // Fetch genuine road route & ETA via public OSRM API (no straight-line distance misrepresentation)
  useEffect(() => {
    if (!active || !pickupCoords || !dropoffCoords) {
      setOsrmRoute(null);
      setOsrmStatus('idle');
      return;
    }

    const now = Date.now();
    // Throttle OSRM public demo API requests to at most once every 10 seconds
    if (now - lastOsrmFetchRef.current < 10000 && osrmRoute) {
      return;
    }

    const originLat =
      deliveryStatus === 'COLLECTED' && location
        ? location.latitude
        : pickupCoords.lat;
    const originLng =
      deliveryStatus === 'COLLECTED' && location
        ? location.longitude
        : pickupCoords.lng;

    const controller = new AbortController();
    setOsrmStatus('loading');
    lastOsrmFetchRef.current = now;

    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${dropoffCoords.lng},${dropoffCoords.lat}?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('OSRM routing unavailable');
        return res.json();
      })
      .then((data) => {
        const route = data?.routes?.[0];
        if (!route?.geometry?.coordinates) {
          setOsrmStatus('unavailable');
          return;
        }
        const latLngs: [number, number][] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => [lat, lng]
        );
        setOsrmRoute({
          coordinates: latLngs,
          distanceKm: Number((route.distance / 1000).toFixed(2)),
          durationMins: Math.max(1, Math.round(route.duration / 60)),
        });
        setOsrmStatus('ready');
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setOsrmStatus('unavailable');
        }
      });

    return () => controller.abort();
  }, [
    active,
    deliveryStatus,
    pickupCoords?.lat,
    pickupCoords?.lng,
    dropoffCoords?.lat,
    dropoffCoords?.lng,
    location?.latitude,
    location?.longitude,
  ]);

  const stopVolunteerGps = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsGpsRunning(false);

    if (wsRef?.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
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
  }, [deliveryId, volunteerId, wsRef]);

  const startVolunteerGps = useCallback(() => {
    setError('');
    if (!isVolunteer) {
      setError('Only the assigned delivery volunteer can share live GPS.');
      return;
    }
    if (!active) {
      setError('Delivery is not active. Tracking is disabled.');
      return;
    }
    if (!navigator.geolocation) {
      setError('GPS is not supported by this browser.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setIsGpsRunning(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const nowIso = new Date().toISOString();
        const speedKmh =
          typeof position.coords.speed === 'number' &&
          !Number.isNaN(position.coords.speed) &&
          position.coords.speed >= 0
            ? Math.round(position.coords.speed * 3.6)
            : 22;

        const nextPoint: LocationPoint = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracyMeters: Math.round(position.coords.accuracy || 15),
          speedKmh,
          updatedAt: nowIso,
        };

        setLocation(nextPoint);
        setHistoryTrail((prev) => [
          ...prev.slice(-59),
          [nextPoint.latitude, nextPoint.longitude],
        ]);
        setError('');

        // Persist coordinate update to backend PostgreSQL store
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (authToken) {
            headers.Authorization = `Bearer ${authToken}`;
          }
          const res = await fetch(
            `/api/live-locations/${encodeURIComponent(deliveryId)}`,
            {
              method: 'PUT',
              headers,
              body: JSON.stringify({
                volunteer_id: volunteerId,
                latitude: nextPoint.latitude,
                longitude: nextPoint.longitude,
                accuracy_meters: nextPoint.accuracyMeters,
                speed_kmh: nextPoint.speedKmh,
                updated_at: nowIso,
                delivery_status: deliveryStatus || 'COLLECTED',
              }),
            }
          );
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            if (errData.error) setError(errData.error);
          }
        } catch {
          // Also push over WebSocket if open
          if (wsRef?.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: 'volunteer:location-update',
                data: {
                  delivery_id: deliveryId,
                  volunteer_id: volunteerId,
                  latitude: nextPoint.latitude,
                  longitude: nextPoint.longitude,
                  accuracy_meters: nextPoint.accuracyMeters,
                  speed_kmh: nextPoint.speedKmh,
                  updated_at: nowIso,
                  delivery_status: deliveryStatus || 'COLLECTED',
                },
              })
            );
          }
        }
      },
      (geoErr) => {
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setError(
            'GPS permission denied. Allow location access in your browser to share live delivery coordinates.'
          );
        } else {
          setError(geoErr.message || 'Unable to read GPS coordinates.');
        }
        setIsGpsRunning(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000,
      }
    );
  }, [
    active,
    authToken,
    deliveryId,
    deliveryStatus,
    isVolunteer,
    volunteerId,
    wsRef,
  ]);

  // Stop tracking automatically when delivery finishes or component unmounts
  useEffect(() => {
    if (!active && watchIdRef.current !== null) {
      stopVolunteerGps();
    }
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [active, stopVolunteerGps]);

  const mapCenter: [number, number] = useMemo(() => {
    if (location) return [location.latitude, location.longitude];
    if (pickupCoords) return [pickupCoords.lat, pickupCoords.lng];
    return [12.9352, 77.6784];
  }, [location, pickupCoords]);

  const boundsPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (pickupCoords) pts.push([pickupCoords.lat, pickupCoords.lng]);
    if (dropoffCoords) pts.push([dropoffCoords.lat, dropoffCoords.lng]);
    if (location) pts.push([location.latitude, location.longitude]);
    return pts;
  }, [pickupCoords, dropoffCoords, location]);

  if (!active) {
    return (
      <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Live GPS Delivery Map · {batchCode || deliveryId}
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              Delivery tracking is inactive ({deliveryStatus || 'IDLE'})
            </h3>
          </div>
          <span className="text-xs font-mono-tabular font-semibold text-emerald-600 dark:text-emerald-400">
            GPS Tracking Stopped
          </span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Real-time GPS tracking activates only while a delivery is{' '}
          <strong>CLAIMED</strong> or <strong>COLLECTED (In Transit)</strong>.
          Select an active batch above (such as <strong>AK-BLR-839</strong> or{' '}
          <strong>AK-BLR-835</strong>) to view live OpenStreetMap road routing
          and volunteer GPS tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
      {/* Header Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Route className="w-3.5 h-3.5 text-orange-600" />
            <span>OpenStreetMap · React Leaflet · OSRM Road Routing</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {location
                ? `${location.latitude.toFixed(5)}°N, ${location.longitude.toFixed(5)}°E`
                : 'Waiting for GPS fix...'}
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {batchCode ? `${batchCode} — ` : ''}Live Volunteer Delivery Tracking
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isVolunteer && (
            <>
              {!isGpsRunning ? (
                <button
                  type="button"
                  onClick={startVolunteerGps}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Start Live GPS
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopVolunteerGps}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-3 h-3" />
                  Stop GPS
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => setAutoFollow((f) => !f)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              autoFollow
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5" />
            {autoFollow ? 'Auto-Follow: ON' : 'Auto-Follow: OFF'}
          </button>

          <button
            type="button"
            onClick={() => {
              setAutoFollow(false);
              setFitTrigger((n) => n + 1);
            }}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-orange-500 cursor-pointer"
          >
            Fit Route
          </button>

          {historyTrail.length > 1 && (
            <button
              type="button"
              onClick={() => setShowTrail((s) => !s)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 cursor-pointer ${
                showTrail
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Trail ({historyTrail.length})
            </button>
          )}
        </div>
      </div>

      {/* OSRM Road Route Metrics & Custody OTP Bar */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 font-mono-tabular text-slate-700 dark:text-slate-200">
          <span>
            <strong className="text-slate-500 dark:text-slate-400">
              OSRM Road Distance:
            </strong>{' '}
            {osrmStatus === 'ready' && osrmRoute
              ? `${osrmRoute.distanceKm} km`
              : osrmStatus === 'loading'
              ? 'Calculating road route...'
              : 'Road distance unavailable'}
          </span>
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <strong>ETA:</strong>{' '}
            {osrmStatus === 'ready' && osrmRoute
              ? `~${osrmRoute.durationMins} mins`
              : '—'}
          </span>
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span>
            <strong>Last Updated:</strong>{' '}
            {location?.updatedAt
              ? new Date(location.updatedAt).toLocaleTimeString()
              : 'Waiting for update'}
          </span>
        </div>

        {(pickupOtp || dropoffOtp) && (
          <div className="flex items-center gap-3 font-mono-tabular text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-orange-600" />
              {deliveryStatus === 'CLAIMED'
                ? `Pickup OTP: ${pickupOtp}`
                : `Drop-off OTP: ${dropoffOtp}`}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="px-5 py-2.5 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Interactive React-Leaflet OpenStreetMap Canvas */}
      <div className="relative">
        <MapContainer
          center={mapCenter}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: '440px', width: '100%' }}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {/* OSRM Real Road Route Polyline */}
          {osrmRoute && osrmRoute.coordinates.length > 1 && (
            <Polyline
              positions={osrmRoute.coordinates}
              pathOptions={{
                color: '#EA580C',
                weight: 5,
                opacity: 0.85,
              }}
            />
          )}

          {/* Recorded Breadcrumb History Trail */}
          {showTrail && historyTrail.length > 1 && (
            <Polyline
              positions={historyTrail}
              pathOptions={{
                color: '#16A34A',
                weight: 3,
                opacity: 0.75,
                dashArray: '6, 6',
              }}
            />
          )}

          {/* Pickup Marker (Donor) */}
          {pickupCoords && (
            <Marker
              position={[pickupCoords.lat, pickupCoords.lng]}
              icon={pickupIcon}
            >
              <Popup>
                <div className="text-xs">
                  <strong>Pickup Location (Donor)</strong>
                  <div>{donorOrg || pickupCoords.hubName}</div>
                  <div className="font-mono-tabular text-[11px] text-slate-500">
                    {pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Drop-off Marker (Receiver NGO) */}
          {dropoffCoords && (
            <Marker
              position={[dropoffCoords.lat, dropoffCoords.lng]}
              icon={dropoffIcon}
            >
              <Popup>
                <div className="text-xs">
                  <strong>Drop-off Destination (Receiver)</strong>
                  <div>{receiverOrg || dropoffCoords.hubName}</div>
                  <div className="font-mono-tabular text-[11px] text-slate-500">
                    {dropoffCoords.lat.toFixed(5)},{' '}
                    {dropoffCoords.lng.toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Live Volunteer Location Marker */}
          {location && (
            <Marker
              position={[location.latitude, location.longitude]}
              icon={volunteerIcon}
            >
              <Popup>
                <div className="text-xs">
                  <strong>Live Volunteer Location</strong>
                  <div>
                    Updated:{' '}
                    {location.updatedAt
                      ? new Date(location.updatedAt).toLocaleTimeString()
                      : 'Live'}
                  </div>
                  <div className="font-mono-tabular text-[11px] text-slate-500">
                    {location.latitude.toFixed(5)},{' '}
                    {location.longitude.toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          <MapCameraController
            location={location}
            autoFollow={autoFollow}
            boundsPoints={boundsPoints}
            fitTrigger={fitTrigger}
          />
        </MapContainer>
      </div>

      {/* Footer Note on Browser GPS Scope & Delivery Endpoints */}
      <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span>
            Browser GPS tracking runs while this tracking page remains active
            and stops automatically when delivery completes.
          </span>
        </div>
        <span className="font-mono-tabular">
          Map data &copy; OpenStreetMap contributors · Routing via OSRM
        </span>
      </div>
    </div>
  );
}
