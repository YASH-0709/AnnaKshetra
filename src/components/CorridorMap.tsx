import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  Compass,
  Flame,
  Globe,
  Layers,
  LocateFixed,
  MapPin,
  Maximize2,
  Navigation,
  PlusCircle,
  ShieldAlert,
  Thermometer,
  TrendingUp,
  Truck,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Coordinates, FoodListing, IndiaHubNode, UserProfile } from '../types';
import {
  ALL_INDIA_HUBS,
  calculateDistanceKm,
  formatListingQuantity,
  generateStreetRouteWaypoints,
  getMinutesRemaining,
} from '../utils/matching';

interface CorridorMapProps {
  listings: FoodListing[];
  selectedListing: FoodListing | null;
  onSelectListing: (listing: FoodListing) => void;
  onAdvanceGps: (listingId: string) => void;
  users: UserProfile[];
  darkMode?: boolean;
  onPinCustomLocation?: (coords: Coordinates) => void;
  liveMapSyncEnabled?: boolean;
  onToggleLiveMapSync?: (enabled: boolean) => void;
  forceSyncTrigger?: number;
}

type OverlayMode = 'combined' | 'heatmap-focus' | 'routes-only';
type CameraViewMode = 'city' | 'all-india' | 'follow-rider';

export interface HubDemandCell extends IndiaHubNode {
  incomingOrDeliveredMeals: number;
  availableUnclaimedSurplusMeals: number;
  unmetMealDeficit: number;
  demandDensityScore: number; // 0-100
  severityTier: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'BALANCED';
}

