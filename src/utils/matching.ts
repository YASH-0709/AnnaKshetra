import type {
  Coordinates,
  FoodListing,
  FoodThermalState,
  IndiaHubNode,
  MatchRecommendation,
  PreparedWhen,
  QuantityUnit,
  StorageCondition,
  UserProfile,
} from '../types.ts';

/**
 * All-India Major Food Rescue Hubs & Neighborhood Corridors
 * Covers Bengaluru Tech Corridor + Pan-India Metropolitan Nodes
 */
export const ALL_INDIA_HUBS: IndiaHubNode[] = [
  // Bengaluru Corridor Nodes
  {
    id: 'BLR_BELLANDUR',
    city: 'Bengaluru',
    neighborhood: 'Bellandur',
    stateName: 'Karnataka',
    zone: 'ORR Banquet & Tech Corridor',
    coords: {
      lat: 12.9304,
      lng: 77.6784,
      hubName: 'Bellandur Outer Ring Road Corridor',
      city: 'Bengaluru',
      stateName: 'Karnataka',
    },
    baselineDailyMealNeed: 320,
    shelterCount: 3,
  },
  {
    id: 'BLR_WHITEFIELD',
    city: 'Bengaluru',
    neighborhood: 'Whitefield',
    stateName: 'Karnataka',
    zone: 'EPIP IT Campus Belt',
    coords: {
      lat: 12.9698,
      lng: 77.75,
      hubName: 'Whitefield EPIP Zone Sector 4',
      city: 'Bengaluru',
      stateName: 'Karnataka',
    },
    baselineDailyMealNeed: 290,
    shelterCount: 3,
  },
  {
    id: 'BLR_KORAMANGALA',
    city: 'Bengaluru',
    neighborhood: 'Koramangala',
    stateName: 'Karnataka',
    zone: '4th Block Civic Cluster',
    coords: {
      lat: 12.9352,
      lng: 77.6245,
      hubName: 'Koramangala 4th Block Civic Cluster',
      city: 'Bengaluru',
      stateName: 'Karnataka',
    },
    baselineDailyMealNeed: 430,
    shelterCount: 5,
  },
  {
    id: 'BLR_HSR',
    city: 'Bengaluru',
    neighborhood: 'HSR Layout',
    stateName: 'Karnataka',
    zone: 'Sector 2 Community Shelter Node',
    coords: {
      lat: 12.9121,
      lng: 77.6446,
      hubName: 'HSR Layout Sector 2 Community Node',
      city: 'Bengaluru',
      stateName: 'Karnataka',
    },
    baselineDailyMealNeed: 390,
    shelterCount: 4,
  },
  {
    id: 'BLR_INDIRANAGAR',
    city: 'Bengaluru',
    neighborhood: 'Indiranagar',
    stateName: 'Karnataka',
    zone: '100ft Road Hospitality Hub',
    coords: {
      lat: 12.9784,
      lng: 77.6408,
      hubName: 'Indiranagar 100ft Cross Hub',
      city: 'Bengaluru',
      stateName: 'Karnataka',
    },
    baselineDailyMealNeed: 310,
    shelterCount: 4,
  },
  {
    id: 'BLR_ECITY',
    city: 'Bengaluru',
    neighborhood: 'Electronic City',
    stateName: 'Karnataka',
    zone: 'Phase 1 Industrial Campus Belt',
    coords: {
      lat: 12.8452,
      lng: 77.6602,
      hubName: 'Electronic City Phase 1 Campus Belt',
      city: 'Bengaluru',
      stateName: 'Karnataka',
    },
    baselineDailyMealNeed: 360,
    shelterCount: 4,
  },
  // Pan-India Metropolitan & Regional Nodes
  {
    id: 'MUM_ANDHERI',
    city: 'Mumbai',
    neighborhood: 'Andheri / BKC Corridor',
    stateName: 'Maharashtra',
    zone: 'Western Suburbs Banquet & Relief Zone',
    coords: {
      lat: 19.1136,
      lng: 72.8697,
      hubName: 'Mumbai Andheri East Civic Relief Node',
      city: 'Mumbai',
      stateName: 'Maharashtra',
    },
    baselineDailyMealNeed: 640,
    shelterCount: 8,
  },
  {
    id: 'DEL_CONNAUGHT',
    city: 'Delhi NCR',
    neighborhood: 'Central Delhi & Noida Sector 62',
    stateName: 'Delhi',
    zone: 'NCR Banquet & Night Shelter Corridor',
    coords: {
      lat: 28.6139,
      lng: 77.209,
      hubName: 'New Delhi Central Rasoi Relief Hub',
      city: 'Delhi NCR',
      stateName: 'Delhi',
    },
    baselineDailyMealNeed: 710,
    shelterCount: 9,
  },
  {
    id: 'HYD_HITEC',
    city: 'Hyderabad',
    neighborhood: 'HITEC City & Gachibowli',
    stateName: 'Telangana',
    zone: 'Cyberabad IT & Convention Belt',
    coords: {
      lat: 17.4435,
      lng: 78.3772,
      hubName: 'Hyderabad HITEC Madhapur Kitchen Node',
      city: 'Hyderabad',
      stateName: 'Telangana',
    },
    baselineDailyMealNeed: 480,
    shelterCount: 6,
  },
  {
    id: 'CHE_OMR',
    city: 'Chennai',
    neighborhood: 'OMR & T. Nagar',
    stateName: 'Tamil Nadu',
    zone: 'IT Expressway & Marriage Hall Belt',
    coords: {
      lat: 13.0418,
      lng: 80.2341,
      hubName: 'Chennai T. Nagar & OMR Seva Hub',
      city: 'Chennai',
      stateName: 'Tamil Nadu',
    },
    baselineDailyMealNeed: 450,
    shelterCount: 5,
  },
  {
    id: 'KOL_SALTLAKE',
    city: 'Kolkata',
    neighborhood: 'Salt Lake Sector V & Park Street',
    stateName: 'West Bengal',
    zone: 'East Kolkata Community Kitchen Corridor',
    coords: {
      lat: 22.5726,
      lng: 88.3639,
      hubName: 'Kolkata Salt Lake & Central Relief Hub',
      city: 'Kolkata',
      stateName: 'West Bengal',
    },
    baselineDailyMealNeed: 520,
    shelterCount: 6,
  },
  {
    id: 'PUN_HINJEWADI',
    city: 'Pune',
    neighborhood: 'Hinjewadi & Kothrud',
    stateName: 'Maharashtra',
    zone: 'Pune Tech Park & Mess Belt',
    coords: {
      lat: 18.5204,
      lng: 73.8567,
      hubName: 'Pune Shivajinagar & Hinjewadi Node',
      city: 'Pune',
      stateName: 'Maharashtra',
    },
    baselineDailyMealNeed: 370,
    shelterCount: 4,
  },
  {
    id: 'AMD_SG',
    city: 'Ahmedabad',
    neighborhood: 'SG Highway & Navrangpura',
    stateName: 'Gujarat',
    zone: 'Party Plot & Community Thali Belt',
    coords: {
      lat: 23.0225,
      lng: 72.5714,
      hubName: 'Ahmedabad SG Highway Annakshetra Hub',
      city: 'Ahmedabad',
      stateName: 'Gujarat',
    },
    baselineDailyMealNeed: 390,
    shelterCount: 5,
  },
  {
    id: 'JAI_MIROAD',
    city: 'Jaipur',
    neighborhood: 'Malviya Nagar & MI Road',
    stateName: 'Rajasthan',
    zone: 'Heritage Wedding & Shelter Corridor',
    coords: {
      lat: 26.9124,
      lng: 75.7873,
      hubName: 'Jaipur Pink City Community Kitchen',
      city: 'Jaipur',
      stateName: 'Rajasthan',
    },
    baselineDailyMealNeed: 340,
    shelterCount: 4,
  },
  {
    id: 'KOC_KAKKANAD',
    city: 'Kochi',
    neighborhood: 'Kakkanad InfoPark & Edappally',
    stateName: 'Kerala',
    zone: 'Ernakulam Sadhya & Canteen Hub',
    coords: {
      lat: 9.9312,
      lng: 76.2673,
      hubName: 'Kochi Kakkanad Community Relief Node',
      city: 'Kochi',
      stateName: 'Kerala',
    },
    baselineDailyMealNeed: 280,
    shelterCount: 3,
  },
  {
    id: 'LKO_GOMTI',
    city: 'Lucknow',
    neighborhood: 'Gomti Nagar & Hazratganj',
    stateName: 'Uttar Pradesh',
    zone: 'Awadh Banquet & Night Shelter Belt',
    coords: {
      lat: 26.8467,
      lng: 80.9462,
      hubName: 'Lucknow Gomti Nagar Seva Kendra',
      city: 'Lucknow',
      stateName: 'Uttar Pradesh',
    },
    baselineDailyMealNeed: 410,
    shelterCount: 5,
  },
  {
    id: 'GAU_DISPUR',
    city: 'Guwahati',
    neighborhood: 'GS Road & Paltan Bazaar',
    stateName: 'Assam',
    zone: 'Northeast Brahmaputra Relief Node',
    coords: {
      lat: 26.1445,
      lng: 91.7362,
      hubName: 'Guwahati GS Road Community Kitchen',
      city: 'Guwahati',
      stateName: 'Assam',
    },
    baselineDailyMealNeed: 260,
    shelterCount: 3,
  },
];

