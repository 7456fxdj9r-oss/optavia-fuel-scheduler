// ============================================================
// MPS OPTIMAL FUELING SCHEDULER — CONSTRAINT SOLVER v2
// ============================================================

// ---- CONSTANTS ----
const MAX_BLOOD_SUGAR_GAP = 180; // 3 hours max between blood-sugar-stabilizing fuelings
const WARN_BLOOD_SUGAR_GAP = 170; // warn at 2h50m
const MIN_BLOOD_SUGAR_GAP = 90;  // too close if < 1.5h
const MIN_MPS_GAP = 240;         // 4 hours between MPS triggers
const WARN_MPS_GAP = 210;        // warn at 3.5h

/** Convert "HH:MM" to minutes since midnight */
export function timeToMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Convert minutes since midnight to "HH:MM" */
export function minToTime(m) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Round minutes to the nearest 15-minute mark (quarter hour) */
function roundToQuarter(m) {
  return Math.round(m / 15) * 15;
}

/** Format minutes to 12-hour display */
export function minToDisplay(m) {
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

// ---- PRODUCT CATALOG ----
// Key: stabilizes_blood_sugar tracks whether a fueling controls blood sugar
// EAA alone does NOT stabilize blood sugar — only triggers MPS
// Whey, L&G, Essential Fuelings, ASCEND, and Hybrid all DO stabilize blood sugar

export const FUELING_TYPES = [
  { id: "whey", name: "Whey Protein Shake", category: "high_protein", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 25, emoji: "\uD83E\uDD64" },
  { id: "lg", name: "Lean & Green Meal", category: "high_protein", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: true, protein_grams: null, emoji: "\uD83E\uDD57" },
  { id: "lg_plus", name: "Lean & Green+ Meal", category: "high_protein", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: true, protein_grams: null, emoji: "\uD83E\uDD57" },
  { id: "eaa", name: "Essential Amino Acids", category: "eaa", triggers_mps: true, stabilizes_blood_sugar: false, is_lean_and_green: false, protein_grams: 3, emoji: "\uD83D\uDCAA" },
  { id: "ef", name: "Essential Fueling", category: "standard", triggers_mps: false, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 11, emoji: "\uD83C\uDF7D\uFE0F" },
  { id: "hybrid", name: "Essential Fueling + EAA", category: "hybrid", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 14, emoji: "\u26A1" },
  { id: "ascend", name: "ASCEND Mini Meal", category: "ascend", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 20, emoji: "\uD83D\uDE80" },
  { id: "yogurt", name: "Greek Yogurt (Healthy Exchange)", category: "exchange", triggers_mps: false, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 12, emoji: "\uD83E\uDD5B" },
  { id: "snack", name: "Healthy Snack", category: "exchange", triggers_mps: false, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 5, emoji: "\uD83C\uDF4E" },
];

export function getFuelingById(id) {
  return FUELING_TYPES.find((f) => f.id === id);
}

// ---- PLAN TEMPLATES ----
// All official Optavia plans

export const PLAN_TEMPLATES = {
  "5&1": {
    label: "Optimal Weight 5 & 1",
    essential_count: 5,
    lean_green_count: 1,
    lean_green_type: "lg",
    total_slots: 6,
    mps_target: 3,
    description: "5 Essential Fuelings + 1 Lean & Green",
    category: "weight_loss",
    has_eaa: false,
    has_snack: false,
  },
  "5&1A": {
    label: "Optimal Weight 5 & 1 ACTIVE",
    essential_count: 5,
    lean_green_count: 1,
    lean_green_type: "lg",
    total_slots: 6,
    mps_target: 3,
    description: "5 Essential Fuelings + 1 Lean & Green + up to 2 EAA servings",
    category: "weight_loss",
    has_eaa: true,
    eaa_count: 2,
    has_snack: false,
  },
  "4&2&1": {
    label: "Optimal Weight 4 & 2 & 1",
    essential_count: 4,
    lean_green_count: 2,
    lean_green_type: "lg",
    total_slots: 7,
    mps_target: 3,
    description: "4 Essential Fuelings + 2 Lean & Green + 1 Healthy Snack",
    category: "weight_loss",
    has_eaa: false,
    has_snack: true,
  },
  "4&2A": {
    label: "Optimal Weight 4 & 2 ACTIVE",
    essential_count: 4,
    lean_green_count: 2,
    lean_green_type: "lg",
    total_slots: 6,
    mps_target: 3,
    description: "4 Essential Fuelings + 2 Lean & Green + 2 EAA servings",
    category: "weight_loss",
    has_eaa: true,
    eaa_count: 2,
    has_snack: false,
  },
  "3&3": {
    label: "Optimal Health 3 & 3",
    essential_count: 3,
    lean_green_count: 3,
    lean_green_type: "lg",
    total_slots: 6,
    mps_target: 3,
    description: "3 Essential Fuelings + 3 Lean & Green (Maintenance)",
    category: "maintenance",
    has_eaa: false,
    has_snack: false,
  },
  "3&3A": {
    label: "Optimal Health 3 & 3 ACTIVE",
    essential_count: 3,
    lean_green_count: 3,
    lean_green_type: "lg",
    total_slots: 6,
    mps_target: 3,
    description: "3 Essential Fuelings + 3 Lean & Green + EAA & Whey",
    category: "maintenance",
    has_eaa: true,
    eaa_count: 1,
    has_snack: false,
  },
  "GLP1": {
    label: "ASCEND (GLP-1 Support)",
    essential_count: 3,
    lean_green_count: 1,
    lean_green_type: "lg_plus",
    total_slots: 4,
    mps_target: 3,
    description: "3 ASCEND Mini Meals + 1 Lean & Green+ + Daily Nutrients Pack",
    category: "glp1",
    has_eaa: false,
    has_snack: false,
  },
  "OPT": {
    label: "Optimization Plan",
    essential_count: 2,
    lean_green_count: 2,
    lean_green_type: "lg_plus",
    total_slots: 7,
    mps_target: 3,
    description: "2 ASCEND Mini Meals + 2 Lean & Green+ + 2 EAA + Yogurt",
    category: "optimization",
    has_eaa: true,
    eaa_count: 2,
    has_snack: false,
    has_yogurt: true,
  },
};

// ---- GOAL MODES ----
// Maps user-friendly goal to solver behavior
export const GOAL_MODES = {
  fat_loss: {
    label: "Lose Fat",
    emoji: "\uD83D\uDD25",
    description: "Even meal spacing for steady blood sugar. Strict 4-hour protein spacing to maximize fat burning.",
    priority_mode: "metabolic",
    implies_workout: false,
  },
  muscle: {
    label: "Build Muscle",
    emoji: "\uD83C\uDFCB\uFE0F",
    description: "Hit the 30-min post-workout protein window to maximize muscle growth. Protein spacing may tighten.",
    priority_mode: "performance",
    implies_workout: true,
  },
  maintain: {
    label: "Maintain",
    emoji: "\u2696\uFE0F",
    description: "Balanced spacing to maintain your weight. No workout pressure, just stay consistent with your plan.",
    priority_mode: "metabolic",
    implies_workout: false,
  },
};

// ---- TOOLTIPS (Light Science) ----
export const TOOLTIPS = {
  mps: "MPS (Muscle Protein Synthesis) is when your body builds or repairs muscle from protein. It works best when you space protein-rich meals at least 4 hours apart — this gives your body time to fully use each dose.",
  anabolic: "After your workout, your body absorbs protein more efficiently for about 30 minutes. This is called the \"anabolic window.\" We'll schedule a protein fueling right after your workout to take advantage of it.",
  blood_sugar: "Eating every 2-3 hours keeps your blood sugar steady, which prevents energy crashes, cravings, and mood swings. Going longer than 3 hours without eating can cause dips.",
  eaa: "Essential Amino Acids (EAAs) trigger muscle protein synthesis but don't stabilize blood sugar on their own. That's why we pair them with an Essential Fueling — you get the MPS trigger AND blood sugar control.",
  athlete_mode: "Adds a bedtime EAA serving as a 4th MPS trigger. This gives your muscles one more protein signal during the day, ideal if you're training hard and want maximum recovery.",
};

// ---- SOLVER ----

export function solve(profile, workout = null) {
  const wakeMin = timeToMin(profile.wake_time);
  const sleepMin = timeToMin(profile.sleep_time);
  const template = PLAN_TEMPLATES[profile.plan_type];
  const isGlp1 = template.category === "glp1";
  const isOptimization = template.category === "optimization";

  const athleteApplies = profile.athlete_mode && !isGlp1;
  const mpsTarget = template.mps_target;
  const totalSlots = template.total_slots;

  // Compute workout window
  let workoutEnd = null;
  let anabolicDeadline = null;
  if (workout) {
    const startMin = timeToMin(workout.start_time);
    workoutEnd = startMin + workout.duration_minutes;
    anabolicDeadline = workoutEnd + 30;
  }

  // Usable window (rounded to quarter hours)
  const firstSlot = roundToQuarter(wakeMin + 30);
  const lastSlot = roundToQuarter(sleepMin - 60);
  const bedtimeEaaSlot = roundToQuarter(sleepMin - 30);
  const wakingMins = lastSlot - firstSlot;

  // ---- STEP 1: Place MPS slots at positions 1, 3, 5 pattern ----
  // MPS triggers should be evenly distributed with ~4h+ gaps

  const allSlots = [];

  if (isGlp1) {
    // GLP-1 ASCEND: 3 ASCEND mini meals + 1 L&G+
    // All ASCEND meals are MPS triggers, L&G+ is MPS trigger
    const slotCount = 4;
    const gap = wakingMins / (slotCount - 1);
    for (let i = 0; i < slotCount; i++) {
      const time = roundToQuarter(firstSlot + gap * i);
      // Put L&G+ at dinner position (slot 3, 0-indexed)
      const isLg = i === slotCount - 1;
      allSlots.push({
        time,
        fueling_id: isLg ? "lg_plus" : "ascend",
        is_mps_trigger: true,
        is_post_workout: false,
        is_bedtime_eaa: false,
        pushed: false,
      });
    }
  } else if (isOptimization) {
    // Optimization: ASCEND, EAA, L&G+, ASCEND+EAA, L&G+, Yogurt
    // Day: Breakfast(ASCEND) - Mid-AM(EAA) - Lunch(L&G+) - Mid-PM(ASCEND+EAA) - Dinner(L&G+) - Evening(Yogurt)
    const slotCount = 6;
    const gap = wakingMins / (slotCount - 1);
    const optSlots = [
      { fueling_id: "ascend", is_mps: true },
      { fueling_id: "eaa", is_mps: true },
      { fueling_id: "lg_plus", is_mps: true },
      { fueling_id: "hybrid", is_mps: true },   // ASCEND + EAA mid-afternoon
      { fueling_id: "lg_plus", is_mps: true },
      { fueling_id: "yogurt", is_mps: false },
    ];
    for (let i = 0; i < slotCount; i++) {
      const time = roundToQuarter(firstSlot + gap * i);
      allSlots.push({
        time,
        fueling_id: optSlots[i].fueling_id,
        is_mps_trigger: optSlots[i].is_mps,
        is_post_workout: false,
        is_bedtime_eaa: false,
        pushed: false,
      });
    }
  } else {
    // Standard plans: anchor MPS slots first, then fill gaps with non-MPS fuelings
    const lgCount = template.lean_green_count;
    const efCount = template.essential_count;
    const snackCount = template.has_snack ? 1 : 0;
    const coreSlotCount = efCount + lgCount + snackCount;
    const fillerCount = coreSlotCount - mpsTarget; // non-MPS slots to place

    // ---- STEP 1a: Place MPS anchor points ----
    // MPS 1 = first slot (whey at wake+30)
    // MPS 2 = L&G at preferred dinner time (default 6 PM)
    // MPS 3 = placed in the largest gap to maximize even spacing
    const lgPreferredMin = profile.lg_preferred_time ? timeToMin(profile.lg_preferred_time) : null;

    const mpsTimes = [];
    // MPS 1: always at firstSlot (whey breakfast)
    mpsTimes.push(firstSlot);

    if (mpsTarget >= 2) {
      if (lgPreferredMin && lgPreferredMin <= lastSlot) {
        // Clamp L&G time: must be at least MIN_MPS_GAP from first MPS
        const clampedLg = roundToQuarter(Math.max(firstSlot + MIN_MPS_GAP, Math.min(lgPreferredMin, lastSlot)));
        mpsTimes.push(clampedLg);
      } else {
        // Fallback: evenly distributed
        mpsTimes.push(roundToQuarter(firstSlot + wakingMins / 2));
      }
    }

    if (mpsTarget >= 3) {
      // MPS 3: find the largest gap between existing MPS and place it there
      mpsTimes.sort((a, b) => a - b);
      let maxGap = 0, gapStart = 0, gapEnd = 0;
      for (let i = 1; i < mpsTimes.length; i++) {
        const g = mpsTimes[i] - mpsTimes[i - 1];
        if (g > maxGap) { maxGap = g; gapStart = mpsTimes[i - 1]; gapEnd = mpsTimes[i]; }
      }
      // Also check gap after last MPS to end of day
      const endGap = lastSlot - mpsTimes[mpsTimes.length - 1];
      if (endGap > maxGap) {
        mpsTimes.push(roundToQuarter(mpsTimes[mpsTimes.length - 1] + endGap / 2));
      } else {
        mpsTimes.push(roundToQuarter((gapStart + gapEnd) / 2));
      }
    }

    mpsTimes.sort((a, b) => a - b);

    // ---- STEP 1b: If workout, move the nearest MPS to post-workout ----
    let postWorkoutMpsIdx = -1;
    if (workout) {
      const targetTime = workoutEnd + 15;
      let bestDist = Infinity;
      for (let i = 0; i < mpsTimes.length; i++) {
        const dist = Math.abs(mpsTimes[i] - targetTime);
        if (dist < bestDist) { bestDist = dist; postWorkoutMpsIdx = i; }
      }
      if (postWorkoutMpsIdx >= 0) {
        mpsTimes[postWorkoutMpsIdx] = roundToQuarter(Math.min(workoutEnd + 15, anabolicDeadline));
      }
    }

    // Sort MPS times (workout may have moved one out of order)
    // Track post-workout by matching the moved time, not the pre-sort index
    const postWorkoutTime = postWorkoutMpsIdx >= 0 ? mpsTimes[postWorkoutMpsIdx] : null;
    mpsTimes.sort((a, b) => a - b);
    const mpsWithMeta = mpsTimes.map(t => ({
      time: t,
      isPostWorkout: postWorkoutTime !== null && t === postWorkoutTime,
    }));

    // ---- STEP 1c: Fill gaps between MPS anchors with filler slots ----
    // Create segments between consecutive MPS anchors (not between firstSlot and first MPS,
    // since MPS 1 IS at firstSlot — avoid zero-duration segments)
    const uniqueBoundaries = [...new Set([...mpsWithMeta.map(m => m.time), lastSlot])].sort((a, b) => a - b);
    // Add firstSlot only if it's before the first MPS (it should be equal)
    if (uniqueBoundaries[0] > firstSlot) uniqueBoundaries.unshift(firstSlot);

    const segments = [];
    for (let i = 0; i < uniqueBoundaries.length - 1; i++) {
      const dur = uniqueBoundaries[i + 1] - uniqueBoundaries[i];
      if (dur > 0) { // skip zero-duration segments
        segments.push({ start: uniqueBoundaries[i], end: uniqueBoundaries[i + 1], duration: dur });
      }
    }

    // Assign fillers per segment — prefer ~2h gaps (better to be closer to 2h than 3h)
    // Target gap: 120 min (2h). Max allowed: 180 min (3h).
    const IDEAL_GAP = 120; // prefer 2-hour gaps
    const fillerAssignment = segments.map(() => 0);
    let fillersRemaining = fillerCount;

    // First pass: ensure each segment gets enough fillers so no sub-gap > MAX (3h)
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].duration > MAX_BLOOD_SUGAR_GAP && fillersRemaining > 0) {
        const needed = Math.ceil(segments[i].duration / MAX_BLOOD_SUGAR_GAP) - 1;
        const assign = Math.min(needed, fillersRemaining);
        fillerAssignment[i] = assign;
        fillersRemaining -= assign;
      }
    }

    // Second pass: distribute remaining to bring gaps closest to IDEAL_GAP (~2h)
    // Place fillers in segments whose effective gap is farthest above the ideal
    while (fillersRemaining > 0) {
      let worstIdx = -1, worstExcess = 0;
      for (let i = 0; i < segments.length; i++) {
        const effectiveGap = segments[i].duration / (fillerAssignment[i] + 1);
        const excess = effectiveGap - IDEAL_GAP; // how far above 2h
        if (excess > worstExcess) { worstExcess = excess; worstIdx = i; }
      }
      if (worstIdx >= 0 && worstExcess > 0) {
        fillerAssignment[worstIdx]++;
        fillersRemaining--;
      } else {
        // All gaps are at or below ideal — put remaining in largest gap
        let bigIdx = -1, bigGap = 0;
        for (let i = 0; i < segments.length; i++) {
          const g = segments[i].duration / (fillerAssignment[i] + 1);
          if (g > bigGap) { bigGap = g; bigIdx = i; }
        }
        if (bigIdx >= 0) {
          fillerAssignment[bigIdx]++;
          fillersRemaining--;
        } else break;
      }
    }

    // Now place all slots: MPS anchors are already set, fill gaps evenly
    const finalSlotList = [];

    // Add MPS slots — assign L&G to the slot closest to preferred L&G time
    let lgAssigned = 0;

    // Find which MPS slot is closest to the L&G preferred time
    const lgTargetTime = lgPreferredMin || Math.round(firstSlot + wakingMins * 0.7);
    let bestLgIdx = -1;
    let bestLgDist = Infinity;
    for (let i = 0; i < mpsWithMeta.length; i++) {
      // Don't assign L&G to post-workout (that should be whey)
      if (mpsWithMeta[i].isPostWorkout) continue;
      // Don't assign L&G to first slot (that should be whey breakfast)
      if (i === 0 && mpsWithMeta.length > 1) continue;
      const dist = Math.abs(mpsWithMeta[i].time - lgTargetTime);
      if (dist < bestLgDist) { bestLgDist = dist; bestLgIdx = i; }
    }

    for (let i = 0; i < mpsWithMeta.length; i++) {
      let fuelingId;
      if (mpsWithMeta[i].isPostWorkout) {
        fuelingId = "whey";
      } else if (i === bestLgIdx && lgAssigned < lgCount) {
        fuelingId = template.lean_green_type;
        lgAssigned++;
      } else if (i === 0) {
        fuelingId = "whey";
      } else if (lgAssigned < lgCount) {
        fuelingId = template.lean_green_type;
        lgAssigned++;
      } else {
        fuelingId = "whey";
      }

      finalSlotList.push({
        time: mpsWithMeta[i].time,
        fueling_id: fuelingId,
        is_mps_trigger: true,
        is_post_workout: mpsWithMeta[i].isPostWorkout,
        is_bedtime_eaa: false,
        pushed: false,
      });
    }

    // Add filler slots within each segment
    let snackAssigned = 0;
    for (let seg = 0; seg < segments.length; seg++) {
      const count = fillerAssignment[seg];
      if (count === 0) continue;
      const segGap = segments[seg].duration / (count + 1);
      for (let f = 1; f <= count; f++) {
        const time = roundToQuarter(segments[seg].start + segGap * f);
        let fuelingId;
        if (snackCount > 0 && snackAssigned < snackCount && seg === segments.length - 1 && f === count) {
          fuelingId = "snack";
          snackAssigned++;
        } else if (lgAssigned < lgCount) {
          fuelingId = template.lean_green_type;
          lgAssigned++;
        } else {
          fuelingId = "ef";
        }
        finalSlotList.push({
          time,
          fueling_id: fuelingId,
          is_mps_trigger: false,
          is_post_workout: false,
          is_bedtime_eaa: false,
          pushed: false,
        });
      }
    }

    // Sort and push to allSlots
    finalSlotList.sort((a, b) => a.time - b.time);
    allSlots.push(...finalSlotList);

    // If ACTIVE plan, add EAA servings (these are EXTRA, not counted as fuelings)
    if (template.has_eaa && template.eaa_count) {
      const sorted = [...allSlots].sort((a, b) => a.time - b.time);
      for (let e = 0; e < template.eaa_count; e++) {
        let maxGap = 0, maxIdx = 0;
        for (let i = 1; i < sorted.length; i++) {
          const g = sorted[i].time - sorted[i - 1].time;
          if (g > maxGap) { maxGap = g; maxIdx = i; }
        }
        const eaaTime = roundToQuarter((sorted[maxIdx - 1].time + sorted[maxIdx].time) / 2);
        const eaaSlot = {
          time: eaaTime,
          fueling_id: "eaa",
          is_mps_trigger: true,
          is_post_workout: false,
          is_bedtime_eaa: false,
          is_extra_eaa: true,  // not a fueling, just a supplement
          pushed: false,
        };
        sorted.splice(maxIdx, 0, eaaSlot);
        allSlots.push(eaaSlot);
      }
    }
  }

  // Sort all slots by time
  allSlots.sort((a, b) => a.time - b.time);

  // ---- STEP 2: Check MPS conflicts ----
  const conflicts = [];
  for (let i = 1; i < allSlots.length; i++) {
    if (allSlots[i].is_mps_trigger && allSlots[i - 1].is_mps_trigger) {
      const gap = allSlots[i].time - allSlots[i - 1].time;
      if (gap < MIN_MPS_GAP) {
        conflicts.push({
          type: "mps_too_close",
          slot_a_index: i - 1,
          slot_b_index: i,
          gap_minutes: gap,
          severity: gap < WARN_MPS_GAP ? "red" : "yellow",
        });
      }
    }
  }

  // ---- STEP 3: Apply priority resolution ----
  if (conflicts.length > 0 && workout) {
    const pwIdx = allSlots.findIndex(s => s.is_post_workout);
    if (profile.priority_mode === "metabolic" && pwIdx > 0) {
      // Find previous MPS
      let prevMpsIdx = -1;
      for (let i = pwIdx - 1; i >= 0; i--) {
        if (allSlots[i].is_mps_trigger) { prevMpsIdx = i; break; }
      }
      if (prevMpsIdx >= 0) {
        const safeTime = roundToQuarter(allSlots[prevMpsIdx].time + MIN_MPS_GAP);
        if (safeTime <= lastSlot) {
          allSlots[pwIdx].time = safeTime;
          allSlots[pwIdx].pushed = true;
        }
      }
    }
    allSlots.sort((a, b) => a.time - b.time);
  }

  // ---- STEP 4: Verify blood sugar gaps ----
  // The segment-based distribution should already prevent gaps > 3h
  // This is a safety net — it should NOT insert extra slots for standard plans

  // ---- STEP 5: Add bedtime EAA for athlete mode ----
  if (athleteApplies) {
    // Check if there's already a slot near bedtime
    const nearBedtime = allSlots.some(s => Math.abs(s.time - bedtimeEaaSlot) < 30);
    if (!nearBedtime) {
      allSlots.push({
        time: bedtimeEaaSlot,
        fueling_id: "eaa",
        is_mps_trigger: true,
        is_post_workout: false,
        is_bedtime_eaa: true,
        pushed: false,
      });
      allSlots.sort((a, b) => a.time - b.time);

      // EAA doesn't stabilize BS — check if we need a filler before it
      const bsSlots = allSlots.filter(s => getFuelingById(s.fueling_id)?.stabilizes_blood_sugar);
      if (bsSlots.length > 0) {
        const lastBs = bsSlots[bsSlots.length - 1];
        if (bedtimeEaaSlot - lastBs.time > MAX_BLOOD_SUGAR_GAP) {
          const mid = roundToQuarter((lastBs.time + bedtimeEaaSlot) / 2);
          allSlots.push({
            time: mid,
            fueling_id: "ef",
            is_mps_trigger: false,
            is_post_workout: false,
            is_bedtime_eaa: false,
            pushed: false,
          });
          allSlots.sort((a, b) => a.time - b.time);
        }
      }
    }
  }

  // ---- STEP 6: Evaluate each slot ----
  const evaluatedSlots = allSlots.map((slot, i) => {
    const prev = i > 0 ? allSlots[i - 1] : null;
    const next = i < allSlots.length - 1 ? allSlots[i + 1] : null;
    return {
      ...slot,
      ...evaluateSlot(slot, prev, next, allSlots, workout, { wakeMin, sleepMin, workoutEnd, anabolicDeadline }),
      slot_index: i,
    };
  });

  // Recompute conflicts after resolution
  const finalConflicts = [];
  for (let i = 1; i < evaluatedSlots.length; i++) {
    if (evaluatedSlots[i].is_mps_trigger && evaluatedSlots[i - 1]?.is_mps_trigger) {
      const gap = evaluatedSlots[i].time - evaluatedSlots[i - 1].time;
      if (gap < MIN_MPS_GAP) {
        finalConflicts.push({
          type: "mps_too_close",
          slot_a_index: i - 1,
          slot_b_index: i,
          gap_minutes: gap,
          severity: gap < WARN_MPS_GAP ? "red" : "yellow",
        });
      }
    }
  }

  // ---- SUMMARY ----
  const bsStabilizing = evaluatedSlots.filter(s => getFuelingById(s.fueling_id)?.stabilizes_blood_sugar);
  const bloodSugarGaps = [];
  for (let i = 1; i < bsStabilizing.length; i++) {
    bloodSugarGaps.push(bsStabilizing[i].time - bsStabilizing[i - 1].time);
  }

  const mpsGaps = [];
  let prevMpsTime = null;
  for (const s of evaluatedSlots) {
    if (s.is_mps_trigger) {
      if (prevMpsTime !== null) mpsGaps.push(s.time - prevMpsTime);
      prevMpsTime = s.time;
    }
  }

  const worstStatus = evaluatedSlots.reduce((w, s) => {
    if (s.status === "red") return "red";
    if (s.status === "yellow" && w !== "red") return "yellow";
    return w;
  }, "green");

  const anabolicHit = workout
    ? evaluatedSlots.some(s => s.is_post_workout && s.time <= anabolicDeadline)
    : null;

  return {
    slots: evaluatedSlots,
    conflicts: finalConflicts,
    summary: {
      overall_status: worstStatus,
      mps_count: evaluatedSlots.filter(s => s.is_mps_trigger).length,
      total_fuelings: evaluatedSlots.filter(s => s.fueling_id !== "eaa").length,
      total_with_eaa: evaluatedSlots.length,
      longest_blood_sugar_gap: bloodSugarGaps.length ? Math.max(...bloodSugarGaps) : 0,
      shortest_mps_gap: mpsGaps.length ? Math.min(...mpsGaps) : null,
      anabolic_window_hit: anabolicHit,
    },
    workout: workout ? { ...workout, end_min: workoutEnd, anabolic_deadline: anabolicDeadline } : null,
    profile_computed: { wakeMin, sleepMin, firstSlot, lastSlot },
  };
}

