// ============================================================
// MPS OPTIMAL FUELING SCHEDULER — CONSTRAINT SOLVER
// ============================================================

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

export const FUELING_TYPES = [
  { id: "whey", name: "Whey Protein Shake", category: "high_protein", triggers_mps: true, blood_sugar_impact: "high_stability", requires_pairing: false, is_lean_and_green: false, protein_grams: 25, emoji: "\uD83E\uDD64" },
  { id: "lg", name: "Lean & Green Meal", category: "high_protein", triggers_mps: true, blood_sugar_impact: "high_stability", requires_pairing: false, is_lean_and_green: true, protein_grams: null, emoji: "\uD83E\uDD57" },
  { id: "eaa", name: "EAA Supplement", category: "eaa", triggers_mps: true, blood_sugar_impact: "low", requires_pairing: true, is_lean_and_green: false, protein_grams: 3, emoji: "\uD83D\uDCAA" },
  { id: "ef_bar", name: "Essential Fueling (Bar)", category: "standard", triggers_mps: false, blood_sugar_impact: "high_stability", requires_pairing: false, is_lean_and_green: false, protein_grams: 11, emoji: "\uD83C\uDF6B" },
  { id: "ef_shake", name: "Essential Fueling (Shake)", category: "standard", triggers_mps: false, blood_sugar_impact: "high_stability", requires_pairing: false, is_lean_and_green: false, protein_grams: 11, emoji: "\uD83E\uDD5B" },
  { id: "ef_soup", name: "Essential Fueling (Soup)", category: "standard", triggers_mps: false, blood_sugar_impact: "high_stability", requires_pairing: false, is_lean_and_green: false, protein_grams: 11, emoji: "\uD83C\uDF5C" },
  { id: "hybrid", name: "Essential Fueling + EAA", category: "hybrid", triggers_mps: true, blood_sugar_impact: "high_stability", requires_pairing: false, is_lean_and_green: false, protein_grams: 14, emoji: "\u26A1" },
];

export function getFuelingById(id) {
  return FUELING_TYPES.find((f) => f.id === id);
}

// ---- PLAN TEMPLATES ----

export const PLAN_TEMPLATES = {
  "5&1": { essential_count: 5, lean_green_count: 1, total_slots: 6, mps_target: 3 },
  "4&2": { essential_count: 4, lean_green_count: 2, total_slots: 6, mps_target: 3 },
  "3&3": { essential_count: 3, lean_green_count: 3, total_slots: 6, mps_target: 3 },
};

// ---- SOLVER ----

/**
 * Generates an optimal schedule given profile and workout info.
 *
 * @param {Object} profile - { plan_type, wake_time, sleep_time, priority_mode, athlete_mode }
 * @param {Object|null} workout - { start_time, duration_minutes } (HH:MM strings)
 * @returns {Object} { slots, conflicts, summary }
 */
