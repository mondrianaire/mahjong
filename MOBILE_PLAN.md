# Charleston Lab — Mobile Implementation Plan

Analysis of the current project and a phased plan to bring the engine and its data views to
phones. Grounded in a compute benchmark of the live code, not assumptions.

> **Scope (set by the project): this is a PRACTICE / STUDY GUIDE, not a live in-game tool.**
> The mobile design is therefore *didactic and explorable*, not glanceable-under-time-pressure.
> The learning loop — encounter a hand → decide → get graded (EV-loss) → understand *why* →
> see the truth (replay reveal) → track progress — is the product. Consequences threaded below:
> sim opponents, the replay/teaching view, and skill tracking are **core, not stretch**; the
> live-table manual flow and OCR are **dropped**; and practice mode can spend the **full compute
> budget** (a spinner is fine) because the user is studying, not racing.

---

## 0. Analysis — what we have and how mobile-ready it is

The project is cleanly split into a **producer** (16 pure-JS engine modules, no DOM) and a
**consumer** (three single-file HTML tools). That split is the single biggest asset for mobile.

| Layer | Files | Mobile-ready? |
|---|---|---|
| Engine / data (producer) | `engine, dealer, kernel, score, charleston2, observer, divergence, stats, calibrated, direction, tileAdvice, ledger, session, card-meta, policies, play` | **Yes, as-is** — pure JS, no DOM, deterministic, **fully offline, no backend**. Ports to any JS runtime unchanged. |
| UIs (consumer) | `charleston-lab{,-v2,-v3}.html` | **No** — desktop-first: two-column grids, fixed tile sizes, **hover** "explain" affordances, all zones visible at once. |
| Build | python concat + a CJS `require` shim | **Needs replacing** with a real bundler + service worker for a PWA. |

### 0.1 Compute profile (measured; mobile JS ≈ 2–4× slower than this desktop Node)
| Operation | Desktop | ~Mobile | Verdict |
|---|---|---|---|
| `analyzeStatic` (1 hand) | 1.3 ms | ~4 ms | main thread fine |
| `direction.compass` | 0.8 ms | ~3 ms | main thread fine |
| `calibrated.predictP` | 1.6 ms | ~5 ms | main thread fine |
| `tileAdvice.advise` (Zone 3) | 14.8 ms | ~45 ms | acceptable; cache-able |
| **`choosePass` seeds40 (Zone 4)** | **438 ms** | **~1.3 s** | **must go off-main-thread** |
| `choosePass` seeds20/topK10 (mobile budget) | 161 ms | ~0.5 s | worker + reduced budget |

**Bundle:** engine modules 83 KB unminified (~25–30 KB gzipped). Trivial for a PWA. The whole
app, engine + UI, ships in well under 150 KB.

### 0.2 Takeaways that drive the plan
1. **The engine is already a portable, offline core.** No rewrite — just repackage as importable modules + a worker wrapper.
2. **Only `choosePass`/`gradePass` are heavy.** A Web Worker keeps the UI smooth; in a *study* tool we can run the **full** budget behind a spinner (no time pressure), so accuracy beats speed.
3. **The UI is the real work**, and the redesign target is *touch + small screen + one teaching point at a time* — a didactic surface, not a "responsive shrink."
4. **Offline-first is a study convenience** (learn on the couch / subway, no signal) and a clean PWA win — but it is not "at the table." The learning loop, not glanceability, is the point.

---

## 1. Strategic recommendation — PWA-first, shared engine core

**Ship a Progressive Web App.** Rationale, given §0: the engine is JS, the UI is HTML/CSS, the
whole thing is client-side and offline, so a PWA installs to the home screen on iOS and Android
**from a URL with no app-store friction** and reuses ~100% of the engine and most UI patterns.

- **Native (React Native / Flutter)** — only if app-store presence or native widgets become a
  requirement later. The engine (pure JS) could be shared into RN via its JS runtime; the UI would
  be reimplemented. **Defer** — don't pay that cost up front.
- **Hybrid (Capacitor)** — wrap the PWA for the app stores once it's proven, near-zero extra UI
  work. The natural "phase 2" if stores are wanted.

Recommendation: **PWA now, Capacitor wrapper later if needed, native only if ever justified.**

---

## 2. The core UX reframe — a didactic learning loop, one teaching point per screen

Desktop shows all six zones at once. A phone can't, and for a *study tool* it shouldn't — a learner
wants **one concept at a time, explained**, not a cockpit. Two modes carry the product:

- **Free Practice** — deal or set up a hand, explore every zone with explanations, then play a full
  Charleston against **sim opponents**, ending in the **replay reveal + EV-loss grade**.
