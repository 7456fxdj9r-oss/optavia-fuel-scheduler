# HFH Optimal Fueling Scheduler — Technical Specification

**Version:** 1.0
**Date:** 2026-03-18
**Platform:** Web App (React + Supabase, extends existing HFH Coach Dashboard)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Constraints & Rules](#2-core-constraints--rules)
3. [Data Models](#3-data-models)
4. [Product Catalog](#4-product-catalog)
5. [Module 1: Profile & Plan Engine](#5-module-1-profile--plan-engine)
6. [Module 2: Scheduling Solver](#6-module-2-scheduling-solver)
7. [Module 3: State Visualizer (Traffic Light System)](#7-module-3-state-visualizer-traffic-light-system)
8. [Priority Toggle — Conflict Resolution](#8-priority-toggle--conflict-resolution)
9. [API Contracts & Interfaces](#9-api-contracts--interfaces)
10. [Supabase Schema](#10-supabase-schema)
11. [Open Discovery Questions & Recommendations](#11-open-discovery-questions--recommendations)

---

## 1. Overview

The Optimal Fueling Scheduler is a new module for the existing HFH Coach Dashboard web app. It helps Optavia clients optimize their daily meal timing by balancing two biological systems:

- **Muscle Protein Synthesis (MPS):** Requires a protein-rich fueling every **≥ 4 hours** to maximize anabolic response.
- **Blood Sugar Stability:** Requires fueling every **2–3 hours** to prevent glycemic dips.

Additionally, clients who work out need to account for the **30-minute Anabolic Window** post-workout. These three timing systems frequently conflict, and this module resolves those conflicts automatically.

---

## 2. Core Constraints & Rules

### 2.1 MPS Constraint

| Rule | Value |
|------|-------|
| Minimum gap between MPS-triggering fuelings | **4 hours** |
| Maximum MPS triggers per day | **3–4** (plan-dependent) |
| Only certain fueling types trigger MPS | See Product Catalog §4 |

### 2.2 Blood Sugar Constraint

| Rule | Value |
|------|-------|
| Ideal gap between any fueling | **2–3 hours** |
| Maximum allowed gap | **3.5 hours** (Yellow zone) |
| Critical gap (triggers Red) | **> 4 hours** with no fueling |

### 2.3 Anabolic Window Constraint

| Rule | Value |
|------|-------|
| Post-workout protein window | **≤ 30 minutes** after workout ends |
| Fueling type required | Must be MPS-triggering (Whey, L&G, or EAA-paired) |
| Conflict potential | May violate 4-hour MPS gap if last MPS was recent |

### 2.4 Sleep Buffer

| Rule | Value |
|------|-------|
| Last fueling before bed | **≥ 1 hour** before sleep |
| First fueling after wake | **≤ 30 minutes** after wake |

---

## 3. Data Models

### 3.1 UserProfile

```typescript
interface UserProfile {
  id: string;                    // Supabase auth user ID
  plan_type: "5&1" | "4&2" | "3&3";
  wake_time: string;             // HH:MM (24hr), e.g. "06:00"
  sleep_time: string;            // HH:MM (24hr), e.g. "22:00"
  priority_mode: "performance" | "metabolic";
  athlete_mode: boolean;         // Enables 4th MPS slot
  workout_default_duration: number; // minutes, default 60
  created_at: string;
  updated_at: string;
}
```

### 3.2 FuelingType

```typescript
interface FuelingType {
  id: string;
  name: string;
  category: "high_protein" | "eaa" | "standard" | "hybrid";
  triggers_mps: boolean;
  blood_sugar_impact: "high_stability" | "moderate" | "low";
  requires_pairing: boolean;     // true for EAA (needs fueling partner)
  pairing_target: string | null; // e.g. "standard" — what it pairs with
  is_lean_and_green: boolean;
  protein_grams: number | null;  // null if variable (L&G depends on recipe)
}
```

### 3.3 DailySchedule

```typescript
interface DailySchedule {
  id: string;
  user_id: string;
  date: string;                  // YYYY-MM-DD
  slots: ScheduleSlot[];
  workout: WorkoutBlock | null;
  solver_status: "valid" | "warning" | "invalid";
  created_at: string;
  updated_at: string;
}
```

### 3.4 ScheduleSlot

```typescript
interface ScheduleSlot {
  id: string;
  schedule_id: string;
  slot_index: number;            // 0-based order in the day
  time: string;                  // HH:MM
  fueling_type_id: string;
  is_mps_trigger: boolean;       // computed from fueling type
  status: "green" | "yellow" | "red";
  status_reasons: string[];      // e.g. ["mps_gap_too_short", "blood_sugar_ok"]
  is_locked: boolean;            // user pinned this slot
  is_post_workout: boolean;
}
```

### 3.5 WorkoutBlock

```typescript
interface WorkoutBlock {
  id: string;
  schedule_id: string;
  start_time: string;            // HH:MM
  duration_minutes: number;
  end_time: string;              // computed: start + duration
  anabolic_window_end: string;   // computed: end + 30 min
  post_workout_fueling_id: string | null;  // links to a ScheduleSlot
}
```

---

## 4. Product Catalog

### 4.1 Category Definitions

| Category | Key | MPS Trigger | Blood Sugar Impact | Examples |
|----------|-----|-------------|-------------------|----------|
| High Protein | `high_protein` | **Yes** | High Stability | Whey Protein Shake, Lean & Green Meal |
| Essential Amino Acids | `eaa` | **Yes** | Low (needs pairing) | Optavia EAA Supplement |
| Standard Fueling | `standard` | **No** | High Stability | Optavia Essential Fuelings (bars, shakes, soups, etc.) |
| Hybrid | `hybrid` | **Yes** | High Stability | Essential Fueling + EAA (combined) |

### 4.2 Seed Data

```json
[
  {
    "name": "Whey Protein Shake",
    "category": "high_protein",
    "triggers_mps": true,
    "blood_sugar_impact": "high_stability",
    "requires_pairing": false,
    "is_lean_and_green": false,
    "protein_grams": 25
  },
  {
    "name": "Lean & Green Meal",
    "category": "high_protein",
    "triggers_mps": true,
    "blood_sugar_impact": "high_stability",
    "requires_pairing": false,
    "is_lean_and_green": true,
    "protein_grams": null
  },
  {
    "name": "Essential Amino Acids (EAA)",
    "category": "eaa",
    "triggers_mps": true,
    "blood_sugar_impact": "low",
    "requires_pairing": true,
    "pairing_target": "standard",
    "is_lean_and_green": false,
    "protein_grams": 3
  },
  {
    "name": "Essential Fueling (Bar)",
    "category": "standard",
    "triggers_mps": false,
    "blood_sugar_impact": "high_stability",
    "requires_pairing": false,
    "is_lean_and_green": false,
    "protein_grams": 11
  },
  {
    "name": "Essential Fueling (Shake)",
    "category": "standard",
    "triggers_mps": false,
    "blood_sugar_impact": "high_stability",
    "requires_pairing": false,
    "is_lean_and_green": false,
    "protein_grams": 11
  },
  {
    "name": "Essential Fueling (Soup/Hearty)",
    "category": "standard",
    "triggers_mps": false,
    "blood_sugar_impact": "high_stability",
    "requires_pairing": false,
    "is_lean_and_green": false,
    "protein_grams": 11
  },
  {
    "name": "Essential Fueling + EAA Combo",
    "category": "hybrid",
    "triggers_mps": true,
    "blood_sugar_impact": "high_stability",
    "requires_pairing": false,
    "is_lean_and_green": false,
    "protein_grams": 14
  }
]
```

---

## 5. Module 1: Profile & Plan Engine

### 5.1 Responsibility

Manages user configuration (the "static constraints") and determines how many fueling slots exist per day.

### 5.2 Plan Slot Counts

| Plan | Essential Fuelings | Lean & Green | Total Slots | MPS Slots Target |
|------|--------------------|-------------|-------------|-----------------|
| 5&1  | 5                  | 1           | 6           | 3 (4 w/ athlete) |
| 4&2  | 4                  | 2           | 6           | 3–4             |
| 3&3  | 3                  | 3           | 6           | 3–4             |

### 5.3 Interface

```typescript
interface ProfileEngine {
  /** Returns total available waking minutes */
  getWakingWindow(profile: UserProfile): number;

  /** Returns the slot template for a given plan */
  getPlanTemplate(plan_type: string): {
    essential_count: number;
    lean_green_count: number;
    total_slots: number;
    mps_target: number;
  };

  /** Returns which fueling types can trigger MPS */
  getMPSCapableTypes(): FuelingType[];

  /** Validates that a profile has sufficient waking hours for the plan */
  validateProfile(profile: UserProfile): {
    valid: boolean;
    errors: string[];
  };
}
```

### 5.4 Validation Rules

- Waking window must be ≥ 10 hours (to fit 6 slots at 2-hour intervals)
- Wake time must be before sleep time (no overnight shifts in v1)
- Plan type must match exactly one of the three options

---

## 6. Module 2: Scheduling Solver

### 6.1 Responsibility

The "brain" of the system. Given a UserProfile, a plan template, and optionally a WorkoutBlock, it generates a DailySchedule with all ScheduleSlots optimally placed.

### 6.2 Algorithm: Recursive Look-ahead Constraint Solver

```
FUNCTION generateSchedule(profile, workout, lockedSlots):

  1. CALCULATE waking window:
     T_start = profile.wake_time + 30min
     T_end   = profile.sleep_time - 60min

  2. PLACE locked slots (user-pinned times)

  3. IF workout exists:
     a. PLACE post-workout MPS slot at workout.end_time + 0–30min
     b. MARK this slot as is_post_workout = true
     c. CHECK backward: find previous MPS slot
        - IF gap < 4 hours → CONFLICT DETECTED → invoke Priority Toggle (§8)

  4. DISTRIBUTE remaining MPS slots:
     a. Target: profile.mps_target MPS triggers evenly across waking window
     b. Constraint: each MPS pair must be ≥ 4 hours apart
     c. Prefer first MPS within 30 min of waking (breakfast position)

  5. FILL blood sugar slots between MPS slots:
     a. For each gap between adjacent fuelings:
        - IF gap > 3 hours → INSERT a standard fueling at midpoint
        - IF gap > 5 hours → INSERT two standard fuelings at ⅓ and ⅔ points
     b. Ensure total slots = plan template total

  6. VALIDATE all constraints:
     FOR each adjacent pair (slot[i], slot[i+1]):
       - blood_sugar_gap = slot[i+1].time - slot[i].time
       - IF both are MPS triggers:
           mps_gap = slot[i+1].time - slot[i].time
           CHECK mps_gap ≥ 4 hours

  7. ASSIGN status to each slot (see §7)

  8. RETURN DailySchedule
```

### 6.3 Conflict Detection

The solver performs a **look-ahead scan** whenever a slot is placed or moved:

```
FUNCTION detectConflicts(slots, newSlot):
  conflicts = []

  FOR each existing slot:
    IF both slot AND newSlot trigger MPS:
      gap = |slot.time - newSlot.time|
      IF gap < 4 hours:
        conflicts.push({
          type: "mps_too_close",
          slot_a: slot,
          slot_b: newSlot,
          gap_minutes: gap
        })

    blood_gap = |slot.time - newSlot.time|
    IF blood_gap > 3.5 hours AND no slot exists between them:
      conflicts.push({
        type: "blood_sugar_gap",
        gap_minutes: blood_gap
      })

  RETURN conflicts
```

### 6.4 Rescheduling on Move

When the user drags a slot to a new time or changes the workout time:

1. Re-anchor the moved/workout slot
2. Re-run the solver on all **unlocked** slots
3. Preserve locked slots
4. Re-validate and re-color all slots

---

## 7. Module 3: State Visualizer (Traffic Light System)

### 7.1 Status Definitions

| Status | Color | Meaning | Conditions |
|--------|-------|---------|-----------|
| `green` | Green | All constraints met | MPS gap ≥ 4h AND blood sugar gap 2–3h |
| `yellow` | Yellow | Minor deviation, still acceptable | Blood sugar gap 3–3.5h OR MPS gap 3.5–4h |
| `red` | Red | Invalid protocol — needs attention | MPS gap < 3.5h OR blood sugar gap > 4h OR missed anabolic window |

### 7.2 Per-Slot Evaluation Function

```typescript
interface SlotEvaluation {
  status: "green" | "yellow" | "red";
  reasons: StatusReason[];
}

type StatusReason =
  | { rule: "mps_gap"; gap_minutes: number; target: 240; status: "ok" | "warn" | "fail" }
  | { rule: "blood_sugar_gap"; gap_minutes: number; target_range: [120, 180]; status: "ok" | "warn" | "fail" }
  | { rule: "anabolic_window"; minutes_post_workout: number; target: 30; status: "ok" | "fail" }
  | { rule: "sleep_buffer"; minutes_before_sleep: number; target: 60; status: "ok" | "warn" }
  | { rule: "wake_buffer"; minutes_after_wake: number; target: 30; status: "ok" | "warn" };
```

```
FUNCTION evaluateSlot(slot, prevSlot, nextSlot, workout, profile):
  reasons = []
  worstStatus = "green"

  // MPS gap check (backward)
  IF slot.is_mps_trigger AND prevSlot?.is_mps_trigger:
    gap = slot.time - prevSlot.time
    IF gap < 210 min:  worstStatus = "red",   reasons.push(mps_gap FAIL)
    ELIF gap < 240 min: worstStatus = max(worstStatus, "yellow"), reasons.push(mps_gap WARN)
    ELSE: reasons.push(mps_gap OK)

  // Blood sugar gap check (backward)
  IF prevSlot:
    gap = slot.time - prevSlot.time
    IF gap > 240 min:  worstStatus = "red",   reasons.push(blood_sugar_gap FAIL)
    ELIF gap > 210 min: worstStatus = max(worstStatus, "yellow"), reasons.push(blood_sugar_gap WARN)
    ELIF gap >= 120 min: reasons.push(blood_sugar_gap OK)
    ELSE: reasons.push(blood_sugar_gap WARN — too close, may cause insulin spike)

  // Anabolic window check
  IF slot.is_post_workout AND workout:
    minutes_after = slot.time - workout.end_time
    IF minutes_after > 30: worstStatus = "red", reasons.push(anabolic_window FAIL)
    ELSE: reasons.push(anabolic_window OK)

  // Sleep buffer
  IF nextSlot IS NULL:  // last slot of day
    buffer = profile.sleep_time - slot.time
    IF buffer < 60 min: worstStatus = max(worstStatus, "yellow"), reasons.push(sleep_buffer WARN)

  RETURN { status: worstStatus, reasons }
```

### 7.3 Schedule-Level Summary

```typescript
interface ScheduleSummary {
  overall_status: "green" | "yellow" | "red";  // worst of all slots
  mps_count: number;
  total_fuelings: number;
  longest_blood_sugar_gap: number;  // minutes
  shortest_mps_gap: number | null;  // minutes, null if <2 MPS triggers
  anabolic_window_hit: boolean | null;  // null if no workout
  conflicts: ConflictDetail[];
}
```

---

## 8. Priority Toggle — Conflict Resolution

### 8.1 When Conflicts Arise

A conflict occurs when the **post-workout MPS fueling** would violate the **4-hour MPS cool-off** from the previous MPS fueling.

**Example:** Last MPS at 1:00 PM. Workout ends at 3:30 PM. Anabolic window demands MPS by 4:00 PM. But 1:00 PM → 4:00 PM = only 3 hours (violates 4-hour rule).

### 8.2 Priority Modes

#### Priority A: Performance (Anabolic Window Wins)

```
IF conflict detected:
  1. PLACE MPS fueling within 30 min of workout end (non-negotiable)
  2. MARK the previous MPS fueling as "overridden" (Red status)
  3. SHOW warning: "MPS gap reduced to {X}h to prioritize post-workout recovery"
  4. NOTE: The overridden earlier MPS still counts for blood sugar
```

#### Priority B: Metabolic (4-Hour MPS Gap Wins)

```
IF conflict detected:
  1. KEEP the 4-hour MPS gap intact
  2. PUSH the post-workout fueling to earliest valid time (prev MPS + 4h)
  3. IF pushed time > 30 min post-workout:
     MARK anabolic window as "missed" (Yellow status)
     SHOW warning: "Post-workout fueling delayed to {time} to protect MPS spacing"
  4. SUGGEST a non-MPS blood sugar fueling (standard fueling) at the 30-min mark
     to at least maintain blood sugar stability
```

#### Pre-Load Strategy (Automatic Suggestion)

When the solver detects an **upcoming conflict** (e.g., workout is scheduled and look-ahead shows MPS gap violation):

```
IF conflict detected BEFORE workout happens:
  SUGGEST the "Thread the Needle" combo:
    1. PRE-WORKOUT: Move last Essential Fueling to 30 min before workout
    2. POST-WORKOUT: Use EAA supplement within 30 min of workout end
    3. This creates a Hybrid MPS trigger (Fueling + EAA = MPS)
       without needing a full protein meal, buying more gap time
```

### 8.3 User Flow for Priority Selection

```
1. User sets up profile → solver runs initial schedule
2. User adds workout time
3. Solver detects conflict
4. App presents modal:
   ┌─────────────────────────────────────────────────┐
   │  ⚡ Timing Conflict Detected                     │
   │                                                   │
   │  Your workout at 3:30 PM creates a conflict       │
   │  between your anabolic window and MPS spacing.    │
   │                                                   │
   │  What's your priority today?                      │
   │                                                   │
   │  [🏋️ Performance]    [⚖️ Metabolic]    [🧠 Smart] │
   │   Hit the 30-min      Keep 4-hour       Pre-Load  │
   │   window. MPS gap     MPS spacing.      strategy   │
   │   will be shorter.    Window may         (EAA +    │
   │                       be missed.         Fueling)  │
   └─────────────────────────────────────────────────┘
5. User selects → solver re-runs with selected priority
6. Schedule updates with new colors/statuses
```

---

## 9. API Contracts & Interfaces

### 9.1 Solver API (Client-Side Functions)

The solver runs client-side (no server round-trip needed for schedule generation).

```typescript
// === MAIN SOLVER ===

interface SolverInput {
  profile: UserProfile;
  workout: WorkoutBlock | null;
  locked_slots: ScheduleSlot[];    // user-pinned slots
  priority: "performance" | "metabolic" | "preload";
}

interface SolverOutput {
  schedule: DailySchedule;
  summary: ScheduleSummary;
  conflicts: ConflictDetail[];
  suggestions: Suggestion[];
}

function solve(input: SolverInput): SolverOutput;

// === CONFLICT DETAIL ===

interface ConflictDetail {
  type: "mps_too_close" | "blood_sugar_gap" | "missed_anabolic" | "sleep_buffer";
  slot_a_index: number;
  slot_b_index: number | null;
  gap_minutes: number;
  severity: "yellow" | "red";
  resolution: string;              // human-readable explanation
}

// === SUGGESTION ===

interface Suggestion {
  type: "preload" | "swap_fueling" | "add_eaa" | "shift_slot";
  description: string;
  affected_slots: number[];
  auto_applicable: boolean;        // can be applied without user input
}
```

### 9.2 Supabase CRUD (extends existing sb helper)

```typescript
// Save a schedule
async function saveSchedule(schedule: DailySchedule): Promise<void>;

// Load schedule for a date
async function loadSchedule(user_id: string, date: string): Promise<DailySchedule | null>;

// Update user profile
async function updateProfile(profile: Partial<UserProfile>): Promise<UserProfile>;

// Load profile
async function loadProfile(user_id: string): Promise<UserProfile>;
```

---

## 10. Supabase Schema

### 10.1 New Tables

```sql
-- User profile for the scheduler module
CREATE TABLE scheduler_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('5&1', '4&2', '3&3')),
  wake_time TIME NOT NULL DEFAULT '06:00',
  sleep_time TIME NOT NULL DEFAULT '22:00',
  priority_mode TEXT NOT NULL DEFAULT 'performance'
    CHECK (priority_mode IN ('performance', 'metabolic')),
  athlete_mode BOOLEAN NOT NULL DEFAULT false,
  workout_default_duration INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Fueling type catalog (seeded, rarely changes)
CREATE TABLE fueling_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (category IN ('high_protein', 'eaa', 'standard', 'hybrid')),
  triggers_mps BOOLEAN NOT NULL DEFAULT false,
  blood_sugar_impact TEXT NOT NULL DEFAULT 'high_stability'
    CHECK (blood_sugar_impact IN ('high_stability', 'moderate', 'low')),
  requires_pairing BOOLEAN NOT NULL DEFAULT false,
  pairing_target TEXT,
  is_lean_and_green BOOLEAN NOT NULL DEFAULT false,
  protein_grams INTEGER
);

-- Daily schedules
CREATE TABLE daily_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  solver_status TEXT NOT NULL DEFAULT 'valid'
    CHECK (solver_status IN ('valid', 'warning', 'invalid')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Individual fueling slots within a schedule
CREATE TABLE schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES daily_schedules(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL,
  time TIME NOT NULL,
  fueling_type_id UUID REFERENCES fueling_types(id),
  is_mps_trigger BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'green'
    CHECK (status IN ('green', 'yellow', 'red')),
  status_reasons JSONB DEFAULT '[]',
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_post_workout BOOLEAN NOT NULL DEFAULT false
);

-- Workout blocks
CREATE TABLE workout_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES daily_schedules(id) ON DELETE CASCADE,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  end_time TIME GENERATED ALWAYS AS (start_time + (duration_minutes || ' minutes')::INTERVAL) STORED,
  post_workout_slot_id UUID REFERENCES schedule_slots(id)
);

-- RLS policies (extend existing pattern)
ALTER TABLE scheduler_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile"
  ON scheduler_profiles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own schedules"
  ON daily_schedules FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see own slots"
  ON schedule_slots FOR ALL
  USING (schedule_id IN (SELECT id FROM daily_schedules WHERE user_id = auth.uid()));

CREATE POLICY "Users see own workouts"
  ON workout_blocks FOR ALL
  USING (schedule_id IN (SELECT id FROM daily_schedules WHERE user_id = auth.uid()));

-- Fueling types are public read
CREATE POLICY "Anyone can read fueling types"
  ON fueling_types FOR SELECT USING (true);
```

### 10.2 Indexes

```sql
CREATE INDEX idx_schedules_user_date ON daily_schedules(user_id, date);
CREATE INDEX idx_slots_schedule ON schedule_slots(schedule_id, slot_index);
CREATE INDEX idx_workout_schedule ON workout_blocks(schedule_id);
```

---

## 11. Open Discovery Questions & Recommendations

### Q1: The "Gap" Logic

> If someone has a 5-hour gap between meals (missed their 3-hour window), should the app automatically "shrink" the next two intervals to catch them up, or just stay on the new offset?

**Recommendation: Stay on new offset, but with a suggestion.**

- Shrinking intervals is dangerous — it can cascade MPS violations downstream.
- Instead: the solver should re-anchor from the current time and re-distribute remaining slots evenly across the remaining waking hours.
- Show a Yellow notification: "You're running behind. Here's your adjusted schedule for the rest of the day."
- This is effectively a **mid-day re-solve** triggered when actual intake deviates from plan.

### Q2: L&G Complexity

> Does the Lean & Green always count as a "Big" MPS trigger, or should the user be able to specify if it's a "Lower Protein" version?

**Recommendation: Default to MPS trigger with an override toggle.**

- Most L&G meals hit the ~25g protein threshold for MPS.
- Add a per-slot toggle: "Is this a lower-protein L&G?" — if yes, `triggers_mps = false` for that slot.
- Keeps the default simple while supporting edge cases.
- The `protein_grams: null` field on the L&G FuelingType supports this — the solver checks the slot-level override, not just the catalog default.

### Q3: The "4th MPS"

> You mentioned a 4th MPS before bed. Should the app suggest this if the timeline allows for another 4-hour gap, or only show it if the user toggles "Athlete Mode"?

**Recommendation: Gate behind Athlete Mode toggle.**

- Adding a 4th MPS changes the entire schedule balance and isn't standard protocol.
- When `athlete_mode = true`: the solver increases `mps_target` from 3 to 4 and looks for a valid 4th slot (typically evening, ≥ 4h after 3rd MPS, ≥ 1h before sleep).
- When `athlete_mode = false`: solver caps at 3 MPS triggers and does not suggest a 4th.
- The toggle lives in the UserProfile and can be flipped per-day or as a persistent default.

### Q4: Workout Duration

> Does the app need to account for the length of the workout (e.g., a 2-hour workout vs. 30 mins) when calculating the start of the 30-minute anabolic window?

**Recommendation: Yes — the anabolic window starts at workout END, not start.**

- The `WorkoutBlock` model includes `start_time` and `duration_minutes`, and computes `end_time`.
- The anabolic window is always: `end_time` to `end_time + 30 min`.
- A 2-hour workout starting at 2:00 PM means the window is 4:00–4:30 PM, not 2:00–2:30 PM.
- Default duration is 60 min (configurable per-session and as a profile default).
- This is already built into the data model (§3.5).

---

## Appendix: Example Scenario

**Setup:** 5&1 plan, wake 6:00 AM, sleep 10:00 PM, workout at 3:00 PM (60 min), Performance priority.

| Slot | Time | Type | MPS? | Status | Notes |
|------|------|------|------|--------|-------|
| 1 | 6:30 AM | Whey Protein | Yes | Green | First MPS, 30 min after wake |
| 2 | 9:00 AM | Essential Fueling | No | Green | Blood sugar maintenance |
| 3 | 11:30 AM | Lean & Green | Yes | Green | 2nd MPS, 5h after first |
| 4 | 2:30 PM | Essential Fueling (Pre-Workout) | No | Green | 30 min before workout |
| 5 | 4:00 PM | Whey Protein (Post-Workout) | Yes | Yellow | 3rd MPS, 4.5h after 2nd — OK. 30 min post-workout — OK |
| 6 | 6:30 PM | Essential Fueling | No | Green | Blood sugar maintenance |
| 7* | 8:30 PM | Essential Fueling + EAA | Yes | Green | 4th MPS (Athlete Mode only), 4.5h after 3rd |

*Slot 7 only appears if Athlete Mode is enabled. Otherwise, slot 6 is the last fueling.

---

*End of Technical Specification*
