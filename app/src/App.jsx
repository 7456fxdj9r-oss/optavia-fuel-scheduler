import { useState, useMemo, useRef } from "react";
import { solve, minToDisplay, minToTime, timeToMin, FUELING_TYPES, getFuelingById, PLAN_TEMPLATES, GOAL_MODES, TOOLTIPS } from "./solver";

// ============================================================
// STATUS COLORS & LABELS
// ============================================================
const STATUS_COLORS = {
  green: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700", dot: "bg-emerald-500", glow: "shadow-emerald-200" },
  yellow: { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-700", dot: "bg-amber-500", glow: "shadow-amber-200" },
  red: { bg: "bg-red-100", border: "border-red-400", text: "text-red-700", dot: "bg-red-500", glow: "shadow-red-200" },
};
const STATUS_LABELS = { green: "All Clear", yellow: "Minor Deviation", red: "Needs Attention" };

// ============================================================
// TOOLTIP COMPONENT
// ============================================================
function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button type="button" onClick={() => setShow(!show)} onBlur={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold inline-flex items-center justify-center hover:bg-indigo-200 transition-colors cursor-help">
        ?
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  );
}

// ============================================================
// PLAN CATEGORY GROUPS
// ============================================================
const PLAN_CATEGORIES = [
  { key: "weight_loss", label: "Weight Loss", plans: ["5&1", "5&1A", "4&2&1", "4&2A"] },
  { key: "maintenance", label: "Maintenance", plans: ["3&3", "3&3A"] },
  { key: "glp1", label: "GLP-1 Support", plans: ["GLP1"] },
  { key: "optimization", label: "Optimization", plans: ["OPT"] },
];

