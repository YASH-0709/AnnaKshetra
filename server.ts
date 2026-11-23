import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  Coordinates,
  DeliveryLocationRecord,
  DietaryType,
  FoodListing,
  FoodThermalState,
  NotificationItem,
  PreparedWhen,
  QuantityUnit,
  UserProfile,
  UserRole,
} from './src/types.ts';
import {
  ALL_INDIA_HUBS,
  computePreparationTiming,
  generateStreetRouteWaypoints,
  interpolateAlongWaypoints,
  mapFoodStateToStorage,
  normalizeQuantityToKgAndServings,
} from './src/utils/matching.ts';
import {
  getLiveLocationByDeliveryId,
  getLocationHistoryByDeliveryId,
  updateDeliveryLocationStatus,
  upsertLiveLocation,
} from './src/db/liveLocations.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  optionalAuth,
  requireAuth,
  type AuthRequest,
} from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const findHub = (id: string): Coordinates => {
  return (
    ALL_INDIA_HUBS.find((h) => h.id === id)?.coords ||
    ALL_INDIA_HUBS[0].coords
  );
};

const now = Date.now();
const minsFromNow = (m: number) => new Date(now + m * 60000).toISOString();
const minsAgo = (m: number) => new Date(now - m * 60000).toISOString();
const daysAgo = (d: number) =>
  new Date(now - d * 24 * 60 * 60000).toISOString();

// Pre-loaded Multi-Role Users across Bengaluru and All-India Hubs (Synthetic Data Only)
const users: UserProfile[] = [
  {
    id: 'user-donor-1',
    name: 'Arvind Rao',
    email: 'dispatch@royallotuscaterers.sample.in',
    role: 'donor',
    organization: 'Royal Lotus Wedding & Banquet Caterers',
    subType: 'Wedding Caterer',
    city: 'Bengaluru',
    neighborhood: 'Bellandur',
    coordinates: findHub('BLR_BELLANDUR'),
    capacityKg: 250,
    verifiedPartner: true,
    contactSynthetic: 'SYNTH-BLR-8821 (No personal phone)',
  },
  {
    id: 'user-donor-2',
    name: 'Meera Nair',
    email: 'sustainability@techparkcanteen.sample.in',
    role: 'donor',
    organization: 'Ecospace TechPark Building 4 Canteen',
    subType: 'IT Campus Canteen',
    city: 'Bengaluru',
    neighborhood: 'Whitefield',
    coordinates: findHub('BLR_WHITEFIELD'),
    capacityKg: 180,
    verifiedPartner: true,
    contactSynthetic: 'SYNTH-BLR-4410 (No personal phone)',
  },
  {
    id: 'user-donor-3',
    name: 'ChefHarpreet Singh',
    email: 'kitchen@imperialbanquets.sample.in',
    role: 'donor',
    organization: 'Imperial Grand Banquet & Rasoi (Mumbai / Delhi)',
    subType: 'Hotel & Banquet',
    city: 'Mumbai',
    neighborhood: 'Andheri / BKC Corridor',
    coordinates: findHub('MUM_ANDHERI'),
    capacityKg: 320,
    verifiedPartner: true,
    contactSynthetic: 'SYNTH-MUM-7721 (No personal phone)',
  },
  {
    id: 'user-receiver-1',
    name: 'Sister Kavitha D.',
    email: 'kitchen@akshayashelter.sample.org',
    role: 'receiver',
    organization: 'Akshaya Sevashram Community Kitchen',
    subType: 'NGO & Night Shelter',
    city: 'Bengaluru',
    neighborhood: 'HSR Layout',
    coordinates: findHub('BLR_HSR'),
    capacityKg: 140,
    dietaryPreference: ['Veg', 'Pure Veg', 'Jain', 'Vegan'],
    verifiedPartner: true,
    contactSynthetic: 'SYNTH-NGO-9012 (Sample Facility Node)',
  },
  {
    id: 'user-receiver-2',
    name: 'Ramesh Gowda',
    email: 'intake@nammabengaluruhope.sample.org',
    role: 'receiver',
    organization: 'Namma Corridor Workers Relief Centre',
    subType: 'Community Shelter',
    city: 'Bengaluru',
    neighborhood: 'Koramangala',
    coordinates: findHub('BLR_KORAMANGALA'),
    capacityKg: 200,
    dietaryPreference: ['Veg', 'Pure Veg', 'Non-Veg', 'Contains Egg', 'Vegan'],
    verifiedPartner: true,
    contactSynthetic: 'SYNTH-NGO-3319 (Sample Facility Node)',
  },
  {
    id: 'user-receiver-3',
    name: 'Dr. Ananya Hegde',
    email: 'coord@vidyarthishelter.sample.org',
    role: 'receiver',
    organization: 'East Bengaluru Youth & Migrant Hostel',
    subType: 'Charitable Hostel',
    city: 'Bengaluru',
    neighborhood: 'Indiranagar',
    coordinates: findHub('BLR_INDIRANAGAR'),
    capacityKg: 120,
    dietaryPreference: [
      'Veg',
      'Pure Veg',
      'Non-Veg',
      'Contains Egg',
      'Jain',
      'Vegan',
    ],
    verifiedPartner: true,
    contactSynthetic: 'SYNTH-NGO-7120 (Sample Facility Node)',
  },
  {
    id: 'user-receiver-4',
    name: 'Farhan Shaikh',
    email: 'relief@mumbaiannaseva.sample.org',
    role: 'receiver',
    organization: 'Western Suburbs Annaseva Night Shelter',
    subType: 'Metro Relief Kitchen',
    city: 'Mumbai',
    neighborhood: 'Andheri / BKC Corridor',
    coordinates: {
      lat: 19.076,
      lng: 72.8777,
      hubName: 'BKC Dharavi Link Relief Kitchen',
      city: 'Mumbai',
      stateName: 'Maharashtra',
    },
    capacityKg: 260,
    dietaryPreference: ['Veg', 'Pure Veg', 'Non-Veg', 'Contains Egg', 'Vegan'],
    verifiedPartner: true,
    contactSynthetic: 'SYNTH-MUM-5190 (Sample Facility Node)',
  },
  {
    id: 'user-volunteer-1',
    name: 'Karthik V.',
    email: 'karthik.rider@annakshetra.sample.org',
    role: 'volunteer',
    organization: 'AnnaKshetra Rapid Relief Fleet',
    subType: 'Insulated E-Van Volunteer',
    city: 'Bengaluru',
    neighborhood: 'Bellandur',
    coordinates: {
      lat: 12.9245,
      lng: 77.662,
      hubName: 'ORR Sarjapur Junction Patrol',
      city: 'Bengaluru',
      stateName: 'Karnataka',
    },
    capacityKg: 160,
    verifiedPartner: true,
    contactSynthetic: 'SYNTH-VOL-5501',
    vehicleType: 'Insulated Electric Cargo Van (Hot/Cold Box)',
  },
  {
    id: 'user-sponsor-1',
    name: 'Priya Sundaram',
    email: 'csr@horizonfoundation.sample.in',
    role: 'sponsor',
    organization: 'Horizon Tech CSR & Zero-Waste Initiative',
    subType: 'CSR & Municipal Sponsor',
    city: 'Bengaluru',
    neighborhood: 'Koramangala',
    coordinates: findHub('BLR_KORAMANGALA'),
    capacityKg: 0,
    verifiedPartner: true,
    contactSynthetic: 'SYNTH-CSR-1008',
  },
];