- **Drills** — curated scenarios as active-recall quizzes: "which 3 would you pass?" → you answer →
  it reveals the EV-loss, the optimal pass, and *why* (the per-tile immediate/long-term reasons).

**Part 3's topicality map becomes the lesson sequencer** (not a speed optimizer): at each step the
screen leads with the *one* zone that teaches this decision, explanation-first.

```
┌─────────────────────────────┐
│  Step bar: ● ● ○ ○ ○  R1→L   │   ← where you are in the Charleston lesson
├─────────────────────────────┤
│  LEAD CARD — teaching first  │   ← the "why" up top; the number a tap deeper
│  (e.g. Tile Tray: this tile  │
│   is PASS because …)         │
├─────────────────────────────┤
│  secondary cards (collapsed) │   ← tap to expand, explore at your own pace
├─────────────────────────────┤
│  YOUR MOVE → grade + explain │   ← decide, then get graded feedback (no clock)
└─────────────────────────────┘
```

- **Tap replaces hover, and explanation leads.** Each card opens a **bottom sheet** with the full
  *why* — immediate/long-term effect, provenance tag, the CI — because teaching the reasoning *is*
  the feature, not a power-user extra.
- **Learner density is the default** (Part 3 §4): plain-language reasons on top, expert numbers
  (keepValue, CIs, EV-loss in strength units) one tap deeper for when the user is ready.
- **The anti-overclaim visual grammar must survive small screens** — solid vs faded ledger chips,
  greyed/tentative leans, dead-heat "tie" badges. In a teaching tool these are doubly important:
  they *teach the player what is knowable vs guessable*, which is itself a core lesson.

---

## 3. Per-data-view mobile treatment

| Zone | Mobile rendering | Touch interaction | On small screens |
|---|---|---|---|
| **1 Direction Compass** | compact horizontal bars, 2 lines | tap → full section breakdown sheet | always visible (cheap, high value) |
| **2 Hand Portfolio** | big calibrated **P%** + closest-hands chips | tap → full list + CI band | collapses to the P% pill |
| **3 Tile Tray** | rack as a **horizontal-scroll row of large chips**, KEEP/PASS/FLEX colored borders | **tap a tile → bottom sheet** (immediate/long-term/constraints); tap-select to add to pass | lead card during pass steps |
| **4 Pass Builder** | **"Your move"**: pick 3, submit, then a graded reveal (EV-loss, optimal, why) | tap to grade — no clock | the teaching payoff of each step |
| **5 Information Ledger** | per-seat **collapsible cards**; solid/faded chips; **"not collecting" first** — and a lesson on certain-vs-inferred | tap a seat to expand | collapsed by default; badge counts |
| **6 Tempo & State** | a compact **header strip** (pass #, jokers, blind/stop flags) | — | always visible |

The teaching payoff at each step is the **graded reveal** — your pass vs the optimum, the EV-loss,
and the per-tile reasons — which the learner reads at their own pace, not a glance-and-go bar.

---

## 4. Hand setup & input — study, not live entry

Desktop clicks a 34-tile palette. For a study tool the input job is *setting up hands to learn
from*, not racing to log a live rack.

- **Deal random** — the default practice on-ramp (no typing).
- **Touch keypad to build a specific hand** — three suit rows (Bam/Crak/Dot 1–9) + an honors row,
  large 44px+ targets, "x/13" + tap-to-undo — for studying a hand you want to understand.
- **Scenario loader** — pick a curated teaching hand from the drill library (§4a).
- In a practice session, **received tiles are provided by the sim opponents** — no manual entry.
- **Dropped (per study scope):** live at-the-table manual-receive flows and camera OCR rack entry.

### 4a. Study-specific features (the heart of a learning tool)
These are what make it a *guide*, not just a calculator — and they're cheap because the engine
already produces every number they need:

- **Drill library** — curated scenarios keyed to a lesson ("strong 369 with a dead evens pivot",
  "two-suit fork", "joker-rich rack"), each a quiz with a graded answer.
- **Active-recall quiz** — hide the recommendation, ask the user to choose, reveal EV-loss +
  reasons. The single most effective study mechanic.
- **Counterfactual explorer** — "what if I'd passed X instead?" re-runs `gradePass` so the learner
  *feels* the EV cost of alternatives.
- **Concept cards** — short lessons tied to the engine's [DERIV]/[EMP] facts (why pairs are hard;
  why jokers ≈ +12%; why points ≠ difficulty), each linking to a drill that exercises it.
- **Progress / mastery** — EV-loss trend over time and per-concept mastery (built on §6 persistence).

---

## 5. Performance — keep the UI at 60fps on a phone

From §0.1, only the pass evaluator is heavy. Plan:

1. **Web Worker for `choosePass`/`gradePass`.** Run them off the main thread; the UI shows a
   progressive "evaluating passes…" state and never janks. (The engine is pure functions over
   plain data → trivially serializable into a worker.)
