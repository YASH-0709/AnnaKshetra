export type UserRole = 'donor' | 'receiver' | 'volunteer' | 'sponsor';

export type DonorType =
  | 'Wedding Caterer'
  | 'IT Campus Canteen'
  | 'Hotel & Banquet'
  | 'Hostel Mess';

export type DietaryType =
  | 'Veg'
  | 'Pure Veg'
  | 'Non-Veg'
  | 'Contains Egg'
  | 'Jain'
  | 'Vegan';

export type QuantityUnit = 'kg' | 'grams' | 'litres' | 'ml';

export type PreparedWhen =
  | 'Just Now'
  | '1 Hour Ago'
  | '2 Hours Ago'
  | '3 Hours Ago'
  | '4 Hours Ago';

export type FoodThermalState = 'Hot' | 'Warm' | 'Chilled' | 'ChilledServe';

export type StorageCondition =
  | 'Hot Insulated (>60°C)'
  | 'Warm Hygienic Hold (45–60°C)'
  | 'Chilled Cold-Chain (<5°C)'
  | 'ChilledServe Ready (<8°C)'
  | 'Ambient Hygienic Sealed';

export type AllergenType =
  | 'Soy'
  | 'Dairy'
  | 'Nuts / Peanuts'
  | 'Gluten / Wheat'
  | 'Egg'
  | 'Mustard'
  | 'Sesame'
  | 'Shellfish';

export type ListingStatus =
  | 'POSTED'
  | 'CLAIMED'
  | 'COLLECTED'
  | 'DELIVERED'
  | 'EXPIRED';

export interface Coordinates {
  lat: number;
  lng: number;
  hubName: string;
  city?: string;
  stateName?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  subType: string;
  city?: string;
  neighborhood: string;
  coordinates: Coordinates;
  capacityKg: number;
  dietaryPreference?: DietaryType[];
  verifiedPartner: boolean;
  contactSynthetic: string;
  vehicleType?: string;
}

export interface CustodyStep {
  status: ListingStatus;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  note: string;
  temperatureCheckC?: number;
}

export interface FoodListing {
  id: string;
  batchCode: string;
  donorId: string;
  donorName: string;
  donorOrg: string;
  donorType: DonorType;
  city?: string;
  neighborhood: string;
  pickupCoords: Coordinates;
  dropoffCoords?: Coordinates;
  title: string; // Food Name
  itemsSummary: string;
  servings: number;
  quantityValue?: number;
  quantityUnit?: QuantityUnit;
  weightKg: number; // Normalized kg equivalent
  dietaryType: DietaryType;
  containsDairy?: boolean;
  containsEgg?: boolean;
  preparedWhen?: PreparedWhen;
  foodState?: FoodThermalState;
  storageCondition: StorageCondition;
  packagingType: string;
  hasAllergens?: boolean;
  allergens: string[];
  preparedAt: string; // ISO
  expiresAt: string; // ISO
  pickupByTime: string; // ISO
  handlingGuidance: string;
  safetyChecklistConfirmed: boolean;
  status: ListingStatus;
  pickupOtp: string;
  dropoffOtp: string;
  claimedByReceiverId?: string;
  claimedByReceiverOrg?: string;
  assignedVolunteerId?: string;
  assignedVolunteerName?: string;
  assignedVolunteerVehicle?: string;
  currentLocation: {
    lat: number;
    lng: number;
    progressPct: number;
    etaMinutes: number;
    speedKmh: number;
    checkpointName?: string;
    lastGpsUpdatedAt?: string;
    liveGpsActive?: boolean;
    accuracyMeters?: number;
  };
  custodyTimeline: CustodyStep[];
  createdAt: string;
}

export interface DeliveryLocationRecord {
  delivery_id: string;
  volunteer_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  speed_kmh?: number;
  updated_at: string;
  delivery_status: ListingStatus;
}

export interface NotificationItem {
  id: string;
  targetRoles: UserRole[];
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  listingId?: string;
  batchCode?: string;
  createdAt: string;
  readByUserIds: string[];
}

export interface MatchRecommendation {
  receiver: UserProfile;
  volunteer?: UserProfile;
  distanceKm: number;
  estimatedTransitMins: number;
  capacityFitScore: number; // 0-100
  urgencyFitScore: number; // 0-100
  dietaryMatch: boolean;
  totalMatchScore: number; // 0-100
  rationale: string;
}

export interface IndiaHubNode {
  id: string;
  city: string;
  neighborhood: string;
  stateName: string;
  zone: string;
  coords: Coordinates;
  baselineDailyMealNeed: number;
  shelterCount: number;
}