// Initial Live + Historical Surplus Listings across India & Donor History
const listings: FoodListing[] = [
  {
    id: 'lst-101',
    batchCode: 'AK-BLR-841',
    donorId: 'user-donor-1',
    donorName: 'Arvind Rao',
    donorOrg: 'Royal Lotus Wedding & Banquet Caterers',
    donorType: 'Wedding Caterer',
    city: 'Bengaluru',
    neighborhood: 'Bellandur',
    pickupCoords: findHub('BLR_BELLANDUR'),
    title: 'Muhurtham Reception Unserved Buffet Trays',
    itemsSummary:
      'Ghee Pulao, Dal Tadka, Paneer Butter Masala, 240 Phulkas, Boondi Raita (Unserved kitchen backup gastronorm pans)',
    servings: 160,
    quantityValue: 72,
    quantityUnit: 'kg',
    weightKg: 72,
    dietaryType: 'Veg',
    containsDairy: true,
    containsEgg: false,
    preparedWhen: 'Just Now',
    foodState: 'Hot',
    storageCondition: 'Hot Insulated (>60°C)',
    packagingType: 'Sealed Stainless Steel Gastronorm Containers',
    hasAllergens: true,
    allergens: ['Dairy', 'Gluten / Wheat', 'Nuts / Peanuts'],
    preparedAt: minsAgo(20),
    expiresAt: minsFromNow(140),
    pickupByTime: minsFromNow(65),
    handlingGuidance:
      'Keep in thermal insulated carrier above 60°C. Consume within 2.5 hours of collection. Reheat curries to 75°C before serving.',
    safetyChecklistConfirmed: true,
    status: 'POSTED',
    pickupOtp: '4829',
    dropoffOtp: '9134',
    currentLocation: {
      lat: findHub('BLR_BELLANDUR').lat,
      lng: findHub('BLR_BELLANDUR').lng,
      progressPct: 0,
      etaMinutes: 18,
      speedKmh: 0,
      checkpointName: 'Bellandur Outer Ring Road Corridor Loading Bay',
    },
    custodyTimeline: [
      {
        status: 'POSTED',
        timestamp: minsAgo(12),
        actorName: 'Arvind Rao (Royal Lotus Caterers)',
        actorRole: 'donor',
        note: 'Posted 72 kg unserved reception surplus (Prepared Just Now, State: Hot). Holding temp logged at 64.5°C.',
        temperatureCheckC: 64.5,
      },
    ],
    createdAt: minsAgo(12),
  },
  {
    id: 'lst-102',
    batchCode: 'AK-BLR-839',
    donorId: 'user-donor-2',
    donorName: 'Meera Nair',
    donorOrg: 'Ecospace TechPark Building 4 Canteen',
    donorType: 'IT Campus Canteen',
    city: 'Bengaluru',
    neighborhood: 'Whitefield',
    pickupCoords: findHub('BLR_WHITEFIELD'),
    dropoffCoords: findHub('BLR_INDIRANAGAR'),
    title: 'Corporate Executive Lunch Surplus Batch',
    itemsSummary:
      'Steamed Basmati Rice, Sambar, Avial, Chapati Rolls & Soy Protein Bhurji (Individually foil-sealed trays)',
    servings: 110,
    quantityValue: 49.5,
    quantityUnit: 'kg',
    weightKg: 49.5,
    dietaryType: 'Veg',
    containsDairy: true,
    containsEgg: false,
    preparedWhen: '1 Hour Ago',
    foodState: 'Hot',
    storageCondition: 'Hot Insulated (>60°C)',
    packagingType: 'Food-Grade Foil-Sealed Meal Boxes',
    hasAllergens: true,
    allergens: ['Soy', 'Dairy', 'Gluten / Wheat', 'Mustard'],
    preparedAt: minsAgo(60),
    expiresAt: minsFromNow(95),
    pickupByTime: minsFromNow(30),
    handlingGuidance:
      'Transport in sanitized insulated boxes. Distribute immediately upon arrival at hostel dining hall.',
    safetyChecklistConfirmed: true,
    status: 'COLLECTED',
    pickupOtp: '3107',
    dropoffOtp: '6742',
    claimedByReceiverId: 'user-receiver-3',
    claimedByReceiverOrg: 'East Bengaluru Youth & Migrant Hostel',
    assignedVolunteerId: 'user-volunteer-1',
    assignedVolunteerName: 'Karthik V.',
    assignedVolunteerVehicle: 'Insulated Electric Cargo Van',
    currentLocation: {
      lat: 12.9742,
      lng: 77.6945,
      progressPct: 52,
      etaMinutes: 9,
      speedKmh: 28,
      checkpointName: 'Outer Ring Road — Marathahalli Flyover Corridor',
    },
    custodyTimeline: [
      {
        status: 'POSTED',
        timestamp: minsAgo(48),
        actorName: 'Meera Nair (Ecospace Canteen)',
        actorRole: 'donor',
        note: 'Batch logged after afternoon shift cutoff (Prepared 1 Hour Ago, State: Hot). Core temp 63°C.',
        temperatureCheckC: 63,
      },
      {
        status: 'CLAIMED',
        timestamp: minsAgo(36),
        actorName: 'Dr. Ananya Hegde (East Bengaluru Hostel)',
        actorRole: 'receiver',
        note: 'Claimed for 110 evening residents. Volunteer Karthik V. assigned.',
      },
      {
        status: 'COLLECTED',
        timestamp: minsAgo(18),
        actorName: 'Karthik V. (Volunteer Fleet)',
        actorRole: 'volunteer',
        note: 'Pickup OTP 3107 verified at Loading Bay B. Thermal box sealed at 61.8°C.',
        temperatureCheckC: 61.8,
      },
    ],
    createdAt: minsAgo(48),
  },
  {
    id: 'lst-103',
    batchCode: 'AK-BLR-835',
    donorId: 'user-donor-1',
    donorName: 'Arvind Rao',
    donorOrg: 'Royal Lotus Wedding & Banquet Caterers',
    donorType: 'Wedding Caterer',
    city: 'Bengaluru',
    neighborhood: 'Bellandur',
    pickupCoords: findHub('BLR_BELLANDUR'),
    dropoffCoords: findHub('BLR_HSR'),
    title: 'Masala Chaas, Badam Milk & Sweet Lassi Cans',
    itemsSummary:
      'Chilled Spiced Buttermilk (Chaas), Saffron Badam Milk & Mango Lassi in food-grade stainless milk cans',
    servings: 84,
    quantityValue: 38,
    quantityUnit: 'litres',
    weightKg: 38,
    dietaryType: 'Veg',
    containsDairy: true,
    containsEgg: false,
    preparedWhen: '2 Hours Ago',
    foodState: 'ChilledServe',
    storageCondition: 'ChilledServe Ready (<8°C)',
    packagingType: 'Food-Grade Sealed Stainless Steel Beverage Cans',
    hasAllergens: true,
    allergens: ['Dairy', 'Nuts / Peanuts'],
    preparedAt: minsAgo(120),
    expiresAt: minsFromNow(140),
    pickupByTime: minsFromNow(40),
    handlingGuidance:
      'Keep chilled under 8°C (ChilledServe state). Ready to serve cold directly at shelter dining hall.',
    safetyChecklistConfirmed: true,
    status: 'CLAIMED',
    pickupOtp: '5581',
    dropoffOtp: '2049',
    claimedByReceiverId: 'user-receiver-1',
    claimedByReceiverOrg: 'Akshaya Sevashram Community Kitchen',
    assignedVolunteerId: 'user-volunteer-1',
    assignedVolunteerName: 'Karthik V.',
    assignedVolunteerVehicle: 'Insulated Electric Cargo Van',
    currentLocation: {
      lat: findHub('BLR_BELLANDUR').lat,
      lng: findHub('BLR_BELLANDUR').lng,
      progressPct: 12,
      etaMinutes: 15,
      speedKmh: 21,
      checkpointName: 'Bellandur Agara Lake Flyover Approach',
    },
    custodyTimeline: [
      {
        status: 'POSTED',
        timestamp: minsAgo(35),
        actorName: 'Arvind Rao (Royal Lotus Caterers)',
        actorRole: 'donor',
        note: '38 litres ChilledServe beverage cans ready at cold dock.',
        temperatureCheckC: 5.4,
      },
      {
        status: 'CLAIMED',
        timestamp: minsAgo(15),
        actorName: 'Sister Kavitha D. (Akshaya Sevashram)',
        actorRole: 'receiver',
        note: 'Claimed for HSR Layout shelter. Awaiting Pickup OTP 5581 handover.',
      },
    ],
    createdAt: minsAgo(35),
  },
  {
    id: 'lst-104',
    batchCode: 'AK-BLR-828',
    donorId: 'user-donor-2',
    donorName: 'Meera Nair',
    donorOrg: 'Ecospace TechPark Building 4 Canteen',
    donorType: 'IT Campus Canteen',
    city: 'Bengaluru',
    neighborhood: 'Whitefield',
    pickupCoords: findHub('BLR_WHITEFIELD'),
    dropoffCoords: findHub('BLR_KORAMANGALA'),
    title: 'Protein Egg Curry, Herb Rice & Soy Manchurian Bowl',
    itemsSummary:
      'Herb Rice, Boiled Egg Masala Curry Trays, Soy Chunks Gravy & Mixed Salad Packs',
    servings: 140,
    quantityValue: 63,
    quantityUnit: 'kg',
    weightKg: 63,
    dietaryType: 'Contains Egg',
    containsDairy: false,
    containsEgg: true,
    preparedWhen: '2 Hours Ago',
    foodState: 'Hot',
    storageCondition: 'Hot Insulated (>60°C)',
    packagingType: 'Tamper-Evident Casserole Trays',
    hasAllergens: true,
    allergens: ['Egg', 'Soy', 'Gluten / Wheat'],
    preparedAt: minsAgo(190),
    expiresAt: minsFromNow(45),
    pickupByTime: minsAgo(90),
    handlingGuidance:
      'Delivered hot at 61°C. Immediate meal service completed at Koramangala relief center.',
    safetyChecklistConfirmed: true,
    status: 'DELIVERED',
    pickupOtp: '7712',
    dropoffOtp: '8830',
    claimedByReceiverId: 'user-receiver-2',
    claimedByReceiverOrg: 'Namma Corridor Workers Relief Centre',
    assignedVolunteerId: 'user-volunteer-1',
    assignedVolunteerName: 'Karthik V.',
    assignedVolunteerVehicle: 'Insulated Electric Cargo Van',
    currentLocation: {
      lat: findHub('BLR_KORAMANGALA').lat,
      lng: findHub('BLR_KORAMANGALA').lng,
      progressPct: 100,
      etaMinutes: 0,
      speedKmh: 0,
      checkpointName: 'Koramangala 4th Block Civic Cluster Intake Gate',
    },
    custodyTimeline: [
      {
        status: 'POSTED',
        timestamp: minsAgo(140),
        actorName: 'Meera Nair (Ecospace Canteen)',
        actorRole: 'donor',
        note: 'Posted 63 kg (140 meals) Egg & Soy protein meal servings.',
        temperatureCheckC: 65,
      },
      {
        status: 'CLAIMED',
        timestamp: minsAgo(128),
        actorName: 'Ramesh Gowda (Namma Corridor Relief)',
        actorRole: 'receiver',
        note: 'Matched at 96% score for Koramangala evening meal drive.',
      },
      {
        status: 'COLLECTED',
        timestamp: minsAgo(105),
        actorName: 'Karthik V. (Volunteer Fleet)',
        actorRole: 'volunteer',
        note: 'Pickup OTP 7712 verified. Loaded into hot cabinet.',
        temperatureCheckC: 63.2,
      },
      {
        status: 'DELIVERED',
        timestamp: minsAgo(72),
        actorName: 'Ramesh Gowda (Namma Corridor Relief)',
        actorRole: 'receiver',
        note: 'Drop-off OTP 8830 verified. 140 meals served safely.',
        temperatureCheckC: 60.8,
      },
    ],
    createdAt: minsAgo(140),
  },
  // All-India National Active Batch (Mumbai Corridor)
  {
    id: 'lst-105',
    batchCode: 'AK-MUM-512',
    donorId: 'user-donor-3',
    donorName: 'Chef Harpreet Singh',
    donorOrg: 'Imperial Grand Banquet & Rasoi (Mumbai / Delhi)',
    donorType: 'Hotel & Banquet',
    city: 'Mumbai',
    neighborhood: 'Andheri / BKC Corridor',
    pickupCoords: findHub('MUM_ANDHERI'),
    dropoffCoords: {
      lat: 19.076,
      lng: 72.8777,
      hubName: 'BKC Dharavi Link Relief Kitchen',
      city: 'Mumbai',
      stateName: 'Maharashtra',
    },
    title: 'Sangeet Gala Awadhi Biryani & Dal Bukhara Trays',
    itemsSummary:
      'Veg Awadhi Subz Biryani, Dal Bukhara, Paneer Pasanda & 350 Roomali Rotis',
    servings: 210,
    quantityValue: 94.5,
    quantityUnit: 'kg',
    weightKg: 94.5,
    dietaryType: 'Veg',
    containsDairy: true,
    containsEgg: false,
    preparedWhen: '1 Hour Ago',
    foodState: 'Hot',
    storageCondition: 'Hot Insulated (>60°C)',
    packagingType: 'Insulated Banquet Hot-Holding Cambros',
    hasAllergens: true,
    allergens: ['Dairy', 'Gluten / Wheat', 'Nuts / Peanuts'],
    preparedAt: minsAgo(60),
    expiresAt: minsFromNow(115),
    pickupByTime: minsFromNow(45),
    handlingGuidance:
      'Keep sealed in Cambro thermal carriers above 62°C during Western Express Highway transit.',
    safetyChecklistConfirmed: true,
    status: 'COLLECTED',
    pickupOtp: '6412',
    dropoffOtp: '3908',
    claimedByReceiverId: 'user-receiver-4',
    claimedByReceiverOrg: 'Western Suburbs Annaseva Night Shelter',
    assignedVolunteerId: 'user-volunteer-1',
    assignedVolunteerName: 'Karthik V.',
    assignedVolunteerVehicle: 'Insulated Electric Cargo Van',
    currentLocation: {
      lat: 19.0945,
      lng: 72.8738,
      progressPct: 48,
      etaMinutes: 11,
      speedKmh: 29,
      checkpointName: 'Western Express Highway — Vakola Flyover',
    },
    custodyTimeline: [
      {
        status: 'POSTED',
        timestamp: minsAgo(40),
        actorName: 'Chef Harpreet Singh (Imperial Grand Banquet)',
        actorRole: 'donor',
        note: 'Posted 94.5 kg banquet surplus in Mumbai Andheri East.',
        temperatureCheckC: 64.2,
      },
      {
        status: 'CLAIMED',
        timestamp: minsAgo(28),
        actorName: 'Farhan Shaikh (Western Suburbs Annaseva)',
        actorRole: 'receiver',
        note: 'Claimed for BKC relief center.',
      },
      {
        status: 'COLLECTED',
        timestamp: minsAgo(14),
        actorName: 'Karthik V. (Volunteer Fleet)',
        actorRole: 'volunteer',
        note: 'Pickup OTP 6412 verified. En route via Western Express Highway.',
        temperatureCheckC: 62.9,
      },
    ],
    createdAt: minsAgo(40),
  },
  // Historical Donor Batches for Rich 'My Surplus History' Trend Chart
  {
    id: 'lst-hist-1',
    batchCode: 'AK-BLR-790',
    donorId: 'user-donor-1',
    donorName: 'Arvind Rao',
    donorOrg: 'Royal Lotus Wedding & Banquet Caterers',
    donorType: 'Wedding Caterer',
    city: 'Bengaluru',
    neighborhood: 'Bellandur',
    pickupCoords: findHub('BLR_BELLANDUR'),
    dropoffCoords: findHub('BLR_HSR'),
    title: 'Weekend Sadhya Plantain Leaf Banquet Surplus',
    itemsSummary:
      'Matta Rice, Parippu, Sambar, Avial, Thoran & Ada Pradhaman Payasam',
    servings: 190,
    quantityValue: 85.5,
    quantityUnit: 'kg',
    weightKg: 85.5,
    dietaryType: 'Veg',
    containsDairy: true,
    containsEgg: false,
    preparedWhen: '1 Hour Ago',
    foodState: 'Hot',
    storageCondition: 'Hot Insulated (>60°C)',
    packagingType: 'Sealed Stainless Gastronorm Containers',
    hasAllergens: true,
    allergens: ['Dairy', 'Nuts / Peanuts', 'Mustard'],
    preparedAt: daysAgo(18),
    expiresAt: daysAgo(18),
    pickupByTime: daysAgo(18),
    handlingGuidance: 'Delivered hot at 62°C to Akshaya Sevashram.',
    safetyChecklistConfirmed: true,
    status: 'DELIVERED',
    pickupOtp: '2190',
    dropoffOtp: '4418',
    claimedByReceiverId: 'user-receiver-1',
    claimedByReceiverOrg: 'Akshaya Sevashram Community Kitchen',
    assignedVolunteerId: 'user-volunteer-1',
    assignedVolunteerName: 'Karthik V.',
    assignedVolunteerVehicle: 'Insulated Electric Cargo Van',
    currentLocation: {
      lat: findHub('BLR_HSR').lat,
      lng: findHub('BLR_HSR').lng,
      progressPct: 100,
      etaMinutes: 0,
      speedKmh: 0,
      checkpointName: 'HSR Layout Sector 2 Shelter Gate',
    },
    custodyTimeline: [
      {
        status: 'DELIVERED',
        timestamp: daysAgo(18),
        actorName: 'Sister Kavitha D. (Akshaya Sevashram)',
        actorRole: 'receiver',
        note: 'Verified delivery of 85.5 kg (190 meals).',
        temperatureCheckC: 61.5,
      },
    ],
    createdAt: daysAgo(18),
  },
  {
    id: 'lst-hist-2',
    batchCode: 'AK-BLR-804',
    donorId: 'user-donor-1',
    donorName: 'Arvind Rao',
    donorOrg: 'Royal Lotus Wedding & Banquet Caterers',
    donorType: 'Wedding Caterer',
    city: 'Bengaluru',
    neighborhood: 'Bellandur',
    pickupCoords: findHub('BLR_BELLANDUR'),
    dropoffCoords: findHub('BLR_KORAMANGALA'),
    title: 'Engagement Dinner North Indian Buffet Trays',
    itemsSummary:
      'Kashmiri Pulao, Dal Makhani, Kadai Paneer, Mix Veg & Assorted Naan',
    servings: 240,
    quantityValue: 108,
    quantityUnit: 'kg',
    weightKg: 108,
    dietaryType: 'Veg',
    containsDairy: true,
    containsEgg: false,
    preparedWhen: 'Just Now',
    foodState: 'Hot',
    storageCondition: 'Hot Insulated (>60°C)',
    packagingType: 'Sealed Stainless Gastronorm Containers',
    hasAllergens: true,
    allergens: ['Dairy', 'Gluten / Wheat', 'Nuts / Peanuts'],
    preparedAt: daysAgo(11),
    expiresAt: daysAgo(11),
    pickupByTime: daysAgo(11),
    handlingGuidance: 'Delivered hot to Namma Corridor Workers Relief Centre.',
    safetyChecklistConfirmed: true,
    status: 'DELIVERED',
    pickupOtp: '8832',
    dropoffOtp: '1920',
    claimedByReceiverId: 'user-receiver-2',
    claimedByReceiverOrg: 'Namma Corridor Workers Relief Centre',
    assignedVolunteerId: 'user-volunteer-1',
    assignedVolunteerName: 'Karthik V.',
    assignedVolunteerVehicle: 'Insulated Electric Cargo Van',
    currentLocation: {
      lat: findHub('BLR_KORAMANGALA').lat,
      lng: findHub('BLR_KORAMANGALA').lng,
      progressPct: 100,
      etaMinutes: 0,
      speedKmh: 0,
      checkpointName: 'Koramangala 4th Block Civic Cluster',
    },
    custodyTimeline: [
      {
        status: 'DELIVERED',
        timestamp: daysAgo(11),
        actorName: 'Ramesh Gowda (Namma Corridor Relief)',
        actorRole: 'receiver',
        note: 'Verified delivery of 108 kg (240 meals).',
        temperatureCheckC: 62.1,
      },
    ],
    createdAt: daysAgo(11),
  },
  {
    id: 'lst-hist-3',
    batchCode: 'AK-BLR-819',
    donorId: 'user-donor-1',
    donorName: 'Arvind Rao',
    donorOrg: 'Royal Lotus Wedding & Banquet Caterers',
    donorType: 'Wedding Caterer',
    city: 'Bengaluru',
    neighborhood: 'Bellandur',
    pickupCoords: findHub('BLR_BELLANDUR'),
    dropoffCoords: findHub('BLR_INDIRANAGAR'),
    title: 'Fresh Rasam, Sambar & Tomato Soup Bulk Kettles',
    itemsSummary:
      'Hot Pepper Rasam, Drumstick Sambar & Roasted Tomato Soup in sealed thermal kettles',
    servings: 120,
    quantityValue: 54000,
    quantityUnit: 'ml',
    weightKg: 54,
    dietaryType: 'Vegan',
    containsDairy: false,
    containsEgg: false,
    preparedWhen: '1 Hour Ago',
    foodState: 'Warm',
    storageCondition: 'Warm Hygienic Hold (45–60°C)',
    packagingType: 'Insulated Soup & Gravy Kettles',
    hasAllergens: true,
    allergens: ['Mustard'],
    preparedAt: daysAgo(5),
    expiresAt: daysAgo(5),
    pickupByTime: daysAgo(5),
    handlingGuidance: 'Reheated to 75°C boil before serving at hostel.',
    safetyChecklistConfirmed: true,
    status: 'DELIVERED',
    pickupOtp: '3091',
    dropoffOtp: '7741',
    claimedByReceiverId: 'user-receiver-3',
    claimedByReceiverOrg: 'East Bengaluru Youth & Migrant Hostel',
    assignedVolunteerId: 'user-volunteer-1',
    assignedVolunteerName: 'Karthik V.',
    assignedVolunteerVehicle: 'Insulated Electric Cargo Van',
    currentLocation: {
      lat: findHub('BLR_INDIRANAGAR').lat,
      lng: findHub('BLR_INDIRANAGAR').lng,
      progressPct: 100,
      etaMinutes: 0,
      speedKmh: 0,
      checkpointName: 'Indiranagar 100ft Cross Hub',
    },
    custodyTimeline: [
      {
        status: 'DELIVERED',
        timestamp: daysAgo(5),
        actorName: 'Dr. Ananya Hegde (East Bengaluru Hostel)',
        actorRole: 'receiver',
        note: 'Verified delivery of 54,000 ml (54 kg eq.) soup and sambar kettles.',
        temperatureCheckC: 56.4,
      },
    ],
    createdAt: daysAgo(5),
  },
  {
    id: 'lst-hist-4',
    batchCode: 'AK-BLR-812',
    donorId: 'user-donor-2',
    donorName: 'Meera Nair',
    donorOrg: 'Ecospace TechPark Building 4 Canteen',
    donorType: 'IT Campus Canteen',
    city: 'Bengaluru',
    neighborhood: 'Whitefield',
    pickupCoords: findHub('BLR_WHITEFIELD'),
    dropoffCoords: findHub('BLR_INDIRANAGAR'),
    title: 'Evening Snack Box & Bakery Muffin Trays',
    itemsSummary:
      'Whole Wheat Veg Sandwiches, Banana Walnut Cake Slices & Soy Milk Cartons',
    servings: 90,
    quantityValue: 40500,
    quantityUnit: 'grams',
    weightKg: 40.5,
    dietaryType: 'Contains Egg',
    containsDairy: true,
    containsEgg: true,
    preparedWhen: '2 Hours Ago',
    foodState: 'Chilled',
    storageCondition: 'Chilled Cold-Chain (<5°C)',
    packagingType: 'Hygienic Bakery Crates',
    hasAllergens: true,
    allergens: ['Egg', 'Soy', 'Dairy', 'Gluten / Wheat', 'Nuts / Peanuts'],
    preparedAt: daysAgo(8),
    expiresAt: daysAgo(8),
    pickupByTime: daysAgo(8),
    handlingGuidance: 'Kept chilled at 4°C until distribution.',
    safetyChecklistConfirmed: true,
    status: 'DELIVERED',
    pickupOtp: '6102',
    dropoffOtp: '5290',
    claimedByReceiverId: 'user-receiver-3',
    claimedByReceiverOrg: 'East Bengaluru Youth & Migrant Hostel',
    assignedVolunteerId: 'user-volunteer-1',
    assignedVolunteerName: 'Karthik V.',
    assignedVolunteerVehicle: 'Insulated Electric Cargo Van',
    currentLocation: {
      lat: findHub('BLR_INDIRANAGAR').lat,
      lng: findHub('BLR_INDIRANAGAR').lng,
      progressPct: 100,
      etaMinutes: 0,
      speedKmh: 0,
      checkpointName: 'Indiranagar 100ft Cross Hub',
    },
    custodyTimeline: [
      {
        status: 'DELIVERED',
        timestamp: daysAgo(8),
        actorName: 'Dr. Ananya Hegde (East Bengaluru Hostel)',
        actorRole: 'receiver',
        note: 'Verified delivery of 40,500 grams (40.5 kg) bakery batch.',
        temperatureCheckC: 4.4,
      },
    ],
    createdAt: daysAgo(8),
  },
];

