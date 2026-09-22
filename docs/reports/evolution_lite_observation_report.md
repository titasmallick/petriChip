# Observation Report: Artificial-Life Sandbox, Lite Version (`server.js`)

**Data:** `evolution_log.csv` (245 rows, 2026-09-21 03:45:35 UTC → 2026-09-22 01:29:34 UTC, one continuous 21.7-hour server run) and `server.js`
**All timestamps are UTC.** Hours ("h") are counted from whichever epoch start is stated in each section.
**How to read this report:** each section separates *what the data show* from *how I read it*, with a confidence label. The log has population means only (no per-individual data, no seasons or eras here at all), so several readings are hypotheses, not proofs. §6 lists the limits.

This is a smaller, simpler cousin of the `server_v2.js` sandbox: no seasons, no immunity/insulation genes, no trophic (chloroplast/scavenger/carnivore) genes, and — importantly — **no nutrient-mass conservation**. Mating here is governed by colour similarity (`hue`) rather than a neural "consent" signal, and predation only requires a size and energy edge. Where a mechanic differs from the v2 sandbox, it's called out, since it changes the biology.

---

## 1. Key findings

1. **One lucky epoch ran for 16.8 hours**, then the world entered a **133-extinction, 4.8-hour mass-extinction spree** where almost every fresh population died in about a minute.
2. **The long epoch swept to its speed cap and its size floor within ~2 hours**, then held there (mean speed 3.6–3.9 against a hard cap of 4.0; mean size fell to 0.5–0.7 against a floor of 0.5) — a fast, miniature body plan.
3. **The long epoch self-poisoned to death.** With no way to recycle corpses, "poison" items (which include dead bodies) accumulated over the epoch — up to 888 of 1,500 slots — while food, competing for the same slots, was squeezed down; population drifted from ~90 to ~45 as this happened, and the epoch finally went extinct.
4. **Brain wiring grew roughly linearly** for the whole 16.8 hours (~33 connections/hour, 3 → 458, no plateau) — and, as with the heavier sandbox, the code makes most of that wiring functionally inert (§5.4).
5. **The subsequent 133 epochs were almost all instant failures**: median lifetime **1.3 minutes**, only 3 lasted beyond 2 minutes, and one reached **77 minutes** with visible adaptation (speed 2.3 → 3.2, lineage depth 53 → 109) before it too collapsed.
6. **The very last epoch in the log (gen 133) is still running** as the data ends, and — after surviving past the 1–2-minute danger zone — shows the same early signature as the original long epoch: lineage climbing (0 → 59 in 30 min) and speed rising (1.7 → 2.1 → 2.0 → 1.9).
7. **Population never approached the 600-slot capacity** in this run; it topped out at 139 and mostly ran below 100.

---

## 2. Data, code, and method

### 2.1 Columns

Same core columns as the heavier sandbox, minus season/immunity/insulation/trophic/fertilizer fields: `gen` = cumulative extinctions since server start (not generations); `max_lineage` = deepest ancestry depth among creatures currently alive; `avg_*` = population means; `max_age`/`max_energy` = maxima; `births`/`deaths` = cumulative since server start; `food`/`poison` = active item counts.

A row is written every **10 minutes**, plus a **forced row on every extinction**.

### 2.2 What's different from the mechanics of the heavier version

| Mechanic | Lite version (`server.js`) | Heavier version (for contrast) |
|---|---|---|
| Founders | 100 of 600 slots, energy 200 each, brains 1–5 wires | 400 of 600 slots, energy 1000 each |
| Metabolism | `0.015·size` baseline + `0.005·size·(|motorL|+|motorR|)` movement — no allometric (Kleiber) scaling | `0.05·size^0.75` + `0.01·size·v²` — cheaper per unit mass for large bodies |
| Poison | Fixed `−80` energy, no trait mitigates it; dead bodies also become permanent poison items | Toxicity offset by a `scavenger` gene; dead mass eventually decays back to a shared nutrient pool |
| Food/poison economy | **No mass conservation** — food spawns at a flat 20% chance/tick if a slot is free; poison items only clear by being eaten | Closed nutrient cycle (`globalFertilizer`) with seasonal spawn rates |
| Mating trigger | Requires **hue (colour) similarity** (`hueDiff < 20`) plus energy and size thresholds — a phenotype-matching rule, not a neural signal | Requires a mutual neural "intent" output plus energy/size thresholds |
| Predation trigger | Attacker just needs `size > 1.5×` defender **and** more energy; no trophic gene needed | Requires a `carnivore` gene, a neural "aggression" output, and `size > 1.2×` |
| Random death | Flat `0.00001`/tick chance | Age- and size-scaled senescence curve |
| Seasons / eras / radiation cycle | None logged; only a manual radiation-burst trigger exists | Full season and era (Ice Age/Greenhouse) cycle |

These differences matter: with no nutrient recycling and no toxin-resistance gene, this world has **fewer escape routes** from a resource crisis than the heavier one, which shows up directly in the data below.

### 2.3 The shape of the run