export function solve(profile, workout = null) {
  const wakeMin = timeToMin(profile.wake_time);
  const sleepMin = timeToMin(profile.sleep_time);
  const template = PLAN_TEMPLATES[profile.plan_type];
  const mpsTarget = profile.athlete_mode ? template.mps_target + 1 : template.mps_target;
  const totalSlots = profile.athlete_mode ? template.total_slots + 1 : template.total_slots;

  // Compute workout window
  let workoutEnd = null;
  let anabolicDeadline = null;
  if (workout) {
    const startMin = timeToMin(workout.start_time);
    workoutEnd = startMin + workout.duration_minutes;
    anabolicDeadline = workoutEnd + 30;
  }

  // Usable window
  const firstSlot = wakeMin + 30; // 30 min after wake
  const lastSlot = sleepMin - 60; // 1 hour before bed

  // Step 1: Place MPS slots evenly
  const wakingMins = lastSlot - firstSlot;
  const mpsSlots = [];

  if (workoutEnd !== null) {
    // Place post-workout MPS first
    const postWorkoutTime = Math.min(workoutEnd + 15, anabolicDeadline);
    mpsSlots.push({ time: postWorkoutTime, is_post_workout: true });
  }

  // Distribute remaining MPS slots evenly
  const remainingMps = mpsTarget - mpsSlots.length;
  if (remainingMps > 0) {
    // If we have a post-workout slot, place MPS before and after it
    if (mpsSlots.length > 0) {
      const pwTime = mpsSlots[0].time;
      // How many MPS slots can fit before workout?
      const beforeWindow = pwTime - firstSlot;
      const afterWindow = lastSlot - pwTime;
      const totalWindow = beforeWindow + afterWindow;

      // Distribute proportionally
      const beforeCount = Math.round((beforeWindow / totalWindow) * remainingMps);
      const afterCount = remainingMps - beforeCount;

      // Place before slots
      if (beforeCount > 0) {
        const gap = beforeWindow / (beforeCount + 1);
        for (let i = 1; i <= beforeCount; i++) {
          mpsSlots.push({ time: Math.round(firstSlot + gap * i), is_post_workout: false });
        }
      }

      // Always place first MPS near wake
      if (beforeCount > 0) {
        // Ensure first MPS is within 30 min of wake
        const earliest = mpsSlots.filter(s => !s.is_post_workout).sort((a, b) => a.time - b.time);
        if (earliest.length > 0 && earliest[0].time > firstSlot + 30) {
          earliest[0].time = firstSlot;
        }
      }

      // Place after slots
      if (afterCount > 0) {
        const gap = afterWindow / (afterCount + 1);
        for (let i = 1; i <= afterCount; i++) {
          mpsSlots.push({ time: Math.round(pwTime + gap * i), is_post_workout: false });
        }
      }
    } else {
      // No workout — distribute evenly
      const gap = wakingMins / (remainingMps - 1 || 1);
      for (let i = 0; i < remainingMps; i++) {
        mpsSlots.push({ time: Math.round(firstSlot + gap * i), is_post_workout: false });
      }
    }
  }

  // Sort MPS slots by time
  mpsSlots.sort((a, b) => a.time - b.time);

  // Ensure first MPS is at wake + 30
  if (mpsSlots.length > 0 && !mpsSlots[0].is_post_workout) {
    mpsSlots[0].time = firstSlot;
  }

  // Step 2: Check for MPS conflicts
  const conflicts = [];
  for (let i = 1; i < mpsSlots.length; i++) {
    const gap = mpsSlots[i].time - mpsSlots[i - 1].time;
    if (gap < 240) {
      conflicts.push({
        type: "mps_too_close",
        slot_a_index: i - 1,
        slot_b_index: i,
        gap_minutes: gap,
        severity: gap < 210 ? "red" : "yellow",
      });
    }
  }

  // Step 3: Apply priority resolution if conflicts exist
  if (conflicts.length > 0 && workout) {
    const pwIdx = mpsSlots.findIndex(s => s.is_post_workout);

    if (profile.priority_mode === "performance") {
      // Keep post-workout in anabolic window, accept short MPS gap
      // (no changes needed — slots stay as-is, red status will show)
    } else if (profile.priority_mode === "metabolic") {
      // Push post-workout to maintain 4h gap
      if (pwIdx > 0) {
        const prevMps = mpsSlots[pwIdx - 1].time;
        const safeTime = prevMps + 240;
        if (safeTime <= lastSlot) {
          mpsSlots[pwIdx].time = safeTime;
          mpsSlots[pwIdx].pushed = true;
        }
      }
    }
    // Re-sort after adjustment
    mpsSlots.sort((a, b) => a.time - b.time);
  }

  // Step 4: Fill blood-sugar slots between MPS slots
  const allSlots = [];
  let mpsIdx = 0;
  const standardTypes = ["ef_bar", "ef_shake", "ef_soup"];
  let stdIdx = 0;
  const lgCount = template.lean_green_count;

  // Build all slots
  for (const mps of mpsSlots) {
    allSlots.push({
      time: mps.time,
      fueling_id: mps.is_post_workout ? "whey" : (mpsIdx === 0 ? "whey" : (mpsIdx < lgCount + 1 ? "lg" : "whey")),
      is_mps_trigger: true,
      is_post_workout: mps.is_post_workout || false,
      pushed: mps.pushed || false,
    });
    mpsIdx++;
  }

  // Re-assign fueling types more intelligently
  // First MPS = whey, middle MPS = L&G, last MPS = whey (or L&G for 4&2/3&3)
  let lgAssigned = 0;
  for (let i = 0; i < allSlots.length; i++) {
    if (allSlots[i].is_mps_trigger) {
      if (i === 0) {
        allSlots[i].fueling_id = "whey";
      } else if (lgAssigned < lgCount) {
        allSlots[i].fueling_id = "lg";
        lgAssigned++;
      } else {
        allSlots[i].fueling_id = "whey";
      }
      // Post-workout always gets whey
      if (allSlots[i].is_post_workout) {
        allSlots[i].fueling_id = "whey";
      }
    }
  }

  // Fill standard fuelings between MPS slots
  const fillerSlots = [];
  const sortedMps = [...allSlots].sort((a, b) => a.time - b.time);
  const fillersNeeded = totalSlots - sortedMps.length;

  if (fillersNeeded > 0) {
    // Find the largest gaps and insert fillers
    const points = [firstSlot, ...sortedMps.map(s => s.time), lastSlot];
    const gaps = [];
    for (let i = 0; i < points.length - 1; i++) {
      gaps.push({ start: points[i], end: points[i + 1], size: points[i + 1] - points[i], idx: i });
    }
    gaps.sort((a, b) => b.size - a.size);

    let fillersPlaced = 0;
    for (const gap of gaps) {
      if (fillersPlaced >= fillersNeeded) break;
      // How many fillers in this gap?
      const count = gap.size > 300 ? 2 : 1;
      const actual = Math.min(count, fillersNeeded - fillersPlaced);
      for (let j = 1; j <= actual; j++) {
        const t = Math.round(gap.start + (gap.size / (actual + 1)) * j);
        fillerSlots.push({
          time: t,
          fueling_id: standardTypes[stdIdx % standardTypes.length],
          is_mps_trigger: false,
          is_post_workout: false,
          pushed: false,
        });
        stdIdx++;
        fillersPlaced++;
      }
    }
  }

  // Combine and sort
  const finalSlots = [...allSlots, ...fillerSlots].sort((a, b) => a.time - b.time);

  // Step 5: Evaluate each slot
  const evaluatedSlots = finalSlots.map((slot, i) => {
    const prev = i > 0 ? finalSlots[i - 1] : null;
    const next = i < finalSlots.length - 1 ? finalSlots[i + 1] : null;
    return {
      ...slot,
      ...evaluateSlot(slot, prev, next, workout, { wakeMin, sleepMin, workoutEnd, anabolicDeadline }),
      slot_index: i,
    };
  });

  // Recompute conflicts after resolution
  const finalConflicts = [];
  for (let i = 1; i < evaluatedSlots.length; i++) {
    if (evaluatedSlots[i].is_mps_trigger && evaluatedSlots[i - 1].is_mps_trigger) {
      const gap = evaluatedSlots[i].time - evaluatedSlots[i - 1].time;
      if (gap < 240) {
        finalConflicts.push({
          type: "mps_too_close",
          slot_a_index: i - 1,
          slot_b_index: i,
          gap_minutes: gap,
          severity: gap < 210 ? "red" : "yellow",
        });
      }
    }
  }

  // Summary
  const mpsGaps = [];
  let prevMpsTime = null;
  for (const s of evaluatedSlots) {
    if (s.is_mps_trigger) {
      if (prevMpsTime !== null) mpsGaps.push(s.time - prevMpsTime);
      prevMpsTime = s.time;
    }
  }

  const bloodSugarGaps = [];
  for (let i = 1; i < evaluatedSlots.length; i++) {
    bloodSugarGaps.push(evaluatedSlots[i].time - evaluatedSlots[i - 1].time);
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

function evaluateSlot(slot, prev, next, workout, ctx) {
  const reasons = [];
  let worstStatus = "green";

  const escalate = (s) => {
    if (s === "red") worstStatus = "red";
    else if (s === "yellow" && worstStatus !== "red") worstStatus = "yellow";
  };

  // MPS gap check (backward)
  if (slot.is_mps_trigger && prev?.is_mps_trigger) {
    const gap = slot.time - prev.time;
    if (gap < 210) {
      escalate("red");
      reasons.push({ rule: "mps_gap", gap_minutes: gap, status: "fail" });
    } else if (gap < 240) {
      escalate("yellow");
      reasons.push({ rule: "mps_gap", gap_minutes: gap, status: "warn" });
    } else {
      reasons.push({ rule: "mps_gap", gap_minutes: gap, status: "ok" });
    }
  }

  // Blood sugar gap (backward)
  if (prev) {
    const gap = slot.time - prev.time;
    if (gap > 240) {
      escalate("red");
      reasons.push({ rule: "blood_sugar_gap", gap_minutes: gap, status: "fail" });
    } else if (gap > 210) {
      escalate("yellow");
      reasons.push({ rule: "blood_sugar_gap", gap_minutes: gap, status: "warn" });
    } else if (gap < 90) {
      escalate("yellow");
      reasons.push({ rule: "blood_sugar_gap", gap_minutes: gap, status: "warn" });
    } else {
      reasons.push({ rule: "blood_sugar_gap", gap_minutes: gap, status: "ok" });
    }
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

  // Sleep buffer (last slot)
  if (!next) {
    const buffer = ctx.sleepMin - slot.time;
    if (buffer < 60) {
      escalate("yellow");
      reasons.push({ rule: "sleep_buffer", minutes: buffer, status: "warn" });
    }
  }

  return { status: worstStatus, reasons };
}