const notifications: NotificationItem[] = [
  {
    id: 'notif-1',
    targetRoles: ['receiver', 'volunteer', 'donor', 'sponsor'],
    title: 'High-Priority Wedding Surplus Posted (72 kg · Hot)',
    message:
      'Royal Lotus Wedding Caterers posted 160 servings of Veg Muhurtham Buffet (Prepared Just Now, Contains Dairy). Pickup window closes in 65 mins.',
    severity: 'warning',
    listingId: 'lst-101',
    batchCode: 'AK-BLR-841',
    createdAt: minsAgo(12),
    readByUserIds: [],
  },
  {
    id: 'notif-2',
    targetRoles: ['receiver', 'volunteer', 'donor'],
    title: 'Live Rider En Route — Batch AK-BLR-839 (52% via ORR)',
    message:
      'Volunteer Karthik V. verified Pickup OTP 3107 at Whitefield Ecospace. Moving smoothly along Outer Ring Road toward Indiranagar.',
    severity: 'info',
    listingId: 'lst-102',
    batchCode: 'AK-BLR-839',
    createdAt: minsAgo(18),
    readByUserIds: [],
  },
  {
    id: 'notif-3',
    targetRoles: ['donor', 'receiver', 'sponsor'],
    title: '140 Meals Verified Delivered — Drop-off OTP 8830',
    message:
      'Batch AK-BLR-828 (63 kg · Contains Egg & Soy) safely handed over to Namma Corridor Workers Relief Centre. ₹1,134 hauling fee saved.',
    severity: 'success',
    listingId: 'lst-104',
    batchCode: 'AK-BLR-828',
    createdAt: minsAgo(72),
    readByUserIds: [],
  },
];