`gen` (cumulative extinctions) stayed at **0 for the first 101 rows (16.8 hours)** — the population never fully died out — then jumped from 0 to 133 across the remaining 143 rows (4.8 hours), one extinction almost every row. So this 21.7-hour log really contains **134 epochs**: one long one, then a burst of 133 short ones.

---

## 3. The long first epoch (h 0–16.8, 2026-09-21 03:45 → 20:35 UTC)

### 3.1 Rapid convergence to a fast, small body plan

| Time | Pop | Mean size | Mean speed | Connections | Max lineage |
|---|---|---|---|---|---|
| Founders (t=0) | 128 | 1.29 | 1.81 | 3.0 | 1 |
| h 1 | 87 | 0.58 | 3.59 | 40.7 | 186 |
| h 4 | 117 | 0.55 | 3.71 | 141.1 | 875 |
| h 8 | 62 | 0.64 | 3.84 | 231.5 | 1,924 |
| h 12 | 95 | 0.66 | 3.77 | 366.5 | 3,455 |
| h 16.8 (last) | 38 | 0.62 | 3.91 | 457.5 | 5,272 |

Mean speed exceeded 3.7 in 73% of the epoch's windows; mean size bottomed at **0.542**, barely above the 0.5 floor. Across the whole epoch, size and speed are strongly anti-correlated (r ≈ −0.66).

**Reading.** This is **directional selection to both boundaries at once**. Because movement cost here scales with motor output × size (not size × speed², as in the heavier sandbox) and baseline cost scales linearly with size (not size^0.75), there's no real energetic penalty for being small *and* fast — being tiny is close to strictly cheaper, and moving fast still finds food efficiently. So the model's own cost structure predicts exactly this fast-miniature outcome. Confidence: high.

### 3.2 A world that poisons itself

Food and (separately) poison item counts over the epoch:

| Time | Food | Poison |
|---|---|---|
| t=0 | 1,102 | 366 |
| h 4 | 189 | 669 |
| h 8 | 105 | 545 |
| h 12 | 88 | 435 |
| h 16 | 217 | 480 |
| last 20 rows, mean | 194 | 588 |

Poison peaked at **888** active items (of 1,500 slots) partway through the epoch. Poison and mean size are negatively correlated (r ≈ −0.44); poison and mean energy are also negatively correlated (r ≈ −0.52).

