import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { solve, minToDisplay, minToTime, timeToMin, FUELING_TYPES, getFuelingById, PLAN_TEMPLATES, GOAL_MODES, TOOLTIPS } from "./solver";

// ============================================================
// STATUS COLORS & LABELS
// ============================================================
const STATUS_COLORS = {
  green: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500", ring: "ring-emerald-200" },
  yellow: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", dot: "bg-amber-500", ring: "ring-amber-200" },
  red: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", dot: "bg-red-500", ring: "ring-red-200" },
};

// ============================================================
// PLAN CATEGORY GROUPS
// ============================================================
const PLAN_CATEGORIES = [
  { key: "weight_loss", label: "Weight Loss", color: "#4f46e5", plans: ["5&1", "5&1A", "4&2&1", "4&2A"] },
  { key: "maintenance", label: "Maintenance", color: "#0d9488", plans: ["3&3", "3&3A"] },
  { key: "glp1", label: "GLP-1 Support", color: "#7c3aed", plans: ["GLP1"] },
  { key: "optimization", label: "Optimization", color: "#c026d3", plans: ["OPT"] },
];

// Default profile values
const DEFAULT_PROFILE = {
  plan_type: "5&1",
  wake_time: "06:30",
  sleep_time: "22:00",
  priority_mode: "performance",
  athlete_mode: false,
  lg_preferred_time: "18:00",
};

// ============================================================
// TOOLTIP COMPONENT (Inline help)
// ============================================================
function InfoTip({ text }) {
  const [show, setShow] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!show) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    };
    document.addEventListener("touchstart", handler);
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("mousedown", handler);
    };
  }, [show]);

  return (
    <span className="relative inline-block ml-1" ref={ref}>
      <button type="button" onClick={() => setShow(!show)}
        className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold inline-flex items-center justify-center hover:bg-indigo-100 hover:text-indigo-600 transition-colors cursor-help">
        ?
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-2xl leading-relaxed">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </span>
  );
}

// ============================================================
// STEP INDICATOR (dots at top)
// ============================================================
function StepIndicator({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3">
      {Array.from({ length: total }, (_, i) => (
        <div key={i}
          className={`step-dot h-2 rounded-full transition-all duration-300 ${
            i === current ? "active bg-indigo-500 w-6" : i < current ? "bg-indigo-300 w-2" : "bg-slate-200 w-2"
          }`} />
      ))}
    </div>
  );
}