function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Structured Delivery Location Table Store (delivery_id, volunteer_id, latitude, longitude, updated_at, delivery_status)
const deliveryLocations = new Map<string, DeliveryLocationRecord>();

function updateVolunteerDeliveryLocation(payload: {
  delivery_id: string;
  volunteer_id: string;
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  speed_kmh?: number;
  updated_at?: string;
}): { listing?: FoodListing; record?: DeliveryLocationRecord; error?: string; status?: number } {
  const listing = listings.find((l) => l.id === payload.delivery_id);
  if (!listing) {
    return { error: 'Delivery listing not found.', status: 404 };
  }

  // Only allow location tracking while delivery is active (CLAIMED or COLLECTED)
  if (listing.status !== 'CLAIMED' && listing.status !== 'COLLECTED') {
    return {
      error: `Cannot update live GPS for a delivery with status ${listing.status}. Tracking stops automatically upon completion.`,
      status: 400,
    };
  }

  // Authorization check: only the assigned volunteer (or an active volunteer account) can push coordinates
  const volunteer = users.find((u) => u.id === payload.volunteer_id);
  if (
    !volunteer ||
    volunteer.role !== 'volunteer' ||
    (listing.assignedVolunteerId && listing.assignedVolunteerId !== volunteer.id)
  ) {
    return {
      error: 'Unauthorized: Only the assigned volunteer for this delivery may update its GPS location.',
      status: 403,
    };
  }

  const lat = Number(payload.latitude);
  const lng = Number(payload.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { error: 'Invalid latitude or longitude coordinates.', status: 400 };
  }

  const updatedAt = payload.updated_at || new Date().toISOString();
  const speedKmh =
    typeof payload.speed_kmh === 'number' && !Number.isNaN(payload.speed_kmh)
      ? payload.speed_kmh
      : listing.currentLocation.speedKmh || 25;

  listing.currentLocation = {
    ...listing.currentLocation,
    lat,
    lng,
    speedKmh,
    lastGpsUpdatedAt: updatedAt,
    liveGpsActive: true,
    accuracyMeters: payload.accuracy_meters,
    checkpointName: `Live Volunteer GPS (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
  };

  const record: DeliveryLocationRecord = {
    delivery_id: listing.id,
    volunteer_id: volunteer.id,
    latitude: lat,
    longitude: lng,
    accuracy_meters: payload.accuracy_meters,
    speed_kmh: speedKmh,
    updated_at: updatedAt,
    delivery_status: listing.status,
  };

  deliveryLocations.set(listing.id, record);
  return { listing, record };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const broadcastState = (eventType: string, meta?: Record<string, unknown>) => {
    const payload = JSON.stringify({
      type: eventType,
      meta,
      state: {
        users,
        listings,
        notifications,
        deliveryLocations: Array.from(deliveryLocations.values()),
      },
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'init',
        state: {
          users,
          listings,
          notifications,
          deliveryLocations: Array.from(deliveryLocations.values()),
        },
      })
    );

    // Handle dedicated real-time WebSocket events from useLiveTracking hook
    ws.on('message', (rawMessage) => {
      try {
        const message = JSON.parse(String(rawMessage));

        if (message.type === 'volunteer:location-update' && message.data) {
          const result = updateVolunteerDeliveryLocation(message.data);
          if (result.listing && result.record) {
            if (process.env.SQL_HOST) {
              upsertLiveLocation({
                deliveryId: result.record.delivery_id,
                volunteerId: result.record.volunteer_id,
                latitude: result.record.latitude,
                longitude: result.record.longitude,
                accuracyMeters: result.record.accuracy_meters ?? null,
                speedKmh: result.record.speed_kmh ?? null,
                deliveryStatus: result.record.delivery_status,
              }).catch((dbErr) => {
                console.error('Non-fatal live location persist error:', dbErr);
              });
            }
            broadcastState('volunteer:location-updated', {
              deliveryId: result.listing.id,
              locationRecord: result.record,
            });
          } else if (result.error) {
            ws.send(
              JSON.stringify({
                type: 'volunteer:location-error',
                error: result.error,
              })
            );
          }
        } else if (message.type === 'volunteer:tracking-stopped' && message.data) {
          const listing = listings.find((l) => l.id === message.data.delivery_id);
          if (listing) {
            listing.currentLocation = {
              ...listing.currentLocation,
              liveGpsActive: false,
            };
            broadcastState('volunteer:tracking-stopped', {
              deliveryId: listing.id,
            });
          }
        }
      } catch {
        // Ignore malformed WebSocket messages
      }
    });
  });

  // Continuous Smooth GPS Delivery Ticker for Active COLLECTED Batches (only when live device GPS is not overriding)
  setInterval(() => {
    let anyMoved = false;
    listings.forEach((listing) => {
      if (
        listing.status === 'COLLECTED' &&
        listing.dropoffCoords &&
        !listing.currentLocation.liveGpsActive
      ) {
        const currentPct = listing.currentLocation.progressPct;
        // Advance smoothly by 2% per tick, cycling softly between 18% and 94% until Drop-off OTP is verified
        const nextPct = currentPct >= 94 ? 22 : currentPct + 2;
        const waypoints = generateStreetRouteWaypoints(
          listing.pickupCoords,
          listing.dropoffCoords
        );
        const pos = interpolateAlongWaypoints(waypoints, nextPct);
        listing.currentLocation = {
          lat: pos.lat,
          lng: pos.lng,
          progressPct: nextPct,
          etaMinutes: Math.max(2, Math.round(((100 - nextPct) / 100) * 18)),
          speedKmh: 26 + (nextPct % 7),
          checkpointName: pos.streetLabel,
          lastGpsUpdatedAt: new Date().toISOString(),
          liveGpsActive: false,
        };
        anyMoved = true;
      }
    });
    if (anyMoved && wss.clients.size > 0) {
      broadcastState('listing:gps-tick');
    }
  }, 3200);

  // --- REST API Endpoints ---

  // 0. Authenticated Firebase User Profile Sync
  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@annakshetra.app`;
      const displayName = req.user!.name || null;
      const dbUser = process.env.SQL_HOST
        ? await getOrCreateUser(uid, email, displayName)
        : { uid, email, displayName, role: 'donor' };
      res.json({ user: dbUser });
    } catch (error) {
      console.error('Error in /api/auth/me:', error);
      res.status(500).json({ error: 'Unable to synchronize authenticated profile.' });
    }
  });

  // 1. Get authoritative state
  app.get('/api/state', (_req, res) => {
    res.json({
      users,
      listings,
      notifications,
      hubs: ALL_INDIA_HUBS,
      deliveryLocations: Array.from(deliveryLocations.values()),
    });
  });

  // 1a. Cloud SQL-backed live delivery location endpoints (delivery-scoped authorization)
  app.get('/api/live-locations/:deliveryId', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const listing = listings.find((l) => l.id === req.params.deliveryId);
      if (!listing) {
        res.status(404).json({ error: 'Delivery not found.' });
        return;
      }

      const requesterId = String(req.query.userId || '');
      const isParticipant =
        requesterId === listing.donorId ||
        requesterId === listing.claimedByReceiverId ||
        requesterId === listing.assignedVolunteerId ||
        users.some((u) => u.id === requesterId && u.role === 'sponsor');

      if (!isParticipant && !req.user) {
        res.status(403).json({
          error:
            'Forbidden: Only the assigned donor, volunteer, or claiming receiver can access this delivery location.',
        });
        return;
      }

      let persisted = null;
      let history: Array<{ latitude: number; longitude: number; recordedAt: Date | string }> = [];

      if (process.env.SQL_HOST) {
        try {
          persisted = await getLiveLocationByDeliveryId(listing.id);
          history = await getLocationHistoryByDeliveryId(listing.id, 60);
        } catch (dbErr) {
          console.error('Fallback to live listing coordinates:', dbErr);
        }
      }

      const location = persisted
        ? {
            delivery_id: persisted.deliveryId,
            volunteer_id: persisted.volunteerId,
            latitude: persisted.latitude,
            longitude: persisted.longitude,
            accuracy_meters: persisted.accuracyMeters ?? undefined,
            speed_kmh: persisted.speedKmh ?? undefined,
            updated_at:
              persisted.updatedAt instanceof Date
                ? persisted.updatedAt.toISOString()
                : String(persisted.updatedAt),
            delivery_status: persisted.deliveryStatus,
          }
        : {
            delivery_id: listing.id,
            volunteer_id: listing.assignedVolunteerId || 'unassigned',
            latitude: listing.currentLocation.lat,
            longitude: listing.currentLocation.lng,
            accuracy_meters: listing.currentLocation.accuracyMeters,
            speed_kmh: listing.currentLocation.speedKmh,
            updated_at:
              listing.currentLocation.lastGpsUpdatedAt || listing.createdAt,
            delivery_status: listing.status,
          };

      res.json({ location, history });
    } catch (error) {
      console.error('Error in GET /api/live-locations/:deliveryId:', error);
      res.status(500).json({ error: 'Failed to retrieve live delivery location.' });
    }
  });

  app.put('/api/live-locations/:deliveryId', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const result = updateVolunteerDeliveryLocation({
        ...req.body,
        delivery_id: req.params.deliveryId,
      });

      if (result.error || !result.listing || !result.record) {
        res.status(result.status || 400).json({
          error: result.error || 'Unable to update delivery location.',
        });
        return;
      }

      if (process.env.SQL_HOST) {
        try {
          await upsertLiveLocation({
            deliveryId: result.record.delivery_id,
            volunteerId: result.record.volunteer_id,
            volunteerUid: req.user?.uid || null,
            latitude: result.record.latitude,
            longitude: result.record.longitude,
            accuracyMeters: result.record.accuracy_meters ?? null,
            speedKmh: result.record.speed_kmh ?? null,
            deliveryStatus: result.record.delivery_status,
          });
        } catch (dbErr) {
          console.error('Cloud SQL upsert warning:', dbErr);
        }
      }

      broadcastState('volunteer:location-updated', {
        deliveryId: result.listing.id,
        locationRecord: result.record,
      });
      res.json({ listing: result.listing, location: result.record });
    } catch (error) {
      console.error('Error in PUT /api/live-locations/:deliveryId:', error);
      res.status(500).json({ error: 'Failed to save live delivery location.' });
    }
  });

  // 1b. Update live volunteer GPS coordinates via REST fallback
  app.post('/api/listings/:id/live-location', optionalAuth, async (req: AuthRequest, res) => {
    const result = updateVolunteerDeliveryLocation({
      ...req.body,
      delivery_id: req.params.id,
    });
    if (result.error || !result.listing || !result.record) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }
    if (process.env.SQL_HOST) {
      try {
        await upsertLiveLocation({
          deliveryId: result.record.delivery_id,
          volunteerId: result.record.volunteer_id,
          volunteerUid: req.user?.uid || null,
          latitude: result.record.latitude,
          longitude: result.record.longitude,
          accuracyMeters: result.record.accuracy_meters ?? null,
          speedKmh: result.record.speed_kmh ?? null,
          deliveryStatus: result.record.delivery_status,
        });
      } catch (dbErr) {
        console.error('Cloud SQL upsert warning:', dbErr);
      }
    }
    broadcastState('volunteer:location-updated', {
      deliveryId: result.listing.id,
      locationRecord: result.record,
    });
    res.json({ listing: result.listing, locationRecord: result.record });
  });

  // 1c. Authorized query for a specific delivery's live location record
  app.get('/api/deliveries/:id/location', (req, res) => {
    const listing = listings.find((l) => l.id === req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Delivery not found.' });
      return;
    }
    const requesterId = String(req.query.userId || '');
    const isAuthorized =
      requesterId === listing.donorId ||
      requesterId === listing.claimedByReceiverId ||
      requesterId === listing.assignedVolunteerId;

    if (!isAuthorized) {
      res.status(403).json({
        error:
          'Forbidden: Only the associated donor, assigned volunteer, or claiming receiver can access this delivery location.',
      });
      return;
    }

    const record = deliveryLocations.get(listing.id) || {
      delivery_id: listing.id,
      volunteer_id: listing.assignedVolunteerId || 'unassigned',
      latitude: listing.currentLocation.lat,
      longitude: listing.currentLocation.lng,
      speed_kmh: listing.currentLocation.speedKmh,
      updated_at: listing.currentLocation.lastGpsUpdatedAt || listing.createdAt,
      delivery_status: listing.status,
    };
    res.json({ location: record });
  });

  // 2. Register or Sign In Custom Account
  app.post('/api/auth/register', (req, res) => {
    const {
      name,
      email,
      role,
      organization,
      subType,
      neighborhood,
      capacityKg,
    } = req.body;

    if (!name || !organization || !role) {
      res.status(400).json({ error: 'Name, organization, and role are required.' });
      return;
    }

    const matchedHub =
      ALL_INDIA_HUBS.find(
        (h) =>
          h.neighborhood.toLowerCase() ===
            String(neighborhood || '').toLowerCase() ||
          h.city.toLowerCase() === String(neighborhood || '').toLowerCase()
      ) || ALL_INDIA_HUBS[0];

    const newUser: UserProfile = {
      id: `user-custom-${Date.now()}`,
      name: String(name).trim(),
      email: String(email || 'partner@annakshetra.sample.org').trim(),
      role: role as UserRole,
      organization: String(organization).trim(),
      subType: String(subType || 'Community Partner').trim(),
      city: matchedHub.city,
      neighborhood: matchedHub.neighborhood,
      coordinates: matchedHub.coords,
      capacityKg: Number(capacityKg) || 120,
      dietaryPreference: [
        'Veg',
        'Pure Veg',
        'Non-Veg',
        'Contains Egg',
        'Jain',
        'Vegan',
      ],
      verifiedPartner: true,
      contactSynthetic: `SYNTH-USR-${Math.floor(1000 + Math.random() * 8999)}`,
      vehicleType:
        role === 'volunteer' ? 'Insulated Two-Wheeler Carrier' : undefined,
    };

    users.push(newUser);

    notifications.unshift({
      id: `notif-${Date.now()}`,
      targetRoles: ['donor', 'receiver', 'volunteer', 'sponsor'],
      title: `New ${newUser.role.toUpperCase()} Joined (${newUser.city})`,
      message: `${newUser.organization} (${newUser.neighborhood}, ${newUser.city}) joined the All-India surplus rescue network.`,
      severity: 'info',
      createdAt: new Date().toISOString(),
      readByUserIds: [],
    });

    broadcastState('user:registered', { userId: newUser.id });
    res.status(201).json({ user: newUser });
  });

  // 3. Create Granular Surplus Listing (<60s Donor Flow with All-India Hub & Multi-Units)
  app.post('/api/listings', (req, res) => {
    const {
      donorId,
      title,
      itemsSummary,
      quantityValue,
      quantityUnit,
      servings: explicitServings,
      weightKg: explicitWeightKg,
      dietaryType,
      containsDairy,
      containsEgg,
      preparedWhen,
      foodState,
      storageCondition: explicitStorage,
      packagingType,
      hasAllergens,
      allergens,
      hubId,
      customCoords,
      pickupWindowMinutes,
      spoilageWindowMinutes,
      handlingGuidance,
      safetyChecklistConfirmed,
    } = req.body;

    const donor = users.find((u) => u.id === donorId) || users[0];
    if (!safetyChecklistConfirmed) {
      res.status(400).json({
        error:
          'Mandatory food safety & handling checklist must be confirmed before posting.',
      });
      return;
    }

    const unit: QuantityUnit =
      quantityUnit && ['kg', 'grams', 'litres', 'ml'].includes(quantityUnit)
        ? quantityUnit
        : 'kg';
    const rawQtyVal = Number(quantityValue) || Number(explicitWeightKg) || 50;
    const normalized = normalizeQuantityToKgAndServings(rawQtyVal, unit);
    const finalWeightKg = normalized.weightKg;
    const finalServings =
      Number(explicitServings) > 0
        ? Number(explicitServings)
        : normalized.servings;

    const thermalState: FoodThermalState =
      foodState && ['Hot', 'Warm', 'Chilled', 'ChilledServe'].includes(foodState)
        ? foodState
        : 'Hot';
    const prepWhen: PreparedWhen =
      preparedWhen &&
      [
        'Just Now',
        '1 Hour Ago',
        '2 Hours Ago',
        '3 Hours Ago',
        '4 Hours Ago',
      ].includes(preparedWhen)
        ? preparedWhen
        : 'Just Now';

    const timing = computePreparationTiming(prepWhen, thermalState);
    const storageInfo = mapFoodStateToStorage(thermalState);

    const selectedHub =
      ALL_INDIA_HUBS.find((h) => h.id === hubId) ||
      ALL_INDIA_HUBS.find(
        (h) =>
          h.neighborhood.toLowerCase() === donor.neighborhood.toLowerCase()
      ) ||
      ALL_INDIA_HUBS[0];

    const pickupCoords: Coordinates =
      customCoords &&
      typeof customCoords.lat === 'number' &&
      typeof customCoords.lng === 'number'
        ? {
            lat: Number(customCoords.lat.toFixed(5)),
            lng: Number(customCoords.lng.toFixed(5)),
            hubName:
              customCoords.hubName ||
              `${selectedHub.neighborhood} Custom Pin (${selectedHub.city})`,
            city: customCoords.city || selectedHub.city,
            stateName: selectedHub.stateName,
          }
        : selectedHub.coords;

    const cityPrefix = (pickupCoords.city || selectedHub.city || 'BLR')
      .slice(0, 3)
      .toUpperCase();
    const batchNum = 842 + listings.length;
    const batchCode = `AK-${cityPrefix}-${batchNum}`;

    const pickupMins =
      Number(pickupWindowMinutes) || timing.recommendedPickupMinutes;
    const expiryMins =
      Number(spoilageWindowMinutes) || timing.recommendedSpoilageMinutes;

    const cleanAllergens =
      hasAllergens === false
        ? []
        : Array.isArray(allergens)
        ? allergens
        : [];

    const finalDietary: DietaryType = dietaryType || 'Veg';
    const dairyFlag =
      typeof containsDairy === 'boolean'
        ? containsDairy
        : cleanAllergens.includes('Dairy');
    const eggFlag =
      typeof containsEgg === 'boolean'
        ? containsEgg
        : finalDietary === 'Contains Egg' || cleanAllergens.includes('Egg');

    const newListing: FoodListing = {
      id: `lst-${Date.now()}`,
      batchCode,
      donorId: donor.id,
      donorName: donor.name,
      donorOrg: donor.organization,
      donorType: (donor.subType as FoodListing['donorType']) || 'Wedding Caterer',
      city: pickupCoords.city || selectedHub.city,
      neighborhood: selectedHub.neighborhood,
      pickupCoords,
      title: String(title || 'Fresh Event Surplus Meal Batch').trim(),
      itemsSummary: String(
        itemsSummary || 'Rice, Dal, Vegetable Curry & Flatbreads'
      ).trim(),
      servings: finalServings,
      quantityValue: rawQtyVal,
      quantityUnit: unit,
      weightKg: finalWeightKg,
      dietaryType: finalDietary,
      containsDairy: dairyFlag,
      containsEgg: eggFlag,
      preparedWhen: prepWhen,
      foodState: thermalState,
      storageCondition: explicitStorage || storageInfo.storageCondition,
      packagingType:
        packagingType || 'Food-Grade Sealed Stainless Containers',
      hasAllergens: cleanAllergens.length > 0,
      allergens: cleanAllergens,
      preparedAt: new Date(
        Date.now() - timing.ageMinutes * 60000
      ).toISOString(),
      pickupByTime: new Date(Date.now() + pickupMins * 60000).toISOString(),
      expiresAt: new Date(Date.now() + expiryMins * 60000).toISOString(),
      handlingGuidance:
        handlingGuidance ||
        `Food state: ${thermalState} (Prepared ${prepWhen}). Maintain ${storageInfo.storageCondition} during transit.`,
      safetyChecklistConfirmed: true,
      status: 'POSTED',
      pickupOtp: generateOtp(),
      dropoffOtp: generateOtp(),
      currentLocation: {
        lat: pickupCoords.lat,
        lng: pickupCoords.lng,
        progressPct: 0,
        etaMinutes: 15,
        speedKmh: 0,
        checkpointName: `${pickupCoords.hubName} Loading Dock`,
      },
      custodyTimeline: [
        {
          status: 'POSTED',
          timestamp: new Date().toISOString(),
          actorName: `${donor.name} (${donor.organization})`,
          actorRole: 'donor',
          note: `Posted ${rawQtyVal} ${unit} (${finalServings} meals · ${finalDietary} · Dairy: ${
            dairyFlag ? 'Yes' : 'No'
          } · Prepared: ${prepWhen} · State: ${thermalState}).`,
          temperatureCheckC: storageInfo.defaultTempC,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    listings.unshift(newListing);

    notifications.unshift({
      id: `notif-${Date.now()}`,
      targetRoles: ['receiver', 'volunteer', 'donor', 'sponsor'],
      title: `New Surplus Posted in ${newListing.city}: ${newListing.batchCode}`,
      message: `${donor.organization} posted "${newListing.title}" (${rawQtyVal} ${unit} · ${newListing.dietaryType} · State: ${thermalState} · Prepared ${prepWhen}). Pickup within ${pickupMins} mins.`,
      severity: pickupMins <= 45 ? 'critical' : 'warning',
      listingId: newListing.id,
      batchCode: newListing.batchCode,
      createdAt: new Date().toISOString(),
      readByUserIds: [],
    });

    broadcastState('listing:created', { listingId: newListing.id });
    res.status(201).json({ listing: newListing });
  });

  // 4. Claim a Listing (Receiver NGO + Volunteer Assignment)
  app.post('/api/listings/:id/claim', (req, res) => {
    const listing = listings.find((l) => l.id === req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found.' });
      return;
    }
    if (listing.status !== 'POSTED') {
      res
        .status(400)
        .json({ error: `Listing is already ${listing.status}.` });
      return;
    }

    const { receiverId, volunteerId } = req.body;
    const receiver =
      users.find((u) => u.id === receiverId && u.role === 'receiver') ||
      users.find((u) => u.role === 'receiver')!;
    const volunteer =
      users.find((u) => u.id === volunteerId && u.role === 'volunteer') ||
      users.find((u) => u.role === 'volunteer')!;

    listing.status = 'CLAIMED';
    listing.claimedByReceiverId = receiver.id;
    listing.claimedByReceiverOrg = receiver.organization;
    listing.dropoffCoords = receiver.coordinates;
    listing.assignedVolunteerId = volunteer.id;
    listing.assignedVolunteerName = volunteer.name;
    listing.assignedVolunteerVehicle =
      volunteer.vehicleType || 'Insulated Relief Van';

    const waypoints = generateStreetRouteWaypoints(
      listing.pickupCoords,
      receiver.coordinates
    );
    const pos = interpolateAlongWaypoints(waypoints, 10);

    listing.currentLocation = {
      lat: pos.lat,
      lng: pos.lng,
      progressPct: 10,
      etaMinutes: 16,
      speedKmh: 22,
      checkpointName: pos.streetLabel,
    };

    listing.custodyTimeline.push({
      status: 'CLAIMED',
      timestamp: new Date().toISOString(),
      actorName: `${receiver.name} (${receiver.organization})`,
      actorRole: 'receiver',
      note: `Claimed batch for ${receiver.neighborhood} shelter. Volunteer ${volunteer.name} dispatched for pickup. Awaiting Donor Pickup OTP (${listing.pickupOtp}).`,
    });

    notifications.unshift({
      id: `notif-${Date.now()}`,
      targetRoles: ['donor', 'receiver', 'volunteer'],
      title: `Batch ${listing.batchCode} Claimed & Volunteer Dispatched`,
      message: `${receiver.organization} claimed ${listing.servings} meals. Volunteer ${volunteer.name} en route to ${listing.donorOrg}. Verify Pickup OTP ${listing.pickupOtp} at handover.`,
      severity: 'info',
      listingId: listing.id,
      batchCode: listing.batchCode,
      createdAt: new Date().toISOString(),
      readByUserIds: [],
    });

    broadcastState('listing:claimed', { listingId: listing.id });
    res.json({ listing });
  });

  // 5. Verify Pickup OTP or Drop-off OTP
  app.post('/api/listings/:id/verify-otp', (req, res) => {
    const listing = listings.find((l) => l.id === req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found.' });
      return;
    }

    const { otpType, otpCode, temperatureC } = req.body;
    const cleanedOtp = String(otpCode || '').trim();

    if (otpType === 'pickup') {
      if (listing.status !== 'CLAIMED') {
        res.status(400).json({
          error: 'Listing must be in CLAIMED state to verify Pickup OTP.',
        });
        return;
      }
      if (cleanedOtp !== listing.pickupOtp) {
        res.status(400).json({
          error: `Invalid Pickup OTP. Expected 4-digit donor code (${listing.pickupOtp} for demo).`,
        });
        return;
      }

      listing.status = 'COLLECTED';
      const dropoff = listing.dropoffCoords || findHub('BLR_HSR');
      const waypoints = generateStreetRouteWaypoints(
        listing.pickupCoords,
        dropoff
      );
      const pos = interpolateAlongWaypoints(waypoints, 35);

      listing.currentLocation = {
        lat: pos.lat,
        lng: pos.lng,
        progressPct: 35,
        etaMinutes: 12,
        speedKmh: 28,
        checkpointName: pos.streetLabel,
      };

      const loggedTemp =
        Number(temperatureC) ||
        (listing.storageCondition.includes('Chilled') ? 4.3 : 62.4);

      listing.custodyTimeline.push({
        status: 'COLLECTED',
        timestamp: new Date().toISOString(),
        actorName: `${listing.assignedVolunteerName || 'Karthik V.'} (Volunteer)`,
        actorRole: 'volunteer',
        note: `Pickup OTP ${listing.pickupOtp} verified at donor kitchen. Sealed container temp verified at ${loggedTemp}°C. Live street GPS transit started.`,
        temperatureCheckC: loggedTemp,
      });

      notifications.unshift({
        id: `notif-${Date.now()}`,
        targetRoles: ['donor', 'receiver', 'volunteer'],
        title: `Pickup OTP Verified — ${listing.batchCode} In Live Transit`,
        message: `Custody transferred from ${listing.donorOrg} to volunteer ${listing.assignedVolunteerName}. Temp checked at ${loggedTemp}°C. Heading to ${listing.claimedByReceiverOrg}.`,
        severity: 'info',
        listingId: listing.id,
        batchCode: listing.batchCode,
        createdAt: new Date().toISOString(),
        readByUserIds: [],
      });

      broadcastState('listing:collected', { listingId: listing.id });
      res.json({ listing });
      return;
    }

    if (otpType === 'dropoff') {
      if (listing.status !== 'COLLECTED') {
        res.status(400).json({
          error:
            'Listing must be in COLLECTED (In Transit) state to verify Drop-off OTP.',
        });
        return;
      }
      if (cleanedOtp !== listing.dropoffOtp) {
        res.status(400).json({
          error: `Invalid Drop-off OTP. Expected 4-digit receiver code (${listing.dropoffOtp} for demo).`,
        });
        return;
      }

      listing.status = 'DELIVERED';
      const dropoff = listing.dropoffCoords || findHub('BLR_HSR');
      listing.currentLocation = {
        lat: dropoff.lat,
        lng: dropoff.lng,
        progressPct: 100,
        etaMinutes: 0,
        speedKmh: 0,
        checkpointName: `${dropoff.hubName} Intake Gate`,
      };

      const loggedTemp =
        Number(temperatureC) ||
        (listing.storageCondition.includes('Chilled') ? 4.6 : 60.5);

      listing.custodyTimeline.push({
        status: 'DELIVERED',
        timestamp: new Date().toISOString(),
        actorName: `${listing.claimedByReceiverOrg || 'Community Shelter'}`,
        actorRole: 'receiver',
        note: `Drop-off OTP ${listing.dropoffOtp} verified at shelter intake. ${listing.servings} meals (${listing.weightKg} kg eq.) received safely at ${loggedTemp}°C.`,
        temperatureCheckC: loggedTemp,
      });

      notifications.unshift({
        id: `notif-${Date.now()}`,
        targetRoles: ['donor', 'receiver', 'volunteer', 'sponsor'],
        title: `Delivery Completed & Verified — ${listing.batchCode}`,
        message: `${listing.servings} meals (${listing.weightKg} kg) from ${listing.donorOrg} delivered to ${listing.claimedByReceiverOrg}. Drop-off OTP ${listing.dropoffOtp} confirmed!`,
        severity: 'success',
        listingId: listing.id,
        batchCode: listing.batchCode,
        createdAt: new Date().toISOString(),
        readByUserIds: [],
      });

      if (process.env.SQL_HOST) {
        updateDeliveryLocationStatus(listing.id, 'DELIVERED').catch((dbErr) => {
          console.error('Non-fatal delivery status sync warning:', dbErr);
        });
      }

      broadcastState('listing:delivered', { listingId: listing.id });
      res.json({ listing });
      return;
    }

    res.status(400).json({ error: 'Invalid otpType. Must be pickup or dropoff.' });
  });

  // 6. Advance Live GPS Telemetry Along Street Route
  app.post('/api/listings/:id/advance-gps', (req, res) => {
    const listing = listings.find((l) => l.id === req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found.' });
      return;
    }

    if (listing.status !== 'COLLECTED' && listing.status !== 'CLAIMED') {
      res.status(400).json({
        error: 'Only CLAIMED or COLLECTED batches can advance GPS progress.',
      });
      return;
    }

    const dropoff = listing.dropoffCoords || findHub('BLR_HSR');
    const step = Number(req.body?.stepPct) || 20;
    const nextPct = Math.min(96, listing.currentLocation.progressPct + step);
    const waypoints = generateStreetRouteWaypoints(
      listing.pickupCoords,
      dropoff
    );
    const pos = interpolateAlongWaypoints(waypoints, nextPct);

    listing.currentLocation = {
      lat: pos.lat,
      lng: pos.lng,
      progressPct: nextPct,
      etaMinutes: Math.max(1, Math.round(((100 - nextPct) / 100) * 18)),
      speedKmh: 26 + Math.floor(Math.random() * 8),
      checkpointName: pos.streetLabel,
    };

    broadcastState('listing:gps-updated', { listingId: listing.id });
    res.json({ listing });
  });

  // 7. Mark Notifications as Read
  app.post('/api/notifications/read-all', (req, res) => {
    const { userId } = req.body;
    if (userId) {
      notifications.forEach((n) => {
        if (!n.readByUserIds.includes(userId)) {
          n.readByUserIds.push(userId);
        }
      });
    }
    broadcastState('notifications:read', { userId });
    res.json({ success: true });
  });

  // Vite middleware for development or static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AnnaKshetra server listening on http://localhost:${PORT}`);
  });
}

startServer();
