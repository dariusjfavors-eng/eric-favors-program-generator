/* ==========================================================================
   Coach Eric Favors — Throwing Program Generator
   Client-side generation engine + renderer. No build step, no backend
   required for the core flow — DRILL_LIBRARY is loaded as a global from
   data/drill_library.js before this file runs.
   ========================================================================== */

(function () {
  "use strict";

  const LIB = window.DRILL_LIBRARY || { throwing_drills: [], lift_exercises: [] };

  const DAY_LABEL_SETS = {
    3: ["MONDAY", "WEDNESDAY", "FRIDAY"],
    4: ["MONDAY", "TUESDAY", "THURSDAY", "FRIDAY"],
    5: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  };

  const LIFT_DAY_TYPES = ["lower_body", "upper_body", "ab_jumps", "combo"];
  const LIFT_DAY_TITLES = {
    lower_body: "Lower Body",
    upper_body: "Upper Body",
    ab_jumps: "Ab & Jumps",
    combo: "Combo",
  };

  const OLY_KEYWORDS = ["clean", "snatch", "jerk"];

  const FULL_THROW_SUBCATS = ["big_step", "pivot", "glide", "spin", "discus_specific", "full_throw"];

  const FOCUS_LABELS = {
    fundamentals: "Learn Fundamentals",
    full_throw: "Build the Full Throw",
    in_season: "In-Season Sharpening",
    off_season: "Off-Season Strength",
  };

  const FOCUS_NOTES = {
    fundamentals: "Foundational block — positions and rhythm before speed. Keep every rep clean before adding load or reverse.",
    full_throw: "Full-throw emphasis — foundational drills trimmed to a quick review, most volume spent finishing the throw.",
    in_season: "In-season maintenance — trimmed technical volume, lifts held at maintenance intensity. Priority is staying sharp and fresh for competition.",
    off_season: "Off-season block — strength volume is the priority. Technical work keeps positions sharp while the lifting program does the heavy lifting.",
  };

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------

  const state = {
    event: "shot_put",
    technique: "glide",
    level: "beginner",
    focus: "fundamentals",
    days: 4,
    weeks: 4,
    includeLifting: true,
  };

  let lastProgram = null;

  // ---------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------

  function extractYouTubeId(url) {
    if (!url) return null;
    const patterns = [
      /youtu\.be\/([A-Za-z0-9_-]{6,})/,
      /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/,
      /[?&]v=([A-Za-z0-9_-]{6,})/,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
    ];
    for (const re of patterns) {
      const m = url.match(re);
      if (m) return m[1];
    }
    return null;
  }

  function rotatePick(list, count, offset) {
    if (!list.length) return [];
    const n = Math.min(count, list.length);
    const out = [];
    const seen = new Set();
    let i = ((offset % list.length) + list.length) % list.length;
    while (out.length < n) {
      if (!seen.has(i)) {
        out.push(list[i]);
        seen.add(i);
      }
      i = (i + 1) % list.length;
      if (seen.size >= list.length) break;
    }
    return out;
  }

  function levelRank(drillLevel) {
    return { beginner: 0, intermediate: 1, advanced: 2 }[drillLevel] ?? 1;
  }

  function levelAllowed(userLevel, drillLevel) {
    const rank = { beginner: 0, intermediate: 1, advanced: 2 };
    if (userLevel === "beginner") return rank[drillLevel] <= 0;
    if (userLevel === "intermediate") return rank[drillLevel] <= 1;
    return true; // advanced sees everything
  }

  function sortByLevelPreference(drills, userLevel) {
    const targetRank = { beginner: 0, intermediate: 1, advanced: 2 }[userLevel];
    return [...drills].sort((a, b) => {
      const da = Math.abs(levelRank(a.level) - targetRank);
      const db = Math.abs(levelRank(b.level) - targetRank);
      return da - db;
    });
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  // ---------------------------------------------------------------------
  // Drill selection
  // ---------------------------------------------------------------------

  function drillsForDiscipline(discipline) {
    // discipline: 'shot_put_glide' | 'shot_put_spin' | 'discus'
    const event = discipline.startsWith("shot_put") ? "shot_put" : "discus";
    return LIB.throwing_drills.filter((d) => d.applies_to.includes(event));
  }

  function pickCategoryDrills(pool, category, userLevel, count, weekIdx, dayIdx) {
    let candidates = pool.filter((d) => d.category === category && levelAllowed(userLevel, d.level));
    if (!candidates.length) candidates = pool.filter((d) => d.category === category);
    candidates = sortByLevelPreference(candidates, userLevel);
    const offset = weekIdx * 2 + dayIdx;
    return rotatePick(candidates, count, offset);
  }

  function pickFullThrowGroup(pool, discipline, userLevel, count, weekIdx, dayIdx) {
    // Prefer technique-specific drills (glide/spin/discus_specific) plus entry
    // work (big_step/pivot) plus finishing full_throw drills, blended in a
    // sensible order. Eric's library doesn't tag a distinct "spin" bucket for
    // shot put — rotational shot put content lives alongside discus_specific
    // (both rotational), so the spin technique pulls from that pool first
    // while glide prioritizes the glide-tagged pool.
    const order =
      discipline === "shot_put_glide"
        ? ["big_step", "pivot", "glide", "discus_specific", "full_throw"]
        : discipline === "shot_put_spin"
        ? ["big_step", "pivot", "discus_specific", "glide", "full_throw"]
        : ["big_step", "pivot", "discus_specific", "full_throw"];
    let candidates = pool.filter((d) => order.includes(d.category) && levelAllowed(userLevel, d.level));
    candidates = sortByLevelPreference(candidates, userLevel);
    candidates.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
    const offset = weekIdx * 3 + dayIdx;
    return rotatePick(candidates, count, offset);
  }

  function buildDayDrillGroups(discipline, userLevel, focus, includeWarmup, weekIdx, dayIdx) {
    const pool = drillsForDiscipline(discipline);
    const groups = [];

    if (includeWarmup) {
      const warm = pickCategoryDrills(pool, "warmup", userLevel, 2, weekIdx, dayIdx);
      if (warm.length) groups.push({ label: "Warm-Up", drills: warm });
    }

    let standCount = userLevel === "beginner" ? 2 : 1;
    let halfCount = userLevel === "beginner" ? 2 : 1;
    let fullCount = userLevel === "advanced" ? 4 : userLevel === "intermediate" ? 3 : 3;

    if (focus === "full_throw") { fullCount += 1; standCount = Math.max(1, standCount - 1); }
    if (focus === "in_season") { fullCount = Math.max(2, fullCount - 1); halfCount = Math.max(1, halfCount - 1); }
    if (focus === "fundamentals") { standCount += 1; }

    const stand = pickCategoryDrills(pool, "stand_throw", userLevel, standCount, weekIdx, dayIdx);
    if (stand.length) groups.push({ label: "Stand Throw", drills: stand });

    const half = pickCategoryDrills(pool, "half_turn", userLevel, halfCount, weekIdx, dayIdx);
    if (half.length) groups.push({ label: "Half Turn", drills: half });

    const full = pickFullThrowGroup(pool, discipline, userLevel, fullCount, weekIdx, dayIdx);
    if (full.length) groups.push({ label: "Full Throw Progression", drills: full });

    return groups;
  }

  // ---------------------------------------------------------------------
  // Lift selection
  // ---------------------------------------------------------------------

  function isOlyLift(name) {
    const lower = name.toLowerCase();
    return OLY_KEYWORDS.some((k) => lower.includes(k));
  }

  function pickLiftsForDayType(dayType, userLevel) {
    let candidates = LIB.lift_exercises.filter((l) => l.day_type === dayType);
    if (userLevel === "beginner") {
      const nonOly = candidates.filter((l) => !isOlyLift(l.name));
      if (nonOly.length >= 3) candidates = nonOly;
    }
    return candidates.slice(0, 4);
  }

  function parseProgressionToWeeks(str, numWeeksNeeded) {
    // Real coaching notes show up in a few shapes:
    //   "Week 1: 5x5 @70% | Week 2: 5x3 @82% | ..."   (pipe-separated, "Week N:")
    //   "Wk1 5x5@70%, Wk2 5x3@82%, Wk3 3x3@70%, Wk4 5x4@75%"  (comma-separated, "WkN")
    //   "Week 1&4 Double Bounce/Pause: Wk1 5x5@70%, Wk2 ... Wk4 5x4@75%"  (descriptive
    //     prefix restating weeks 1&4, followed by the real per-week list — later
    //     marker matches overwrite the prefix's placeholder, so this still resolves)
    //   "Wk1&3 Pause ... 5x3@70%, Wk2&4 Normal ... 6x2@75%"   (grouped weeks)
    //   "4 sets of 12-15, all 4 weeks"  (flat, no per-week breakdown)
    //   "4-5 sets of 5-20, varying by week"  (free-text, not parseable)
    const markerRe = /(?:wk\.?|week)\s*(\d+)(?:\s*(?:&|,|and|\/)\s*(\d+))?\s*:?\s*/gi;
    const matches = [...str.matchAll(markerRe)];
    const weekMap = {};
    matches.forEach((m, i) => {
      const start = m.index + m[0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : str.length;
      const val = str.slice(start, end).replace(/^[,\s]+|[,\s]+$/g, "");
      if (!val) return;
      weekMap[m[1]] = val;
      if (m[2]) weekMap[m[2]] = val;
    });

    let weeks4;
    if (Object.keys(weekMap).length >= 2) {
      const fallbackVal = Object.values(weekMap)[0] || str;
      weeks4 = [1, 2, 3, 4].map((n) => weekMap[n] ?? weekMap[n - 1] ?? fallbackVal);
    } else if (/all\s*4?\s*weeks/i.test(str)) {
      const cleaned = str.replace(/,?\s*all\s*4?\s*weeks/i, "").trim();
      weeks4 = [cleaned, cleaned, cleaned, cleaned];
    } else {
      weeks4 = [str, str, str, str];
    }
    const out = [];
    for (let i = 0; i < numWeeksNeeded; i++) out.push(weeks4[i % 4]);
    return out;
  }

  function buildLiftingPlan(userLevel, daysCount, numWeeks) {
    const usedTypes = [];
    for (let i = 0; i < daysCount; i++) usedTypes.push(LIFT_DAY_TYPES[i % LIFT_DAY_TYPES.length]);
    const uniqueTypes = [...new Set(usedTypes)];

    return uniqueTypes.map((dayType) => {
      const exercises = pickLiftsForDayType(dayType, userLevel).map((ex) => ({
        name: ex.name,
        video_url: ex.video_url,
        coaching_note: ex.coaching_note,
        weeks: parseProgressionToWeeks(ex.example_progressions[0] || "", numWeeks),
      }));
      return { dayType, title: LIFT_DAY_TITLES[dayType], exercises };
    });
  }

  // ---------------------------------------------------------------------
  // Program assembly
  // ---------------------------------------------------------------------

  function disciplineForDayIndex(cfg, dayIndexAbsolute) {
    if (cfg.event === "both") {
      const cycle = [cfg.technique === "spin" ? "shot_put_spin" : "shot_put_glide", "discus", "shot_put_spin" === cfg.technique ? "shot_put_glide" : "shot_put_spin"];
      // simpler, stable rotation: glide/spin(chosen) -> discus -> spin/glide(other)
      const rotation = [`shot_put_${cfg.technique}`, "discus", cfg.technique === "glide" ? "shot_put_spin" : "shot_put_glide"];
      return rotation[dayIndexAbsolute % rotation.length];
    }
    if (cfg.event === "discus") return "discus";
    return `shot_put_${cfg.technique}`;
  }

  function disciplineLabel(discipline) {
    if (discipline === "discus") return "Discus";
    if (discipline === "shot_put_glide") return "Shot Put — Glide";
    if (discipline === "shot_put_spin") return "Shot Put — Spin";
    return discipline;
  }

  function generateProgram(cfg) {
    const dayLabels = DAY_LABEL_SETS[cfg.days];
    const weeks = [];

    for (let w = 0; w < cfg.weeks; w++) {
      const days = dayLabels.map((label, dIdx) => {
        const discipline = disciplineForDayIndex(cfg, dIdx);
        const includeWarmup = dIdx < 2;
        const groups = buildDayDrillGroups(discipline, cfg.level, cfg.focus, includeWarmup, w, dIdx);
        return { label, discipline, disciplineLabel: disciplineLabel(discipline), groups };
      });
      weeks.push({ index: w + 1, days });
    }

    const lifting = cfg.includeLifting ? buildLiftingPlan(cfg.level, cfg.days, cfg.weeks) : null;

    return {
      athleteName: cfg.athleteName,
      event: cfg.event,
      technique: cfg.technique,
      level: cfg.level,
      focus: cfg.focus,
      days: cfg.days,
      weeksCount: cfg.weeks,
      notes: cfg.notes,
      generatedDate: new Date(),
      weeks,
      lifting,
    };
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  function fmtDate(d) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function eventLabel(program) {
    if (program.event === "both") return "Shot Put + Discus";
    if (program.event === "discus") return "Discus";
    return "Shot Put";
  }

  function techLabel(program) {
    if (program.event === "discus") return "Rotational";
    return program.technique === "spin" ? "Spin" : "Glide";
  }

  function renderHeader(program) {
    const el = document.getElementById("programHeader");
    el.innerHTML = `
      <div class="eyebrow">Generated ${fmtDate(program.generatedDate)}</div>
      <h2>${escapeHtml(program.athleteName)} — Throwing Program</h2>
      <div class="badge-row">
        <span class="badge accent">${eventLabel(program)}</span>
        <span class="badge">${techLabel(program)}</span>
        <span class="badge lvl-${program.level}">${program.level}</span>
        <span class="badge">${FOCUS_LABELS[program.focus]}</span>
        <span class="badge">${program.weeksCount} Weeks · ${program.days}x/wk</span>
      </div>
      <div class="badge-row" style="margin-top:12px;">
        <span style="font-size:13px;color:var(--text-secondary);max-width:640px;line-height:1.5;">${FOCUS_NOTES[program.focus]}</span>
      </div>
      ${program.notes ? `<div class="badge-row" style="margin-top:10px;"><span style="font-size:12.5px;color:var(--text-tertiary);"><b style="color:var(--text-secondary)">Coach notes:</b> ${escapeHtml(program.notes)}</span></div>` : ""}
    `;
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function videoLinkHtml(url) {
    if (!url) return "";
    const id = extractYouTubeId(url);
    return `<a class="d-video" href="${url}" target="_blank" rel="noopener"><span class="play-ico">▶</span>${id ? "Watch demo" : "Reference link"}</a>`;
  }

  function drillRowHtml(drill) {
    const cues = (drill.cues || []).map((c) => `<span class="d-cue">${escapeHtml(c)}</span>`).join("");
    const mistake = drill.common_mistake
      ? `<div class="d-mistake">⚠ ${escapeHtml(drill.common_mistake)}${drill.fix ? " — Fix: " + escapeHtml(drill.fix) : ""}</div>`
      : "";
    return `
      <div class="drill-row">
        <div class="d-top">
          <div class="d-name">${escapeHtml(drill.name)}</div>
          ${drill.rep_range ? `<div class="d-reps">${escapeHtml(drill.rep_range)}</div>` : ""}
        </div>
        ${drill.goal ? `<div class="d-goal">${escapeHtml(drill.goal)}</div>` : ""}
        ${cues ? `<div class="d-cues">${cues}</div>` : ""}
        ${mistake}
        ${videoLinkHtml(drill.video_url)}
      </div>
    `;
  }

  function dayCardHtml(day, isCombo) {
    const groupsHtml = day.groups
      .map(
        (g) => `
      <div class="drill-group">
        <div class="cat-label">${g.label}</div>
        ${g.drills.map(drillRowHtml).join("")}
      </div>
    `
      )
      .join("");
    return `
      <div class="day-card">
        <div class="day-head">
          <div class="day-name">${day.label}</div>
          ${isCombo ? `<div class="day-discipline">${day.disciplineLabel}</div>` : ""}
        </div>
        ${groupsHtml}
      </div>
    `;
  }

  function renderWeeks(program) {
    const tabsEl = document.getElementById("weekTabs");
    const panelsEl = document.getElementById("weekPanels");
    tabsEl.innerHTML = "";
    panelsEl.innerHTML = "";

    program.weeks.forEach((week, i) => {
      const tab = document.createElement("div");
      tab.className = "week-tab" + (i === 0 ? " active" : "");
      tab.innerHTML = `<span class="n">${String(week.index).padStart(2, "0")}</span>Week ${week.index}`;
      tab.addEventListener("click", () => {
        document.querySelectorAll(".week-tab").forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".week-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(`weekPanel-${week.index}`).classList.add("active");
      });
      tabsEl.appendChild(tab);

      const panel = document.createElement("div");
      panel.className = "week-panel" + (i === 0 ? " active" : "");
      panel.id = `weekPanel-${week.index}`;
      panel.innerHTML = `<div class="day-grid">${week.days.map((d) => dayCardHtml(d, program.event === "both")).join("")}</div>`;
      panelsEl.appendChild(panel);
    });
  }

  function renderLifting(program) {
    const el = document.getElementById("liftSection");
    if (!program.lifting) {
      el.innerHTML = "";
      return;
    }
    const weekHeaders = Array.from({ length: program.weeksCount }, (_, i) => `<th>Wk ${i + 1}</th>`).join("");

    const blocks = program.lifting
      .map(
        (block) => `
      <div class="lift-day-block">
        <div class="lift-day-head"><b>${block.title}</b><span>${block.exercises.length} exercises</span></div>
        <div class="lift-table-wrap">
          <table class="lift-table">
            <thead><tr><th>Exercise</th>${weekHeaders}<th>Demo</th></tr></thead>
            <tbody>
              ${block.exercises
                .map(
                  (ex) => `
                <tr>
                  <td class="ex-name">${escapeHtml(ex.name)}${ex.coaching_note ? `<small>${escapeHtml(ex.coaching_note)}</small>` : ""}</td>
                  ${ex.weeks.map((w) => `<td><span class="wk-val">${escapeHtml(w)}</span></td>`).join("")}
                  <td class="ex-video">${ex.video_url ? `<a href="${ex.video_url}" target="_blank" rel="noopener">▶ Watch</a>` : "—"}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `
      )
      .join("");

    el.innerHTML = `
      <div class="lift-section-head"><h3>Lifting Program</h3><span>${program.weeksCount}-Week Block</span></div>
      ${blocks}
    `;
  }

  function renderProgram(program) {
    renderHeader(program);
    renderWeeks(program);
    renderLifting(program);
  }

  // ---------------------------------------------------------------------
  // Copy-for-Sheets export (matches Eric's existing template columns)
  // ---------------------------------------------------------------------

  function buildSheetTSV(program) {
    const rows = [];
    program.weeks.forEach((week, wIdx) => {
      if (wIdx > 0) {
        rows.push([`Week ${week.index}`]);
      }
      week.days.forEach((day, dIdx) => {
        rows.push([
          `DAY ${dIdx + 1} - ${day.label}${program.event === "both" ? " (" + day.disciplineLabel + ")" : ""}`,
          "Weekly Goal:",
          "Drill",
          "Drill Goal",
          "Key Cues",
          "Recommended Reps",
          "Recorded Reps",
          "Self Rating (1-5)",
          "Notes",
          "Personal Notes",
          "Video Example",
        ]);
        day.groups.forEach((group) => {
          group.drills.forEach((drill) => {
            const notes = drill.common_mistake ? `Common mistake: ${drill.common_mistake}${drill.fix ? ". Fix: " + drill.fix : ""}` : "";
            rows.push([
              "",
              group.label,
              drill.name,
              drill.goal || "",
              (drill.cues || []).join(" • "),
              drill.rep_range || "",
              "",
              "",
              notes,
              "",
              drill.video_url || "",
            ]);
          });
        });
      });
    });

    if (program.lifting) {
      rows.push([]);
      rows.push(["Lifting Program"]);
      program.lifting.forEach((block) => {
        rows.push([block.title]);
        rows.push(["Exercise", ...Array.from({ length: program.weeksCount }, (_, i) => `Week ${i + 1}`), "Video"]);
        block.exercises.forEach((ex) => {
          rows.push([ex.name, ...ex.weeks, ex.video_url || ""]);
        });
      });
    }

    return rows.map((r) => r.join("\t")).join("\n");
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------

  function setupChipGroup(id, stateKey, parse) {
    const el = document.getElementById(id);
    el.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      el.querySelectorAll(".chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      state[stateKey] = parse ? parse(chip.dataset.value) : chip.dataset.value;
      if (stateKey === "event") updateTechniqueVisibility();
    });
  }

  function updateTechniqueVisibility() {
    const group = document.getElementById("techniqueGroup");
    group.style.display = state.event === "discus" ? "none" : "";
  }

  function initWizard() {
    setupChipGroup("chip-event", "event");
    setupChipGroup("chip-technique", "technique");
    setupChipGroup("chip-level", "level");
    setupChipGroup("chip-focus", "focus");
    setupChipGroup("chip-days", "days", Number);
    setupChipGroup("chip-weeks", "weeks", Number);

    const liftToggle = document.getElementById("liftToggle");
    liftToggle.addEventListener("click", () => {
      liftToggle.classList.toggle("on");
      state.includeLifting = liftToggle.classList.contains("on");
    });

    document.getElementById("wizardForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("athleteName").value.trim();
      const errBanner = document.getElementById("errorBanner");
      if (!name) {
        errBanner.textContent = "Enter an athlete name to generate a program.";
        errBanner.classList.add("show");
        document.getElementById("athleteName").focus();
        return;
      }
      errBanner.classList.remove("show");

      const cfg = {
        ...state,
        athleteName: name,
        notes: document.getElementById("coachNotes").value.trim(),
      };

      const program = generateProgram(cfg);
      lastProgram = program;
      renderProgram(program);

      document.getElementById("wizardShell").classList.add("hidden");
      document.getElementById("outputShell").classList.add("show");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.getElementById("btnNew").addEventListener("click", () => {
      document.getElementById("outputShell").classList.remove("show");
      document.getElementById("wizardShell").classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.getElementById("btnPrint").addEventListener("click", () => window.print());

    document.getElementById("btnCopySheet").addEventListener("click", async () => {
      if (!lastProgram) return;
      const tsv = buildSheetTSV(lastProgram);
      try {
        await navigator.clipboard.writeText(tsv);
        toast("Copied — paste into a duplicated Template sheet");
      } catch (err) {
        toast("Couldn't access clipboard — see console for the export text");
        console.log(tsv);
      }
    });

    document.getElementById("btnSheetExport").addEventListener("click", () => {
      if (!lastProgram) {
        toast("Generate a program first");
        return;
      }
      if (window.attemptGoogleSheetExport) {
        window.attemptGoogleSheetExport(lastProgram, buildSheetTSV(lastProgram));
      }
    });

    updateTechniqueVisibility();
  }

  document.addEventListener("DOMContentLoaded", initWizard);
})();
