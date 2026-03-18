// ============================================================
// MPS OPTIMAL FUELING SCHEDULER — CONSTRAINT SOLVER
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

/** Format minutes to 12-hour display */
export function minToDisplay(m) {
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

// ---- PRODUCT CATALOG ----
// Key distinction: stabilizes_blood_sugar tracks whether a fueling controls blood sugar
// EAA alone does NOT stabilize blood sugar — only MPS trigger
// Whey, L&G, Essential Fuelings, ASCEND, and Hybrid all DO stabilize blood sugar

export const FUELING_TYPES = [
  { id: "whey", name: "Whey Protein Shake", category: "high_protein", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 25, emoji: "\uD83E\uDD64" },
  { id: "lg", name: "Lean & Green Meal", category: "high_protein", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: true, protein_grams: null, emoji: "\uD83E\uDD57" },
  { id: "lg_plus", name: "Lean & Green+ Meal", category: "high_protein", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: true, protein_grams: null, emoji: "\uD83E\uDD57" },
  { id: "eaa", name: "Essential Amino Acids", category: "eaa", triggers_mps: true, stabilizes_blood_sugar: false, is_lean_and_green: false, protein_grams: 3, emoji: "\uD83D\uDCAA" },
  { id: "ef", name: "Essential Fueling", category: "standard", triggers_mps: false, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 11, emoji: "\uD83C\uDF7D\uFE0F" },
  { id: "hybrid", name: "Essential Fueling + EAA", category: "hybrid", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 14, emoji: "\u26A1" },
  { id: "ascend", name: "ASCEND Mini Meal", category: "ascend", triggers_mps: true, stabilizes_blood_sugar: true, is_lean_and_green: false, protein_grams: 20, emoji: "\uD83D\uDE80" },
];

export function getFuelingById(id) {
  return FUELING_TYPES.find((f) => f.id === id);
}

// ---- PLAN TEMPLATES ----

export const PLAN_TEMPLATES = {
  "5&1": {
    label: "Optimal Weight 5&1",
    essential_count: 5,
    lean_green_count: 1,
    total_slots: 6,
    mps_target: 3,
    description: "5 Essential Fuelings + 1 Lean & Green",
    is_glp1: false,
  },
  "4&2": {
    label: "Optimal Weight 4&2",
    essential_count: 4,
    lean_green_count: 2,
    total_slots: 6,
    mps_target: 3,
    description: "4 Essential Fuelings + 2 Lean & Green",
    is_glp1: false,
  },
  "3&3": {
    label: "Optimal Weight 3&3",
    essential_count: 3,
    lean_green_count: 3,
    total_slots: 6,
    mps_target: 3,
    description: "3 Essential Fuelings + 3 Lean & Green",
    is_glp1: false,
  },
  "GLP1": {
    label: "ASCEND for GLP-1",
    essential_count: 3,
    lean_green_count: 1,
    total_slots: 4,
    mps_target: 4,
    description: "3 ASCEND Mini Meals + 1 Lean & Green+",
    is_glp1: true,
  },
};

// ---- SOLVER ----

export function solve(profile, workout = null) {
  const wakeMin = timeToMin(profile.wake_time);
  const sleepMin = timeToMin(profile.sleep_time);
  const template = PLAN_TEMPLATES[profile.plan_type];
  const isGlp1 = template.is_glp1;

  const athleteApplies = profile.athlete_mode && !isGlp1;
  const mpsTarget = athleteApplies ? template.mps_target + 1 : template.mps_target;
  const totalSlots = template.total_slots;

  // Compute workout window
  let workoutEnd = null;
  let anabolicDeadline = null;
  if (workout) {
    const startMin = timeToMin(workout.start_time);
    workoutEnd = startMin + workout.duration_minutes;
    anabolicDeadline = workoutEnd + 30;
  }

  // Usable window
  const firstSlot = wakeMin + 30;
  const lastSlot = sleepMin - 60;
  const bedtimeEaaSlot = sleepMin - 30;

  const wakingMins = lastSlot - firstSlot;
  const mpsSlots = [];
  const mainMpsTarget = athleteApplies ? mpsTarget - 1 : mpsTarget;

  // ---- STEP 1: Place MPS slots ----

  if (workoutEnd !== null) {
    const postWorkoutTime = Math.min(workoutEnd + 15, anabolicDeadline);
    mpsSlots.push({ time: postWorkoutTime, is_post_workout: true, is_bedtime_eaa: false });
  }

  const remainingMps = mainMpsTarget - mpsSlots.length;
  if (remainingMps > 0) {
    if (mpsSlots.length > 0) {
      const pwTime = mpsSlots[0].time;
      const beforeWindow = pwTime - firstSlot;
      const afterWindow = lastSlot - pwTime;
      const totalWindow = beforeWindow + afterWindow;

      const beforeCount = Math.max(1, Math.round((beforeWindow / totalWindow) * remainingMps));
      const afterCount = remainingMps - beforeCount;

      // Place before slots
      if (beforeCount === 1) {
        mpsSlots.push({ time: firstSlot, is_post_workout: false, is_bedtime_eaa: false });
      } else {
        for (let i = 0; i < beforeCount; i++) {
          const t = Math.round(firstSlot + (beforeWindow / beforeCount) * i);
          mpsSlots.push({ time: t, is_post_workout: false, is_bedtime_eaa: false });
        }
      }

      // Place after slots
      if (afterCount > 0) {
        const gap = afterWindow / (afterCount + 1);
        for (let i = 1; i <= afterCount; i++) {
          mpsSlots.push({ time: Math.round(pwTime + gap * i), is_post_workout: false, is_bedtime_eaa: false });
        }
      }
    } else {
      // No workout — distribute evenly
      const gap = wakingMins / (remainingMps - 1 || 1);
      for (let i = 0; i < remainingMps; i++) {
        mpsSlots.push({ time: Math.round(firstSlot + gap * i), is_post_workout: false, is_bedtime_eaa: false });
      }
    }
  }

  mpsSlots.sort((a, b) => a.time - b.time);

  // Ensure first MPS is at firstSlot
  if (mpsSlots.length > 0 && !mpsSlots[0].is_post_workout) {
    mpsSlots[0].time = firstSlot;
  }

  // ---- STEP 2: Check for MPS conflicts ----
  const conflicts = [];
  for (let i = 1; i < mpsSlots.length; i++) {
    const gap = mpsSlots[i].time - mpsSlots[i - 1].time;
    if (gap < MIN_MPS_GAP) {
      conflicts.push({ type: "mps_too_close", slot_a_index: i - 1, slot_b_index: i, gap_minutes: gap, severity: gap < WARN_MPS_GAP ? "red" : "yellow" });
    }
  }

  // ---- STEP 3: Apply priority resolution ----
  if (conflicts.length > 0 && workout) {
    const pwIdx = mpsSlots.findIndex(s => s.is_post_workout);
    if (profile.priority_mode === "metabolic" && pwIdx > 0) {
      const prevMps = mpsSlots[pwIdx - 1].time;
      const safeTime = prevMps + MIN_MPS_GAP;
      if (safeTime <= lastSlot) {
        mpsSlots[pwIdx].time = safeTime;
        mpsSlots[pwIdx].pushed = true;
      }
    }
    mpsSlots.sort((a, b) => a.time - b.time);
  }

  // ---- STEP 4: Assign fueling types to MPS slots ----
  const allSlots = [];
  const lgCount = template.lean_green_count;
  let lgAssigned = 0;

  for (let i = 0; i < mpsSlots.length; i++) {
    const mps = mpsSlots[i];
    let fuelingId;

    if (isGlp1) {
      if (lgAssigned < lgCount && i === Math.floor(mpsSlots.length / 2)) {
        fuelingId = "lg_plus";
        lgAssigned++;
      } else {
        fuelingId = "ascend";
      }
      if (mps.is_post_workout) fuelingId = "ascend";
    } else {
      if (i === 0) {
        fuelingId = "whey";
      } else if (lgAssigned < lgCount) {
        fuelingId = "lg";
        lgAssigned++;
      } else {
        fuelingId = "whey";
      }
      if (mps.is_post_workout) fuelingId = "whey";
    }

    allSlots.push({
      time: mps.time,
      fueling_id: fuelingId,
      is_mps_trigger: true,
      is_post_workout: mps.is_post_workout || false,
      is_bedtime_eaa: false,
      pushed: mps.pushed || false,
    });
  }

  // ---- STEP 5: Fill blood-sugar slots to guarantee no gap > 3 hours ----
  // This is the critical fix: we don't just fill a fixed number of slots,
  // we fill UNTIL no blood-sugar gap exceeds 3 hours.

  let finalSlots = [...allSlots].sort((a, b) => a.time - b.time);

  if (!isGlp1) {
    // For standard plans, we need to place Essential Fuelings
    // Strategy: repeatedly find the largest blood-sugar gap and insert a filler
    const maxFillers = totalSlots - finalSlots.length;
    let fillersPlaced = 0;

    for (let pass = 0; pass < maxFillers + 5; pass++) {
      if (fillersPlaced >= maxFillers) break;

      // Find the largest gap between blood-sugar-stabilizing slots
      const bsSlots = finalSlots.filter(s => {
        const f = getFuelingById(s.fueling_id);
        return f?.stabilizes_blood_sugar;
      });

      // Include boundaries: first fueling should be near wake, last near lastSlot
      let worstGap = 0;
      let worstStart = 0;
      let worstEnd = 0;

      // Check gap from wake to first BS slot
      if (bsSlots.length > 0 && bsSlots[0].time - wakeMin > MAX_BLOOD_SUGAR_GAP) {
        const g = bsSlots[0].time - wakeMin;
        if (g > worstGap) { worstGap = g; worstStart = wakeMin; worstEnd = bsSlots[0].time; }
      }

      // Check gaps between consecutive BS slots
      for (let i = 1; i < bsSlots.length; i++) {
        const g = bsSlots[i].time - bsSlots[i - 1].time;
        if (g > worstGap) { worstGap = g; worstStart = bsSlots[i - 1].time; worstEnd = bsSlots[i].time; }
      }

      // Check gap from last BS slot to sleep
      if (bsSlots.length > 0) {
        const g = sleepMin - bsSlots[bsSlots.length - 1].time;
        if (g > worstGap) { worstGap = g; worstStart = bsSlots[bsSlots.length - 1].time; worstEnd = sleepMin; }
      }

      if (worstGap <= MAX_BLOOD_SUGAR_GAP) break; // All gaps are good!

      // Insert a filler at the midpoint of the worst gap
      const midpoint = Math.round((worstStart + worstEnd) / 2);
      finalSlots.push({
        time: midpoint,
        fueling_id: "ef",
        is_mps_trigger: false,
        is_post_workout: false,
        is_bedtime_eaa: false,
        pushed: false,
      });
      finalSlots.sort((a, b) => a.time - b.time);
      fillersPlaced++;
    }

    // If we still have filler budget and gaps > 2.5h, keep filling
    while (fillersPlaced < maxFillers) {
      const bsSlots = finalSlots.filter(s => getFuelingById(s.fueling_id)?.stabilizes_blood_sugar);
      let worstGap = 0, worstStart = 0, worstEnd = 0;
      for (let i = 1; i < bsSlots.length; i++) {
        const g = bsSlots[i].time - bsSlots[i - 1].time;
        if (g > worstGap) { worstGap = g; worstStart = bsSlots[i - 1].time; worstEnd = bsSlots[i].time; }
      }
      if (worstGap < 150) break; // gaps are small enough
      const midpoint = Math.round((worstStart + worstEnd) / 2);
      finalSlots.push({
        time: midpoint,
        fueling_id: "ef",
        is_mps_trigger: false,
        is_post_workout: false,
        is_bedtime_eaa: false,
        pushed: false,
      });
      finalSlots.sort((a, b) => a.time - b.time);
      fillersPlaced++;
    }
  }

  // ---- STEP 5b: Add bedtime EAA for athlete mode ----
  // EAA doesn't stabilize blood sugar, so we pair it: if the gap from the last
  // blood-sugar slot to bedtime EAA is > 3h, the solver already placed a filler above.
  if (athleteApplies) {
    finalSlots.push({
      time: bedtimeEaaSlot,
      fueling_id: "eaa",
      is_mps_trigger: true,
      is_post_workout: false,
      is_bedtime_eaa: true,
      pushed: false,
    });
    finalSlots.sort((a, b) => a.time - b.time);
  }

  // ---- STEP 6: Evaluate each slot ----
  const evaluatedSlots = finalSlots.map((slot, i) => {
    const prev = i > 0 ? finalSlots[i - 1] : null;
    const next = i < finalSlots.length - 1 ? finalSlots[i + 1] : null;
    return {
      ...slot,
      ...evaluateSlot(slot, prev, next, finalSlots, workout, { wakeMin, sleepMin, workoutEnd, anabolicDeadline }),
      slot_index: i,
    };
  });

  // Recompute conflicts after resolution
  const finalConflicts = [];
  for (let i = 1; i < evaluatedSlots.length; i++) {
    if (evaluatedSlots[i].is_mps_trigger && evaluatedSlots[i - 1].is_mps_trigger) {
      const gap = evaluatedSlots[i].time - evaluatedSlots[i - 1].time;
      if (gap < MIN_MPS_GAP) {
        finalConflicts.push({ type: "mps_too_close", slot_a_index: i - 1, slot_b_index: i, gap_minutes: gap, severity: gap < WARN_MPS_GAP ? "red" : "yellow" });
      }
    }
  }

  // ---- SUMMARY ----
  // Blood sugar gaps: only count gaps between blood-sugar-STABILIZING slots
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
      total_fuelings: evaluatedSlots.length,
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

  // EAA-only slot: note that it doesn't control blood sugar
  if (slot.is_bedtime_eaa) {
    reasons.push({ rule: "eaa_note", status: "ok" });
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