/**
 * Normalizes any quantity (kg, grams, litres, ml) into kilograms equivalent
 * and computes standard 450g/450ml meal servings.
 */
export function normalizeQuantityToKgAndServings(
  value: number,
  unit: QuantityUnit
): { weightKg: number; servings: number; formattedQuantity: string } {
  const cleanVal = Math.max(0.1, Number(value) || 1);
  let weightKg = cleanVal;

  switch (unit) {
    case 'kg':
      weightKg = cleanVal;
      break;
    case 'grams':
      weightKg = cleanVal / 1000;
      break;
    case 'litres':
      // 1 litre of cooked dal/curry/milk/soup ~= 1.0 kg mass equivalent
      weightKg = cleanVal;
      break;
    case 'ml':
      weightKg = cleanVal / 1000;
      break;
  }

  const roundedKg = Number(Math.max(0.1, weightKg).toFixed(2));
  const servings = Math.max(1, Math.round(roundedKg / 0.45));
  const formattedQuantity = `${cleanVal} ${unit}`;

  return { weightKg: roundedKg, servings, formattedQuantity };
}

/**
 * Maps food thermal state to storage condition and recommended probe temperature
 */
export function mapFoodStateToStorage(state: FoodThermalState): {
  storageCondition: StorageCondition;
  defaultTempC: number;
} {
  switch (state) {
    case 'Hot':
      return {
        storageCondition: 'Hot Insulated (>60°C)',
        defaultTempC: 63.5,
      };
    case 'Warm':
      return {
        storageCondition: 'Warm Hygienic Hold (45–60°C)',
        defaultTempC: 52.0,
      };
    case 'Chilled':
      return {
        storageCondition: 'Chilled Cold-Chain (<5°C)',
        defaultTempC: 4.2,
      };
    case 'ChilledServe':
      return {
        storageCondition: 'ChilledServe Ready (<8°C)',
        defaultTempC: 6.0,
      };
  }
}