// ---- SLOT EVALUATOR ----

function evaluateSlot(slot, prev, next, allSlots, workout, ctx) {
  const reasons = [];
  let worstStatus = "green";

  const escalate = (s) => {
    if (s === "red") worstStatus = "red";
    else if (s === "yellow" && worstStatus !== "red") worstStatus = "yellow";
  };

  const fueling = getFuelingById(slot.fueling_id);
  const slotStabilizesBs = fueling?.stabilizes_blood_sugar;

  // MPS gap check (backward) — find previous MPS slot
  if (slot.is_mps_trigger) {
    const slotIdx = allSlots.indexOf(slot);
    let prevMps = null;
    for (let i = slotIdx - 1; i >= 0; i--) {
      if (allSlots[i].is_mps_trigger) { prevMps = allSlots[i]; break; }
    }
    if (prevMps) {
      const gap = slot.time - prevMps.time;
      if (gap < WARN_MPS_GAP) {
        escalate("red");
        reasons.push({ rule: "mps_gap", gap_minutes: gap, status: "fail" });
      } else if (gap < MIN_MPS_GAP) {
        escalate("yellow");
        reasons.push({ rule: "mps_gap", gap_minutes: gap, status: "warn" });
      } else {
        reasons.push({ rule: "mps_gap", gap_minutes: gap, status: "ok" });
      }
    }
  }

  // Blood sugar gap check — find previous blood-sugar-stabilizing slot
  if (slotStabilizesBs) {
    const slotIdx = allSlots.indexOf(slot);
    let prevBs = null;
    for (let i = slotIdx - 1; i >= 0; i--) {
      const pf = getFuelingById(allSlots[i].fueling_id);
      if (pf?.stabilizes_blood_sugar) { prevBs = allSlots[i]; break; }
    }
    if (prevBs) {
      const gap = slot.time - prevBs.time;
      if (gap > MAX_BLOOD_SUGAR_GAP) {
        escalate("red");
        reasons.push({ rule: "blood_sugar_gap", gap_minutes: gap, status: "fail" });
      } else if (gap > WARN_BLOOD_SUGAR_GAP) {
        escalate("yellow");
        reasons.push({ rule: "blood_sugar_gap", gap_minutes: gap, status: "warn" });
      } else if (gap < MIN_BLOOD_SUGAR_GAP) {
        escalate("yellow");
        reasons.push({ rule: "blood_sugar_gap", gap_minutes: gap, status: "warn" });
      } else {
        reasons.push({ rule: "blood_sugar_gap", gap_minutes: gap, status: "ok" });
      }
    }
  }

  // EAA-only slot note
  if (slot.fueling_id === "eaa" && !slot.is_bedtime_eaa) {
    reasons.push({ rule: "eaa_note", status: "ok" });
  }
  if (slot.is_bedtime_eaa) {
    reasons.push({ rule: "bedtime_eaa", status: "ok" });
  }

  // Anabolic window check
  if (slot.is_post_workout && ctx.workoutEnd != null) {
    const minsAfter = slot.time - ctx.workoutEnd;
    if (minsAfter > 30) {
      escalate("red");
      reasons.push({ rule: "anabolic_window", minutes_post_workout: minsAfter, status: "fail" });
    } else {
      reasons.push({ rule: "anabolic_window", minutes_post_workout: minsAfter, status: "ok" });
    }
  }

  // Sleep buffer (last non-EAA slot)
  if (!next && !slot.is_bedtime_eaa) {
    const buffer = ctx.sleepMin - slot.time;
    if (buffer < 60) {
      escalate("yellow");
      reasons.push({ rule: "sleep_buffer", minutes: buffer, status: "warn" });
    }
  }

  return { status: worstStatus, reasons };
}