export const CorridorMap: React.FC<CorridorMapProps> = ({
  listings,
  selectedListing,
  onSelectListing,
  onAdvanceGps,
  users,
  darkMode = false,
  onPinCustomLocation,
  liveMapSyncEnabled = true,
  onToggleLiveMapSync,
  forceSyncTrigger = 0,
}) => {
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('combined');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('city');
  const [selectedHubId, setSelectedHubId] = useState<string>('BLR_HSR');
  const [pinDropMode, setPinDropMode] = useState<boolean>(false);
  const [pinnedCoords, setPinnedCoords] = useState<Coordinates | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const activeBatch = selectedListing || listings[0] || null;

  const routeDistanceKm =
    activeBatch && activeBatch.dropoffCoords
      ? calculateDistanceKm(activeBatch.pickupCoords, activeBatch.dropoffCoords)
      : null;

  const minsToSpoil = activeBatch
    ? getMinutesRemaining(activeBatch.expiresAt)
    : 0;

  // Compute live Food Rescue Demand Density across All-India Hubs
  const demandCells: HubDemandCell[] = useMemo(() => {
    return ALL_INDIA_HUBS.map((node) => {
      const incomingOrDeliveredMeals = listings
        .filter((l) => {
          if (l.status === 'POSTED' || l.status === 'EXPIRED') return false;
          const receiver = users.find((u) => u.id === l.claimedByReceiverId);
          return (
            receiver?.neighborhood.toLowerCase() ===
              node.neighborhood.toLowerCase() ||
            l.city?.toLowerCase() === node.city.toLowerCase()
          );
        })
        .reduce((sum, l) => sum + l.servings, 0);

      const availableUnclaimedSurplusMeals = listings
        .filter(
          (l) =>
            l.status === 'POSTED' &&
            (l.neighborhood.toLowerCase() === node.neighborhood.toLowerCase() ||
              l.city?.toLowerCase() === node.city.toLowerCase())
        )
        .reduce((sum, l) => sum + l.servings, 0);

      const unmetMealDeficit = Math.max(
        0,
        node.baselineDailyMealNeed - incomingOrDeliveredMeals
      );

      const rawRatio =
        unmetMealDeficit / Math.max(1, node.baselineDailyMealNeed);
      const demandDensityScore = Math.min(
        98,
        Math.max(20, Math.round(rawRatio * 96))
      );

      let severityTier: HubDemandCell['severityTier'] = 'BALANCED';
      if (demandDensityScore >= 82) {
        severityTier = 'CRITICAL';
      } else if (demandDensityScore >= 65) {
        severityTier = 'HIGH';
      } else if (demandDensityScore >= 45) {
        severityTier = 'MODERATE';
      }

      return {
        ...node,
        incomingOrDeliveredMeals,
        availableUnclaimedSurplusMeals,
        unmetMealDeficit,
        demandDensityScore,
        severityTier,
      };
    });
  }, [listings, users]);

  const inspectedHub = useMemo(() => {
    return (
      demandCells.find((c) => c.id === selectedHubId) || demandCells[0]
    );
  }, [demandCells, selectedHubId]);

  const showHeatmap =
    overlayMode === 'combined' || overlayMode === 'heatmap-focus';
  const showRoutesAndPins =
    overlayMode === 'combined' || overlayMode === 'routes-only';

  // Initialize Leaflet Map instance with explicit Zoom & Attribution controls
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [12.9352, 77.6784], // Default Bengaluru Corridor center
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
    });

    // Explicit Leaflet top-left zoom control
    L.control.zoom({ position: 'topleft', zoomInTitle: 'Zoom in', zoomOutTitle: 'Zoom out' }).addTo(map);

    const tileUrl = darkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    tileLayerRef.current = tileLayer;
    overlayLayerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Explicit Zoom & fitBounds handlers
  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn(1, { animate: true });
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut(1, { animate: true });
  };

  const handleFitRegionBounds = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const points: [number, number][] = [];
    if (activeBatch) {
      points.push([activeBatch.pickupCoords.lat, activeBatch.pickupCoords.lng]);
      points.push([
        activeBatch.currentLocation.lat,
        activeBatch.currentLocation.lng,
      ]);
      if (activeBatch.dropoffCoords) {
        points.push([
          activeBatch.dropoffCoords.lat,
          activeBatch.dropoffCoords.lng,
        ]);
      }
      // Include same-city hubs so the regional corridor fits cleanly
      const activeCity = (activeBatch.city || 'Bengaluru').toLowerCase();
      ALL_INDIA_HUBS.filter(
        (h) => h.city.toLowerCase() === activeCity
      ).forEach((h) => {
        points.push([h.coords.lat, h.coords.lng]);
      });
    } else {
      ALL_INDIA_HUBS.filter((h) => h.city === 'Bengaluru').forEach((h) => {
        points.push([h.coords.lat, h.coords.lng]);
      });
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, {
        padding: [48, 48],
        maxZoom: 13,
        animate: true,
        duration: 0.75,
      });
    }
    setCameraMode('city');
  };

  const handleFitIndiaBounds = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const indiaPoints: [number, number][] = ALL_INDIA_HUBS.map((h) => [
      h.coords.lat,
      h.coords.lng,
    ]);
    listings.forEach((l) => {
      indiaPoints.push([l.pickupCoords.lat, l.pickupCoords.lng]);
      if (l.dropoffCoords) {
        indiaPoints.push([l.dropoffCoords.lat, l.dropoffCoords.lng]);
      }
    });

    const indiaBounds =
      indiaPoints.length > 1
        ? L.latLngBounds(indiaPoints)
        : L.latLngBounds(
            [8.08, 68.1],
            [35.5, 97.4]
          );

    map.fitBounds(indiaBounds, {
      padding: [36, 36],
      maxZoom: 6,
      animate: true,
      duration: 0.85,
    });
    setCameraMode('all-india');
  };

  // Update tile layer when darkMode changes
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const tileUrl = darkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    tileLayerRef.current.setUrl(tileUrl);
  }, [darkMode]);

  // Handle Click-on-Map to pin any custom location in India
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!pinDropMode) return;
      const customCoord: Coordinates = {
        lat: Number(e.latlng.lat.toFixed(5)),
        lng: Number(e.latlng.lng.toFixed(5)),
        hubName: `Custom India Pin (${e.latlng.lat.toFixed(3)}°N, ${e.latlng.lng.toFixed(3)}°E)`,
        city: 'Custom Location (India)',
      };
      setPinnedCoords(customCoord);
      setPinDropMode(false);
      if (onPinCustomLocation) {
        onPinCustomLocation(customCoord);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [pinDropMode, onPinCustomLocation]);

  // Handle Camera View Mode Transitions (All-India vs City Corridor vs Follow Live Rider)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (cameraMode === 'all-india') {
      map.flyTo([21.1458, 79.0882], 5, { duration: 0.9 });
    } else if (cameraMode === 'follow-rider' && activeBatch) {
      map.flyTo(
        [activeBatch.currentLocation.lat, activeBatch.currentLocation.lng],
        13,
        { duration: 0.7 }
      );
    } else if (cameraMode === 'city' && activeBatch) {
      const centerLat = activeBatch.dropoffCoords
        ? (activeBatch.pickupCoords.lat + activeBatch.dropoffCoords.lat) / 2
        : activeBatch.pickupCoords.lat;
      const centerLng = activeBatch.dropoffCoords
        ? (activeBatch.pickupCoords.lng + activeBatch.dropoffCoords.lng) / 2
        : activeBatch.pickupCoords.lng;
      map.flyTo([centerLat, centerLng], 12, { duration: 0.8 });
    }
  }, [cameraMode, activeBatch?.id]);

  // Keep camera synchronized with live rider GPS updates when follow-rider OR liveMapSyncEnabled is active
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeBatch) return;
    const isActiveDelivery =
      activeBatch.status === 'CLAIMED' || activeBatch.status === 'COLLECTED';
    if (
      cameraMode === 'follow-rider' ||
      (liveMapSyncEnabled && isActiveDelivery && cameraMode !== 'all-india')
    ) {
      map.panTo(
        [activeBatch.currentLocation.lat, activeBatch.currentLocation.lng],
        { animate: true, duration: 0.6 }
      );
    }
  }, [
    cameraMode,
    liveMapSyncEnabled,
    activeBatch?.status,
    activeBatch?.currentLocation.lat,
    activeBatch?.currentLocation.lng,
  ]);

  // Immediate map center sync when user clicks "Center Map" in LiveTrackingTransparencyInfo
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeBatch || forceSyncTrigger === 0) return;
    map.flyTo(
      [activeBatch.currentLocation.lat, activeBatch.currentLocation.lng],
      13,
      { duration: 0.65 }
    );
    if (onToggleLiveMapSync) {
      onToggleLiveMapSync(true);
    }
  }, [forceSyncTrigger]);

  // Render Heatmap Circles, Road Polylines, Donor/Shelter Markers, and Moving Rider Van
  useEffect(() => {
    const group = overlayLayerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    // 1. Render All-India Demand Density Heatmap Circles
    if (showHeatmap) {
      demandCells.forEach((cell) => {
        const isCurrentHub = inspectedHub?.id === cell.id;
        const heatColor =
          cell.severityTier === 'CRITICAL'
            ? '#EF4444'
            : cell.severityTier === 'HIGH'
            ? '#F97316'
            : cell.severityTier === 'MODERATE'
            ? '#EAB308'
            : '#10B981';

        const radiusMeters =
          cameraMode === 'all-india'
            ? 38000 + cell.demandDensityScore * 350
            : 1650 + cell.demandDensityScore * 18;

        const circle = L.circle([cell.coords.lat, cell.coords.lng], {
          radius: radiusMeters,
          color: heatColor,
          weight: isCurrentHub ? 2 : 1,
          opacity: isCurrentHub ? 0.85 : 0.45,
          fillColor: heatColor,
          fillOpacity: isCurrentHub ? 0.32 : 0.2,
        });

        circle.on('click', () => {
          setSelectedHubId(cell.id);
        });

        circle.bindTooltip(
          `<div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px;">
            <strong>${cell.city} — ${cell.neighborhood}</strong><br/>
            Demand Density: <b>${cell.demandDensityScore}% (${cell.severityTier})</b><br/>
            Unmet Meal Deficit: <b>${cell.unmetMealDeficit} meals</b>
          </div>`,
          { sticky: true }
        );

        circle.addTo(group);
      });
    }

    // 2. Render Street-Level Multi-Waypoint Delivery Route & Moving Rider Van
    if (showRoutesAndPins && activeBatch) {
      if (activeBatch.dropoffCoords) {
        const waypoints = generateStreetRouteWaypoints(
          activeBatch.pickupCoords,
          activeBatch.dropoffCoords
        );
        const latlngs = waypoints.map(
          (w) => [w.lat, w.lng] as [number, number]
        );

        // Full planned street trajectory (dashed)
        L.polyline(latlngs, {
          color: '#EA580C',
          weight: 4,
          opacity: 0.45,
          dashArray: '8, 8',
        }).addTo(group);

        // Completed route trajectory up to rider's current position (solid)
        const activeSegmentCount = Math.max(
          1,
          Math.floor((activeBatch.currentLocation.progressPct / 100) * latlngs.length)
        );
        const completedLatLngs: [number, number][] = [
          ...latlngs.slice(0, activeSegmentCount),
          [activeBatch.currentLocation.lat, activeBatch.currentLocation.lng],
        ];
        L.polyline(completedLatLngs, {
          color: '#EA580C',
          weight: 5,
          opacity: 0.95,
        }).addTo(group);

        // Receiving NGO Shelter Destination Pin
        const shelterIcon = L.divIcon({
          className: 'leaflet-div-icon',
          html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="background:#16A34A;color:#fff;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;padding:3px 7px;border-radius:6px;border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.3);white-space:nowrap;">
              NGO: ${(activeBatch.claimedByReceiverOrg || 'Shelter').slice(0, 18)}
            </div>
            <div style="width:12px;height:12px;border-radius:9999px;background:#16A34A;border:2px solid #fff;margin-top:2px;"></div>
          </div>`,
          iconSize: [120, 36],
        });
        L.marker(
          [activeBatch.dropoffCoords.lat, activeBatch.dropoffCoords.lng],
          { icon: shelterIcon }
        ).addTo(group);
      }

      // Live Delivery Van Rider Marker (when CLAIMED or COLLECTED)
      if (
        activeBatch.status === 'COLLECTED' ||
        activeBatch.status === 'CLAIMED'
      ) {
        const riderIcon = L.divIcon({
          className: 'leaflet-div-icon',
          html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
            <div style="background:#EA580C;color:#fff;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;padding:4px 8px;border-radius:9999px;border:2px solid #fff;box-shadow:0 6px 14px rgba(234,88,12,0.45);white-space:nowrap;display:flex;align-items:center;gap:4px;">
              <span>🚚 ${activeBatch.currentLocation.progressPct}%</span>
              <span>·</span>
              <span>ETA ${activeBatch.currentLocation.etaMinutes}m</span>
            </div>
            <div style="width:14px;height:14px;border-radius:9999px;background:#EA580C;border:3px solid #fff;margin-top:2px;box-shadow:0 0 0 5px rgba(234,88,12,0.3);"></div>
          </div>`,
          iconSize: [130, 42],
        });

        L.marker(
          [activeBatch.currentLocation.lat, activeBatch.currentLocation.lng],
          { icon: riderIcon, zIndexOffset: 900 }
        ).addTo(group);
      }
    }

    // 3. Render All Surplus Food Batch Pickup Pins Across India
    if (showRoutesAndPins) {
      listings.forEach((item) => {
        const isSelected = activeBatch?.id === item.id;
        const badgeBg =
          item.status === 'DELIVERED'
            ? '#16A34A'
            : item.status === 'COLLECTED'
            ? '#EA580C'
            : item.status === 'CLAIMED'
            ? '#D97706'
            : '#0284C7';

        const qtyLabel = formatListingQuantity(item);
        const batchIcon = L.divIcon({
          className: 'leaflet-div-icon',
          html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);cursor:pointer;">
            <div style="background:${ isSelected ? '#0F172A' : badgeBg };color:#fff;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;padding:3px 7px;border-radius:6px;border:2px solid ${ isSelected ? '#EA580C' : '#fff' };box-shadow:0 3px 8px rgba(0,0,0,0.25);white-space:nowrap;">
              ${item.batchCode} (${qtyLabel})
            </div>
            <div style="width:11px;height:11px;border-radius:9999px;background:${badgeBg};border:2px solid #fff;margin-top:2px;"></div>
          </div>`,
          iconSize: [120, 34],
        });

        const marker = L.marker(
          [item.pickupCoords.lat, item.pickupCoords.lng],
          {
            icon: batchIcon,
            zIndexOffset: isSelected ? 600 : 200,
          }
        );

        marker.on('click', () => {
          onSelectListing(item);
        });

        marker.addTo(group);
      });
    }

    // 4. Custom Pinned Coordinate Marker (if dropped)
    if (pinnedCoords) {
      const pinIcon = L.divIcon({
        className: 'leaflet-div-icon',
        html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
          <div style="background:#7C3AED;color:#fff;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;padding:3px 7px;border-radius:6px;border:2px solid #fff;white-space:nowrap;">
            Custom Pickup Pin
          </div>
          <div style="width:12px;height:12px;border-radius:9999px;background:#7C3AED;border:2px solid #fff;margin-top:2px;"></div>
        </div>`,
        iconSize: [120, 34],
      });
      L.marker([pinnedCoords.lat, pinnedCoords.lng], { icon: pinIcon }).addTo(
        group
      );
    }
  }, [
    listings,
    activeBatch,
    demandCells,
    inspectedHub,
    showHeatmap,
    showRoutesAndPins,
    cameraMode,
    pinnedCoords,
  ]);

  return (
    <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
      {/* Top Map Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Compass className="w-3.5 h-3.5 text-orange-600 dark:text-orange-500" />
            <span>
              All-India Interactive Street Map &amp; Live Delivery Telemetry
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {activeBatch
                ? `${activeBatch.currentLocation.lat.toFixed(4)}° N, ${activeBatch.currentLocation.lng.toFixed(4)}° E`
                : '12.9304° N, 77.6784° E'}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            {activeBatch
              ? `${activeBatch.batchCode} (${activeBatch.city || 'Bengaluru'}): ${activeBatch.title}`
              : 'Select a Surplus Batch to Track'}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Camera Zoom Preset Switcher: All-India vs City Corridor vs Follow Rider */}
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
            role="group"
            aria-label="Map Camera Scope"
          >
            <button
              type="button"
              onClick={() => setCameraMode('all-india')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                cameraMode === 'all-india'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-orange-600" />
              All-India Map
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('city')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                cameraMode === 'city'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              City Corridor
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('follow-rider')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                cameraMode === 'follow-rider'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <LocateFixed className="w-3.5 h-3.5 text-emerald-600" />
              Follow Rider
            </button>
          </div>

          {/* Layer Mode Segmented Control */}
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
            role="group"
            aria-label="Map Overlay Mode"
          >
            <button
              type="button"
              onClick={() => setOverlayMode('combined')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                overlayMode === 'combined'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-orange-600" />
              Heatmap + GPS
            </button>
            <button
              type="button"
              onClick={() => setOverlayMode('heatmap-focus')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                overlayMode === 'heatmap-focus'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-red-500" />
              Demand Only
            </button>
            <button
              type="button"
              onClick={() => setOverlayMode('routes-only')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                overlayMode === 'routes-only'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Routes Only
            </button>
          </div>

          {/* Explicit Zoom & fitBounds Control Group */}
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
            role="group"
            aria-label="Leaflet Zoom and fitBounds Controls"
          >
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In (+)"
              className="px-2 py-1 text-xs font-semibold rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5 text-orange-600" />
              <span>+</span>
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out (-)"
              className="px-2 py-1 text-xs font-semibold rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5 text-orange-600" />
              <span>-</span>
            </button>
            <button
              type="button"
              onClick={handleFitRegionBounds}
              title="fitBounds to Current Region / Active Delivery Route"
              className="px-2.5 py-1 text-xs font-medium rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
              Fit Region
            </button>
            <button
              type="button"
              onClick={handleFitIndiaBounds}
              title="fitBounds to Entire India Map"
              className="px-2.5 py-1 text-xs font-medium rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-orange-600" />
              Fit All-India
            </button>
          </div>

          {/* Pin Any Place in India Button */}
          <button
            type="button"
            onClick={() => setPinDropMode((p) => !p)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              pinDropMode
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-orange-500'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {pinDropMode
              ? 'Click Anywhere on Map...'
              : 'Pin Custom Place on Map'}
          </button>
        </div>
      </div>

      {/* Interactive Leaflet Street Map Container + Floating Controls & Live Delivery Rider Card */}
      <div className="relative">
        <div
          ref={mapContainerRef}
          className="w-full h-[400px] md:h-[440px] bg-slate-900"
        />

        {/* Floating Quick fitBounds Reset Bar (Bottom-Left over Map) */}
        <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 shadow-md">
          <button
            type="button"
            onClick={handleFitRegionBounds}
            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fit Current Region
          </button>
          <button
            type="button"
            onClick={handleFitIndiaBounds}
            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-orange-600 text-white hover:bg-orange-500 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Globe className="w-3.5 h-3.5" />
            Fit Entire India Map
          </button>
        </div>

        {/* Modern Food-Delivery Floating Live Rider & Thermal Card (Top-Right Overlay) */}
        {activeBatch && (
          <div className="absolute top-3 right-3 z-[400] w-80 max-w-[calc(100%-24px)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-lg space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {activeBatch.status === 'COLLECTED'
                    ? 'LIVE RIDER EN ROUTE'
                    : activeBatch.status === 'CLAIMED'
                    ? 'VOLUNTEER ASSIGNED · AT DONOR'
                    : activeBatch.status === 'DELIVERED'
                    ? 'VERIFIED DELIVERED'
                    : 'AWAITING SHELTER CLAIM'}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {activeBatch.assignedVolunteerName || 'Karthik V. (Fleet Ready)'}
                </div>
              </div>

              <div className="text-right font-mono-tabular">
                <div className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                  {activeBatch.status === 'DELIVERED'
                    ? 'Arrived'
                    : `${activeBatch.currentLocation.etaMinutes} min ETA`}
                </div>
                <div className="text-[11px] text-slate-500">
                  {activeBatch.currentLocation.speedKmh > 0
                    ? `${activeBatch.currentLocation.speedKmh} km/h`
                    : 'Stationary'}
                </div>
              </div>
            </div>

            {/* Live Progress Bar along Street Route */}
            <div>
              <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-mono-tabular">
                <span className="truncate max-w-[190px]">
                  {activeBatch.currentLocation.checkpointName ||
                    activeBatch.pickupCoords.hubName}
                </span>
                <span>{activeBatch.currentLocation.progressPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-600 transition-all duration-500"
                  style={{
                    width: `${activeBatch.currentLocation.progressPct}%`,
                  }}
                />
              </div>
            </div>

            {/* Granular Food Telemetry Summary on Delivery Card */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1 font-medium">
                <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                State: <strong>{activeBatch.foodState || 'Hot'}</strong> (
                {activeBatch.preparedWhen || 'Just Now'})
              </span>
              <span className="font-mono-tabular font-semibold">
                {formatListingQuantity(activeBatch)}
              </span>
            </div>

            {(activeBatch.status === 'COLLECTED' ||
              activeBatch.status === 'CLAIMED') && (
              <button
                type="button"
                onClick={() => onAdvanceGps(activeBatch.id)}
                className="w-full py-1.5 px-3 text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Navigation className="w-3.5 h-3.5" />
                Advance Rider GPS (+20% Street Route)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Interactive All-India Neighborhood Demand Density & Dispatch Insights Strip */}
      {showHeatmap && inspectedHub && (
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-200">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium mr-1">
              All-India Demand Hubs:
            </span>
            {demandCells.slice(0, 10).map((cell) => {
              const isCurrent = cell.id === inspectedHub.id;
              return (
                <button
                  key={cell.id}
                  type="button"
                  onClick={() => {
                    setSelectedHubId(cell.id);
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.flyTo(
                        [cell.coords.lat, cell.coords.lng],
                        12,
                        { duration: 0.7 }
                      );
                    }
                  }}
                  className={`px-2 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isCurrent
                      ? 'bg-orange-600 text-white font-semibold'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {cell.city === 'Bengaluru'
                    ? cell.neighborhood
                    : `${cell.city}`}{' '}
                  ({cell.demandDensityScore}%)
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono-tabular text-slate-200">
            <span className="flex items-center gap-1.5 text-orange-400 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              {inspectedHub.city} ({inspectedHub.neighborhood}):{' '}
              {inspectedHub.severityTier}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>Need: {inspectedHub.baselineDailyMealNeed}m</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-red-400 font-semibold">
              Deficit: {inspectedHub.unmetMealDeficit} meals
            </span>
          </div>
        </div>
      )}

      {/* Bottom Map Telemetry Bar */}
      {activeBatch && (
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-300">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <MapPin className="w-3.5 h-3.5 text-orange-400" />
              Origin: {activeBatch.donorOrg} ({activeBatch.neighborhood},{' '}
              {activeBatch.city || 'Bengaluru'})
            </span>
            <span aria-hidden="true" className="text-slate-600">
              →
            </span>
            <span className="flex items-center gap-1.5 text-slate-300">
              <Truck className="w-3.5 h-3.5 text-emerald-400" />
              Destination:{' '}
              {activeBatch.claimedByReceiverOrg ||
                'Awaiting Shelter Match Claim'}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono-tabular text-slate-300">
            {routeDistanceKm !== null && (
              <>
                <span>Road Dist: {routeDistanceKm} km</span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
              </>
            )}
            <span>Spoilage Window: {minsToSpoil}m left</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>
              Dairy: {activeBatch.containsDairy ? 'Yes' : 'No'} · State:{' '}
              {activeBatch.foodState || 'Hot'}
            </span>
          </div>
        </div>
      )}

      {/* Mandatory Handling & Privacy Guardrail Strip */}
      <div className="px-5 py-2.5 bg-amber-50/70 dark:bg-amber-950/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 text-xs text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Handling Guidance:</strong>{' '}
            {activeBatch?.handlingGuidance ||
              'Keep sealed in thermal carriers above 60°C or chilled below 5°C.'}
          </span>
        </div>
        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          Synthetic Corridor Nodes Only · Non-Certified Peer Transfer
        </span>
      </div>
    </div>
  );
};