/**
 * Converts preparation age label ('Just Now', '1 Hour Ago', etc.) into
 * minutes elapsed since preparation and recommended remaining safe spoilage minutes.
 */
export function computePreparationTiming(
  preparedWhen: PreparedWhen,
  foodState: FoodThermalState
): {
  ageMinutes: number;
  recommendedSpoilageMinutes: number;
  recommendedPickupMinutes: number;
} {
  const ageMap: Record<PreparedWhen, number> = {
    'Just Now': 12,
    '1 Hour Ago': 60,
    '2 Hours Ago': 120,
    '3 Hours Ago': 180,
    '4 Hours Ago': 240,
  };
  const ageMinutes = ageMap[preparedWhen] ?? 30;

  // Base shelf life depends on thermal state
  const baseSafeTotalWindow =
    foodState === 'Chilled' || foodState === 'ChilledServe'
      ? 360 // 6 hours if blast-chilled/cold-chain
      : foodState === 'Hot'
      ? 270 // 4.5 hours if held >60°C
      : 210; // 3.5 hours if warm

  const remainingSafe = Math.max(35, baseSafeTotalWindow - ageMinutes);
  const pickupWin = Math.max(20, Math.min(90, Math.round(remainingSafe * 0.55)));

  return {
    ageMinutes,
    recommendedSpoilageMinutes: remainingSafe,
    recommendedPickupMinutes: pickupWin,
  };
}

