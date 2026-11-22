# AnnaKshetra — Real-Time Surplus Food Redistribution & Hunger Relief Platform

AnnaKshetra connects surplus food donors (wedding caterers and corporate IT canteens across the Bengaluru tech corridor) with nearby community kitchens, shelter NGOs, and delivery volunteers within critical spoilage windows. It coordinates end-to-end pickup verification via dual OTP handshakes, live GPS corridor tracking, rigorous food-safety guardrails, and an auditable CSR impact ledger.

### User Review & Critical Decisions

> [!IMPORTANT]
> The platform is engineered around the decisions confirmed during planning, alongside strict food-safety and data-privacy guardrails from the challenge brief.

- **Confirmed Decision 1 (Auth & Multi-Role Testing)**: Instant role switcher with pre-loaded accounts (Royal Lotus Wedding Caterers, TechPark North Canteen, Akshaya Community Shelter, QuickRescue Volunteer Rider, and Horizon CSR Foundation) alongside full custom account sign-in/sign-up modal support.
- **Confirmed Decision 2 (Regional Corridor & Donor Focus)**: Focused on the Bengaluru Tech Corridor (Whitefield, Bellandur, Koramangala, Indiranagar, Electronic City, HSR Layout) featuring Wedding Caterers and IT Canteens as primary surplus generators.
- **Confirmed Decision 3 (Geolocation & Live Tracking)**: Interactive Bengaluru corridor vector map with live server-synchronized GPS coordinates, dynamic route polylines, spoilage countdown timers, and step-by-step OTP state progression (`Posted` → `Claimed` → `Collected` → `Delivered`).
- **Confirmed Decision 4 (Impact & Business Case)**: Sponsor & CSR ROI Calculator paired with a transparent impact ledger detailing the exact scientific and economic formulas behind meals rescued, $\text{CO}_2\text{e}$ methane avoidance, and caterer waste-hauling cost savings.
- **Safety & Privacy Guardrails**: Every listing displays mandatory food handling guidance, storage temperature requirements, preparation-to-spoilage countdown windows, and explicit disclaimers stating that AnnaKshetra coordinates community logistics without certifying food safety or promising tax/legal deductions. All addresses and phone numbers use synthetic corridor coordinates.

---

### 1. Overview & Core Concept

- **What It Does**: Provides an operational command center and role-tailored dispatch workflow that lets busy caterers post surplus food in under 45 seconds, ranks nearby NGO receivers and volunteer couriers by a transparent smart-matching score (distance, quantity capacity, urgency, and dietary fit), tracks transit in real time over WebSockets, verifies custody transfers via Pickup and Drop-off OTPs, and quantifies financial and environmental ROI for sponsors.
- **Target Audience / Persona**:
  - **Food Donors**: Event & wedding caterers, corporate IT campus canteens looking to cut municipal wet-waste hauling fees and earn verifiable sustainability reports.
  - **Receivers (NGOs & Shelters)**: Community kitchens, night shelters, and orphanages requiring predictable, safe bulk meal arrivals before spoilage deadlines.
  - **Delivery Volunteers**: Local two-wheeler and van volunteers who bridge the last-mile gap between donor kitchens and shelter dining halls.
  - **CSR Sponsors & Municipal Partners**: Corporate sustainability officers funding cold-chain logistics in exchange for auditable meal-rescue metrics.
