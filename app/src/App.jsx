import { useState, useMemo } from "react";
import { solve, minToDisplay, minToTime, timeToMin, FUELING_TYPES, getFuelingById, PLAN_TEMPLATES } from "./solver";

// ============================================================
// STATUS COLORS
// ============================================================
const STATUS_COLORS = {
  green: { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-700", dot: "bg-emerald-500", glow: "shadow-emerald-200" },
  yellow: { bg: "bg-amber-100", border: "border-amber-400", text: "text-amber-700", dot: "bg-amber-500", glow: "shadow-amber-200" },
  red: { bg: "bg-red-100", border: "border-red-400", text: "text-red-700", dot: "bg-red-500", glow: "shadow-red-200" },
};

const STATUS_LABELS = { green: "All Clear", yellow: "Minor Deviation", red: "Needs Attention" };

// ============================================================
// SETUP PANEL
// ============================================================
function SetupPanel({ profile, setProfile, workout, setWorkout }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2">{"\u2699\uFE0F"} Profile Setup</h2>
      </div>
      <div className="p-6 space-y-5">
        {/* Plan Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Optavia Plan</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(PLAN_TEMPLATES).map((p) => (
              <button key={p} onClick={() => setProfile({ ...profile, plan_type: p })}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${profile.plan_type === p
                  ? (PLAN_TEMPLATES[p].is_glp1 ? "bg-teal-600 text-white shadow-lg shadow-teal-200 scale-105" : "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105")
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {PLAN_TEMPLATES[p].is_glp1 ? "\uD83D\uDC8A GLP-1" : p}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            {PLAN_TEMPLATES[profile.plan_type].description}
          </p>
        </div>

        {/* Wake / Sleep */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{"\uD83C\uDF05"} Wake Time</label>
            <input type="time" value={profile.wake_time}
              onChange={(e) => setProfile({ ...profile, wake_time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{"\uD83C\uDF19"} Bed Time</label>
            <input type="time" value={profile.sleep_time}
              onChange={(e) => setProfile({ ...profile, sleep_time: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        </div>

        {/* Priority Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Conflict Priority</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setProfile({ ...profile, priority_mode: "performance" })}
              className={`p-3 rounded-xl text-left transition-all ${profile.priority_mode === "performance"
                ? "bg-orange-50 border-2 border-orange-400 shadow-md"
                : "bg-gray-50 border-2 border-transparent hover:border-gray-200"}`}>
              <div className="text-sm font-semibold">{"\uD83C\uDFCB\uFE0F"} Performance</div>
              <div className="text-xs text-gray-500 mt-0.5">Hit the 30-min anabolic window</div>
            </button>
            <button onClick={() => setProfile({ ...profile, priority_mode: "metabolic" })}
              className={`p-3 rounded-xl text-left transition-all ${profile.priority_mode === "metabolic"
                ? "bg-blue-50 border-2 border-blue-400 shadow-md"
                : "bg-gray-50 border-2 border-transparent hover:border-gray-200"}`}>
              <div className="text-sm font-semibold">{"\u2696\uFE0F"} Metabolic</div>
              <div className="text-xs text-gray-500 mt-0.5">Keep 4-hour MPS spacing</div>
            </button>
          </div>
        </div>

        {/* Athlete Mode */}
        <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
          <input type="checkbox" checked={profile.athlete_mode}
            onChange={(e) => setProfile({ ...profile, athlete_mode: e.target.checked })}
            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
          <div>
            <div className="text-sm font-medium text-gray-700">{"\uD83D\uDCAA"} Athlete Mode</div>
            <div className="text-xs text-gray-500">Add bedtime EAA as 4th MPS trigger</div>
          </div>
        </label>

        {/* Workout */}
        <div className="border-t pt-4">
          <label className="flex items-center gap-3 mb-3 cursor-pointer">
            <input type="checkbox" checked={workout !== null}
              onChange={(e) => setWorkout(e.target.checked ? { start_time: "15:00", duration_minutes: 60 } : null)}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
            <span className="text-sm font-medium text-gray-700">{"\uD83C\uDFBD"} Include Workout</span>
          </label>
          {workout && (
            <div className="grid grid-cols-2 gap-4 pl-8">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
                <input type="time" value={workout.start_time}
                  onChange={(e) => setWorkout({ ...workout, start_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                <input type="number" value={workout.duration_minutes} min={15} max={180} step={15}
                  onChange={(e) => setWorkout({ ...workout, duration_minutes: parseInt(e.target.value) || 60 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}
        </div>
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

  const pct = (min) => ((min - wakeMin) / range) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2">{"\uD83D\uDCC5"} Daily Timeline</h2>
      </div>
      <div className="p-6">
        {/* Timeline bar */}
        <div className="relative h-16 mb-2">
          {/* Base bar */}
          <div className="absolute top-7 left-0 right-0 h-2 bg-gray-200 rounded-full" />

          {/* Workout block */}
          {workout && (
            <div className="absolute top-5 h-6 bg-purple-200 border-2 border-purple-400 rounded-lg opacity-70 flex items-center justify-center"
              style={{ left: `${pct(timeToMin(workout.start_time))}%`, width: `${(workout.duration_minutes / range) * 100}%` }}>
              <span className="text-[9px] font-bold text-purple-700">{"\uD83C\uDFCB\uFE0F"} WORKOUT</span>
            </div>
          )}

          {/* Slot markers */}
          {slots.map((slot, i) => {
            const colors = STATUS_COLORS[slot.status];
            const fueling = getFuelingById(slot.fueling_id);
            return (
              <div key={i} className="absolute -translate-x-1/2 group" style={{ left: `${pct(slot.time)}%`, top: 0 }}>
                <div className={`w-5 h-5 rounded-full border-2 ${colors.border} ${colors.bg} ${slot.is_mps_trigger ? "ring-2 ring-offset-1 ring-indigo-300" : ""} cursor-pointer transition-transform hover:scale-125`}
                  title={`${minToDisplay(slot.time)} - ${fueling?.name}`}>
                  <span className="text-[8px] flex items-center justify-center h-full">{fueling?.emoji}</span>
                </div>
                {/* Tooltip */}
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-gray-900 text-white text-xs rounded-lg p-2 z-20 shadow-xl">
                  <div className="font-semibold">{minToDisplay(slot.time)}</div>
                  <div className="text-gray-300">{fueling?.name}</div>
                  {slot.is_mps_trigger && <div className="text-indigo-300 mt-1">MPS Trigger</div>}
                  {slot.is_post_workout && <div className="text-purple-300">Post-Workout</div>}
                  {slot.reasons?.map((r, ri) => (
                    <div key={ri} className={`mt-0.5 ${r.status === "fail" ? "text-red-300" : r.status === "warn" ? "text-amber-300" : "text-emerald-300"}`}>
                      {r.rule.replace(/_/g, " ")}: {r.gap_minutes || r.minutes_post_workout || r.minutes}min
                    </div>
                  ))}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Time labels */}
        <div className="relative h-5 text-[10px] text-gray-400">
          {slots.map((slot, i) => (
            <div key={i} className="absolute -translate-x-1/2" style={{ left: `${pct(slot.time)}%` }}>
              {minToDisplay(slot.time).replace(":00 ", " ")}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-600">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Green = All good</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Yellow = Minor issue</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Red = Needs fix</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full ring-2 ring-indigo-300 ring-offset-1 bg-gray-200 inline-block" /> = MPS Trigger</span>
          <span className="flex items-center gap-1"><span className="w-6 h-3 rounded bg-purple-200 border border-purple-400 inline-block" /> = Workout</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SLOT LIST (DETAILED VIEW)
// ============================================================
function SlotList({ result }) {
  const { slots, workout } = result;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2">{"\uD83C\uDF7D\uFE0F"} Fueling Schedule</h2>
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
                <div className="flex items-center justify-center py-1.5 bg-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <div className="w-8 h-px bg-gray-300" />
                    {Math.floor(gap / 60)}h {gap % 60}m gap
                    {slot.is_mps_trigger && prevSlot?.is_mps_trigger && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${gap < 210 ? "bg-red-100 text-red-600" : gap < 240 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                        MPS Gap
                      </span>
                    )}
                    <div className="w-8 h-px bg-gray-300" />
                  </div>
                </div>
              )}

              {/* Workout marker */}
              {workout && slot.is_post_workout && (
                <div className="flex items-center gap-2 px-6 py-2 bg-purple-50 border-l-4 border-purple-400">
                  <span className="text-sm">{"\uD83C\uDFCB\uFE0F"}</span>
                  <span className="text-xs font-medium text-purple-700">
                    Workout: {minToDisplay(timeToMin(workout.start_time))} - {minToDisplay(workout.end_min)}
                  </span>
                  <span className="text-xs text-purple-500 ml-auto">
                    Anabolic window closes at {minToDisplay(workout.anabolic_deadline)}
                  </span>
                </div>
              )}

              {/* Slot row */}
              <div className={`flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors`}>
                {/* Status dot */}
                <div className={`w-3.5 h-3.5 rounded-full ${colors.dot} shadow-lg ${colors.glow} flex-shrink-0`} />

                {/* Time */}
                <div className="w-24 flex-shrink-0">
                  <div className="text-sm font-semibold text-gray-800">{minToDisplay(slot.time)}</div>
                </div>

                {/* Fueling info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{fueling?.emoji}</span>
                    <span className="text-sm font-medium text-gray-800 truncate">{fueling?.name}</span>
                    {slot.is_mps_trigger && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold flex-shrink-0">
                        MPS
                      </span>
                    )}
                    {slot.is_post_workout && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold flex-shrink-0">
                        POST-WO
                      </span>
                    )}
                    {slot.is_bedtime_eaa && (
                      <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-bold flex-shrink-0">
                        BEDTIME
                      </span>
                    )}
                    {slot.pushed && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold flex-shrink-0">
                        PUSHED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {fueling?.protein_grams ? `${fueling.protein_grams}g protein` : "Variable protein"} &middot; {fueling?.stabilizes_blood_sugar ? "stabilizes blood sugar" : "MPS only (no BS control)"}
                  </div>
                </div>

                {/* Status label */}
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${colors.bg} ${colors.text} flex-shrink-0`}>
                  {slot.status === "green" ? "\u2713" : slot.status === "yellow" ? "\u26A0" : "\u2717"} {STATUS_LABELS[slot.status]}
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
  const overallColors = STATUS_COLORS[summary.overall_status];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      <div className={`px-6 py-4 ${summary.overall_status === "green" ? "bg-gradient-to-r from-emerald-500 to-green-500" : summary.overall_status === "yellow" ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-red-500 to-rose-500"}`}>
        <h2 className="text-white text-lg font-semibold flex items-center gap-2">
          {summary.overall_status === "green" ? "\u2705" : summary.overall_status === "yellow" ? "\u26A0\uFE0F" : "\u274C"}{" "}
          Schedule Status: {STATUS_LABELS[summary.overall_status]}
        </h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="MPS Triggers" value={summary.mps_count} icon={"\uD83D\uDCAA"} />
          <StatCard label="Total Fuelings" value={summary.total_fuelings} icon={"\uD83C\uDF7D\uFE0F"} />
          <StatCard label="Longest BS Gap" value={`${Math.floor(summary.longest_blood_sugar_gap / 60)}h ${summary.longest_blood_sugar_gap % 60}m`}
            icon={"\uD83E\uDE78"} warn={summary.longest_blood_sugar_gap > 210} />
          <StatCard label="Shortest MPS Gap" value={summary.shortest_mps_gap ? `${Math.floor(summary.shortest_mps_gap / 60)}h ${summary.shortest_mps_gap % 60}m` : "N/A"}
            icon={"\u23F1\uFE0F"} warn={summary.shortest_mps_gap !== null && summary.shortest_mps_gap < 240} />
        </div>

        {summary.anabolic_window_hit !== null && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${summary.anabolic_window_hit ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {summary.anabolic_window_hit ? "\u2705 Post-workout fueling hits the 30-min anabolic window" : "\u274C Post-workout fueling misses the 30-min anabolic window (pushed for MPS spacing)"}
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Conflicts</h3>
            {conflicts.map((c, i) => (
              <div key={i} className={`p-3 rounded-xl text-sm ${c.severity === "red" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                {"\u26A0\uFE0F"} MPS triggers at slots {c.slot_a_index + 1} and {c.slot_b_index + 1} are only {Math.floor(c.gap_minutes / 60)}h {c.gap_minutes % 60}m apart (need 4h+)
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, warn }) {
  return (
    <div className={`p-3 rounded-xl border ${warn ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"}`}>
      <div className="text-lg mb-1">{icon}</div>
      <div className={`text-xl font-bold ${warn ? "text-amber-700" : "text-gray-800"}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

// ============================================================
// CONFLICT MODAL
// ============================================================
function ConflictModal({ conflicts, onSelectPriority, currentPriority }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-amber-300 overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
        <h2 className="text-white text-lg font-semibold">{"\u26A1"} Timing Conflict Detected</h2>
      </div>
      <div className="p-6">
        <p className="text-sm text-gray-700 mb-4">
          Your workout creates a conflict between your anabolic window and MPS spacing. How should the scheduler resolve it?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={() => onSelectPriority("performance")}
            className={`p-4 rounded-xl text-left border-2 transition-all ${currentPriority === "performance" ? "border-orange-400 bg-orange-50 shadow-lg" : "border-gray-200 hover:border-gray-300"}`}>
            <div className="text-base font-semibold mb-1">{"\uD83C\uDFCB\uFE0F"} Performance Mode</div>
            <div className="text-xs text-gray-600">
              Hit the 30-min anabolic window. MPS gap may be shorter than 4 hours. Best for muscle building focus.
            </div>
          </button>
          <button onClick={() => onSelectPriority("metabolic")}
            className={`p-4 rounded-xl text-left border-2 transition-all ${currentPriority === "metabolic" ? "border-blue-400 bg-blue-50 shadow-lg" : "border-gray-200 hover:border-gray-300"}`}>
            <div className="text-base font-semibold mb-1">{"\u2696\uFE0F"} Metabolic Mode</div>
            <div className="text-xs text-gray-600">
              Keep 4-hour MPS spacing strict. Post-workout fueling may be pushed past the 30-min window. Best for fat loss focus.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const [profile, setProfile] = useState({
    plan_type: "5&1",
    wake_time: "06:00",
    sleep_time: "22:00",
    priority_mode: "performance",
    athlete_mode: false,
  });

  const [workout, setWorkout] = useState(null);

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
          <div>Error generating schedule. Check your settings.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-purple-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              {"\uD83C\uDF4F"}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">MPS Optimal Fueling</h1>
              <p className="text-xs text-gray-500">Scheduler &middot; {PLAN_TEMPLATES[profile.plan_type].label}</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-semibold ${STATUS_COLORS[result.summary.overall_status].bg} ${STATUS_COLORS[result.summary.overall_status].text}`}>
            {result.summary.overall_status === "green" ? "\u2705" : result.summary.overall_status === "yellow" ? "\u26A0\uFE0F" : "\u274C"}{" "}
            {STATUS_LABELS[result.summary.overall_status]}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Setup */}
        <div className="lg:col-span-1 space-y-6">
          <SetupPanel profile={profile} setProfile={setProfile} workout={workout} setWorkout={setWorkout} />
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Conflict Resolution (only shows when relevant) */}
          {result.conflicts.length > 0 && (
            <ConflictModal
              conflicts={result.conflicts}
              currentPriority={profile.priority_mode}
              onSelectPriority={(mode) => setProfile({ ...profile, priority_mode: mode })} />
          )}

          {/* Summary */}
          <Summary result={result} />

          {/* Timeline */}
          <Timeline result={result} />

          {/* Slot List */}
          <SlotList result={result} />
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-gray-400">
        HFH Optimal Fueling Scheduler v1.0 &middot; Built for Optavia Coaches
      </footer>
    </div>
  );
}