/**
 * Formats a listing's quantity with its original unit (kg, grams, litres, ml)
 */
export function formatListingQuantity(listing: FoodListing): string {
  if (listing.quantityValue && listing.quantityUnit) {
    if (listing.quantityUnit === 'kg') {
      return `${listing.quantityValue} kg`;
    }
    return `${listing.quantityValue} ${listing.quantityUnit} (${listing.weightKg} kg eq.)`;
  }
  return `${listing.weightKg} kg`;
}

/**
 * Generates realistic multi-waypoint street route coordinates between pickup & dropoff
 * so the live delivery vehicle follows street curvature rather than a straight line.
 */
export function generateStreetRouteWaypoints(
  origin: Coordinates,
  destination: Coordinates
): Array<{ lat: number; lng: number; streetLabel: string }> {
  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;

  // Create curved arterial road waypoints simulating ring roads & flyovers
  return [
    {
      lat: origin.lat,
      lng: origin.lng,
      streetLabel: `${origin.hubName} Loading Bay`,
    },
    {
      lat: Number((origin.lat + dLat * 0.18 + dLng * 0.06).toFixed(5)),
      lng: Number((origin.lng + dLng * 0.14 - dLat * 0.04).toFixed(5)),
      streetLabel: 'Arterial Service Road Junction',
    },
    {
      lat: Number((origin.lat + dLat * 0.38 + dLng * 0.09).toFixed(5)),
      lng: Number((origin.lng + dLng * 0.36 - dLat * 0.07).toFixed(5)),
      streetLabel: 'Outer Ring Road Flyover',
    },
    {
      lat: Number((origin.lat + dLat * 0.62 - dLng * 0.05).toFixed(5)),
      lng: Number((origin.lng + dLng * 0.64 + dLat * 0.06).toFixed(5)),
      streetLabel: 'Expressway Underpass Corridor',
    },
    {
      lat: Number((origin.lat + dLat * 0.84 - dLng * 0.03).toFixed(5)),
      lng: Number((origin.lng + dLng * 0.86 + dLat * 0.03).toFixed(5)),
      streetLabel: 'Civic Ward Approach Road',
    },
    {
      lat: destination.lat,
      lng: destination.lng,
      streetLabel: `${destination.hubName} Intake Gate`,
    },
  ];
}

/**
 * Interpolates smooth lat/lng and current street name along multi-waypoint road path
 */
export function interpolateAlongWaypoints(
  waypoints: Array<{ lat: number; lng: number; streetLabel: string }>,
  progressPct: number
): { lat: number; lng: number; streetLabel: string } {
  if (waypoints.length === 0) {
    return { lat: 12.9304, lng: 77.6784, streetLabel: 'Corridor Hub' };
  }
  if (waypoints.length === 1 || progressPct <= 0) {
    return waypoints[0];
  }
  if (progressPct >= 100) {
    return waypoints[waypoints.length - 1];
  }

  const totalSegments = waypoints.length - 1;
  const exactPos = (progressPct / 100) * totalSegments;
  const segIndex = Math.min(totalSegments - 1, Math.floor(exactPos));
  const segFraction = exactPos - segIndex;

  const start = waypoints[segIndex];
  const end = waypoints[segIndex + 1];

  return {
    lat: Number((start.lat + (end.lat - start.lat) * segFraction).toFixed(5)),
    lng: Number((start.lng + (end.lng - start.lng) * segFraction).toFixed(5)),
    streetLabel: segFraction < 0.5 ? start.streetLabel : end.streetLabel,
  };
}

/**
 * Calculates Haversine distance in kilometers between two coordinates
 */
export function calculateDistanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Number((R * c).toFixed(2));
}

/**
 * Computes remaining minutes until a listing spoils/expires
 */
export function getMinutesRemaining(isoTimestamp: string): number {
  const diffMs = new Date(isoTimestamp).getTime() - Date.now();
  return Math.max(0, Math.round(diffMs / 60000));
}

/**
 * Smart multi-factor matching engine ranking receiver NGOs & volunteers
 * by distance, quantity capacity, spoilage timing, and dietary need.
 */
