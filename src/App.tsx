import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  KeyRound,
  Moon,
  Navigation,
  QrCode,
  Search,
  Sun,
  Truck,
} from 'lucide-react';
import { AuthRoleModal } from './components/AuthRoleModal';
import { CorridorMap } from './components/CorridorMap';
import { ImpactBusinessView } from './components/ImpactBusinessView';
import { LiveTrackingTransparencyInfo } from './components/LiveTrackingTransparencyInfo';
import { MySurplusHistoryView } from './components/MySurplusHistoryView';
import { QrScannerOverlay } from './components/QrScannerOverlay';
import { RapidDonorModal } from './components/RapidDonorModal';
import { useLiveTracking } from './hooks/useLiveTracking';
import {
  Coordinates,
  DietaryType,
  FoodListing,
  ListingStatus,
  NotificationItem,
  UserProfile,
} from './types';
import {
  computeSmartMatches,
  formatListingQuantity,
  getMinutesRemaining,
  IMPACT_ASSUMPTIONS,
} from './utils/matching';

type ActiveSection =
  | 'dispatch'
  | 'history'
  | 'matching'
  | 'impact'
  | 'guardrails';

export default function App() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [listings, setListings] = useState<FoodListing[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('user-donor-1');
  const [selectedListingId, setSelectedListingId] = useState<string>('lst-101');
  const [activeSection, setActiveSection] = useState<ActiveSection>('dispatch');

  // Theme state synced with document.documentElement
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Modals & Custom Map Pinning
  const [isDonorModalOpen, setIsDonorModalOpen] = useState<boolean>(false);
  const [customPinnedCoords, setCustomPinnedCoords] =
    useState<Coordinates | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [qrScannerState, setQrScannerState] = useState<{
    isOpen: boolean;
    otpType: 'pickup' | 'dropoff';
  }>({ isOpen: false, otpType: 'pickup' });

  // Filters
  const [statusFilter, setStatusFilter] = useState<ListingStatus | 'ALL'>('ALL');
  const [dietFilter, setDietFilter] = useState<DietaryType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // OTP Verification inputs
  const [otpInput, setOtpInput] = useState<string>('');
  const [tempInputC, setTempInputC] = useState<string>('62.5');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [liveMapSyncEnabled, setLiveMapSyncEnabled] = useState<boolean>(true);
  const [forceSyncTrigger, setForceSyncTrigger] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Initial fetch + WebSocket real-time state sync
  useEffect(() => {
    let isMounted = true;

    async function fetchInitialState() {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setUsers(data.users || []);
            setListings(data.listings || []);
            setNotifications(data.notifications || []);
            setLoadingInitial(false);
          }
        }
      } catch {
        if (isMounted) setLoadingInitial(false);
      }
    }

    fetchInitialState();

    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.state && isMounted) {
            setUsers(payload.state.users || []);
            setListings(payload.state.listings || []);
            setNotifications(payload.state.notifications || []);
            setLoadingInitial(false);
          }
        } catch {
          // ignore malformed ws message
        }
      };

      socket.onclose = () => {
        if (isMounted) {
          window.setTimeout(connectWs, 2500);
        }
      };
    };

    connectWs();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const currentUser = useMemo(() => {
    return (
      users.find((u) => u.id === currentUserId) ||
      users[0] || {
        id: 'user-donor-1',
        name: 'Arvind Rao',
        email: 'dispatch@royallotuscaterers.sample.in',
        role: 'donor',
        organization: 'Royal Lotus Wedding & Banquet Caterers',
        subType: 'Wedding Caterer',
        neighborhood: 'Bellandur',
        city: 'Bengaluru',
        stateName: 'Karnataka',
        coordinates: {
          lat: 12.9304,
          lng: 77.6784,
          hubName: 'Bellandur Outer Ring Road Corridor',
          city: 'Bengaluru',
          state: 'Karnataka',
        },
        capacityKg: 250,
        verifiedPartner: true,
        contactSynthetic: 'SYNTH-BLR-8821',
      }
    );
  }, [users, currentUserId]);

  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (dietFilter !== 'ALL') {
        if (
          dietFilter === 'Veg' &&
          item.dietaryType !== 'Veg' &&
          item.dietaryType !== 'Pure Veg'
        ) {
          return false;
        } else if (dietFilter !== 'Veg' && item.dietaryType !== dietFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText =
          item.title.toLowerCase().includes(q) ||
          item.donorOrg.toLowerCase().includes(q) ||
          item.neighborhood.toLowerCase().includes(q) ||
          (item.city && item.city.toLowerCase().includes(q)) ||
          item.batchCode.toLowerCase().includes(q) ||
          item.itemsSummary.toLowerCase().includes(q);
        if (!matchText) return false;
      }
      return true;
    });
  }, [listings, statusFilter, dietFilter, searchQuery]);

  const selectedListing = useMemo(() => {
    return (
      listings.find((l) => l.id === selectedListingId) ||
      filteredListings[0] ||
      listings[0] ||
      null
    );
  }, [listings, filteredListings, selectedListingId]);

  // Synchronize default OTP and temp suggestion whenever selectedListing changes
  useEffect(() => {
    if (!selectedListing) return;
    if (selectedListing.status === 'CLAIMED') {
      setOtpInput(selectedListing.pickupOtp);
      setTempInputC(
        selectedListing.storageCondition.includes('Chilled') ? '4.2' : '62.5'
      );
    } else if (selectedListing.status === 'COLLECTED') {
      setOtpInput(selectedListing.dropoffOtp);
      setTempInputC(
        selectedListing.storageCondition.includes('Chilled') ? '4.5' : '60.8'
      );
    } else {
      setOtpInput('');
    }
    setActionFeedback(null);
  }, [selectedListing?.id, selectedListing?.status]);

  const smartMatches = useMemo(() => {
    if (!selectedListing) return [];
    return computeSmartMatches(selectedListing, users);
  }, [selectedListing, users]);

  const isAssignedVolunteer =
    currentUser.role === 'volunteer' &&
    (!selectedListing?.assignedVolunteerId ||
      selectedListing.assignedVolunteerId === currentUser.id);

  const isAuthorizedViewer =
    isAssignedVolunteer ||
    currentUser.id === selectedListing?.donorId ||
    currentUser.id === selectedListing?.claimedByReceiverId ||
    currentUser.role === 'sponsor';

  const liveTracking = useLiveTracking({
    deliveryId: selectedListing?.id,
    volunteerId: currentUser.id,
    deliveryStatus: selectedListing?.status,
    isAuthorizedVolunteer: isAssignedVolunteer,
    wsRef,
    syncIntervalMs: 5000,
  });

  const roleNotifications = useMemo(() => {
    return notifications.filter((n) =>
      n.targetRoles.includes(currentUser.role)
    );
  }, [notifications, currentUser.role]);

  const unreadCount = useMemo(() => {
    return roleNotifications.filter(
      (n) => !n.readByUserIds.includes(currentUser.id)
    ).length;
  }, [roleNotifications, currentUser.id]);

  // Handlers
  const handleClaimListing = async (
    listingId: string,
    receiverId?: string,
    volunteerId?: string
  ) => {
    setActionFeedback(null);
    try {
      const targetReceiverId =
        receiverId ||
        (currentUser.role === 'receiver'
          ? currentUser.id
          : smartMatches[0]?.receiver.id);
      const targetVolunteerId =
        volunteerId ||
        (currentUser.role === 'volunteer'
          ? currentUser.id
          : smartMatches[0]?.volunteer?.id);

      const res = await fetch(`/api/listings/${listingId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId: targetReceiverId,
          volunteerId: targetVolunteerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not claim listing');
      }
      setActionFeedback({
        type: 'success',
        text: `Batch ${data.listing.batchCode} claimed for ${data.listing.claimedByReceiverOrg}. Pickup OTP is ${data.listing.pickupOtp}.`,
      });
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Claim failed',
      });
    }
  };

  const handleVerifyOtp = async (
    listingId: string,
    otpType: 'pickup' | 'dropoff',
    explicitOtpCode?: string,
    explicitTempC?: number
  ) => {
    setActionFeedback(null);
    const codeToVerify = explicitOtpCode ?? otpInput;
    const tempToVerify =
      explicitTempC !== undefined ? explicitTempC : Number(tempInputC);

    try {
      const res = await fetch(`/api/listings/${listingId}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otpType,
          otpCode: codeToVerify,
          temperatureC: tempToVerify,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'OTP Verification failed');
      }
      setOtpInput(codeToVerify);
      setTempInputC(String(tempToVerify));
      setActionFeedback({
        type: 'success',
        text:
          otpType === 'pickup'
            ? `Packaging QR / Pickup OTP (${codeToVerify}) verified! Batch ${data.listing.batchCode} is now COLLECTED & in live GPS transit.`
            : `Shelter QR / Drop-off OTP (${codeToVerify}) verified! Batch ${data.listing.batchCode} DELIVERED (${data.listing.servings} meals credited).`,
      });
    } catch (err: unknown) {
      setActionFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'OTP verification error',
      });
    }
  };

  const handleAdvanceGps = async (listingId: string) => {
    try {
      await fetch(`/api/listings/${listingId}/advance-gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepPct: 20 }),
      });
    } catch {
      // ignore
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
    } catch {
      // ignore
    }
  };

  // Top-level live network metrics
  const corridorTotals = useMemo(() => {
    const active = listings.filter((l) => l.status !== 'EXPIRED');
    const meals = active.reduce((sum, l) => sum + l.servings, 0);
    const kg = Number(
      active.reduce((sum, l) => sum + l.weightKg, 0).toFixed(1)
    );
    const co2 = Number(
      (kg * IMPACT_ASSUMPTIONS.CO2E_KG_PER_KG_FOOD_WASTE).toFixed(1)
    );
    return { meals, kg, co2 };
  }, [listings]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Strict 3-Zone Top Navigation Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#dispatch"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('dispatch');
          }}
          className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 font-display"
        >
          AnnaKshetra
        </a>

        {/* Zone 2: 5 clean single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-400">
          <a
            href="#dispatch"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('dispatch');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'dispatch'
                ? 'text-slate-900 dark:text-white underline underline-offset-8 decoration-2 decoration-orange-600 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Live Dispatch Map
          </a>
          <a
            href="#history"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('history');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'history'
                ? 'text-slate-900 dark:text-white underline underline-offset-8 decoration-2 decoration-orange-600 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            My Surplus History
          </a>
          <a
            href="#matching"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('matching');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'matching'
                ? 'text-slate-900 dark:text-white underline underline-offset-8 decoration-2 decoration-orange-600 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Smart Matching
          </a>
          <a
            href="#impact"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('impact');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'impact'
                ? 'text-slate-900 dark:text-white underline underline-offset-8 decoration-2 decoration-orange-600 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Impact &amp; ROI
          </a>
          <a
            href="#guardrails"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('guardrails');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              activeSection === 'guardrails'
                ? 'text-slate-900 dark:text-white underline underline-offset-8 decoration-2 decoration-orange-600 font-semibold'
                : 'hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Safety Guardrails
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setCustomPinnedCoords(null);
              setIsDonorModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            + Post Surplus (&lt;60s)
          </button>
        </div>
      </header>

      {/* Main Workspace Layout: Left Sidebar (272px) + Primary Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto">
        {/* Left Operational Sidebar: Instant Role Switcher + Live WebSocket Notifications */}
        <aside className="w-full lg:w-72 shrink-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-6">
          <div className="space-y-6">
            {/* Active Authenticated Role Card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Active Role &amp; Account
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDarkMode((d) => !d)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-md border border-slate-200 dark:border-slate-800 cursor-pointer"
                    title={
                      darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'
                    }
                  >
                    {darkMode ? (
                      <Sun className="w-3.5 h-3.5" />
                    ) : (
                      <Moon className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="px-2 py-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
                  >
                    Directory / New
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold uppercase text-orange-600 dark:text-orange-400">
                    {currentUser.role}
                  </span>{' '}
                  · {currentUser.subType}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {currentUser.organization}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {currentUser.name} · {currentUser.neighborhood}
                  {currentUser.city ? `, ${currentUser.city}` : ''}
                </div>
                {currentUser.role === 'donor' && (
                  <button
                    type="button"
                    onClick={() => setActiveSection('history')}
                    className="mt-2.5 w-full py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-orange-600/10 text-orange-700 dark:text-orange-300 border border-orange-600/20 hover:bg-orange-600/15 transition-colors cursor-pointer text-center"
                  >
                    View My Surplus History &amp; Savings →
                  </button>
                )}
              </div>

              {/* Instant 1-Click Role Switcher Buttons for Rapid Evaluation */}
              <div className="mt-2.5">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                  Instant Demo Role Switcher:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {users.slice(0, 6).map((u) => {
                    const isCurrent = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setCurrentUserId(u.id)}
                        className={`px-2.5 py-1.5 text-left rounded-lg border text-xs transition-colors truncate cursor-pointer ${
                          isCurrent
                            ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 font-semibold'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                        title={`${u.role.toUpperCase()}: ${u.organization}`}
                      >
                        {u.role === 'donor'
                          ? `Donor (${u.neighborhood})`
                          : u.role === 'receiver'
                          ? `NGO (${u.neighborhood})`
                          : u.role === 'volunteer'
                          ? `Volunteer Van`
                          : `CSR Sponsor`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mobile Section Switcher */}
            <div className="flex md:hidden flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  ['dispatch', 'Map'],
                  ['history', 'History'],
                  ['matching', 'Match'],
                  ['impact', 'Impact'],
                  ['guardrails', 'Safety'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key)}
                  className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md cursor-pointer ${
                    activeSection === key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Real-Time WebSocket Notification Stream */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <Bell className="w-3.5 h-3.5 text-orange-600" />
                  <span>Live Network Alerts</span>
                  {unreadCount > 0 && (
                    <span className="font-mono-tabular text-orange-600 dark:text-orange-400">
                      ({unreadCount} new)
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkNotificationsRead}
                    className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Mark read
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {roleNotifications.map((notif) => {
                  const isUnread = !notif.readByUserIds.includes(
                    currentUser.id
                  );
                  return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (notif.listingId) {
                          setSelectedListingId(notif.listingId);
                          setActiveSection('dispatch');
                        }
                      }}
                      className={`p-3 rounded-xl border text-xs transition-colors cursor-pointer ${
                        isUnread
                          ? 'bg-orange-50/40 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/60'
                          : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {notif.title}
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 font-mono-tabular">
                        {notif.batchCode ? `${notif.batchCode} · ` : ''}
                        {new Date(notif.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* All-India Summary Mini Ledger */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-xs space-y-1.5 text-slate-500 dark:text-slate-400">
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              All-India Network Ledger
            </div>
            <div className="flex justify-between font-mono-tabular">
              <span>Meals Active/Saved:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {corridorTotals.meals.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between font-mono-tabular">
              <span>Surplus Diverted:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {corridorTotals.kg.toLocaleString('en-IN')} kg
              </span>
            </div>
            <div className="flex justify-between font-mono-tabular">
              <span>Methane Avoided:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {corridorTotals.co2.toLocaleString('en-IN')} kg CO₂e
              </span>
            </div>
          </div>
        </aside>

        {/* Primary Main Workspace Canvas */}
        <main className="flex-1 p-6 lg:p-8 space-y-6 overflow-x-hidden">
          {activeSection === 'dispatch' && (
            <>
              {/* Corridor Header & Quick Role Guidance */}
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    All-India Live Food Rescue Network (Bengaluru · Mumbai ·
                    Delhi NCR · Hyderabad · Chennai · Kolkata · Pune &amp; Custom
                    Map Pins)
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    Real-Time Surplus Pickup Coordination &amp; Dual-OTP
                    Custody
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveSection('history')}
                    className="px-3.5 py-2 text-xs font-semibold border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-950/30 rounded-lg hover:bg-orange-100/60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    My Surplus History &amp; Savings Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveSection('matching')}
                    className="px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Smart Match Scores ({smartMatches.length} NGOs)
                  </button>
                </div>
              </div>

              {/* Interactive All-India Leaflet Street Map & Live Rider GPS Tracker */}
              <CorridorMap
                listings={listings}
                selectedListing={selectedListing}
                onSelectListing={(item) => setSelectedListingId(item.id)}
                onAdvanceGps={handleAdvanceGps}
                users={users}
                darkMode={darkMode}
                onPinCustomLocation={(coords) => {
                  setCustomPinnedCoords(coords);
                  setIsDonorModalOpen(true);
                }}
                liveMapSyncEnabled={liveMapSyncEnabled}
                onToggleLiveMapSync={setLiveMapSyncEnabled}
                forceSyncTrigger={forceSyncTrigger}
              />

              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                {/* Interactive Status Segmented Control */}
                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
                  {(
                    [
                      ['ALL', 'All Batches'],
                      ['POSTED', '1. Posted'],
                      ['CLAIMED', '2. Claimed'],
                      ['COLLECTED', '3. Collected (In Transit)'],
                      ['DELIVERED', '4. Delivered'],
                    ] as const
                  ).map(([st, label]) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        statusFilter === st
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Dietary & Text Search */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={dietFilter}
                    onChange={(e) =>
                      setDietFilter(e.target.value as DietaryType | 'ALL')
                    }
                    className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-200"
                  >
                    <option value="ALL">All Food Types</option>
                    <option value="Veg">Veg / Pure Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Contains Egg">Contains Egg</option>
                    <option value="Jain">Jain</option>
                    <option value="Vegan">Vegan</option>
                  </select>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search dish, city, caterer, hub..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 w-56"
                    />
                  </div>
                </div>
              </div>

              {/* Split Master-Detail Grid: Surplus Listings Queue (Left) + Custody & Dual-OTP Console (Right) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left 7 Columns: Live Surplus Batches List */}
                <div className="xl:col-span-7 space-y-3">
                  {loadingInitial ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="h-32 rounded-xl bg-slate-200/60 dark:bg-slate-800/40 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : filteredListings.length === 0 ? (
                    <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        No Surplus Food Batches Match Current Filter
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Reset your status/dietary filters or post a new surplus
                        food batch anywhere across India in under 60 seconds.
                      </p>
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter('ALL');
                            setDietFilter('ALL');
                            setSearchQuery('');
                          }}
                          className="px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                        >
                          Reset Filters
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomPinnedCoords(null);
                            setIsDonorModalOpen(true);
                          }}
                          className="px-4 py-2 text-xs font-semibold bg-orange-600 text-white rounded-lg cursor-pointer"
                        >
                          + Post New Surplus Batch
                        </button>
                      </div>
                    </div>
                  ) : (
                    filteredListings.map((item) => {
                      const isSelected = selectedListing?.id === item.id;
                      const minsLeft = getMinutesRemaining(item.expiresAt);
                      const pickupMinsLeft = getMinutesRemaining(
                        item.pickupByTime
                      );

                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedListingId(item.id)}
                          className={`p-5 rounded-xl border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-white dark:bg-slate-900 border-orange-600 dark:border-orange-500 shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          {/* Clean Unboxed Metadata Header (Zero-Pill Compliance) */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                                {item.batchCode}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-orange-600 dark:text-orange-400">
                                Status: {item.status}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{item.donorType}</span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {item.neighborhood}
                                {item.city ? `, ${item.city}` : ''}
                              </span>
                            </div>

                            <div
                              className={`font-mono-tabular font-semibold ${
                                item.status === 'DELIVERED'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : minsLeft <= 45
                                  ? 'text-red-600 dark:text-red-400'
                                  : minsLeft <= 90
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {item.status === 'DELIVERED'
                                ? '✓ Safely Delivered'
                                : `Spoils in ${minsLeft}m (Pickup: ${pickupMinsLeft}m)`}
                            </div>
                          </div>

                          {/* Primary Batch Title & Quantity */}
                          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                              {item.title}
                            </h3>
                            <span className="text-sm font-bold font-mono-tabular text-slate-900 dark:text-slate-100">
                              {item.servings} meals (
                              {formatListingQuantity(item)})
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                            {item.itemsSummary}
                          </p>

                          {/* Safety, Dairy, Preparation Age, Food State & Allergen Unboxed Metadata Footer */}
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {item.dietaryType}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>
                                {item.containsDairy
                                  ? 'Contains Dairy'
                                  : 'Dairy-Free'}
                              </span>
                              {item.foodState && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>State: {item.foodState}</span>
                                </>
                              )}
                              {item.preparedWhen && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>Prep: {item.preparedWhen}</span>
                                </>
                              )}
                              <span aria-hidden="true">·</span>
                              <span>
                                Allergens:{' '}
                                {item.allergens.length > 0
                                  ? item.allergens.join(', ')
                                  : 'None Declared'}
                              </span>
                            </div>

                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                              {item.donorOrg}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Right 5 Columns: Selected Batch Live Custody, OTP Handshake & Safety Detail */}
                <div className="xl:col-span-5">
                  {selectedListing ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 sticky top-20">
                      {/* Header */}
                      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-mono-tabular font-semibold text-orange-600 dark:text-orange-400">
                            BATCH {selectedListing.batchCode}
                          </span>
                          <span className="font-mono-tabular">
                            {selectedListing.servings} servings ·{' '}
                            {formatListingQuantity(selectedListing)}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {selectedListing.title}
                        </h3>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Donor: <strong>{selectedListing.donorOrg}</strong> (
                          {selectedListing.neighborhood}
                          {selectedListing.city
                            ? `, ${selectedListing.city}`
                            : ''}
                          )
                        </div>
                      </div>

                      {/* 4-Stage Pickup Coordination Progress Stepper */}
                      <div>
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2.5">
                          Live Custody Lifecycle (Posted → Claimed → Collected →
                          Delivered)
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                          {(
                            [
                              ['POSTED', '1. Posted'],
                              ['CLAIMED', '2. Claimed'],
                              ['COLLECTED', '3. Collected'],
                              ['DELIVERED', '4. Delivered'],
                            ] as const
                          ).map(([stageKey, stageLabel], idx) => {
                            const order = [
                              'POSTED',
                              'CLAIMED',
                              'COLLECTED',
                              'DELIVERED',
                            ];
                            const currentIdx = order.indexOf(
                              selectedListing.status
                            );
                            const isCompleted = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;

                            return (
                              <div
                                key={stageKey}
                                className={`py-2 px-1.5 rounded-lg border text-xs font-medium ${
                                  isCurrent
                                    ? 'border-orange-600 bg-orange-50/70 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-bold'
                                    : isCompleted
                                    ? 'border-emerald-600/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                                    : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600'
                                }`}
                              >
                                {stageLabel}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Real-Time Volunteer Browser GPS Tracking Panel (watchPosition -> 5s WebSocket sync) */}
                      {(selectedListing.status === 'CLAIMED' ||
                        selectedListing.status === 'COLLECTED') && (
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <Navigation className="w-3.5 h-3.5 text-orange-600" />
                              Live Volunteer GPS Tracking (5s WebSocket Sync)
                            </span>
                            <span
                              className={`text-[11px] font-mono-tabular font-semibold ${
                                liveTracking.isTracking ||
                                selectedListing.currentLocation.liveGpsActive
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {liveTracking.isTracking
                                ? '● Broadcasting Device GPS'
                                : selectedListing.currentLocation.liveGpsActive
                                ? '● Live Volunteer GPS Active'
                                : '○ Ready for Device GPS'}
                            </span>
                          </div>

                          {isAuthorizedViewer ? (
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono-tabular text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                              <div>
                                <span className="text-slate-400 block">
                                  Volunteer Coordinates:
                                </span>
                                <strong>
                                  {selectedListing.currentLocation.lat.toFixed(
                                    5
                                  )}
                                  °N,{' '}
                                  {selectedListing.currentLocation.lng.toFixed(
                                    5
                                  )}
                                  °E
                                </strong>
                              </div>
                              <div>
                                <span className="text-slate-400 block">
                                  Last Updated:
                                </span>
                                <strong>
                                  {selectedListing.currentLocation
                                    .lastGpsUpdatedAt
                                    ? new Date(
                                        selectedListing.currentLocation.lastGpsUpdatedAt
                                      ).toLocaleTimeString()
                                    : liveTracking.lastSyncedAt
                                    ? new Date(
                                        liveTracking.lastSyncedAt
                                      ).toLocaleTimeString()
                                    : 'Live Stream'}
                                </strong>
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-amber-700 dark:text-amber-300">
                              Switch to the assigned Donor, Receiver NGO, or
                              Volunteer account to view or broadcast protected
                              delivery coordinates.
                            </div>
                          )}

                          {currentUser.role === 'volunteer' ? (
                            <div className="flex items-center gap-2">
                              {!liveTracking.isTracking ? (
                                <button
                                  type="button"
                                  onClick={liveTracking.startTracking}
                                  className="flex-1 py-2 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
                                >
                                  Start Live GPS Tracking (watchPosition)
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={liveTracking.stopTracking}
                                  className="flex-1 py-2 px-3 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
                                >
                                  Stop Live GPS Broadcast
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Viewing as{' '}
                              <strong className="uppercase">
                                {currentUser.role}
                              </strong>
                              . Switch to{' '}
                              <strong>Volunteer Van (Karthik V.)</strong> in the
                              left sidebar to broadcast your browser&apos;s real
                              GPS coordinates via{' '}
                              <code>navigator.geolocation.watchPosition</code>.
                            </div>
                          )}

                          {liveTracking.errorMessage && (
                            <div className="text-[11px] text-red-600 dark:text-red-400">
                              {liveTracking.errorMessage}
                            </div>
                          )}

                          {/* Contextual Info Tooltip & Companion Transparency Panel for Donor & Receiver Dashboards */}
                          <LiveTrackingTransparencyInfo
                            listing={selectedListing}
                            userRole={currentUser.role}
                            isAuthorizedViewer={isAuthorizedViewer}
                            isDeviceGpsBroadcasting={liveTracking.isTracking}
                            lastSyncedAt={liveTracking.lastSyncedAt}
                            liveMapSyncEnabled={liveMapSyncEnabled}
                            onToggleLiveMapSync={setLiveMapSyncEnabled}
                            onForceSyncMapNow={() =>
                              setForceSyncTrigger((n) => n + 1)
                            }
                          />
                        </div>
                      )}

                      {/* Interactive Action Box based on Current Stage */}
                      {selectedListing.status === 'POSTED' && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              Top Smart-Matched Shelter &amp; Volunteer
                            </span>
                            {smartMatches[0] && (
                              <span className="text-xs font-mono-tabular font-bold text-emerald-600 dark:text-emerald-400">
                                {smartMatches[0].totalMatchScore}% Match Score
                              </span>
                            )}
                          </div>

                          {smartMatches[0] && (
                            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                              <div>
                                <strong>Recommended NGO:</strong>{' '}
                                {smartMatches[0].receiver.organization} (
                                {smartMatches[0].receiver.neighborhood})
                              </div>
                              <div>
                                <strong>Why Matched:</strong>{' '}
                                {smartMatches[0].rationale}
                              </div>
                              <div>
                                <strong>Nearest Courier:</strong>{' '}
                                {smartMatches[0].volunteer?.name} (
                                {smartMatches[0].volunteer?.vehicleType})
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              handleClaimListing(selectedListing.id)
                            }
                            className="w-full py-2.5 px-4 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Truck className="w-4 h-4" />
                            Claim for Shelter &amp; Dispatch Volunteer Now
                          </button>
                        </div>
                      )}

                      {selectedListing.status === 'CLAIMED' && (
                        <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/70 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <KeyRound className="w-4 h-4 text-orange-600" />
                              Step 2 → 3: Donor Pickup Custody Verification
                            </span>
                            <span className="text-xs font-mono-tabular font-semibold text-amber-800 dark:text-amber-300">
                              Donor OTP: {selectedListing.pickupOtp}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Volunteer{' '}
                            <strong>
                              {selectedListing.assignedVolunteerName}
                            </strong>{' '}
                            is at{' '}
                            <strong>{selectedListing.donorOrg}</strong> loading
                            dock. Scan the unique QR code on the donor&apos;s
                            sealed container for instant verification, or enter
                            the 4-digit Pickup OTP below.
                          </p>

                          {/* Primary Fast QR Scanner Action */}
                          <button
                            type="button"
                            onClick={() =>
                              setQrScannerState({
                                isOpen: true,
                                otpType: 'pickup',
                              })
                            }
                            className="w-full py-2.5 px-4 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                          >
                            <QrCode className="w-4 h-4" />
                            Scan Donor Packaging QR Code (Instant Verify)
                          </button>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/60" />
                            <span>or manual 4-digit OTP fallback</span>
                            <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800/60" />
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                4-Digit Pickup OTP
                              </label>
                              <input
                                type="text"
                                maxLength={4}
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value)}
                                className="w-full px-3 py-2 text-sm font-mono-tabular font-bold tracking-widest border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                Probe Temp (°C)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={tempInputC}
                                onChange={(e) => setTempInputC(e.target.value)}
                                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleVerifyOtp(selectedListing.id, 'pickup')
                            }
                            className="w-full py-2 px-4 text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            Verify Manual Pickup OTP &amp; Start Transit
                          </button>
                        </div>
                      )}

                      {selectedListing.status === 'COLLECTED' && (
                        <div className="p-4 rounded-xl bg-orange-50/60 dark:bg-orange-950/25 border border-orange-200 dark:border-orange-800/70 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <KeyRound className="w-4 h-4 text-emerald-600" />
                              Step 3 → 4: Shelter Drop-off Custody Verification
                            </span>
                            <span className="text-xs font-mono-tabular font-semibold text-orange-800 dark:text-orange-300">
                              Shelter OTP: {selectedListing.dropoffOtp}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            In transit ({selectedListing.currentLocation.progressPct}
                            % route complete) to{' '}
                            <strong>
                              {selectedListing.claimedByReceiverOrg}
                            </strong>
                            . Scan the shelter intake QR code or enter the
                            4-digit Drop-off OTP upon arrival.
                          </p>

                          {/* Primary Fast QR Scanner Action */}
                          <button
                            type="button"
                            onClick={() =>
                              setQrScannerState({
                                isOpen: true,
                                otpType: 'dropoff',
                              })
                            }
                            className="w-full py-2.5 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                          >
                            <QrCode className="w-4 h-4" />
                            Scan Shelter Intake QR Code (Instant Verify)
                          </button>

                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <div className="flex-1 h-px bg-orange-200 dark:bg-orange-800/60" />
                            <span>or manual 4-digit OTP fallback</span>
                            <div className="flex-1 h-px bg-orange-200 dark:bg-orange-800/60" />
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                4-Digit Drop-off OTP
                              </label>
                              <input
                                type="text"
                                maxLength={4}
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value)}
                                className="w-full px-3 py-2 text-sm font-mono-tabular font-bold tracking-widest border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                Arrival Temp (°C)
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={tempInputC}
                                onChange={(e) => setTempInputC(e.target.value)}
                                className="w-full px-3 py-2 text-sm font-mono-tabular border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleAdvanceGps(selectedListing.id)
                              }
                              className="px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                            >
                              +20% GPS Hop
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleVerifyOtp(selectedListing.id, 'dropoff')
                              }
                              className="flex-1 py-2 px-4 text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg transition-colors cursor-pointer"
                            >
                              Verify Manual Drop-off OTP
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedListing.status === 'DELIVERED' && (
                        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-800/70 space-y-1.5">
                          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            Dual-OTP Verified &amp; Delivered Safely
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            Pickup OTP ({selectedListing.pickupOtp}) and
                            Drop-off OTP ({selectedListing.dropoffOtp})
                            verified. {selectedListing.servings} meals credited
                            to {selectedListing.claimedByReceiverOrg}.
                          </p>
                        </div>
                      )}

                      {actionFeedback && (
                        <div
                          className={`p-3 rounded-lg border text-xs ${
                            actionFeedback.type === 'success'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {actionFeedback.text}
                        </div>
                      )}

                      {/* Mandatory Handling, Storage, Time Window & Allergen Specification */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          Food Safety, Preparation &amp; Allergen Specification
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                          <div>
                            <span className="text-slate-400">Food Type:</span>{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {selectedListing.dietaryType}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400">Dairy:</span>{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {selectedListing.containsDairy
                                ? 'Yes (Contains Dairy)'
                                : 'No (Dairy-Free)'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400">
                              Prepared When:
                            </span>{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {selectedListing.preparedWhen || 'Just Now'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400">
                              State of Food:
                            </span>{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {selectedListing.foodState || 'Hot'}
                            </strong>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400">Storage:</span>{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {selectedListing.storageCondition}
                            </strong>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400">Packaging:</span>{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {selectedListing.packagingType}
                            </strong>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400">Allergens:</span>{' '}
                            <strong className="text-amber-700 dark:text-amber-400">
                              {selectedListing.allergens.length > 0
                                ? selectedListing.allergens.join(', ')
                                : 'None declared'}
                            </strong>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                          <strong>Handling Guidance:</strong>{' '}
                          {selectedListing.handlingGuidance}
                        </div>
                      </div>

                      {/* Timestamped Custody Audit Trail */}
                      <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          Custody &amp; Temperature Log
                        </div>
                        <div className="space-y-2">
                          {selectedListing.custodyTimeline.map((step, i) => (
                            <div
                              key={`${step.status}-${i}`}
                              className="text-xs border-b last:border-b-0 border-slate-100 dark:border-slate-800 pb-2 last:pb-0"
                            >
                              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-mono-tabular">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {step.status}
                                </span>
                                <span>
                                  {step.temperatureCheckC
                                    ? `${step.temperatureCheckC}°C · `
                                    : ''}
                                  {new Date(step.timestamp).toLocaleTimeString(
                                    [],
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    }
                                  )}
                                </span>
                              </div>
                              <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                                {step.note}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}

          {activeSection === 'history' && (
            <MySurplusHistoryView
              listings={listings}
              currentUser={currentUser}
              users={users}
              onSelectBatch={(item) => {
                setSelectedListingId(item.id);
                setActiveSection('dispatch');
              }}
              onOpenNewBatchModal={() => {
                setCustomPinnedCoords(null);
                setIsDonorModalOpen(true);
              }}
            />
          )}

          {activeSection === 'matching' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Multi-Factor Algorithmic Dispatch · Distance (35%) ·
                    Quantity Capacity (25%) · Spoilage Timing (25%) · Dietary
                    Need (15%)
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                    Smart Surplus-to-Shelter &amp; Volunteer Matching Engine
                  </h2>
                </div>

                {/* Batch Selector for Smart Matching */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">
                    Inspecting Batch:
                  </span>
                  <select
                    value={selectedListing?.id || ''}
                    onChange={(e) => setSelectedListingId(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {listings.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.batchCode} — {l.title} ({formatListingQuantity(l)} ·{' '}
                        {l.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedListing && (
                <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Origin Batch: <strong>{selectedListing.batchCode}</strong>{' '}
                      · {selectedListing.donorOrg} (
                      {selectedListing.neighborhood}
                      {selectedListing.city ? `, ${selectedListing.city}` : ''})
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {selectedListing.title} — {selectedListing.servings} meals
                      ({formatListingQuantity(selectedListing)} ·{' '}
                      {selectedListing.dietaryType})
                    </h3>
                  </div>
                  <div className="text-right font-mono-tabular text-xs">
                    <div className="text-slate-500">Safe Window Remaining</div>
                    <div className="text-sm font-bold text-orange-600">
                      {getMinutesRemaining(selectedListing.expiresAt)} mins
                    </div>
                  </div>
                </div>
              )}

              {/* Ranked NGO & Volunteer Table */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                      <th className="py-3.5 px-5 font-medium">Rank</th>
                      <th className="py-3.5 px-5 font-medium">
                        Receiving NGO / Community Kitchen
                      </th>
                      <th className="py-3.5 px-5 font-medium text-right">
                        Corridor Distance
                      </th>
                      <th className="py-3.5 px-5 font-medium text-right">
                        Capacity Fit
                      </th>
                      <th className="py-3.5 px-5 font-medium text-right">
                        Spoilage Buffer
                      </th>
                      <th className="py-3.5 px-5 font-medium text-right">
                        Overall Match
                      </th>
                      <th className="py-3.5 px-5 font-medium text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                    {smartMatches.map((match, index) => (
                      <tr
                        key={match.receiver.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                      >
                        <td className="py-4 px-5 font-mono-tabular font-bold text-slate-900 dark:text-slate-100">
                          0{index + 1}
                        </td>
                        <td className="py-4 px-5">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {match.receiver.organization}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            {match.receiver.neighborhood} · Max Intake:{' '}
                            {match.receiver.capacityKg} kg · Assigned Volunteer:{' '}
                            {match.volunteer?.name || 'Karthik V.'}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right font-mono-tabular">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {match.distanceKm} km
                          </div>
                          <div className="text-slate-500">
                            ~{match.estimatedTransitMins} min ETA
                          </div>
                        </td>
                        <td className="py-4 px-5 text-right font-mono-tabular font-semibold">
                          {match.capacityFitScore}%
                        </td>
                        <td className="py-4 px-5 text-right font-mono-tabular font-semibold">
                          {match.urgencyFitScore}%
                        </td>
                        <td className="py-4 px-5 text-right font-mono-tabular">
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {match.totalMatchScore} / 100
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          {selectedListing?.status === 'POSTED' ? (
                            <button
                              type="button"
                              onClick={() => {
                                handleClaimListing(
                                  selectedListing.id,
                                  match.receiver.id,
                                  match.volunteer?.id
                                );
                                setActiveSection('dispatch');
                              }}
                              className="px-3.5 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              Dispatch to NGO
                            </button>
                          ) : (
                            <span className="text-slate-400 font-medium">
                              Batch {selectedListing?.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'impact' && (
            <ImpactBusinessView listings={listings} />
          )}

          {activeSection === 'guardrails' && (
            <div className="space-y-6 max-w-4xl">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Operational Compliance · Food Safety Handling · Privacy &amp;
                  Synthetic Data Architecture
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  Platform Safety Guardrails &amp; Spoilage Prevention Protocol
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                  <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                    01. Non-Certification &amp; Liability Boundary
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Coordination Platform, Not a Food Safety Certifier
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    AnnaKshetra connects surplus food generators with nearby
                    community kitchens and volunteers. The platform{' '}
                    <strong>does not certify that food is safe</strong>. Every
                    listing displays explicit storage temperatures, preparation
                    timestamps, allergen disclosures, and handling guidance so
                    receiving NGO coordinators can perform sensory and
                    thermometer checks upon arrival.
                  </p>
                </div>

                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                  <div className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                    02. Commercial Honesty (No Tax or Legal Promises)
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Operational Waste Savings Only
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    AnnaKshetra{' '}
                    <strong>
                      never promises tax deductions or legal immunity
                    </strong>{' '}
                    to food donors. Instead, our business case focuses on
                    verifiable commercial wet-waste hauling fee savings (₹18/kg
                    under municipal Bulk Waste Generator rules) and auditable
                    CSR meal-rescue impact logs.
                  </p>
                </div>

                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    03. Spoilage Prevention &amp; Thermal Chain
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    How We Ensure Collection Before Spoilage
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Cooked Indian banquet food enters the bacterial danger zone
                    between 5°C and 60°C. AnnaKshetra enforces a strict countdown
                    window, prioritizes shelters within a 15-minute corridor
                    transit radius, and logs core temperature readings at both
                    Pickup OTP and Drop-off OTP handshakes.
                  </p>
                </div>

                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5">
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    04. Synthetic Data &amp; Privacy Protection
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Zero Real Personal Addresses or Phone Numbers
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    All locations use synthetic sector hubs across India
                    (Bengaluru, Mumbai, Delhi NCR, Hyderabad, Chennai, Kolkata,
                    Pune, etc.) and synthetic partner identifiers (e.g.,{' '}
                    <code>SYNTH-BLR-8821</code>). No personal residential
                    addresses or private mobile numbers are published.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Clean Quiet Footer */}
      <footer className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-4">
        <div>
          AnnaKshetra — All-India Surplus Food Redistribution &amp; Hunger
          Relief Network
        </div>
        <div>
          Guardrail Compliant: Non-Certified Peer Transfer · No Tax/Legal
          Promises · Synthetic Corridor Data Only
        </div>
      </footer>

      {/* Under-60s Rapid Surplus Donor Modal with Full Granular Food & Allergen Questionnaire */}
      <RapidDonorModal
        isOpen={isDonorModalOpen}
        onClose={() => setIsDonorModalOpen(false)}
        currentUser={currentUser}
        customPinnedCoords={customPinnedCoords}
        onCreated={(newListing) => {
          setSelectedListingId(newListing.id);
          setActiveSection('dispatch');
        }}
      />

      {/* Multi-Role Switcher & Custom Partner Registration Modal */}
      <AuthRoleModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        users={users}
        currentUser={currentUser}
        onSelectUser={(u) => setCurrentUserId(u.id)}
        onUserCreated={(u) => setCurrentUserId(u.id)}
      />

      {/* QR Code Scanner Overlay for Instant Packaging Custody Verification */}
      {selectedListing && (
        <QrScannerOverlay
          isOpen={qrScannerState.isOpen}
          onClose={() =>
            setQrScannerState((prev) => ({ ...prev, isOpen: false }))
          }
          listing={selectedListing}
          otpType={qrScannerState.otpType}
          defaultTempC={tempInputC}
          onScanVerified={async (otpType, decodedOtp, loggedTempC) => {
            await handleVerifyOtp(
              selectedListing.id,
              otpType,
              decodedOtp,
              loggedTempC
            );
          }}
        />
      )}
    </div>
  );
}