- **Key Value**: Eliminates the manual coordination bottleneck (phone trees and WhatsApp delays) that causes cooked event surplus to spoil before reaching hungry communities a few kilometers away.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Under-60-Second Rapid Donor Flow**:
     - Donor selects a 1-click preset template (*"Wedding Banquet Buffet Surplus"*, *"IT Campus Lunch Tray Batch"*, *"Bakery & Packaged Snacks"*) or enters custom details.
     - Sets quantity (servings & kg), dietary classification (Pure Veg, Non-Veg, Jain, Vegan), storage condition (Hot Insulated $>60^\circ\text{C}$, Chilled $<5^\circ\text{C}$, Ambient Sealed), allergen checkboxes (Dairy, Nuts, Gluten, Soy), and time cooked / pickup-by deadline.
     - Confirms the mandatory food hygiene checklist and publishes. The server immediately generates a 4-digit **Pickup OTP** and broadcasts the listing to matched NGOs and volunteers.
  2. **Smart Matching & Receiver/Volunteer Claim Flow**:
     - Receivers and Volunteers inspect available batches ranked by a multi-factor match score (`Distance km` · `Capacity Fit %` · `Urgency Spoilage Window` · `Dietary Match`).
     - When an NGO claims a listing and a Volunteer accepts dispatch, a 4-digit **Drop-off OTP** is issued to the receiving NGO, and real-time route tracking activates.
  3. **Live Geolocation & Dual-OTP Custody Chain**:
     - On the interactive Bengaluru corridor map, the volunteer vehicle moves along the route between the Donor hub and Receiver shelter.
     - At the donor kitchen, entering the **Pickup OTP** transitions status from `Claimed` to `Collected (In Transit)` and logs the pickup timestamp and temperature check.
     - At the shelter destination, entering the **Drop-off OTP** transitions status to `Delivered`, triggers instant multi-channel notifications, and credits the Impact Ledger.
  4. **Impact Ledger & CSR Business Case Simulator**:
     - Interactive sliders allow caterers and CSR sponsors to model weekly surplus volume or sponsorship budgets.
     - Displays real-time breakdown of meals rescued, kilograms diverted from landfills, $\text{CO}_2\text{e}$ emissions prevented, and net waste-disposal savings, complete with an expandable **"Methodology & Assumptions"** drawer.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-trust civic logistics & precision SaaS workspace—clean architectural geometry, high scannability under kitchen time pressure, and zero visual clutter.
  - *Color Palette & Mood*:
    - **60% Dominant Neutral Canvas**: Crisp warm alabaster (`#F8FAFC`) in light mode / deep slate (`#0F172A`) in dark mode.
    - **30% Structural Surfaces**: Pure white (`#FFFFFF`) / elevated slate (`#1E293B`) panels with `1px solid` hairline borders (`#E2E8F0` / `#334155`).
    - **10% High-Intent Accent & Semantic Status**: Terracotta Saffron (`#EA580C`) for primary dispatch actions; Emerald Green (`#16A34A`) for safe window & completed delivery; Amber (`#D97706`) for approaching spoilage threshold ($<90\text{ min}$); Crimson (`#DC2626`) for critical expiry alert ($<45\text{ min}$). Always paired with clear text labels and icons.
  - *Typography & Hierarchy*:
    - **Display & Navigation**: `Plus Jakarta Sans` (SemiBold/Bold, tight tracking, balanced headline wrapping).
    - **Body & Safety Guidance**: `DM Sans` (Regular/Medium, 15px body for effortless kitchen readability).
    - **Telemetry, Timers, OTPs & Metrics**: `JetBrains Mono` with `tabular-nums` for countdown clocks, OTP codes, distance readouts, and kilogram ledgers.
  - *Component Styling & Layout*:
    - Designed for a full 1440px desktop viewport with a Left Workspace Sidebar ($256\text{px}$), a strict 3-zone Top Header Bar (Brand Wordmark — Contextual Navigation Links — Primary Quick-Post Action), and a high-density main canvas.
    - Single-level card elevation with hairline dividers; metadata rendered as clean unboxed inline text separated by `·` bullets.
- **Interactive Feedback & Motion**:
  - Instant $\le 150\text{ms}$ button and filter transitions; live WebSocket notification drawer with unread counter and toast alerts on every status change (`Listing Posted`, `Batch Claimed`, `OTP Verified`, `Spoilage Warning`).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Authoritative Real-Time State via Express + WebSockets**
  - *Chosen Approach*: Full-stack Node/Express server running on port 3000 with an attached WebSocket server (`ws`) and REST API endpoints (`/api/*`).
  - *Why*: Ensures real-time notifications, live GPS telemetry ticks, and OTP status transitions synchronize across multiple browser tabs or role switches without client-only memory loss.
  - *Alternatives Considered*: Client-only `localStorage` was rejected because multi-user logistics and notification broadcasts require a shared authoritative state.
- **Decision 2: Dual-OTP Chain of Custody (`Pickup OTP` + `Drop-off OTP`)**
  - *Chosen Approach*: Separate 4-digit verification codes for Donor-to-Volunteer handover and Volunteer-to-NGO delivery.
  - *Why*: Prevents phantom claims and ensures accountability at both ends of the cold/hot transport window while recording custody timestamps.
- **Decision 3: Transparent Impact Math & Non-Certification Guardrails**
  - *Chosen Approach*: Embed explicit mathematical assumptions ($1\text{ meal} = 0.45\text{ kg}$ edible food; $1\text{ kg}$ food waste avoided $= 2.5\text{ kg CO}_2\text{e}$ landfill methane equivalent; municipal commercial wet-waste hauling savings $= ₹18/\text{kg}$) directly next to the KPI cards, alongside mandatory safety disclaimers.
  - *Why*: Directly satisfies the hackathon guardrails requiring transparent assumptions, zero tax/legal promises, and strict food-handling guidance.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT WORKSPACE (React 19)                         │