export function computeSmartMatches(
  listing: FoodListing,
  users: UserProfile[]
): MatchRecommendation[] {
  const receivers = users.filter((u) => u.role === 'receiver');
  const volunteers = users.filter((u) => u.role === 'volunteer');
  const minsRemaining = getMinutesRemaining(listing.expiresAt);

  return receivers
    .map((receiver) => {
      const distanceKm = calculateDistanceKm(
        listing.pickupCoords,
        receiver.coordinates
      );
      const estimatedTransitMins = Math.max(8, Math.round((distanceKm / 24) * 60));

      // 1. Distance Score (0-100)
      const distanceScore = Math.max(0, Math.min(100, Math.round(100 - distanceKm * 5.5)));

      // 2. Quantity & Capacity Fit Score (0-100)
      const capacityRatio = listing.weightKg / Math.max(10, receiver.capacityKg);
      let capacityFitScore = 90;
      if (capacityRatio <= 1.0 && capacityRatio >= 0.2) {
        capacityFitScore = 98;
      } else if (capacityRatio < 0.2) {
        capacityFitScore = 78;
      } else {
        capacityFitScore = Math.max(35, Math.round(100 - (capacityRatio - 1) * 60));
      }

      // 3. Timing & Spoilage Urgency Score (0-100)
      const bufferMins = minsRemaining - estimatedTransitMins;
      let urgencyFitScore = 95;
      if (bufferMins <= 15) {
        urgencyFitScore = 25;
      } else if (bufferMins <= 45) {
        urgencyFitScore = 70;
      } else if (bufferMins <= 90) {
        urgencyFitScore = 88;
      }

      // 4. Dietary Compatibility
      const dietaryPrefs = receiver.dietaryPreference || [
        'Veg',
        'Pure Veg',
        'Non-Veg',
        'Contains Egg',
        'Jain',
        'Vegan',
      ];
      const normalizedDiet =
        listing.dietaryType === 'Veg' ? 'Pure Veg' : listing.dietaryType;
      const dietaryMatch =
        dietaryPrefs.includes(listing.dietaryType) ||
        dietaryPrefs.includes(normalizedDiet);

      // Find nearest available volunteer courier to the donor pickup point
      const sortedVolunteers = [...volunteers].sort(
        (v1, v2) =>
          calculateDistanceKm(listing.pickupCoords, v1.coordinates) -
          calculateDistanceKm(listing.pickupCoords, v2.coordinates)
      );
      const nearestVolunteer = sortedVolunteers[0];

      const rawTotal =
        distanceScore * 0.35 +
        capacityFitScore * 0.25 +
        urgencyFitScore * 0.25 +
        (dietaryMatch ? 15 : 0);
      const totalMatchScore = Math.min(99, Math.max(12, Math.round(rawTotal)));

      const rationaleParts: string[] = [
        `${distanceKm} km away (~${estimatedTransitMins} min transit)`,
        `handles up to ${receiver.capacityKg} kg (${capacityFitScore}% capacity fit)`,
      ];
      if (dietaryMatch) {
        rationaleParts.push(`accepts ${listing.dietaryType}`);
      } else {
        rationaleParts.push(`Note: prefers ${dietaryPrefs.join('/')}`);
      }

      return {
        receiver,
        volunteer: nearestVolunteer,
        distanceKm,
        estimatedTransitMins,
        capacityFitScore,
        urgencyFitScore,
        dietaryMatch,
        totalMatchScore,
        rationale: rationaleParts.join(' · '),
      };
    })
    .sort((a, b) => b.totalMatchScore - a.totalMatchScore);
}

/**
 * Transparent Impact & Business Case Formula Constants
 */
export const IMPACT_ASSUMPTIONS = {
  KG_PER_STANDARD_MEAL: 0.45,
  CO2E_KG_PER_KG_FOOD_WASTE: 2.5,
  WATER_LITERS_PER_KG_FOOD: 820,
  WET_WASTE_HAULING_SAVINGS_INR_PER_KG: 18,
  CSR_SPONSOR_COST_PER_RESCUED_MEAL_INR: 11.5,
  RETAIL_MEAL_EQUIVALENT_VALUE_INR: 65,
};