// ============================================================
// SCREEN 1: SETUP (Mobile-first card flow)
// ============================================================
function SetupScreen({ profile, setProfile, workout, setWorkout, goal, setGoal, onContinue }) {
  const template = PLAN_TEMPLATES[profile.plan_type];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 pt-6 pb-4 text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg mx-auto mb-3">
          🍏
        </div>
        <h1 className="text-xl font-bold text-slate-900">MPS Fueling Scheduler</h1>
        <p className="text-sm text-slate-500 mt-1">Let's optimize your day in a few easy steps</p>
        <StepIndicator current={0} total={2} />
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5">

        {/* CARD 1: Priorities */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-slideUp">
          <div className="px-5 pt-5 pb-2">
            <h2 className="text-base font-semibold text-slate-800">Set your priorities</h2>
            <p className="text-xs text-slate-400 mt-0.5">You can do it all — just tell us what matters most to you</p>
          </div>
          <div className="px-5 pb-4 space-y-3">
            {/* Priority 1 */}
            <div>
              <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">1</span>
                Most important to me
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(GOAL_MODES).map(([key, mode]) => {
                  const isPrimary = goal.primary === key;
                  return (
                    <button key={key} onClick={() => {
                      setGoal(prev => {
                        const newGoal = { ...prev, primary: key };
                        // If secondary is the same, clear it
                        if (prev.secondary === key) newGoal.secondary = null;
                        return newGoal;
                      });
                      setProfile(p => ({ ...p, priority_mode: mode.priority_mode }));
                      if (key === "muscle" && !workout) {
                        setWorkout({ start_time: "08:00", duration_minutes: 60 });
                      }
                    }}
                      className={`p-3 rounded-xl text-center transition-all ${isPrimary
                        ? "bg-indigo-50 border-2 border-indigo-400 shadow-md scale-[1.03]"
                        : "bg-slate-50 border-2 border-transparent hover:border-slate-200"}`}>
                      <div className="text-2xl mb-1">{mode.emoji}</div>
                      <div className="text-[11px] font-bold text-slate-800">{mode.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority 2 */}
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-300 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                Also important
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(GOAL_MODES)
                  .filter(([key]) => key !== goal.primary)
                  .map(([key, mode]) => {
                    const isSecondary = goal.secondary === key;
                    return (
                      <button key={key} onClick={() => {
                        setGoal(prev => ({ ...prev, secondary: isSecondary ? null : key }));
                        // If secondary is muscle, auto-enable workout
                        if (key === "muscle" && !workout) {
                          setWorkout({ start_time: "08:00", duration_minutes: 60 });
                        }
                      }}
                        className={`p-3 rounded-xl text-center transition-all ${isSecondary
                          ? "bg-slate-100 border-2 border-slate-400 shadow-sm scale-[1.02]"
                          : "bg-slate-50 border-2 border-transparent hover:border-slate-200"}`}>
                        <div className="text-2xl mb-1">{mode.emoji}</div>
                        <div className="text-[11px] font-bold text-slate-800">{mode.label}</div>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Description of chosen combo */}
          <div className="px-5 pb-4">
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 leading-relaxed">
              {goal.secondary
                ? `Primary: ${GOAL_MODES[goal.primary].label} — ${GOAL_MODES[goal.primary].description} Secondary: ${GOAL_MODES[goal.secondary].label}.`
                : GOAL_MODES[goal.primary].description}
            </p>
          </div>
        </div>

        {/* CARD 2: Plan */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-slideUp" style={{ animationDelay: "0.05s" }}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="text-base font-semibold text-slate-800">Which plan are you on?</h2>
            <p className="text-xs text-slate-400 mt-0.5">Select your Optavia plan</p>
          </div>
          <div className="px-5 pb-5 space-y-4">
            {PLAN_CATEGORIES.map(cat => (
              <div key={cat.key}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{cat.label}</div>
                <div className="flex flex-wrap gap-2">
                  {cat.plans.map(p => {
                    const tmpl = PLAN_TEMPLATES[p];
                    const isActive = profile.plan_type === p;
                    return (
                      <button key={p} onClick={() => setProfile(pr => ({ ...pr, plan_type: p }))}
                        className={`py-2 px-4 rounded-xl text-sm font-semibold transition-all ${isActive
                          ? "text-white shadow-lg scale-105"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        style={isActive ? { backgroundColor: cat.color } : {}}>
                        {tmpl.label.replace("Optimal Weight ", "").replace("Optimal Health ", "")}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-4">
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 flex items-start gap-2">
              <span className="text-base shrink-0">ℹ️</span>
              <span className="leading-relaxed">{template.description}</span>
            </p>
          </div>
        </div>

        {/* CARD 3: Times */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-slideUp" style={{ animationDelay: "0.1s" }}>
          <div className="px-5 pt-5 pb-2">
            <h2 className="text-base font-semibold text-slate-800">Your daily schedule</h2>
            <p className="text-xs text-slate-400 mt-0.5">When does your day start and end?</p>
          </div>
          <div className="px-5 pb-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">🌅 Wake up</label>
                <input type="time" value={profile.wake_time}
                  onChange={(e) => setProfile(p => ({ ...p, wake_time: e.target.value }))}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">🌙 Bedtime</label>
                <input type="time" value={profile.sleep_time}
                  onChange={(e) => setProfile(p => ({ ...p, sleep_time: e.target.value }))}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors" />
              </div>
            </div>

            {template.lean_green_count > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  🥗 Preferred Lean & Green time
                  <InfoTip text="Most people eat their Lean & Green as dinner (4-7 PM). We'll schedule your protein meal around this time." />
                </label>
                <input type="time" value={profile.lg_preferred_time || "18:00"}
                  onChange={(e) => setProfile(p => ({ ...p, lg_preferred_time: e.target.value }))}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors" />
              </div>
            )}
          </div>
        </div>

        {/* CARD 4: Workout */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-slideUp" style={{ animationDelay: "0.15s" }}>
          <div className="px-5 pt-5 pb-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-12 h-7 rounded-full transition-colors relative ${workout ? "bg-indigo-500" : "bg-slate-200"}`}
                onClick={() => setWorkout(workout ? null : { start_time: "08:00", duration_minutes: 60 })}>
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${workout ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-800">Working out today?</div>
                <div className="text-xs text-slate-400">We'll add a post-workout protein window</div>
              </div>
              <InfoTip text={TOOLTIPS.anabolic} />
            </label>
          </div>
          {workout && (
            <div className="px-5 pb-5 grid grid-cols-2 gap-3 animate-fadeIn">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">🏋️ Start time</label>
                <input type="time" value={workout.start_time}
                  onChange={(e) => setWorkout(w => ({ ...w, start_time: e.target.value }))}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">⏱ Duration</label>
                <select value={workout.duration_minutes}
                  onChange={(e) => setWorkout(w => ({ ...w, duration_minutes: parseInt(e.target.value) }))}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors">
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

        {/* CARD 5: Athlete Mode */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-slideUp" style={{ animationDelay: "0.2s" }}>
          <div className="px-5 py-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-12 h-7 rounded-full transition-colors relative ${profile.athlete_mode ? "bg-indigo-500" : "bg-slate-200"}`}
                onClick={() => setProfile(p => ({ ...p, athlete_mode: !p.athlete_mode }))}>
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${profile.athlete_mode ? "translate-x-5" : "translate-x-0.5"}`} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-800">💪 Athlete Mode</div>
                <div className="text-xs text-slate-400">Add bedtime EAA for a 4th protein trigger</div>
              </div>
              <InfoTip text={TOOLTIPS.athlete_mode} />
            </label>
          </div>
        </div>

        {/* CTA Button */}
        <button onClick={onContinue}
          className="w-full py-4 rounded-2xl text-white font-bold text-base bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
          See My Schedule →
        </button>

        <div className="h-6" />
      </div>
    </div>
  );
}

// ============================================================
// SCREEN 2: SCHEDULE VIEW (Day Planner with Drag & Drop)
// ============================================================
function ScheduleScreen({ result, profile, workout, goal, onBack, onEdit, activeWhatIfs, toggleWhatIf, clearWhatIfs, baseWorkout }) {
  const { slots, summary, conflicts } = result;
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [expandedSlot, setExpandedSlot] = useState(null);

  // Touch drag state
  const touchStartY = useRef(null);
  const touchSlotIdx = useRef(null);
  const longPressTimer = useRef(null);

  // Status banner
  const statusConfig = {
    green: { label: "All Clear! Your schedule is optimized.", icon: "✅", bg: "bg-emerald-500" },
    yellow: { label: "Almost there — minor adjustments possible.", icon: "⚠️", bg: "bg-amber-500" },
    red: { label: "Needs attention — see flagged items below.", icon: "🔴", bg: "bg-red-500" },
  };
  const status = statusConfig[summary.overall_status];

  // What-If scenarios
  const scenarios = [
    { key: "wake_earlier", label: "Wake 30m earlier", emoji: "⏰", show: true },
    { key: "wake_later", label: "Wake 30m later", emoji: "💤", show: true },
    { key: "sleep_later", label: "Stay up 1h later", emoji: "🌙", show: true },
    { key: "add_workout", label: "Add workout", emoji: "🏋️", show: !baseWorkout },
    { key: "workout_earlier", label: "Workout earlier", emoji: "⏪", show: !!baseWorkout },
    { key: "workout_later", label: "Workout later", emoji: "⏩", show: !!baseWorkout },
    { key: "no_workout", label: "Skip workout", emoji: "❌", show: !!baseWorkout },
    { key: "athlete_mode", label: "Athlete Mode", emoji: "💪", show: true },
  ];
  const visibleScenarios = scenarios.filter(s => s.show);
  const anyWhatIfActive = Object.values(activeWhatIfs).some(v => v);

  // Drag handlers (HTML5 for desktop)
  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx.toString());
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== dragIdx) setDragOverIdx(idx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    // For now, reordering just swaps visual position
    // In a future version this would adjust times
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // Touch handlers for mobile drag
  const handleTouchStart = (e, idx) => {
    touchSlotIdx.current = idx;
    touchStartY.current = e.touches[0].clientY;
    // Long press to initiate drag
    longPressTimer.current = setTimeout(() => {
      setDragIdx(idx);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 400);
  };

  const handleTouchMove = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setDragIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-indigo-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Setup
          </button>
          <div className="text-center">
            <div className="text-sm font-bold text-slate-800">Your Schedule</div>
            <div className="text-[10px] text-slate-400">{PLAN_TEMPLATES[profile.plan_type].label} · {GOAL_MODES[goal.primary].label}</div>
          </div>
          <button onClick={onEdit}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all">
            🔄
          </button>
        </div>
        <StepIndicator current={1} total={2} />
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {/* Status Banner */}
        <div className={`${status.bg} rounded-2xl px-5 py-4 text-white animate-slideUp`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{status.icon}</span>
            <div>
              <div className="font-semibold text-sm">{status.label}</div>
              <div className="text-xs opacity-80 mt-0.5">
                {summary.mps_count} protein triggers · {summary.total_fuelings} fuelings
                {summary.total_with_eaa > summary.total_fuelings && ` + ${summary.total_with_eaa - summary.total_fuelings} EAA`}
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="flex gap-3 mt-3 pt-3 border-t border-white/20">
            <div className="flex-1 text-center">
              <div className="text-lg font-bold">
                {summary.shortest_mps_gap ? `${Math.floor(summary.shortest_mps_gap / 60)}h${summary.shortest_mps_gap % 60 > 0 ? `${summary.shortest_mps_gap % 60}m` : ""}` : "—"}
              </div>
              <div className="text-[10px] opacity-70">Protein gap</div>
            </div>
            <div className="w-px bg-white/20" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold">
                {summary.longest_blood_sugar_gap ? `${Math.floor(summary.longest_blood_sugar_gap / 60)}h${summary.longest_blood_sugar_gap % 60 > 0 ? `${summary.longest_blood_sugar_gap % 60}m` : ""}` : "—"}
              </div>
              <div className="text-[10px] opacity-70">Longest BS gap</div>
            </div>
            {summary.anabolic_window_hit !== null && (
              <>
                <div className="w-px bg-white/20" />
                <div className="flex-1 text-center">
                  <div className="text-lg font-bold">{summary.anabolic_window_hit ? "✓" : "✗"}</div>
                  <div className="text-[10px] opacity-70">Post-workout</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 animate-slideUp">
            <div className="text-sm font-semibold text-amber-800 mb-2">⚡ Timing Conflict</div>
            <p className="text-xs text-amber-700 mb-3">
              Your workout creates a conflict between the anabolic window and protein spacing.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "performance", emoji: "🏋️", label: "Muscle first", desc: "Hit 30-min window" },
                { key: "metabolic", emoji: "🔥", label: "Fat burn first", desc: "Keep 4h spacing" },
                { key: "preload", emoji: "🧠", label: "Smart Pre-Load", desc: "Fuel before + EAA after" },
              ].map(opt => (
                <button key={opt.key} onClick={() => onEdit("priority", opt.key)}
                  className={`p-3 rounded-xl text-center border-2 transition-all ${profile.priority_mode === opt.key
                    ? "border-indigo-400 bg-indigo-50 shadow-md"
                    : "border-slate-200 hover:border-slate-300 bg-white"}`}>
                  <div className="text-xl mb-1">{opt.emoji}</div>
                  <div className="text-[11px] font-bold text-slate-800">{opt.label}</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* What-If Toggles */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-slideUp" style={{ animationDelay: "0.05s" }}>
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm">🤔</span>
              <span className="text-xs font-semibold text-slate-700">What if...</span>
            </div>
            {anyWhatIfActive && (
              <button onClick={clearWhatIfs}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold">
                Clear all
              </button>
            )}
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {visibleScenarios.map(s => {
              const isActive = !!activeWhatIfs[s.key];
              return (
                <button key={s.key} onClick={() => toggleWhatIf(s.key)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${isActive
                    ? "bg-indigo-500 text-white shadow-md"
                    : "bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200"}`}>
                  <span>{s.emoji}</span> {s.label}
                </button>
              );
            })}
          </div>
          {anyWhatIfActive && (
            <div className="px-4 pb-3">
              <div className="bg-indigo-50 rounded-lg px-3 py-2 flex items-center gap-2 text-[11px] text-indigo-700">
                <span className="font-bold">Preview mode:</span>
                {Object.entries(activeWhatIfs).filter(([, v]) => v).map(([k]) => (
                  <span key={k} className="px-2 py-0.5 bg-indigo-100 rounded-full font-semibold">{k.replace(/_/g, " ")}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Day Planner Schedule */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-slideUp" style={{ animationDelay: "0.1s" }}>
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span className="text-sm font-semibold text-slate-800">Your Day</span>
            </div>
            <div className="text-[10px] text-slate-400">Tap a meal for details</div>
          </div>

          <div className="schedule-scroll divide-y divide-slate-50">
            {slots.map((slot, i) => {
              const fueling = getFuelingById(slot.fueling_id);
              const colors = STATUS_COLORS[slot.status];
              const prevSlot = i > 0 ? slots[i - 1] : null;
              const gap = prevSlot ? slot.time - prevSlot.time : null;
              const isExpanded = expandedSlot === i;
              const isDragging = dragIdx === i;
              const isDragOver = dragOverIdx === i;

              return (
                <div key={i}>
                  {/* Gap between meals */}
                  {gap !== null && (
                    <div className="flex items-center justify-center py-1.5 bg-slate-50/50">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <div className="w-4 h-px bg-slate-200" />
                        <span>{Math.floor(gap / 60)}h {gap % 60 > 0 ? `${gap % 60}m` : ""}</span>
                        {/* MPS gap badge */}
                        {slot.is_mps_trigger && prevSlot?.is_mps_trigger && (
                          <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                            gap < 210 ? "bg-red-100 text-red-600" :
                            gap < 240 ? "bg-amber-100 text-amber-600" :
                            "bg-emerald-100 text-emerald-600"
                          }`}>
                            Protein
                          </span>
                        )}
                        {/* Blood sugar gap badge */}
                        {fueling?.stabilizes_blood_sugar && prevSlot && getFuelingById(prevSlot.fueling_id)?.stabilizes_blood_sugar && !slot.is_mps_trigger && !prevSlot?.is_mps_trigger && (
                          <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                            gap > 180 ? "bg-red-100 text-red-600" :
                            gap > 170 ? "bg-amber-100 text-amber-600" :
                            "bg-emerald-100 text-emerald-600"
                          }`}>
                            Blood Sugar
                          </span>
                        )}
                        <div className="w-4 h-px bg-slate-200" />
                      </div>
                    </div>
                  )}

                  {/* Workout marker */}
                  {workout && slot.is_post_workout && (
                    <div className="flex items-center gap-2 px-5 py-2 bg-purple-50 border-l-4 border-purple-400">
                      <span className="text-sm">🏋️</span>
                      <span className="text-[11px] font-medium text-purple-700">
                        Workout ends {minToDisplay(result.workout.end_min)}
                      </span>
                      <span className="text-[10px] text-purple-500 ml-auto">
                        Window: {minToDisplay(result.workout.anabolic_deadline)}
                      </span>
                    </div>
                  )}

                  {/* Slot Card */}
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, i)}
                    onTouchStart={(e) => handleTouchStart(e, i)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => setExpandedSlot(isExpanded ? null : i)}
                    className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-all active:bg-slate-50 select-none
                      ${isDragging ? "slot-dragging opacity-50" : ""}
                      ${isDragOver ? "slot-drag-over" : ""}
                      ${isExpanded ? "bg-indigo-50/30" : "hover:bg-slate-50/50"}`}
                  >
                    {/* Time column */}
                    <div className="w-14 flex-shrink-0">
                      <div className="text-[13px] font-bold text-slate-800 leading-tight">{minToDisplay(slot.time).split(" ")[0]}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{minToDisplay(slot.time).split(" ")[1]}</div>
                    </div>

                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} flex-shrink-0 ${slot.is_mps_trigger ? "ring-2 ring-offset-1 ring-indigo-200" : ""}`} />

                    {/* Meal info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1.5">
                        <span className="text-base flex-shrink-0 mt-0.5">{fueling?.emoji}</span>
                        <span className="text-[13px] font-semibold text-slate-800 leading-snug">{fueling?.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {slot.is_mps_trigger && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold">Protein Meal</span>
                        )}
                        {slot.is_post_workout && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold">Post-Workout</span>
                        )}
                        {slot.is_bedtime_eaa && (
                          <span className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-bold">Bedtime</span>
                        )}
                        {slot.pushed && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold">Shifted</span>
                        )}
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <svg className={`w-4 h-4 text-slate-300 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1 bg-indigo-50/20 animate-fadeIn">
                      <div className="ml-16 pl-7 space-y-2">
                        {/* Fueling details */}
                        <div className="text-xs text-slate-600">
                          {fueling?.protein_grams ? `${fueling.protein_grams}g protein per serving` : "Variable protein content"}
                        </div>

                        {/* Explanations */}
                        {slot.reasons?.map((r, ri) => (
                          <div key={ri} className={`text-xs flex items-start gap-2 ${
                            r.status === "fail" ? "text-red-600" :
                            r.status === "warn" ? "text-amber-600" :
                            "text-emerald-600"
                          }`}>
                            <span className="mt-0.5">{r.status === "fail" ? "✗" : r.status === "warn" ? "⚠" : "✓"}</span>
                            <span>
                              {r.rule === "mps_gap" && `Protein spacing: ${Math.floor(r.gap_minutes / 60)}h ${r.gap_minutes % 60}m (need 4h+)`}
                              {r.rule === "blood_sugar_gap" && `Blood sugar gap: ${Math.floor(r.gap_minutes / 60)}h ${r.gap_minutes % 60}m (max 3h)`}
                              {r.rule === "anabolic_window" && `${r.minutes_post_workout} min after workout (30 min window)`}
                              {r.rule === "eaa_note" && "Amino acids trigger muscle building but don't control blood sugar alone"}
                              {r.rule === "bedtime_eaa" && "Extra protein trigger before bed for overnight recovery"}
                              {r.rule === "sleep_buffer" && `${r.minutes} min before bedtime`}
                            </span>
                          </div>
                        ))}

                        {/* Science tip */}
                        {slot.is_mps_trigger && (
                          <div className="bg-slate-50 rounded-lg p-2.5 text-[11px] text-slate-500 leading-relaxed mt-1">
                            💡 <strong>Protein Meal (MPS trigger):</strong> This meal has enough protein to activate muscle building. Space these at least 4 hours apart for best results.
                          </div>
                        )}
                        {!fueling?.stabilizes_blood_sugar && (
                          <div className="bg-amber-50 rounded-lg p-2.5 text-[11px] text-amber-700 leading-relaxed mt-1">
                            ⚠️ <strong>No blood sugar control:</strong> EAAs alone don't stabilize blood sugar — that's why we pair them with an Essential Fueling nearby.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 animate-slideUp" style={{ animationDelay: "0.15s" }}>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">How to read your schedule</div>
          <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" /> All good — optimal timing
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" /> Close to limit — watch it
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" /> Issue — needs adjustment
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full ring-2 ring-indigo-200 ring-offset-1 bg-slate-200" /> Protein meal (MPS)
            </div>
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}

// ============================================================
// WHAT-IF LOGIC
// ============================================================
function applyWhatIfs(baseProfile, baseWorkout, activeWhatIfs) {
  let profile = { ...baseProfile };
  let workout = baseWorkout ? { ...baseWorkout } : null;

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

// ============================================================
// APP (Multi-Screen Controller)
// ============================================================
export default function App() {
  const [screen, setScreen] = useState("setup"); // "setup" or "schedule"
  const [baseProfile, setBaseProfile] = useState({ ...DEFAULT_PROFILE });
  const [baseWorkout, setBaseWorkout] = useState(null);
  const [goal, setGoal] = useState({ primary: "fat_loss", secondary: null });
  const [activeWhatIfs, setActiveWhatIfs] = useState({});

  const toggleWhatIf = (key) => {
    setActiveWhatIfs(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const clearWhatIfs = () => setActiveWhatIfs({});

  const resetAll = () => {
    setBaseProfile({ ...DEFAULT_PROFILE });
    setBaseWorkout(null);
    setGoal({ primary: "fat_loss", secondary: null });
    setActiveWhatIfs({});
    setScreen("setup");
  };

  // Compute effective profile/workout with what-ifs
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

  const handleEdit = (type, value) => {
    if (type === "priority") {
      setBaseProfile(p => ({ ...p, priority_mode: value }));
    }
  };

  if (!result && screen === "schedule") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <div className="text-sm text-slate-600 mb-4">Error generating schedule. Check your settings.</div>
          <button onClick={() => setScreen("setup")}
            className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-medium">
            Go Back to Setup
          </button>
        </div>
      </div>
    );
  }

  if (screen === "setup") {
    return (
      <SetupScreen
        profile={baseProfile}
        setProfile={setBaseProfile}
        workout={baseWorkout}
        setWorkout={setBaseWorkout}
        goal={goal}
        setGoal={setGoal}
        onContinue={() => setScreen("schedule")}
      />
    );
  }

  return (
    <ScheduleScreen
      result={result}
      profile={profile}
      workout={workout}
      goal={goal}
      onBack={() => setScreen("setup")}
      onEdit={handleEdit}
      activeWhatIfs={activeWhatIfs}
      toggleWhatIf={toggleWhatIf}
      clearWhatIfs={clearWhatIfs}
      baseWorkout={baseWorkout}
    />
  );
}
