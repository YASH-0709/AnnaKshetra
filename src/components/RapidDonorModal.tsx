import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Flame,
  MapPin,
  ShieldCheck,
  Sparkles,
  Thermometer,
  X,
} from 'lucide-react';
import {
  AllergenType,
  Coordinates,
  DietaryType,
  FoodListing,
  FoodThermalState,
  PreparedWhen,
  QuantityUnit,
  UserProfile,
} from '../types';
import {
  ALL_INDIA_HUBS,
  computePreparationTiming,
  mapFoodStateToStorage,
  normalizeQuantityToKgAndServings,
} from '../utils/matching';

interface RapidDonorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onCreated: (listing: FoodListing) => void;
  customPinnedCoords?: Coordinates | null;
}

interface PresetTemplate {
  label: string;
  title: string;
  itemsSummary: string;
  quantityValue: number;
  quantityUnit: QuantityUnit;
  dietaryType: DietaryType;
  containsDairy: boolean;
  containsEgg: boolean;
  preparedWhen: PreparedWhen;
  foodState: FoodThermalState;
  packagingType: string;
  hasAllergens: boolean;
  allergens: string[];
  handlingGuidance: string;
}

const RAPID_PRESETS: PresetTemplate[] = [
  {
    label: '1-Click: Wedding Buffet (75 kg · Hot)',
    title: 'Grand Muhurtham Unserved Banquet Buffet',
    itemsSummary:
      'Veg Dum Biryani, Dal Makhani, Paneer Tikka Gravy, 300 Butter Rotis & Gulab Jamun',
    quantityValue: 75,
    quantityUnit: 'kg',
    dietaryType: 'Veg',
    containsDairy: true,
    containsEgg: false,
    preparedWhen: 'Just Now',
    foodState: 'Hot',
    packagingType: 'Sealed Stainless Gastronorm Trays',
    hasAllergens: true,
    allergens: ['Dairy', 'Gluten / Wheat', 'Nuts / Peanuts'],
    handlingGuidance:
      'Maintain above 60°C in thermal box. Reheat gravies to 75°C core temperature prior to shelter distribution.',
  },
  {
    label: '1-Click: ChilledServe Chaas/Lassi (40 L)',
    title: 'Masala Chaas, Sweet Lassi & Badam Milk Cans',
    itemsSummary:
      'Chilled Spiced Buttermilk (Chaas) & Saffron Lassi in food-grade stainless cans',
    quantityValue: 40,
    quantityUnit: 'litres',
    dietaryType: 'Veg',
    containsDairy: true,
    containsEgg: false,
    preparedWhen: '1 Hour Ago',
    foodState: 'ChilledServe',
    packagingType: 'Food-Grade Sealed Beverage Cans',
    hasAllergens: true,
    allergens: ['Dairy', 'Nuts / Peanuts'],
    handlingGuidance:
      'ChilledServe ready-to-drink (<8°C). Keep chilled in insulated ice-pack carriers.',
  },
  {
    label: '1-Click: Egg & Soy Protein Bowl (35,000 g)',
    title: 'IT Canteen Egg Masala & Soy Manchurian Trays',
    itemsSummary:
      'Steamed Herb Rice, Boiled Egg Curry, Soy Chunks Gravy & Chapati Packs',
    quantityValue: 35000,
    quantityUnit: 'grams',
    dietaryType: 'Contains Egg',
    containsDairy: false,
    containsEgg: true,
    preparedWhen: '2 Hours Ago',
    foodState: 'Warm',
    packagingType: 'Tamper-Evident Foil Meal Containers',
    hasAllergens: true,
    allergens: ['Soy', 'Egg', 'Gluten / Wheat'],
    handlingGuidance:
      'Keep sealed in insulated delivery crates. Reheat to 75°C and distribute within 90 minutes.',
  },
];

const ALL_ALLERGENS: AllergenType[] = [
  'Soy',
  'Dairy',
  'Nuts / Peanuts',
  'Gluten / Wheat',
  'Egg',
  'Mustard',
  'Sesame',
  'Shellfish',
];

const QUANTITY_UNITS: Array<{ value: QuantityUnit; label: string }> = [
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'grams', label: 'Grams (g)' },
  { value: 'litres', label: 'Litres (L)' },
  { value: 'ml', label: 'Millilitres (ml)' },
];

const PREPARED_WHEN_OPTIONS: PreparedWhen[] = [
  'Just Now',
  '1 Hour Ago',
  '2 Hours Ago',
  '3 Hours Ago',
  '4 Hours Ago',
];

