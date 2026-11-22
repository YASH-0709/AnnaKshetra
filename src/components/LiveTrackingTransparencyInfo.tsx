import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  HelpCircle,
  Info,
  Lock,
  Radio,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { FoodListing, UserRole } from '../types';

interface LiveTrackingTransparencyInfoProps {
  listing: FoodListing;
  userRole: UserRole;
  isAuthorizedViewer: boolean;
  isDeviceGpsBroadcasting: boolean;
  lastSyncedAt: string | null;
  liveMapSyncEnabled: boolean;
  onToggleLiveMapSync: (enabled: boolean) => void;
  onForceSyncMapNow: () => void;
}

export const LiveTrackingTransparencyInfo: React.FC<
  LiveTrackingTransparencyInfoProps
> = ({
  listing,
  userRole,
  isAuthorizedViewer,
  isDeviceGpsBroadcasting,
  lastSyncedAt,
  liveMapSyncEnabled,
  onToggleLiveMapSync,
  onForceSyncMapNow,
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState<boolean>(false);
  const [isInfoPanelExpanded, setIsInfoPanelExpanded] = useState<boolean>(true);
  const [secondsSinceSync, setSecondsSinceSync] = useState<number>(0);

  const effectiveLastSyncIso =
    listing.currentLocation.lastGpsUpdatedAt || lastSyncedAt;

  // Live 5-second cycle counter for transparency
  useEffect(() => {
    const updateCounter = () => {
      if (!effectiveLastSyncIso) {
        setSecondsSinceSync(0);
        return;
      }
      const diffSec = Math.max(
        0,
        Math.floor((Date.now() - new Date(effectiveLastSyncIso).getTime()) / 1000)
      );
      setSecondsSinceSync(diffSec);
    };

    updateCounter();
    const timer = window.setInterval(updateCounter, 1000);
    return () => window.clearInterval(timer);
  }, [effectiveLastSyncIso]);

  const isHardwareGps =
    isDeviceGpsBroadcasting || Boolean(listing.currentLocation.liveGpsActive);

  const nextSyncInSec = Math.max(0, 5 - (secondsSinceSync % 5));

  const roleSpecificExplanation =
    userRole === 'donor'
      ? {
          badge: 'Donor Dashboard Transparency',
          heading: 'How Live GPS & 5s Sync Work for Food Donors',
          bullets: [
            'Approach Tracking (CLAIMED): As the assigned volunteer approaches your kitchen loading bay, their coordinates update on your map every 5 seconds so your team can stage sealed containers at >60°C or <5°C.',
            'Custody Handover (Pickup OTP / QR): Once you verify the 4-digit Pickup OTP or packaging QR code, status moves to COLLECTED and you can watch the live route to the shelter.',
            'Auto-Termination: Tracking automatically halts the moment Drop-off OTP is verified at the receiving NGO.',
          ],
        }
      : userRole === 'receiver'
      ? {
          badge: 'Receiver NGO Dashboard Transparency',
          heading: 'How Live GPS & 5s Sync Work for Receiving Shelters',
          bullets: [
            'Incoming ETA & Route Progress: Every 5 seconds, the volunteer’s latitude, longitude, and street checkpoint sync via WebSocket to update your Leaflet map marker and live ETA without refreshing.',
            'Intake Readiness: Monitor the volunteer’s approach and container thermal state so dining hall staff are ready to inspect food temperature and verify the 4-digit Drop-off OTP / QR code.',
            'Zero Page Reloads: The Leaflet street map pans and redraws the completed vs. remaining route polyline automatically when Live Map Sync is enabled.',
          ],
        }
      : {
          badge: 'Volunteer & Sponsor Transparency',
          heading: 'How 5-Second WebSocket GPS Synchronization Works',
          bullets: [
            'Device Hardware GPS: Uses navigator.geolocation.watchPosition (high-accuracy mode) to read device latitude, longitude, accuracy (m), and speed (km/h).',
            '5-Second WebSocket Heartbeat: Pushes volunteer:location-update every 5,000ms over /ws to the backend store and broadcasts volunteer:location-updated to the batch donor and claiming NGO.',
            'Strict Privacy Boundary: Coordinates are only accessible to authorized participants of this delivery and stop immediately upon delivery completion.',
          ],
        };

  return (
    <div className="space-y-2.5">
      {/* Top Action Row: Contextual Tooltip Trigger + Live Map Sync Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {/* Contextual Info Tooltip Trigger + Popover */}
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setIsTooltipOpen((prev) => !prev)}
            onMouseEnter={() => setIsTooltipOpen(true)}
            aria-expanded={isTooltipOpen}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-orange-500 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-600" />
            <span>How 5s GPS &amp; Map Sync Works</span>
          </button>

          {isTooltipOpen && (
            <div
              onMouseLeave={() => setIsTooltipOpen(false)}
              className="absolute left-0 top-full mt-2 z-50 w-80 sm:w-96 p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 shadow-xl space-y-2.5 text-xs"
              role="tooltip"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-orange-400 font-semibold">
                    {roleSpecificExplanation.badge}
                  </span>
                  <h4 className="text-xs font-bold text-white mt-0.5">
                    {roleSpecificExplanation.heading}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTooltipOpen(false)}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  aria-label="Close tooltip"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed">
                <div>
                  <strong className="text-white">1. Data Derivation:</strong>{' '}
                  Coordinates are captured from the volunteer&apos;s device via{' '}
                  <code className="text-orange-300">
                    navigator.geolocation.watchPosition
                  </code>{' '}
                  (or street-corridor waypoint interpolation during demo mode).
                </div>
                <div>
                  <strong className="text-white">
                    2. 5-Second WebSocket Sync:
                  </strong>{' '}
                  Every <strong>5 seconds</strong>, the client emits{' '}
                  <code className="text-emerald-300">
                    volunteer:location-update
                  </code>{' '}
                  over WebSocket (<code className="text-orange-300">/ws</code>),
                  updating the server&apos;s{' '}
                  <code className="text-orange-300">DeliveryLocationRecord</code>{' '}
                  and pushing live coordinates to authorized Donor &amp;
                  Receiver dashboards.
                </div>
                <div>
                  <strong className="text-white">3. Live Map Sync:</strong> When{' '}
                  <strong>Auto-Sync Map</strong> is enabled, the Leaflet street
                  map automatically pans and updates the volunteer marker &amp;
                  road polyline on every 5s packet.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Map Sync Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleLiveMapSync(!liveMapSyncEnabled)}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
              liveMapSyncEnabled
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-500'
            }`}
            title="Automatically pan and sync the Leaflet street map on every 5-second WebSocket GPS update"
          >
            <Radio
              className={`w-3 h-3 ${
                liveMapSyncEnabled ? 'animate-pulse text-white' : 'text-orange-600'
              }`}
            />
            <span>
              {liveMapSyncEnabled ? 'Live Map Sync: ON' : 'Live Map Sync: OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={onForceSyncMapNow}
            className="px-2 py-1 text-[11px] font-medium rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-400 transition-colors flex items-center gap-1 cursor-pointer"
            title="Center and synchronize the map to the volunteer's latest GPS coordinates immediately"
          >
            <RefreshCw className="w-3 h-3 text-emerald-600" />
            <span>Center Map</span>
          </button>
        </div>
      </div>

      {/* Companion Transparency & Derivation Info Panel for Donor & Receiver Dashboards */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 space-y-2.5 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
            <Info className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>{roleSpecificExplanation.heading}</span>
          </div>
          <button
            type="button"
            onClick={() => setIsInfoPanelExpanded((prev) => !prev)}
            className="text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:underline cursor-pointer whitespace-nowrap"
          >
            {isInfoPanelExpanded ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {/* Live Telemetry Source & 5s WebSocket Heartbeat Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 font-mono-tabular">
          <div>
            <span className="text-slate-400 block text-[10px]">
              LOCATION SOURCE
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-600 shrink-0" />
              {isHardwareGps
                ? 'Browser GPS (watchPosition)'
                : 'Street Corridor Telemetry'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">
              WEBSOCKET SYNC CADENCE
            </span>
            <span className="font-semibold text-orange-600 dark:text-orange-400">
              Every 5.0s (Next ~{nextSyncInSec}s)
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[10px]">
              ACCURACY &amp; ACCESS
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
              {listing.currentLocation.accuracyMeters
                ? `±${listing.currentLocation.accuracyMeters}m · Auth Verified`
                : isAuthorizedViewer
                ? 'Role Authorized'
                : 'Restricted'}
            </span>
          </div>
        </div>

        {isInfoPanelExpanded && (
          <div className="space-y-1.5 pt-1 text-slate-600 dark:text-slate-300 leading-relaxed">
            {roleSpecificExplanation.bullets.map((bullet, idx) => (
              <div key={idx} className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{bullet}</span>
              </div>
            ))}
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Protected by Delivery-Scoped Authorization (Donor · Volunteer ·
                Receiver NGO)
              </span>
              <span className="font-mono-tabular">
                Last Packet: {secondsSinceSync}s ago
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