// ============================================================
// SETUP PANEL (Smart Form with Tooltips)
// ============================================================
function SetupPanel({ profile, setProfile, workout, setWorkout, goal, setGoal }) {
  const template = PLAN_TEMPLATES[profile.plan_type];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2">
          {"\u2699\uFE0F"} Your Setup
        </h2>
        <p className="text-indigo-200 text-xs mt-0.5">Configure your plan and the scheduler will optimize your day</p>
      </div>
      <div className="p-5 space-y-5">

        {/* Goal Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What's your main goal?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(GOAL_MODES).map(([key, mode]) => (
              <button key={key} onClick={() => {
                setGoal(key);
                setProfile(p => ({ ...p, priority_mode: mode.priority_mode }));
                if (key === "muscle" && !workout) {
                  setWorkout({ start_time: "08:00", duration_minutes: 60 });
                }
              }}
                className={`p-3 rounded-xl text-center transition-all ${goal === key
                  ? "bg-indigo-50 border-2 border-indigo-400 shadow-md scale-[1.02]"
                  : "bg-gray-50 border-2 border-transparent hover:border-gray-200"}`}>
                <div className="text-2xl mb-1">{mode.emoji}</div>
                <div className="text-xs font-semibold text-gray-800">{mode.label}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">{GOAL_MODES[goal].description}</p>
        </div>

        {/* Plan Selection by Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Which plan are you on?
          </label>
          <div className="space-y-3">
            {PLAN_CATEGORIES.map(cat => (
              <div key={cat.key}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">{cat.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {cat.plans.map(p => {
                    const tmpl = PLAN_TEMPLATES[p];
                    const isActive = profile.plan_type === p;
                    const catColor = cat.key === "glp1" ? "teal" : cat.key === "optimization" ? "violet" : "indigo";
                    return (
                      <button key={p} onClick={() => setProfile(pr => ({ ...pr, plan_type: p }))}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${isActive
                          ? `bg-${catColor}-600 text-white shadow-lg scale-105`
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        style={isActive ? { backgroundColor: catColor === "teal" ? "#0d9488" : catColor === "violet" ? "#7c3aed" : "#4f46e5" } : {}}>
                        {tmpl.label.replace("Optimal Weight ", "").replace("Optimal Health ", "")}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
            <span className="shrink-0">{"\u2139\uFE0F"}</span> {template.description}
          </p>
        </div>

        {/* Wake / Sleep / L&G Dinner */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{"\uD83C\uDF05"} Wake Up</label>
            <input type="time" value={profile.wake_time}
              onChange={(e) => setProfile(p => ({ ...p, wake_time: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{"\uD83C\uDF19"} Bedtime</label>
            <input type="time" value={profile.sleep_time}
              onChange={(e) => setProfile(p => ({ ...p, sleep_time: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        </div>

        {/* Preferred L&G Time */}
        {template.lean_green_count > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {"\uD83E\uDD57"} When do you want your Lean & Green?
            </label>
            <input type="time" value={profile.lg_preferred_time || "18:00"}
              onChange={(e) => setProfile(p => ({ ...p, lg_preferred_time: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
            <p className="text-[10px] text-gray-400 mt-1">Most people prefer dinner time (4-7 PM). The scheduler will place your L&G here.</p>
          </div>
        )}

        {/* Workout */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input type="checkbox" checked={workout !== null}
              onChange={(e) => setWorkout(e.target.checked ? { start_time: "08:00", duration_minutes: 60 } : null)}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
            <span className="text-sm font-medium text-gray-700">{"\uD83C\uDFBD"} I'm working out today</span>
            <InfoTip text={TOOLTIPS.anabolic} />
          </label>
          {workout && (
            <div className="grid grid-cols-2 gap-3 pl-8 animate-fadeIn">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                <input type="time" value={workout.start_time}
                  onChange={(e) => setWorkout(w => ({ ...w, start_time: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                <select value={workout.duration_minutes}
                  onChange={(e) => setWorkout(w => ({ ...w, duration_minutes: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500">
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Athlete Mode */}
        <label className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-indigo-50/50 rounded-xl cursor-pointer hover:from-gray-100 hover:to-indigo-100/50 transition-colors border border-gray-200">
          <input type="checkbox" checked={profile.athlete_mode}
            onChange={(e) => setProfile(p => ({ ...p, athlete_mode: e.target.checked }))}
            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700">{"\uD83D\uDCAA"} Athlete Mode</div>
            <div className="text-xs text-gray-500">Add bedtime EAA for a 4th MPS trigger</div>
          </div>
          <InfoTip text={TOOLTIPS.athlete_mode} />
        </label>
      </div>
    </div>
  );
}

// ============================================================
// WHAT-IF TOGGLES (uses plain object, not Set, for reliable React state)
// ============================================================
function WhatIfToggles({ activeWhatIfs, toggleWhatIf, clearWhatIfs, hasWorkout }) {
  const scenarios = [
    { key: "wake_earlier", label: "Wake 30m earlier", emoji: "\u23F0", show: true },
    { key: "wake_later", label: "Wake 30m later", emoji: "\uD83D\uDCA4", show: true },
    { key: "sleep_later", label: "Stay up 1h later", emoji: "\uD83C\uDF19", show: true },
    { key: "add_workout", label: "Add a workout", emoji: "\uD83C\uDFCB\uFE0F", show: !hasWorkout },
    { key: "workout_earlier", label: "Workout 1h earlier", emoji: "\u23EA", show: hasWorkout },
    { key: "workout_later", label: "Workout 1h later", emoji: "\u23E9", show: hasWorkout },
    { key: "no_workout", label: "Skip workout", emoji: "\u274C", show: hasWorkout },
    { key: "athlete_mode", label: "Athlete Mode", emoji: "\uD83D\uDCAA", show: true },
  ];

  const visible = scenarios.filter(s => s.show);
  const anyActive = Object.values(activeWhatIfs).some(v => v);

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-3 flex items-center justify-between">
        <h2 className="text-white text-sm font-semibold flex items-center gap-2">{"\uD83E\uDD14"} What If...</h2>
        {anyActive && (
          <button onClick={clearWhatIfs}
            className="text-[10px] text-sky-200 hover:text-white font-medium transition-colors">
            Clear all
          </button>
        )}
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {visible.map(s => {
          const isActive = !!activeWhatIfs[s.key];
          return (
            <button key={s.key} onClick={() => toggleWhatIf(s.key)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border-2 ${isActive
                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg scale-105"
                : "bg-gray-50 hover:bg-indigo-50 border-gray-200 hover:border-indigo-300 text-gray-700 hover:text-indigo-700"}`}>
              <span>{s.emoji}</span> {s.label}
              {isActive && <span className="ml-1 opacity-80">ON</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// TIMELINE VISUALIZER
// ============================================================
function Timeline({ result }) {
  const { slots, workout, profile_computed } = result;
  const { wakeMin, sleepMin } = profile_computed;
  const range = sleepMin - wakeMin;
  const pct = (min) => Math.max(1, Math.min(99, ((min - wakeMin) / range) * 100));

  // Generate hour markers
  const hourMarkers = [];
  const startHour = Math.ceil(wakeMin / 60);
  const endHour = Math.floor(sleepMin / 60);
  for (let h = startHour; h <= endHour; h++) {
    hourMarkers.push(h * 60);
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3">
        <h2 className="text-white text-sm font-semibold flex items-center gap-2">{"\uD83D\uDCC5"} Your Day at a Glance</h2>
      </div>
      <div className="p-6">
        {/* Hour labels */}
        <div className="relative h-5 mb-1">
          {hourMarkers.map(m => (
            <div key={m} className="absolute -translate-x-1/2 text-[10px] text-gray-400" style={{ left: `${pct(m)}%` }}>
              {minToDisplay(m).replace(":00 ", "").toLowerCase()}
            </div>
          ))}
        </div>

        {/* Timeline bar */}
        <div className="relative h-20 mb-1">
          {/* Base bar */}
          <div className="absolute top-9 left-0 right-0 h-2 bg-gray-200 rounded-full" />

          {/* Hour tick marks */}
          {hourMarkers.map(m => (
            <div key={m} className="absolute top-7 w-px h-6 bg-gray-300" style={{ left: `${pct(m)}%` }} />
          ))}

          {/* Workout block */}
          {workout && (
            <div className="absolute top-6 h-8 bg-purple-100 border-2 border-purple-400 rounded-lg flex items-center justify-center"
              style={{ left: `${pct(timeToMin(workout.start_time))}%`, width: `${Math.max(3, (workout.duration_minutes / range) * 100)}%` }}>
              <span className="text-[9px] font-bold text-purple-700 whitespace-nowrap">{"\uD83C\uDFCB\uFE0F"}</span>
            </div>
          )}

          {/* Slot markers */}
          {slots.map((slot, i) => {
            const colors = STATUS_COLORS[slot.status];
            const fueling = getFuelingById(slot.fueling_id);
            return (
              <div key={i} className="absolute -translate-x-1/2 group" style={{ left: `${pct(slot.time)}%`, top: 0 }}>
                {/* Connector line */}
                <div className={`absolute top-5 left-1/2 w-px h-4 ${slot.status === "red" ? "bg-red-300" : slot.status === "yellow" ? "bg-amber-300" : "bg-gray-300"}`} />
                {/* Dot */}
                <div className={`w-5 h-5 rounded-full border-2 ${colors.border} ${colors.bg} ${slot.is_mps_trigger ? "ring-2 ring-offset-1 ring-indigo-300" : ""} cursor-pointer transition-transform hover:scale-150 relative z-10`}
                  title={`${minToDisplay(slot.time)} - ${fueling?.name}`}>
                  <span className="text-[8px] flex items-center justify-center h-full">{fueling?.emoji}</span>
                </div>
                {/* Tooltip */}
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-gray-900 text-white text-xs rounded-lg p-2.5 z-30 shadow-xl pointer-events-none">
                  <div className="font-semibold">{minToDisplay(slot.time)}</div>
                  <div className="text-gray-300 mt-0.5">{fueling?.name}</div>
                  {slot.is_mps_trigger && <div className="text-indigo-300 mt-1 text-[10px] font-semibold">MPS Trigger</div>}
                  {slot.is_post_workout && <div className="text-purple-300 text-[10px]">Post-Workout</div>}
                  {slot.is_bedtime_eaa && <div className="text-violet-300 text-[10px]">Bedtime EAA</div>}
                  {!fueling?.stabilizes_blood_sugar && <div className="text-red-300 text-[10px]">Does NOT control blood sugar</div>}
                  {slot.reasons?.map((r, ri) => (
                    <div key={ri} className={`mt-0.5 text-[10px] ${r.status === "fail" ? "text-red-300" : r.status === "warn" ? "text-amber-300" : "text-emerald-300"}`}>
                      {r.rule === "mps_gap" ? `MPS gap: ${Math.floor(r.gap_minutes/60)}h ${r.gap_minutes%60}m` :
                       r.rule === "blood_sugar_gap" ? `BS gap: ${Math.floor(r.gap_minutes/60)}h ${r.gap_minutes%60}m` :
                       r.rule === "anabolic_window" ? `${r.minutes_post_workout}min post-workout` :
                       r.rule === "eaa_note" ? "EAA: MPS only, no BS control" :
                       r.rule === "bedtime_eaa" ? "Bedtime MPS boost" :
                       r.rule === "sleep_buffer" ? `${r.minutes}min before bed` : r.rule}
                    </div>
                  ))}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Slot time labels */}
        <div className="relative h-8 text-[9px] text-gray-500 font-medium">
          {slots.map((slot, i) => (
            <div key={i} className="absolute -translate-x-1/2 text-center leading-tight" style={{ left: `${pct(slot.time)}%` }}>
              {minToDisplay(slot.time).replace(":00 ", " ")}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[10px] text-gray-500 border-t pt-3">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Good</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Warning</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Issue</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full ring-2 ring-indigo-300 ring-offset-1 bg-gray-200 inline-block" /> MPS</span>
          <span className="flex items-center gap-1"><span className="w-5 h-2.5 rounded bg-purple-100 border border-purple-400 inline-block" /> Workout</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SLOT LIST (Detailed Schedule)
// ============================================================
function SlotList({ result }) {
  const { slots, workout } = result;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3">
        <h2 className="text-white text-sm font-semibold flex items-center gap-2">{"\uD83C\uDF7D\uFE0F"} Your Fueling Schedule</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {slots.map((slot, i) => {
          const fueling = getFuelingById(slot.fueling_id);
          const colors = STATUS_COLORS[slot.status];
          const prevSlot = i > 0 ? slots[i - 1] : null;
          const gap = prevSlot ? slot.time - prevSlot.time : null;

          return (
            <div key={i}>
              {/* Gap indicator */}
              {gap !== null && (
                <div className="flex items-center justify-center py-1 bg-gray-50/80">
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <div className="w-6 h-px bg-gray-300" />
                    {Math.floor(gap / 60)}h {gap % 60}m
                    {slot.is_mps_trigger && prevSlot?.is_mps_trigger && (
                      <span className={`px-1.5 py-0.5 rounded font-bold ${gap < 210 ? "bg-red-100 text-red-600" : gap < 240 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                        MPS
                      </span>
                    )}
                    {!slot.is_mps_trigger && !prevSlot?.is_mps_trigger && getFuelingById(slot.fueling_id)?.stabilizes_blood_sugar && (
                      <span className={`px-1.5 py-0.5 rounded font-bold ${gap > 180 ? "bg-red-100 text-red-600" : gap > 170 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                        BS
                      </span>
                    )}
                    <div className="w-6 h-px bg-gray-300" />
                  </div>
                </div>
              )}

              {/* Workout marker */}
              {workout && slot.is_post_workout && (
                <div className="flex items-center gap-2 px-6 py-1.5 bg-purple-50 border-l-4 border-purple-400">
                  <span className="text-sm">{"\uD83C\uDFCB\uFE0F"}</span>
                  <span className="text-[11px] font-medium text-purple-700">
                    Workout ends at {minToDisplay(workout.end_min)}
                  </span>
                  <span className="text-[10px] text-purple-500 ml-auto">
                    Anabolic window: {minToDisplay(workout.anabolic_deadline)}
                  </span>
                </div>
              )}

              {/* Slot row */}
              <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                {/* Status dot */}
                <div className={`w-3 h-3 rounded-full ${colors.dot} shadow-md flex-shrink-0`} />

                {/* Meal number */}
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                  {i + 1}
                </div>

                {/* Time */}
                <div className="w-20 flex-shrink-0">
                  <div className="text-sm font-semibold text-gray-800">{minToDisplay(slot.time)}</div>
                </div>

                {/* Fueling info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{fueling?.emoji}</span>
                    <span className="text-sm font-medium text-gray-800">{fueling?.name}</span>
                    {slot.is_mps_trigger && (
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold">MPS</span>
                    )}
                    {slot.is_post_workout && (
                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold">POST-WO</span>
                    )}
                    {slot.is_bedtime_eaa && (
                      <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-bold">BEDTIME</span>
                    )}
                    {slot.pushed && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">SHIFTED</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {fueling?.protein_grams ? `${fueling.protein_grams}g protein` : "Variable protein"}
                    {!fueling?.stabilizes_blood_sugar && " \u2022 MPS only (no blood sugar control)"}
                  </div>
                </div>

                {/* Status badge */}
                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${colors.bg} ${colors.text} flex-shrink-0`}>
                  {slot.status === "green" ? "\u2713" : slot.status === "yellow" ? "\u26A0" : "\u2717"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// SUMMARY DASHBOARD
// ============================================================
function Summary({ result }) {
  const { summary, conflicts } = result;

  const headerGradient = summary.overall_status === "green"
    ? "from-emerald-500 to-green-500"
    : summary.overall_status === "yellow"
    ? "from-amber-500 to-orange-500"
    : "from-red-500 to-rose-500";

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className={`px-6 py-3 bg-gradient-to-r ${headerGradient}`}>
        <h2 className="text-white text-sm font-semibold flex items-center gap-2">
          {summary.overall_status === "green" ? "\u2705" : summary.overall_status === "yellow" ? "\u26A0\uFE0F" : "\u274C"}{" "}
          {STATUS_LABELS[summary.overall_status]}
        </h2>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="MPS Triggers" value={summary.mps_count} icon={"\uD83D\uDCAA"} tip={TOOLTIPS.mps} />
          <StatCard label="Total Fuelings" value={summary.total_fuelings} icon={"\uD83C\uDF7D\uFE0F"}
            subtitle={summary.total_with_eaa > summary.total_fuelings ? `+ ${summary.total_with_eaa - summary.total_fuelings} EAA` : undefined} />
          <StatCard label="Longest BS Gap"
            value={summary.longest_blood_sugar_gap ? `${Math.floor(summary.longest_blood_sugar_gap / 60)}h ${summary.longest_blood_sugar_gap % 60}m` : "N/A"}
            icon={"\uD83E\uDE78"} warn={summary.longest_blood_sugar_gap > 180} tip={TOOLTIPS.blood_sugar} />
          <StatCard label="Shortest MPS Gap"
            value={summary.shortest_mps_gap ? `${Math.floor(summary.shortest_mps_gap / 60)}h ${summary.shortest_mps_gap % 60}m` : "N/A"}
            icon={"\u23F1\uFE0F"} warn={summary.shortest_mps_gap !== null && summary.shortest_mps_gap < 240} />
        </div>

        {summary.anabolic_window_hit !== null && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs font-medium ${summary.anabolic_window_hit ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {summary.anabolic_window_hit ? "\u2705 Post-workout fueling hits the 30-min anabolic window" : "\u274C Post-workout fueling misses the anabolic window"}
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {conflicts.map((c, i) => (
              <div key={i} className={`p-2.5 rounded-xl text-xs ${c.severity === "red" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                {"\u26A0\uFE0F"} MPS slots {c.slot_a_index + 1} & {c.slot_b_index + 1} are only {Math.floor(c.gap_minutes / 60)}h {c.gap_minutes % 60}m apart (need 4h+)
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, warn, tip, subtitle }) {
  return (
    <div className={`p-3 rounded-xl border ${warn ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <span className="text-base">{icon}</span>
        {tip && <InfoTip text={tip} />}
      </div>
      <div className={`text-lg font-bold mt-1 ${warn ? "text-amber-700" : "text-gray-800"}`}>
        {value}
        {subtitle && <span className="text-xs font-normal text-indigo-500 ml-1">{subtitle}</span>}
      </div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

// ============================================================
// CONFLICT RESOLUTION PANEL
// ============================================================
function ConflictPanel({ conflicts, profile, setProfile, goal }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-amber-300 overflow-hidden animate-fadeIn">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3">
        <h2 className="text-white text-sm font-semibold">{"\u26A1"} Timing Conflict</h2>
      </div>
      <div className="p-5">
        <p className="text-xs text-gray-600 mb-3">
          Your workout timing creates a conflict between the anabolic window and MPS spacing. Choose how to resolve it:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { key: "performance", emoji: "\uD83C\uDFCB\uFE0F", label: "Build Muscle", desc: "Hit the 30-min window. MPS gap may shrink." },
            { key: "metabolic", emoji: "\uD83D\uDD25", label: "Burn Fat", desc: "Keep strict 4h MPS. Window may be missed." },
            { key: "preload", emoji: "\uD83E\uDDE0", label: "Smart Pre-Load", desc: "Fueling before + EAA after workout." },
          ].map(opt => (
            <button key={opt.key} onClick={() => setProfile(p => ({ ...p, priority_mode: opt.key }))}
              className={`p-3 rounded-xl text-left border-2 transition-all ${profile.priority_mode === opt.key
                ? "border-indigo-400 bg-indigo-50 shadow-md"
                : "border-gray-200 hover:border-gray-300"}`}>
              <div className="text-lg mb-1">{opt.emoji}</div>
              <div className="text-xs font-semibold text-gray-800">{opt.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP
// ============================================================
// ============================================================
// WHAT-IF LOGIC: applies toggles to base profile/workout
// activeWhatIfs is a plain object like { wake_earlier: true, workout_later: true }
// ============================================================
function applyWhatIfs(baseProfile, baseWorkout, activeWhatIfs) {
  let profile = { ...baseProfile };
  let workout = baseWorkout ? { ...baseWorkout } : null;

  // Only apply keys that are truthy (toggled ON)
  if (activeWhatIfs.wake_earlier) {
    const cur = timeToMin(profile.wake_time);
    profile.wake_time = minToTime(Math.max(240, cur - 30));
  }
  if (activeWhatIfs.wake_later) {
    const cur = timeToMin(profile.wake_time);
    profile.wake_time = minToTime(cur + 30);
  }
  if (activeWhatIfs.sleep_later) {
    const cur = timeToMin(profile.sleep_time);
    profile.sleep_time = minToTime(Math.min(1440 - 30, cur + 60));
  }
  if (activeWhatIfs.add_workout && !workout) {
    workout = { start_time: "08:00", duration_minutes: 60 };
  }
  if (activeWhatIfs.workout_earlier && workout) {
    const cur = timeToMin(workout.start_time);
    workout = { ...workout, start_time: minToTime(Math.max(timeToMin(profile.wake_time) + 60, cur - 60)) };
  }
  if (activeWhatIfs.workout_later && workout) {
    const cur = timeToMin(workout.start_time);
    workout = { ...workout, start_time: minToTime(Math.min(timeToMin(profile.sleep_time) - 120, cur + 60)) };
  }
  if (activeWhatIfs.no_workout) {
    workout = null;
  }
  if (activeWhatIfs.athlete_mode) {
    profile.athlete_mode = !profile.athlete_mode;
  }

  return { profile, workout };
}

// Default profile values for reset
const DEFAULT_PROFILE = {
  plan_type: "5&1",
  wake_time: "06:30",
  sleep_time: "22:00",
  priority_mode: "performance",
  athlete_mode: false,
  lg_preferred_time: "18:00",
};

export default function App() {
  const [baseProfile, setBaseProfile] = useState({ ...DEFAULT_PROFILE });
  const [baseWorkout, setBaseWorkout] = useState(null);
  const [goal, setGoal] = useState("balanced");
  const [activeWhatIfs, setActiveWhatIfs] = useState({});

  // Toggle a what-if on/off (plain object for reliable React state updates)
  const toggleWhatIf = (key) => {
    setActiveWhatIfs(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const clearWhatIfs = () => setActiveWhatIfs({});

  // Full reset to defaults
  const resetAll = () => {
    setBaseProfile({ ...DEFAULT_PROFILE });
    setBaseWorkout(null);
    setGoal("balanced");
    setActiveWhatIfs({});
  };

  // Compute effective profile/workout with what-ifs applied
  const { profile, workout } = useMemo(
    () => applyWhatIfs(baseProfile, baseWorkout, activeWhatIfs),
    [baseProfile, baseWorkout, activeWhatIfs]
  );

  const result = useMemo(() => {
    try {
      return solve(profile, workout);
    } catch (e) {
      console.error("Solver error:", e);
      return null;
    }
  }, [profile, workout]);

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">{"\u26A0\uFE0F"}</div>
          <div className="text-sm">Error generating schedule. Check your settings.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-lg shadow-lg">
              {"\uD83C\uDF4F"}
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">MPS Optimal Fueling</h1>
              <p className="text-[10px] text-gray-500">{PLAN_TEMPLATES[profile.plan_type].label} &middot; {GOAL_MODES[goal].label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={resetAll}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-300 transition-all">
              {"\uD83D\uDD04"} Reset
            </button>
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${STATUS_COLORS[result.summary.overall_status].bg} ${STATUS_COLORS[result.summary.overall_status].text}`}>
              {result.summary.overall_status === "green" ? "\u2705" : result.summary.overall_status === "yellow" ? "\u26A0\uFE0F" : "\u274C"}{" "}
              {STATUS_LABELS[result.summary.overall_status]}
            </div>
          </div>
        </div>
      </header>

      {/* What-If Active Banner */}
      {Object.values(activeWhatIfs).some(v => v) && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-indigo-700 flex-wrap">
            <span className="font-bold">{"\uD83E\uDD14"} What-If Preview:</span>
            {Object.entries(activeWhatIfs).filter(([,v]) => v).map(([k]) => (
              <span key={k} className="px-2 py-0.5 bg-indigo-100 rounded-full text-[10px] font-semibold">{k.replace(/_/g, " ")}</span>
            ))}
          </div>
          <button onClick={clearWhatIfs}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
            Clear all
          </button>
        </div>
      )}

      {/* Main Layout */}
      <main className="max-w-7xl mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Setup */}
        <div className="lg:col-span-4 space-y-5">
          <SetupPanel profile={baseProfile} setProfile={setBaseProfile} workout={baseWorkout} setWorkout={setBaseWorkout} goal={goal} setGoal={setGoal} />
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-8 space-y-5">
          {/* Conflict Resolution */}
          {result.conflicts.length > 0 && (
            <ConflictPanel conflicts={result.conflicts} profile={baseProfile} setProfile={setBaseProfile} goal={goal} />
          )}

          {/* Summary */}
          <Summary result={result} />

          {/* What-If Toggles */}
          <WhatIfToggles activeWhatIfs={activeWhatIfs} toggleWhatIf={toggleWhatIf} clearWhatIfs={clearWhatIfs} hasWorkout={baseWorkout !== null} />

          {/* Timeline */}
          <Timeline result={result} />

          {/* Slot List */}
          <SlotList result={result} />
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[10px] text-gray-400">
        HFH MPS Optimal Fueling Scheduler v2.0 &middot; Built for Optavia Coaches
      </footer>
    </div>
  );
}