2. **Full compute budget is the default** (study, not racing). The ~1 s in-worker cost behind a
   spinner is fine when the user is learning, so we favor accuracy; the `seeds`/`topK` knobs stay
   available for a "lite" mode on low-end devices, but deep analysis leads.
3. **Cache the expensive-but-stable bits.** `buildTargets()` (card expansion) once at load;
   memoize `tileAdvice` per rack hash (it's 13× `shortlist` — the biggest avoidable cost).
4. **Defer WASM.** JS + a worker is sufficient at these sizes; revisit only if profiling on real
   devices shows a need.

---

## 6. Delivery & engineering

- **Build pipeline:** replace the python-concat + CJS shim with **esbuild or Vite** — ES modules,
  minify, tree-shake, code-split the worker. (~half a day; unblocks everything.)
- **PWA essentials:** web app manifest (icons, name, standalone display), a **service worker**
  caching the app shell + engine for **full offline** use, and an install prompt.
- **Persistence:** **IndexedDB** for session history and replay logs → unlocks the deferred
  **B.8 skill/luck tracking** (EV-loss over time) and a **replay library** for the teaching view.
  (Note: the current artifacts avoid storage; a real PWA can use it freely.)
- **Responsive system:** mobile-first CSS, safe-area insets, one-handed thumb reach, large hit
  targets, haptic feedback on confirm, dark mode (a dim table-friendly theme).
- **Accessibility:** the color-coded KEEP/PASS/FLEX needs a non-color cue (icon/label) for
  colorblind users — small but important given the grammar carries meaning.

---

## 7. Phased plan (study-first ordering)

| Phase | Deliverable | Depends on | Size |
|---|---|---|---|
| **M0 — Engine packaging** | 16 modules → an ES-module package (`@charleston/engine`) + a `compute.worker` wrapping `choosePass`/`gradePass`; esbuild build | — | S–M |
| **M1 — PWA shell** | manifest + service worker + offline + installable; mobile-first frame; step-bar + lesson-card skeleton (learner density default) | M0 | M |
| **M2 — Hand setup input** | deal-random, touch keypad to build a hand, x/13 + undo, scenario loader hook | M1 | S–M |
| **M3 — Teaching data-view cards** | the six zones as **explanation-first** cards + bottom-sheet "why"; anti-overclaim grammar preserved; non-color KEEP/PASS/FLEX cue | M1 | **L** |
| **M4 — Guided practice loop** | sim-opponent session, step R1→stop→R2→done, **replay reveal + EV-loss grade** — the core learning loop | M2, M3 | M |
| **M5 — Drills & quiz** | drill library, active-recall quiz, counterfactual explorer, concept cards (§4a) | M4 | M–L |
| **M6 — Progress & persistence** | IndexedDB history, EV-loss trend + per-concept mastery (B.8), replay library | M4 | M |
| **M7 — Polish** | worker perf on real devices, dark table-theme, a11y, install UX; optional Capacitor wrapper for stores | M3–M6 | M |

**First slice (smallest shippable study win):** M0 + M1 + M2 + M3(Tile Tray + Direction) + M4 =
a phone study loop: deal a hand, learn *why* each tile is keep/pass, play the Charleston vs sim
opponents, then see the **replay reveal and your EV-loss grade** — fully offline.

---

## 8. Decisions for you

1. **Delivery target** — PWA (recommended), or app-store presence now (→ add Capacitor in M7) or a
   native app (→ larger, defer)?
2. **Curriculum depth** — free practice only, or invest in the **drill/quiz/concept library** (M5)?
   This is what most separates a *study guide* from a calculator; recommended, but it's content
   work as much as code (authoring scenarios + lessons).
3. **Progress model** — simple history + EV-loss trend, or a fuller **mastery / spaced-repetition**
   model per concept and card section?
4. **Opponent realism for practice** — keep the current `winsFlexible` sim opponents, or offer a
   **difficulty ladder** (naive → flexible → points-chaser) so learners practice reading different
   styles? (The policy zoo already exists.)
5. **Design system** — extend the warm-cream/accent theme, or design a dedicated mobile theme
   (light study theme + optional dark)?

---

## 9. Bottom line

The hard part — a trustworthy, offline, self-contained analytical engine — **is already done and
is mobile-ready unchanged.** As a **study guide**, mobile is a *didactic UX* project: explanation-
first data views, a deal→decide→grade→understand→reveal learning loop against sim opponents, and a
drill/quiz/progress layer — all on the engine that exists, with one Web Worker for the single heavy
call. The PWA path reuses the engine and most UI logic and ships offline, landing the project's
real form: a Charleston **coach that teaches you**, hand by graded hand.
