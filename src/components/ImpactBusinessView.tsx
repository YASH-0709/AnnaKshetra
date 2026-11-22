import React, { useState } from 'react';
import {
  Building2,
  Calculator,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
  Leaf,
  Scale,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { FoodListing } from '../types';
import { IMPACT_ASSUMPTIONS } from '../utils/matching';

interface ImpactBusinessViewProps {
  listings: FoodListing[];
}

export const ImpactBusinessView: React.FC<ImpactBusinessViewProps> = ({
  listings,
}) => {
  // Interactive CSR & Caterer Business Case Simulator state
  const [weeklyCatererEvents, setWeeklyCatererEvents] = useState<number>(6);
  const [avgSurplusKgPerEvent, setAvgSurplusKgPerEvent] = useState<number>(65);
  const [csrMonthlyGrantInr, setCsrMonthlyGrantInr] = useState<number>(150000);

  // Live Corridor Aggregate Metrics from actual listings
  const activeAndDelivered = listings.filter((l) => l.status !== 'EXPIRED');
  const totalWeightKg = Number(
    activeAndDelivered.reduce((acc, l) => acc + l.weightKg, 0).toFixed(1)
  );
  const totalMealsSaved = activeAndDelivered.reduce(
    (acc, l) => acc + l.servings,
    0
  );
  const deliveredListings = listings.filter((l) => l.status === 'DELIVERED');
  const deliveredMeals = deliveredListings.reduce(
    (acc, l) => acc + l.servings,
    0
  );
  const inProgressMeals = totalMealsSaved - deliveredMeals;

  const totalCo2eAvoidedKg = Number(
    (totalWeightKg * IMPACT_ASSUMPTIONS.CO2E_KG_PER_KG_FOOD_WASTE).toFixed(1)
  );
  const totalWaterSavedLiters = Math.round(
    totalWeightKg * IMPACT_ASSUMPTIONS.WATER_LITERS_PER_KG_FOOD
  );
  const totalHaulingSavingsInr = Math.round(
    totalWeightKg * IMPACT_ASSUMPTIONS.WET_WASTE_HAULING_SAVINGS_INR_PER_KG
  );

  // Caterer Weekly/Annual Business Case Projection
  const projectedWeeklyKg = weeklyCatererEvents * avgSurplusKgPerEvent;
  const projectedMonthlyKg = projectedWeeklyKg * 4.33;
  const projectedMonthlyMeals = Math.round(
    projectedMonthlyKg / IMPACT_ASSUMPTIONS.KG_PER_STANDARD_MEAL
  );
  const projectedMonthlyWasteHaulingSavingsInr = Math.round(
    projectedMonthlyKg * IMPACT_ASSUMPTIONS.WET_WASTE_HAULING_SAVINGS_INR_PER_KG
  );
  const projectedMonthlyCo2eKg = Math.round(
    projectedMonthlyKg * IMPACT_ASSUMPTIONS.CO2E_KG_PER_KG_FOOD_WASTE
  );

  // CSR Sponsor ROI Math
  const csrSponsoredMealsPerMonth = Math.round(
    csrMonthlyGrantInr / IMPACT_ASSUMPTIONS.CSR_SPONSOR_COST_PER_RESCUED_MEAL_INR
  );
  const csrNutritionalCommunityValueInr = Math.round(
    csrSponsoredMealsPerMonth *
      IMPACT_ASSUMPTIONS.RETAIL_MEAL_EQUIVALENT_VALUE_INR
  );
  const csrMultiplier = (
    csrNutritionalCommunityValueInr / Math.max(1, csrMonthlyGrantInr)
  ).toFixed(1);

  const handleDownloadCsv = () => {
    const headers = [
      'Batch Code',
      'Donor Organization',
      'Donor Type',
      'Neighborhood',
      'Title',
      'Servings (Meals)',
      'Weight (kg)',
      'CO2e Avoided (kg)',
      'Wet-Waste Hauling Saved (INR)',
      'Status',
      'Receiver NGO',
    ];
    const rows = listings.map((l) => [
      l.batchCode,
      `"${l.donorOrg}"`,
      l.donorType,
      l.neighborhood,
      `"${l.title}"`,
      l.servings,
      l.weightKg,
      (l.weightKg * IMPACT_ASSUMPTIONS.CO2E_KG_PER_KG_FOOD_WASTE).toFixed(1),
      Math.round(
        l.weightKg * IMPACT_ASSUMPTIONS.WET_WASTE_HAULING_SAVINGS_INR_PER_KG
      ),
      l.status,
      `"${l.claimedByReceiverOrg || 'Unclaimed'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'annakshetra_bengaluru_impact_ledger.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Auditable Sustainability Ledger · Transparent Assumptions · Zero
            Tax/Legal Promises
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            Corridor Impact Ledger &amp; Commercial Business Case
          </h2>
        </div>

        <button
          type="button"
          onClick={handleDownloadCsv}
          className="px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          Download Impact Audit CSV
        </button>
      </div>

      {/* 4-Column Live Corridor KPI Row with Immediate Formula Footnotes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Meals Rescued &amp; Active
          </div>
          <div className="text-3xl font-bold font-mono-tabular text-slate-900 dark:text-slate-100 mt-2">
            {totalMealsSaved.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono-tabular">
            {deliveredMeals} delivered · {inProgressMeals} in active dispatch
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            Assumption: <strong>1 meal = 0.45 kg</strong> cooked edible food
            (standard rice, dal &amp; accompaniment portion).
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Edible Food Waste Diverted
          </div>
          <div className="text-3xl font-bold font-mono-tabular text-emerald-600 dark:text-emerald-400 mt-2">
            {totalWeightKg} kg
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono-tabular">
            {totalWaterSavedLiters.toLocaleString()} L embedded water preserved
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            Assumption: Weighed or tray-calibrated unserved kitchen surplus
            diverted from municipal wet-waste dumping.
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Landfill Greenhouse Gas Avoided
          </div>
          <div className="text-3xl font-bold font-mono-tabular text-slate-900 dark:text-slate-100 mt-2">
            {totalCo2eAvoidedKg} kg CO₂e
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Methane decomposition prevented
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            Assumption: <strong>1 kg food waste = 2.5 kg CO₂e</strong> (FAO /
            WRAP lifecycle + anaerobic landfill methane factor).
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Direct Hauling Cost Saved
          </div>
          <div className="text-3xl font-bold font-mono-tabular text-orange-600 dark:text-orange-400 mt-2">
            ₹{totalHaulingSavingsInr.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Bulk Waste Generator (BWG) fees saved
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            Assumption: <strong>₹18 / kg</strong> commercial wet-waste private
            empaneled tipping &amp; composting fee in Bengaluru.
          </div>
        </div>
      </div>

      {/* Interactive Dual Simulator: Why Caterers Use It Weekly & Why CSR Sponsors Pay */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Busy Caterer & IT Canteen Weekly ROI Calculator */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                01. Donor Value Proposition (Wedding Caterers &amp; Canteens)
              </span>
              <Calculator className="w-4 h-4 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Why a Busy Caterer Uses AnnaKshetra Every Week
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Under Bengaluru municipal Bulk Waste Generator (BWG) rules,
              wedding halls and corporate canteens pay private haulers per
              kilogram of wet organic waste and need verifiable ESG kitchen
              waste-diversion logs for corporate procurement tenders.
            </p>

            {/* Interactive Sliders */}
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700 dark:text-slate-300">
                    Banquet / Canteen Surplus Events per Week
                  </span>
                  <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                    {weeklyCatererEvents} events / week
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={25}
                  value={weeklyCatererEvents}
                  onChange={(e) =>
                    setWeeklyCatererEvents(Number(e.target.value))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700 dark:text-slate-300">
                    Average Unserved Surplus per Event (kg)
                  </span>
                  <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                    {avgSurplusKgPerEvent} kg (~
                    {Math.round(avgSurplusKgPerEvent / 0.45)} meals)
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={250}
                  step={5}
                  value={avgSurplusKgPerEvent}
                  onChange={(e) =>
                    setAvgSurplusKgPerEvent(Number(e.target.value))
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Monthly Wet-Waste Savings
              </div>
              <div className="text-lg font-bold font-mono-tabular text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{projectedMonthlyWasteHaulingSavingsInr.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Monthly Meals Credited
              </div>
              <div className="text-lg font-bold font-mono-tabular text-slate-900 dark:text-slate-100 mt-0.5">
                {projectedMonthlyMeals.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Monthly Carbon Offset
              </div>
              <div className="text-lg font-bold font-mono-tabular text-slate-900 dark:text-slate-100 mt-0.5">
                {projectedMonthlyCo2eKg.toLocaleString()} kg
              </div>
            </div>
          </div>
        </div>

        {/* Right: Who Pays? CSR Sponsor & City Authority Business Model */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                02. Revenue &amp; Sponsorship Architecture (Who Pays?)
              </span>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              CSR Cold-Chain Logistics Grant &amp; SaaS Subscription
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Receiving shelters and NGOs never pay. The platform is funded by a
              dual model: <strong>(A)</strong> Corporate canteens &amp; wedding
              banquet chains pay ₹2,400/month for automated waste-audit
              dashboards, and <strong>(B)</strong> CSR foundations underwrite
              insulated E-Van dispatch at ₹11.50 per verified meal.
            </p>

            <div className="pt-2">
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700 dark:text-slate-300">
                  Monthly Corridor CSR Logistics Grant (INR)
                </span>
                <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                  ₹{csrMonthlyGrantInr.toLocaleString()} / month
                </span>
              </div>
              <input
                type="range"
                min={25000}
                max={500000}
                step={25000}
                value={csrMonthlyGrantInr}
                onChange={(e) => setCsrMonthlyGrantInr(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                How Every ₹11.50 Per Rescued Meal is Allocated:
              </div>
              <div>
                ₹6.80 Insulated E-Van Fuel &amp; Volunteer Micro-Stipend · ₹2.70
                Sanitized Thermal Box Turnaround · ₹2.00 Platform Geolocation,
                OTP &amp; Audit Ledger
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Verified Meals Funded
              </div>
              <div className="text-lg font-bold font-mono-tabular text-slate-900 dark:text-slate-100 mt-0.5">
                {csrSponsoredMealsPerMonth.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Nutritional Retail Value
              </div>
              <div className="text-lg font-bold font-mono-tabular text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{csrNutritionalCommunityValueInr.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Social Value Leverage
              </div>
              <div className="text-lg font-bold font-mono-tabular text-orange-600 dark:text-orange-400 mt-0.5">
                {csrMultiplier}x ROI
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transparent Methodology Table & Regulatory Guardrails */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Documented Assumptions &amp; Verification Methodology
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Every metric in AnnaKshetra is computed deterministically from
              dual-OTP verified batch weights.
            </p>
          </div>
          <FileSpreadsheet className="w-5 h-5 text-slate-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/40">
                <th className="py-3 px-6 font-medium">Impact Metric</th>
                <th className="py-3 px-6 font-medium">Conversion Factor</th>
                <th className="py-3 px-6 font-medium">
                  Scientific / Economic Basis
                </th>
                <th className="py-3 px-6 font-medium text-right">
                  Live Corridor Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">
                  Standard Meal Portion Equivalent
                </td>
                <td className="py-3.5 px-6 font-mono-tabular">
                  0.45 kg / meal
                </td>
                <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                  450 grams cooked weight (200g rice/roti + 150g dal/gravy +
                  100g vegetable accompaniment)
                </td>
                <td className="py-3.5 px-6 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                  {totalMealsSaved} meals
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">
                  Greenhouse Gas (CO₂e) Avoidance
                </td>
                <td className="py-3.5 px-6 font-mono-tabular">
                  2.50 kg CO₂e / kg food
                </td>
                <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                  FAO &amp; WRAP food waste lifecycle factor accounting for
                  avoided anaerobic landfill methane (CH₄)
                </td>
                <td className="py-3.5 px-6 text-right font-mono-tabular font-semibold text-emerald-600 dark:text-emerald-400">
                  {totalCo2eAvoidedKg} kg CO₂e
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">
                  Commercial Wet-Waste Hauling Savings
                </td>
                <td className="py-3.5 px-6 font-mono-tabular">
                  ₹18.00 / kg diverted
                </td>
                <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                  Average Bengaluru Bulk Waste Generator (BWG) private vendor
                  collection &amp; composting tariff
                </td>
                <td className="py-3.5 px-6 text-right font-mono-tabular font-semibold text-orange-600 dark:text-orange-400">
                  ₹{totalHaulingSavingsInr.toLocaleString()}
                </td>
              </tr>
              <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                <td className="py-3.5 px-6 font-semibold text-slate-900 dark:text-slate-100">
                  Cold-Chain Dispatch Unit Cost
                </td>
                <td className="py-3.5 px-6 font-mono-tabular">
                  ₹11.50 / rescued meal
                </td>
                <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                  Covers 6.5 km average Bengaluru corridor insulated E-Van hop,
                  dual-OTP audit &amp; container sanitization
                </td>
                <td className="py-3.5 px-6 text-right font-mono-tabular font-semibold text-slate-900 dark:text-slate-100">
                  5.7x community value
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Strict Guardrail Compliance Banner */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong>Platform Scope &amp; Guardrail Notice:</strong> AnnaKshetra
            is a coordination and logistics visibility platform. It{' '}
            <u>does not certify that food is safe</u>; donors and receiving
            shelters must follow the displayed temperature and time-window
            guidance at pickup and delivery. Operational waste-hauling savings
            shown above reflect estimated municipal disposal fee reductions and{' '}
            <u>do not constitute tax deductions or legal liability waivers</u>.
            All corridor coordinates and partner contacts use synthetic data to
            protect privacy.
          </div>
        </div>
      </div>
    </div>
  );
};