const FOOD_STATE_OPTIONS: Array<{
  value: FoodThermalState;
  label: string;
  desc: string;
}> = [
  { value: 'Hot', label: 'Hot (>60°C)', desc: 'Fresh off stove / hot-held' },
  { value: 'Warm', label: 'Warm (45–60°C)', desc: 'Recently cooked ambient' },
  { value: 'Chilled', label: 'Chilled (<5°C)', desc: 'Cold-room / needs reheat' },
  {
    value: 'ChilledServe',
    label: 'ChilledServe (<8°C)',
    desc: 'Serve cold (chaas/curd/fruit)',
  },
];

export const RapidDonorModal: React.FC<RapidDonorModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onCreated,
  customPinnedCoords,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Location / All-India Hub Selection
  const defaultHubId =
    ALL_INDIA_HUBS.find(
      (h) =>
        h.neighborhood.toLowerCase() === currentUser.neighborhood.toLowerCase()
    )?.id || ALL_INDIA_HUBS[0].id;
  const [selectedHubId, setSelectedHubId] = useState<string>(defaultHubId);
  const [useCustomMapPin, setUseCustomMapPin] = useState<boolean>(false);

  // Food Name & Summary
  const [title, setTitle] = useState(RAPID_PRESETS[0].title);
  const [itemsSummary, setItemsSummary] = useState(
    RAPID_PRESETS[0].itemsSummary
  );

  // Granular Quantity & Units (kg, grams, litres, ml)
  const [quantityValue, setQuantityValue] = useState<number>(
    RAPID_PRESETS[0].quantityValue
  );
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>(
    RAPID_PRESETS[0].quantityUnit
  );

  // Food Type, Contains Dairy, Contains Egg
  const [dietaryType, setDietaryType] = useState<DietaryType>(
    RAPID_PRESETS[0].dietaryType
  );
  const [containsDairy, setContainsDairy] = useState<boolean>(
    RAPID_PRESETS[0].containsDairy
  );

  // Preparation Time (Just Now, 1h, 2h, 3h, 4h ago) & Thermal State (Hot, Warm, Chilled, ChilledServe)
  const [preparedWhen, setPreparedWhen] = useState<PreparedWhen>(
    RAPID_PRESETS[0].preparedWhen
  );
  const [foodState, setFoodState] = useState<FoodThermalState>(
    RAPID_PRESETS[0].foodState
  );

  // Allergen Gate & Multi-Select (Soy, Dairy, Nuts, etc.)
  const [hasAllergens, setHasAllergens] = useState<boolean>(
    RAPID_PRESETS[0].hasAllergens
  );
  const [allergens, setAllergens] = useState<string[]>(
    RAPID_PRESETS[0].allergens
  );
  const [customAllergenInput, setCustomAllergenInput] = useState<string>('');

  const [packagingType, setPackagingType] = useState(
    RAPID_PRESETS[0].packagingType
  );
  const [handlingGuidance, setHandlingGuidance] = useState(
    RAPID_PRESETS[0].handlingGuidance
  );
  const [safetyChecklistConfirmed, setSafetyChecklistConfirmed] =
    useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customPinnedCoords) {
      setUseCustomMapPin(true);
    }
  }, [customPinnedCoords]);

  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  // Derived normalized weight, servings, and spoilage windows
  const normalizedQty = useMemo(
    () => normalizeQuantityToKgAndServings(quantityValue, quantityUnit),
    [quantityValue, quantityUnit]
  );

  const timingCalc = useMemo(
    () => computePreparationTiming(preparedWhen, foodState),
    [preparedWhen, foodState]
  );

  const storageMapping = useMemo(
    () => mapFoodStateToStorage(foodState),
    [foodState]
  );

  if (!isOpen) return null;

  const applyPreset = (preset: PresetTemplate) => {
    setTitle(preset.title);
    setItemsSummary(preset.itemsSummary);
    setQuantityValue(preset.quantityValue);
    setQuantityUnit(preset.quantityUnit);
    setDietaryType(preset.dietaryType);
    setContainsDairy(preset.containsDairy);
    setPreparedWhen(preset.preparedWhen);
    setFoodState(preset.foodState);
    setPackagingType(preset.packagingType);
    setHasAllergens(preset.hasAllergens);
    setAllergens(preset.allergens);
    setHandlingGuidance(preset.handlingGuidance);
    setErrorMsg(null);
  };

  const handleUnitChange = (nextUnit: QuantityUnit) => {
    // Convert existing value smoothly between kg/grams and litres/ml
    if (
      (quantityUnit === 'kg' || quantityUnit === 'litres') &&
      (nextUnit === 'grams' || nextUnit === 'ml')
    ) {
      setQuantityValue(Math.round(quantityValue * 1000));
    } else if (
      (quantityUnit === 'grams' || quantityUnit === 'ml') &&
      (nextUnit === 'kg' || nextUnit === 'litres')
    ) {
      setQuantityValue(Number((quantityValue / 1000).toFixed(2)));
    }
    setQuantityUnit(nextUnit);
  };

  const handleToggleDairy = (val: boolean) => {
    setContainsDairy(val);
    if (val) {
      setHasAllergens(true);
      if (!allergens.includes('Dairy')) {
        setAllergens((prev) => [...prev, 'Dairy']);
      }
    } else {
      setAllergens((prev) => prev.filter((a) => a !== 'Dairy'));
    }
  };

  const handleDietaryChange = (nextDiet: DietaryType) => {
    setDietaryType(nextDiet);
    if (nextDiet === 'Contains Egg') {
      setHasAllergens(true);
      if (!allergens.includes('Egg')) {
        setAllergens((prev) => [...prev, 'Egg']);
      }
    } else if (nextDiet === 'Vegan') {
      handleToggleDairy(false);
      setAllergens((prev) => prev.filter((a) => a !== 'Egg' && a !== 'Dairy'));
    }
  };

  const toggleAllergen = (item: string) => {
    setAllergens((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const handleAddCustomAllergen = () => {
    const clean = customAllergenInput.trim();
    if (!clean) return;
    if (!allergens.includes(clean)) {
      setAllergens((prev) => [...prev, clean]);
    }
    setCustomAllergenInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safetyChecklistConfirmed) {
      setErrorMsg(
        'Please confirm the food hygiene and non-certification handling declaration.'
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donorId: currentUser.id,
          hubId: selectedHubId,
          customCoords:
            useCustomMapPin && customPinnedCoords
              ? customPinnedCoords
              : undefined,
          title,
          itemsSummary,
          quantityValue,
          quantityUnit,
          servings: normalizedQty.servings,
          weightKg: normalizedQty.weightKg,
          dietaryType,
          containsDairy,
          containsEgg:
            dietaryType === 'Contains Egg' || allergens.includes('Egg'),
          preparedWhen,
          foodState,
          storageCondition: storageMapping.storageCondition,
          packagingType,
          hasAllergens,
          allergens: hasAllergens ? allergens : [],
          pickupWindowMinutes: timingCalc.recommendedPickupMinutes,
          spoilageWindowMinutes: timingCalc.recommendedSpoilageMinutes,
          handlingGuidance,
          safetyChecklistConfirmed,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to publish surplus listing.');
      }
      onCreated(data.listing);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to post listing.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl my-6">
        {/* Modal Header with <60s Speed Benchmark */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-orange-600" />
              <span>All-India Granular Surplus Food Intake</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-orange-600 dark:text-orange-400 font-medium">
                Elapsed: {elapsedSeconds}s / 60s target
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              Post Surplus Food Batch — {currentUser.organization}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
        >
          {/* 1-Click Kitchen Templates */}
          <div>
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-orange-600" />
              <span>Quick-Fill Kitchen Templates (1-Click Setup):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {RAPID_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="px-3 py-2 text-xs font-medium text-left border border-slate-200 dark:border-slate-800 rounded-lg hover:border-orange-500 dark:hover:border-orange-500 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 1. All-India Location Selector & Food Name */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                All-India Pickup City &amp; Corridor Hub
              </label>
              <select
                value={selectedHubId}
                onChange={(e) => {
                  setSelectedHubId(e.target.value);
                  setUseCustomMapPin(false);
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                {ALL_INDIA_HUBS.map((hub) => (
                  <option key={hub.id} value={hub.id}>
                    {hub.city} — {hub.neighborhood} ({hub.stateName})
                  </option>
                ))}
              </select>
              {customPinnedCoords && (
                <label className="flex items-center gap-1.5 mt-1.5 text-[11px] text-orange-600 dark:text-orange-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomMapPin}
                    onChange={(e) => setUseCustomMapPin(e.target.checked)}
                    className="accent-orange-600"
                  />
                  <MapPin className="w-3 h-3" />
                  <span>
                    Use custom map pin ({customPinnedCoords.lat.toFixed(3)}°N,{' '}
                    {customPinnedCoords.lng.toFixed(3)}°E)
                  </span>
                </label>
              )}
            </div>

            <div className="sm:col-span-7">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Food Name (Primary Dish / Batch Title)
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Veg Dum Biryani, Masala Chaas Cans, or Egg Curry Trays"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="sm:col-span-12">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Complete Menu Items &amp; Packaging Details
              </label>
              <input
                type="text"
                required
                value={itemsSummary}
                onChange={(e) => setItemsSummary(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {/* 2. Quantity in kg, grams, litres, or ml */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Quantity &amp; Measurement Unit (kg · grams · litres · ml)
              </span>
              <span className="text-xs font-mono-tabular font-semibold text-emerald-600 dark:text-emerald-400">
                Normalized: {normalizedQty.weightKg} kg eq. (~
                {normalizedQty.servings} standard meals)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Enter Quantity Amount
                </label>
                <input
                  type="number"
                  step="any"
                  min={0.5}
                  required
                  value={quantityValue}
                  onChange={(e) => setQuantityValue(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm font-mono-tabular font-bold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="sm:col-span-8">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Select Measurement Unit
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {QUANTITY_UNITS.map((u) => {
                    const active = quantityUnit === u.value;
                    return (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => handleUnitChange(u.value)}
                        className={`py-2 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                          active
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {u.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Food Type (Veg, Non-Veg, Contains Egg, Jain, Vegan) & Contains Dairy */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-7">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Food Type (Dietary Classification)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {(
                  [
                    ['Veg', 'Veg'],
                    ['Non-Veg', 'Non-Veg'],
                    ['Contains Egg', 'Contains Egg'],
                    ['Jain', 'Jain'],
                    ['Vegan', 'Vegan'],
                  ] as const
                ).map(([val, label]) => {
                  const active =
                    dietaryType === val ||
                    (val === 'Veg' && dietaryType === 'Pure Veg');
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleDietaryChange(val)}
                      className={`py-2 px-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Contains Dairy (Milk / Ghee / Paneer / Curd)?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleDairy(true)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    containsDairy
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Yes · Contains Dairy
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleDairy(false)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    !containsDairy
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  No · Dairy-Free
                </button>
              </div>
            </div>
          </div>

          {/* 4. When Was Food Prepared? & State of Food (Hot, Warm, Chilled, ChilledServe) */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  When Was the Food Prepared?
                </label>
                <span className="text-xs font-mono-tabular text-orange-600 dark:text-orange-400 font-semibold">
                  Auto-Calculated Safe Window: {timingCalc.recommendedSpoilageMinutes}{' '}
                  mins left (Pickup within {timingCalc.recommendedPickupMinutes}m)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {PREPARED_WHEN_OPTIONS.map((opt) => {
                  const active = preparedWhen === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPreparedWhen(opt)}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                Current State of Food (Thermal Condition)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FOOD_STATE_OPTIONS.map((st) => {
                  const active = foodState === st.value;
                  return (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => setFoodState(st.value)}
                      className={`p-2.5 text-left rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5 text-orange-500" />
                        <span>{st.label}</span>
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 ${
                          active
                            ? 'text-slate-300 dark:text-slate-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {st.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. Contains Allergens? (Yes / No + Soy, Nuts, Dairy, Gluten, Egg, etc.) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Does This Food Contain Allergens (e.g., Soy, Nuts, Dairy,
                Gluten)?
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setHasAllergens(true)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md border cursor-pointer ${
                    hasAllergens
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  Yes · Contains Allergens
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHasAllergens(false);
                    setAllergens([]);
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-md border cursor-pointer ${
                    !hasAllergens
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  No · Allergen-Free
                </button>
              </div>
            </div>

            {hasAllergens && (
              <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {ALL_ALLERGENS.map((item) => {
                    const active = allergens.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleAllergen(item)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        {active ? '✓ ' : ''}
                        {item}
                      </button>
                    );
                  })}
                  {allergens
                    .filter((a) => !ALL_ALLERGENS.includes(a as AllergenType))
                    .map((custom) => (
                      <button
                        key={custom}
                        type="button"
                        onClick={() => toggleAllergen(custom)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 cursor-pointer"
                      >
                        ✓ {custom}
                      </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add other allergen (e.g., Fenugreek, Garlic, Mushroom)..."
                    value={customAllergenInput}
                    onChange={(e) => setCustomAllergenInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomAllergen();
                      }
                    }}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomAllergen}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg cursor-pointer"
                  >
                    + Add Allergen
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Handling & Non-Certification Safety Guardrail */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={safetyChecklistConfirmed}
                onChange={(e) => setSafetyChecklistConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 accent-orange-600 rounded"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Food Handling &amp; Guardrail Declaration:</strong> I
                confirm this surplus food ({quantityValue} {quantityUnit},
                Prepared {preparedWhen}, State: {foodState}) is unserved,
                hygienically covered, and within its safe temperature window. I
                acknowledge that AnnaKshetra coordinates community pickup and{' '}
                <u>does not certify food safety</u> or provide tax/legal
                deduction certificates.
              </span>
            </label>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Generates 4-digit Pickup OTP &amp; Packaging QR immediately
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Flame className="w-4 h-4" />
                {submitting
                  ? 'Broadcasting Batch...'
                  : 'Publish & Generate Pickup OTP'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