**Reading.** In this version, **every death drops a permanent poison item**, and nothing converts it back into food (no decay, no fertilizer, no scavenger gene). Food spawns at a flat 20% chance per tick *only into an empty slot* — so as poison fills the 1,500-slot arena, there are fewer empty slots for new food to appear in. The result is a **slow self-poisoning of the environment**: more deaths → more poison → fewer empty slots → less food → more deaths. Population fell from a mean of ~87 in the first 4 hours to ~46 in the last 4, correlating with hours elapsed at r ≈ −0.66. This mechanism — not predation, disease, or a season — is the most likely proximate driver of the eventual extinction at h 16.8. Confidence: moderate-high (the item-count trend is directly observed; the causal chain follows from the code, but isn't separately instrumented).

### 3.3 Brain growth, again mostly inert

Connections rose from 3 to 458 across the epoch, close to linear (~33/h on average, ranging 14–41/h across 4-hour windows) with **no plateau**, correlating with elapsed time at r ≈ 0.99.

**Reading.** As in the heavier sandbox, I checked `processBrain`: it evaluates connections in a single pass over a pre-update node array, so **a connection sourced from a hidden node (id ≥ 26) or another output always reads 0** — confirmed with a direct test (a sensor→motor wire produces a real signal; the same wire split through a hidden node produces none). With only 16 inputs × 12 outputs (192 possible direct slots), most of this near-perfectly-linear "brain growth" is very likely **inert wiring accumulating under weak or no selection**, not increasing cognitive capacity. Confidence: high for the growth pattern, moderate-high for the inert-wiring reading (code-based, not directly measurable from the log).

![First epoch: speed/size sweep and the food-vs-poison squeeze](fig1_first_epoch_sweep.png)
*Fig. 1: Left — mean speed rushes to its cap and mean size collapses toward its floor within about 2 hours, both essentially fixed for the next 15. Right — active poison items climb and stay well above food for the rest of the epoch.*

![First epoch: brain growth and population decline](fig2_first_epoch_brain_pop.png)
*Fig. 2: Left — connections per brain grow almost linearly for the full 16.8 hours. Right — population trends down as the environment fills with poison; the 600-slot cap (dotted) is never approached.*

---

## 4. The extinction spree (h 0–4.8 from 2026-09-21 20:41 UTC)

### 4.1 A near-universal 1–2 minute filter

133 extinctions occurred in 4.8 hours. Epoch durations:

| Statistic | Value |
|---|---|
| Median | 1.3 min |
| 25th / 75th percentile | 1.20 / 1.32 min |
| Epochs under 2 min | 128 of 132 (97%) |
| Longest | 77.4 min (one epoch) |
| Second-longest | 8.9 min |

**Reading.** This is the same **founder-bottleneck filter** documented in the heavier sandbox's sessions 0–2, but noticeably harsher here: essentially every fresh 100-founder population dies almost immediately, with no toxin-resistance gene and no nutrient buffer to fall back on. Since each new epoch gets a *fresh* item pool (25% poison, matching genesis ratios exactly — confirmed in the data), the self-poisoning problem from §3.2 resets each time; what kills these populations so fast instead is most likely simply that very few of the random 1–5-wire founder brains can find food and avoid poison before starving, and there's no time within a minute or two for mutation to fix that by chance. Confidence: high for the pattern, moderate for the exact mechanism (not separately instrumented).

### 4.2 The one epoch that (partly) broke through — and the one still running

**Gen 116 (an ordinary founder round) unexpectedly lasted 77 minutes**, and showed real evolution in that time:

| | Start | End (77 min later) |
|---|---|---|
| Population | 69 | 80 |
| Mean size | 1.50 | 0.84 |
| Mean speed | 2.34 | 3.16 |
| Max lineage | 53 | 109 |
| Connections | 19.4 | 16.1 |

It then went extinct like the rest.

**The final epoch in the log (gen 133) is still alive** when the data ends, and by the last row (30 minutes in) had reached population 95, lineage depth 59, mean speed rising toward 2.0, and 19 connections per brain — the same early trajectory the original successful epoch showed in its first hour. Whether it goes on to survive as long, or joins the 133 that didn't, isn't knowable from this log.

**Reading.** Read together with the original 16.8-hour epoch (which also started from ordinary founders and also happened to survive), this looks like **evolutionary rescue is a rare, stochastic event** in this world rather than something that gets easier with practice: of 134 fresh starts in this log, exactly one clearly succeeded, one partially and briefly succeeded, and one is a live unresolved case at the point the data cuts off. Confidence: high that the pattern holds in this log; the underlying success rate could differ over a longer run.

![The extinction spree: durations and the one partial escape](fig3_extinction_spree.png)
*Fig. 3: Left — epoch durations during the 4.8-hour spree, overwhelmingly under 2 minutes. Right — population trajectory through the spree; almost every epoch (dark purple) resets within a minute or two, except gen 116's 77-minute run (colour = lineage depth) which climbs before it, too, collapses.*

---

## 5. Phenomena not observed (and why, given this version's mechanics)

- **Trophic diversification, thermal adaptation, immune drift, seasonal cycling:** the code has no chloroplast/scavenger/carnivore, insulation, immunity, or season/era system in this version, so none of these can appear here — a direct consequence of it being the "lite" build, not a finding about the population.
- **Sustained large-bodied states:** unlike the heavier sandbox's alternating small/large regimes, this population converged on one small-fast strategy and stayed there for the whole surviving epoch; the metabolic cost structure here doesn't reward size the way Kleiber scaling does in the other version.
- **Colour-based speciation:** the mating rule requires similar hue, which could in principle drive assortative mating and colour clustering, but hue isn't logged, so this can't be checked from the CSV. Flagged as worth logging.
- **Predation pressure:** predation only needs a 1.5× size and energy edge here (no dedicated carnivore gene), but with the population converging on a narrow, small size range, opportunities for one individual to be 1.5× larger than another may have become rare — again unconfirmed, since kills aren't logged separately from other deaths.

---

## 6. Caveats

1. **Averages only** — as with the heavier sandbox, a population-mean shift can't distinguish a uniform trait shift from a change in group composition.
2. **No mass/energy accounting fields** (no fertilizer-equivalent column here) — the self-poisoning story in §3.2 is inferred from food/poison counts, not measured directly as an energy balance.
3. **Tick rate vs wall clock** — as before, simulation speed likely depends on population and item load, so wall-clock rates (e.g., "connections per hour") are approximate, not a fixed tick-based rate.
4. **Single long-run sample size** — the "one success in many founder rounds" pattern is based on one dataset; it shows that outcome varies enormously, not the long-run success probability.
5. **hue/diet/kill data absent** — several plausible dynamics (assortative mating, predation frequency) can't be checked with the columns logged here.
6. **The final epoch (gen 133) is unresolved** — its trajectory is suggestive but the log ends before its fate is known.

---

## 7. Suggested logging for next run

- **Item-slot occupancy breakdown** (empty vs food vs poison) directly, to confirm the food-starvation mechanism in §3.2 quantitatively.
- **Mean hue and hue variance**, to test for colour-based assortative mating/speciation.
- **A predation-event counter**, separate from other death causes.
- **Functional vs. total connection count** in the brain (as suggested for the heavier sandbox), since most of the logged brain growth here is likely inert.
- **A shorter, fixed-tick sampling interval early in each epoch** (the first minute is where most epochs live or die, and 10-minute logging mostly misses it — the forced extinction-row log is currently the only fine-grained signal available).

---

## Appendix: figures

| File | Content |
|---|---|
| `fig1_first_epoch_sweep.png` | Speed/size convergence and the food-vs-poison squeeze in the 16.8-hour epoch |
| `fig2_first_epoch_brain_pop.png` | Brain growth and population decline in the 16.8-hour epoch |
| `fig3_extinction_spree.png` | Epoch-duration histogram and population trace through the 133-extinction spree |

Keep the PNGs in the same folder as this `.md` so the image links resolve.