│                                                                            │
│  ┌──────────────────────┐   ┌───────────────────────────────────────────┐  │
│  │   Top Bar & Sidebar  │   │        Active Workspace Viewport          │  │
│  │ ──────────────────── │   │ ───────────────────────────────────────── │  │
│  │ • Brand Wordmark     │   │ 1. Live Corridor Dispatch & GPS Map       │  │
│  │ • View Navigation    │   │    • Interactive Bengaluru SVG/Canvas Map │  │
│  │ • Role Switcher &    │   │    • Smart Match Score Breakdown          │  │
│  │   Custom Auth Modal  │   │    • Dual-OTP Verification Console        │  │
│  │ • Notification Bell  │   │                                           │  │
│  │   & Live Feed Drawer │   │ 2. <60s Rapid Surplus Donor Flow          │  │
│  └──────────┬───────────┘   │    • 1-Click Caterer/Canteen Presets      │  │
│             │               │    • Quantity, Storage, Allergens & Timer │  │
│             │               │    • Mandatory Safety Guardrail Checklist │  │
│             │               │                                           │  │
│             │               │ 3. Impact Ledger & CSR Business Case      │  │
│             │               │    • Meals, Kg, CO2e & Formula Drawer     │  │
│             │               │    • Caterer Cost Savings & CSR Simulator │  │
│             │               └─────────────────────┬─────────────────────┘  │
└─────────────┼─────────────────────────────────────┼────────────────────────┘
              │ REST (/api/*) & WebSocket Events    │
              ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   EXPRESS + WEBSOCKET SERVER (Port 3000)                   │
│                                                                            │
│  ┌────────────────────────┐  ┌─────────────────────────┐  ┌─────────────┐  │
│  │ Authoritative Store    │  │ Smart Matching Engine   │  │ GPS & Spoil │  │
│  │ • Users & Profiles     │  │ • Haversine Distance    │  │ Telemetry   │  │
│  │ • Surplus Listings     │  │ • Urgency & Expiry Fit  │  │ • Route Step│  │
│  │ • OTP Custody Logs     │  │ • Capacity & Diet Score │  │   Broadcast │  │
│  │ • Notifications        │  └─────────────────────────┘  └─────────────┘  │
│  └────────────────────────┘                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **User Profile**: `id`, `name`, `role` (`donor` | `receiver` | `volunteer` | `sponsor`), `organization`, `neighborhood`, `coordinates` (`lat`, `lng`), `capacityKg`, `verifiedBadge`.
  - **Food Listing**: `id`, `donorId`, `donorName`, `donorType` (`Wedding Caterer` | `IT Canteen` | `Restaurant` | `Hostel Mess`), `title`, `category`, `servings`, `weightKg`, `dietaryType` (`Pure Veg` | `Non-Veg` | `Jain` | `Vegan`), `storageCondition` (`Hot Insulated >60°C` | `Chilled <5°C` | `Ambient Sealed`), `allergens` (array), `preparedAt`, `expiresAt`, `pickupWindowEnd`, `safetyChecklistConfirmed`, `status` (`POSTED` | `CLAIMED` | `COLLECTED` | `DELIVERED` | `EXPIRED`), `pickupOtp`, `dropoffOtp`, `claimedByReceiverId`, `assignedVolunteerId`, `currentLocation` (`lat`, `lng`, `progressPct`), `custodyTimeline` (timestamps for posted, claimed, collected, delivered).
  - **Notification Event**: `id`, `recipientRole`, `title`, `message`, `severity` (`info` | `success` | `warning` | `critical`), `listingId`, `createdAt`, `read`.

- **Interactive Component & State Mapping**:
  - **Role Switcher & Auth Handler**: Switching roles or logging in immediately updates the active user context, filters actionable buttons (e.g., Donors see *"Post Surplus Batch"* and *"Verify Pickup OTP"*; Receivers see *"Claim for Shelter"* and *"Verify Drop-off OTP"*; Volunteers see *"Accept Dispatch"* and *"Advance GPS Transit"*), and highlights role-specific notifications.
  - **Rapid Donor Form Handler**: Validates required safety fields, calculates spoilage urgency window, posts to `POST /api/listings`, resets form in $<150\text{ms}$, and broadcasts `listing:created` over WebSocket.
  - **Smart Matching & Filter Controls**: Client-side and server-assisted filtering by dietary type, distance radius ($<3\text{ km}$, $<5\text{ km}$, $<10\text{ km}$), urgency window, and status, dynamically recalculating match compatibility scores for each receiver shelter.
  - **OTP Verification & Live Transit Handler**: Submitting the 4-digit Pickup OTP or Drop-off OTP calls `POST /api/listings/:id/verify-otp`, validating the code server-side, advancing the delivery state, starting or completing the live GPS corridor movement, and emitting real-time notifications to all connected stakeholders.
