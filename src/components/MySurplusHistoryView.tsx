import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Download,
  History,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { FoodListing, UserProfile } from '../types';
import {
  formatListingQuantity,
  IMPACT_ASSUMPTIONS,
} from '../utils/matching';

interface MySurplusHistoryViewProps {
  listings: FoodListing[];
  currentUser: UserProfile;
  users: UserProfile[];
  onSelectBatch: (listing: FoodListing) => void;
  onOpenNewBatchModal: () => void;
}

interface ChartPoint {
  listing: FoodListing;
  batchLabel: string;
  dateLabel: string;
  weightKg: number;
  batchSavingsInr: number;
  cumulativeKg: number;
  cumulativeSavingsInr: number;
}

export const MySurplusHistoryView: React.FC<MySurplusHistoryViewProps> = ({
  listings,
  currentUser,
  users,
  onSelectBatch,
  onOpenNewBatchModal,
}) => {
  const donorUsers = useMemo(
    () => users.filter((u) => u.role === 'donor'),
    [users]
  );

  const defaultScope =
    currentUser.role === 'donor' ? currentUser.id : 'ALL_DONORS';
  const [selectedDonorScope, setSelectedDonorScope] =
    useState<string>(defaultScope);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Keep scope synced when switching between different donor profiles
  React.useEffect(() => {
    if (currentUser.role === 'donor') {
      setSelectedDonorScope(currentUser.id);
    }
  }, [currentUser.id, currentUser.role]);

  const scopedListings = useMemo(() => {
    const filtered =
      selectedDonorScope === 'ALL_DONORS'
        ? listings
        : listings.filter((l) => l.donorId === selectedDonorScope);

    // Sort chronologically (oldest to newest) for cumulative chart calculation
    return [...filtered].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [listings, selectedDonorScope]);

  const chartSeries: ChartPoint[] = useMemo(() => {
    let runningKg = 0;
    let runningInr = 0;

    return scopedListings.map((item) => {
      const batchSavings = Math.round(
        item.weightKg * IMPACT_ASSUMPTIONS.WET_WASTE_HAULING_SAVINGS_INR_PER_KG
      );
      runningKg = Number((runningKg + item.weightKg).toFixed(1));
      runningInr += batchSavings;

      const d = new Date(item.createdAt);
      const dateLabel = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      });

      return {
        listing: item,
        batchLabel: item.batchCode,
        dateLabel,
        weightKg: item.weightKg,
        batchSavingsInr: batchSavings,
        cumulativeKg: runningKg,
        cumulativeSavingsInr: runningInr,
      };
    });
  }, [scopedListings]);

  const totalBatches = chartSeries.length;
  const totalDivertedKg =
    chartSeries.length > 0
      ? chartSeries[chartSeries.length - 1].cumulativeKg
      : 0;
  const cumulativeSavingsInr =
    chartSeries.length > 0
      ? chartSeries[chartSeries.length - 1].cumulativeSavingsInr
      : 0;
  const totalMealsRescued = scopedListings.reduce(
    (sum, l) => sum + l.servings,
    0
  );
  const deliveredCount = scopedListings.filter(
    (l) => l.status === 'DELIVERED'
  ).length;
  const totalCo2eKg = Number(
    (totalDivertedKg * IMPACT_ASSUMPTIONS.CO2E_KG_PER_KG_FOOD_WASTE).toFixed(1)
  );

  const activePoint =
    hoveredIdx !== null && chartSeries[hoveredIdx]
      ? chartSeries[hoveredIdx]
      : chartSeries[chartSeries.length - 1] || null;

  const handleExportHistoryCsv = () => {
    const headers = [
      'Batch Code',
      'Date Posted',
      'City',
      'Neighborhood',
      'Food Name',
      'Entered Quantity',
      'Unit',
      'Normalized Weight (kg)',
      'Meals',
      'Food Type',
      'Contains Dairy',
      'Prepared When',
      'Food State',
      'Allergens',
      'Batch Hauling Savings (INR)',
      'Cumulative Savings (INR)',
      'Status',
      'Receiving Shelter',
    ];

    const rows = chartSeries.map((pt) => {
      const l = pt.listing;
      return [
        l.batchCode,
        new Date(l.createdAt).toISOString().slice(0, 10),
        l.city || 'Bengaluru',
        l.neighborhood,
        `"${l.title}"`,
        l.quantityValue ?? l.weightKg,
        l.quantityUnit ?? 'kg',
        l.weightKg,
        l.servings,
        l.dietaryType,
        l.containsDairy ? 'Yes' : 'No',
        l.preparedWhen || 'Just Now',
        l.foodState || 'Hot',
        `"${l.allergens.join('; ') || 'None'}"`,
        pt.batchSavingsInr,
        pt.cumulativeSavingsInr,
        l.status,
        `"${l.claimedByReceiverOrg || 'Pending Match'}"`,
      ];
    });

    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', 'annakshetra_my_surplus_history.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Geometry Constants
  const svgW = 860;
  const svgH = 290;
  const padL = 56;
  const padR = 68;
  const padT = 26;
  const padB = 46;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const maxBatchKg = Math.max(
    100,
    ...chartSeries.map((c) => c.weightKg)
  );
  const maxCumSavings = Math.max(
    2000,
    ...chartSeries.map((c) => c.cumulativeSavingsInr)
  );

  return (
    <div className="space-y-6">
      {/* Header & Donor Filter Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Donor Longitudinal Waste Audit · Multi-Unit Ledger (kg · grams ·
            litres · ml) · ₹18/kg BWG Savings
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            My Surplus History &amp; Cumulative Cost-Savings Analytics
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedDonorScope}
            onChange={(e) => setSelectedDonorScope(e.target.value)}
            className="px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
          >
            {donorUsers.map((d) => (
              <option key={d.id} value={d.id}>
                Donor: {d.organization} ({d.city || 'Bengaluru'})
              </option>
            ))}
            <option value="ALL_DONORS">
              All Corridor Donors Combined ({listings.length} Batches)
            </option>
          </select>

          <button
            type="button"
            onClick={handleExportHistoryCsv}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export History CSV
          </button>

          <button
            type="button"
            onClick={onOpenNewBatchModal}
            className="px-4 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Post New Batch
          </button>
        </div>
      </div>

      {/* 4-Column Donor History KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Surplus Batches Posted
          </div>
          <div className="text-3xl font-bold font-mono-tabular text-slate-900 dark:text-slate-100 mt-2">
            {totalBatches}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono-tabular">
            {deliveredCount} verified delivered ·{' '}
            {totalBatches - deliveredCount} active
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Kilograms Diverted
          </div>
          <div className="text-3xl font-bold font-mono-tabular text-emerald-600 dark:text-emerald-400 mt-2">
            {totalDivertedKg.toLocaleString()} kg
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono-tabular">
            Normalized across kg, grams, litres &amp; ml
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Cumulative Waste Fee Savings
          </div>
          <div className="text-3xl font-bold font-mono-tabular text-orange-600 dark:text-orange-400 mt-2">
            ₹{cumulativeSavingsInr.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Avoided commercial BWG hauling fees (@ ₹18/kg)
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Meals Rescued &amp; Carbon Offset
          </div>
          <div className="text-3xl font-bold font-mono-tabular text-slate-900 dark:text-slate-100 mt-2">
            {totalMealsRescued.toLocaleString()} meals
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-mono-tabular">
            {totalCo2eKg} kg CO₂e landfill methane prevented
          </div>
        </div>
      </div>

      {/* Combined Dual-Axis Summary Chart: Kilograms Diverted (Bars) + Cumulative Cost Savings ₹ (Trend Line) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <BarChart3 className="w-3.5 h-3.5 text-orange-600" />
              <span>
                Chronological Batch Progression (Bars: Batch Weight Diverted kg
                · Line: Cumulative Disposal Fee Savings ₹)
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              Diverted Food Volume vs. Cumulative Waste Hauling Cost Savings
            </h3>
          </div>

          {activePoint && (
            <div className="px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800 text-xs font-mono-tabular flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {activePoint.batchLabel} ({activePoint.dateLabel})
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                Batch: {formatListingQuantity(activePoint.listing)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-orange-600 dark:text-orange-400 font-semibold">
                Cumulative Saved: ₹
                {activePoint.cumulativeSavingsInr.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {chartSeries.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No surplus batches posted yet for this donor account. Click
            &ldquo;Post New Batch&rdquo; to log your first surplus donation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-72 block select-none"
              role="img"
              aria-label="Summary Chart of Batches Posted, Kilograms Diverted, and Cumulative Cost Savings"
            >
              {/* Horizontal Reference Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
                const y = padT + plotH * (1 - t);
                const leftAxisKg = Math.round(maxBatchKg * t);
                const rightAxisInr = Math.round(maxCumSavings * t);
                return (
                  <g key={i}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={svgW - padR}
                      y2={y}
                      stroke="rgba(148, 163, 184, 0.2)"
                      strokeDasharray={t === 0 ? undefined : '4 4'}
                    />
                    {/* Left Y-Axis: Batch Weight (kg) */}
                    <text
                      x={padL - 8}
                      y={y + 4}
                      textAnchor="end"
                      fill="#64748B"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {leftAxisKg}kg
                    </text>
                    {/* Right Y-Axis: Cumulative Savings (INR) */}
                    <text
                      x={svgW - padR + 8}
                      y={y + 4}
                      textAnchor="start"
                      fill="#EA580C"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      ₹{rightAxisInr.toLocaleString()}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Bars for Each Batch's Diverted Weight (kg) */}
              {chartSeries.map((pt, idx) => {
                const slotW = plotW / Math.max(1, chartSeries.length);
                const barW = Math.min(54, Math.max(20, slotW * 0.48));
                const centerX = padL + slotW * idx + slotW / 2;
                const barH = Math.max(
                  6,
                  (pt.weightKg / maxBatchKg) * plotH
                );
                const barY = padT + plotH - barH;
                const isHovered = hoveredIdx === idx;

                return (
                  <g
                    key={pt.listing.id}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onClick={() => onSelectBatch(pt.listing)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={centerX - barW / 2}
                      y={barY}
                      width={barW}
                      height={barH}
                      rx={4}
                      fill={isHovered ? '#059669' : '#10B981'}
                      fillOpacity={isHovered ? 0.95 : 0.78}
                    />
                    <text
                      x={centerX}
                      y={barY - 6}
                      textAnchor="middle"
                      fill="#10B981"
                      fontSize="10"
                      fontWeight="700"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {pt.weightKg}kg
                    </text>
                    <text
                      x={centerX}
                      y={padT + plotH + 16}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {pt.batchLabel}
                    </text>
                    <text
                      x={centerX}
                      y={padT + plotH + 30}
                      textAnchor="middle"
                      fill="#94A3B8"
                      fontSize="9.5"
                      fontFamily="DM Sans, sans-serif"
                    >
                      {pt.dateLabel}
                    </text>
                  </g>
                );
              })}

              {/* Rising Trend Line for Cumulative Cost Savings (INR) */}
              {chartSeries.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#EA580C"
                  strokeWidth="3"
                  points={chartSeries
                    .map((pt, idx) => {
                      const slotW = plotW / chartSeries.length;
                      const cx = padL + slotW * idx + slotW / 2;
                      const cy =
                        padT +
                        plotH -
                        (pt.cumulativeSavingsInr / maxCumSavings) * plotH;
                      return `${cx},${cy}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Cumulative Cost Savings Nodes */}
              {chartSeries.map((pt, idx) => {
                const slotW = plotW / chartSeries.length;
                const cx = padL + slotW * idx + slotW / 2;
                const cy =
                  padT +
                  plotH -
                  (pt.cumulativeSavingsInr / maxCumSavings) * plotH;

                return (
                  <g
                    key={`node-${pt.listing.id}`}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onClick={() => onSelectBatch(pt.listing)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={hoveredIdx === idx ? 6 : 4.5}
                      fill="#EA580C"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Detailed Historical Surplus Batches Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Complete Historical Batch Ledger &amp; Food Safety Telemetry
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any batch row to inspect its live map trajectory and custody
              timeline.
            </p>
          </div>
          <History className="w-5 h-5 text-slate-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                <th className="py-3 px-4 font-medium">Batch &amp; Date</th>
                <th className="py-3 px-4 font-medium">
                  Food Name &amp; Location
                </th>
                <th className="py-3 px-4 font-medium">
                  Quantity (kg/g/L/ml)
                </th>
                <th className="py-3 px-4 font-medium">
                  Type · Dairy · Allergens
                </th>
                <th className="py-3 px-4 font-medium">
                  Prepared &amp; Food State
                </th>
                <th className="py-3 px-4 font-medium text-right">
                  Hauling Saved
                </th>
                <th className="py-3 px-4 font-medium text-right">
                  Cumulative ₹
                </th>
                <th className="py-3 px-4 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {[...chartSeries].reverse().map((pt) => {
                const l = pt.listing;
                return (
                  <tr
                    key={l.id}
                    onClick={() => onSelectBatch(l)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono-tabular">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {l.batchCode}
                      </div>
                      <div className="text-slate-500">{pt.dateLabel}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {l.title}
                      </div>
                      <div className="text-slate-500">
                        {l.neighborhood}, {l.city || 'Bengaluru'} →{' '}
                        {l.claimedByReceiverOrg || 'Awaiting NGO Claim'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatListingQuantity(l)}
                      </div>
                      <div className="text-slate-500">{l.servings} meals</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {l.dietaryType} ·{' '}
                        {l.containsDairy ? 'Contains Dairy' : 'Dairy-Free'}
                      </div>
                      <div className="text-slate-500">
                        Allergens:{' '}
                        {l.allergens.length > 0
                          ? l.allergens.join(', ')
                          : 'None'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        State: {l.foodState || 'Hot'}
                      </div>
                      <div className="text-slate-500">
                        Prepared: {l.preparedWhen || 'Just Now'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular font-semibold text-emerald-600 dark:text-emerald-400">
                      +₹{pt.batchSavingsInr.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-orange-600 dark:text-orange-400">
                      ₹{pt.cumulativeSavingsInr.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular font-semibold">
                      {l.status === 'DELIVERED' ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          ✓ DELIVERED
                        </span>
                      ) : (
                        <span className="text-orange-600 dark:text-orange-400">
                          {l.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
