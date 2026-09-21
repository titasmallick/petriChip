# Observation Report: Artificial-Life Sandbox (`server_v2.js`)

**Data:** `evolution_v2_log.csv` (680 rows, 2026-09-17 11:14 UTC → 2026-09-21 03:07 UTC) and `server_v2.js`
**All timestamps are UTC, as logged.** Hours ("h") are counted from the start of the surviving epoch (2026-09-17 20:37:24 UTC) unless stated.
**How to read this report:** each section separates *what the data show* from *how I read it*, and interpretations carry a confidence label. The log contains population means only (no distributions, no era, no event flags), so several readings are hypotheses, not proofs. §7 lists the limits.

---

## 1. Key findings

1. **The world is a near-lethal filter.** 197 extinction-and-restart events were logged. Of 196 completed founder epochs, the median lasted **1.5 min**, 51% were over in under 1.5 minutes, and only 8 (4%) reached the 10-minute log, all of them on the brink (3–32 individuals).
2. **One epoch escaped and has now run for 78.5 hours** (3 d 6.5 h): **1.36 million births ≈ 1.36 million deaths**, ancestry depth **10,516 generations**, still alive at the last row.
3. **Evolutionary rescue.** Within ~10 minutes of genesis the survivors had roughly doubled their speed (1.75 → 3.62), more than tripled their brain wiring (3 → 11 connections), and begun scavenging (0.004 → 0.11).
4. **Selection to a boundary.** Mean speed locked at **3.84 ± 0.04 against a hard cap of 4.0** and barely moved again (3.81 → 3.87 in ten-hour block means), so speed variation was effectively exhausted.
5. **Detritivory became the dominant feeding strategy.** The scavenger gene averages ~0.7, while autotrophy (chloroplast) and predation (carnivore) hover at ~4–5%.
6. **Directional thermal adaptation.** Insulation rose from 0.50 to ~0.85, as the code's cost structure predicts.
7. **Two alternative body-size states** (mean ≈ 1.3 vs ≈ 2.2) that switch abruptly and persist for hours. The large state has longer lives, lower birth rate and higher standing population: an r → K style shift.
8. **Punctuated dynamics.** Long stasis is broken by sudden population irruptions (peak **592 of a 600 cap** at 2026-09-19 13:37).
9. **Seasonal nutrient cycle.** The soil pool is ~5.9× larger in winter than spring, and population is ~21% lower in winter samples.
10. **Neutral evolution is visible.** Immunity random-walks across almost its whole range (0.06–0.97) because no epidemic ever took hold (never more than one infected creature).
11. **Brain "complexity" grows linearly (~10 connections/hour) with no plateau, but this is probably mostly inert wiring**: in the current code, hidden nodes never pass a signal on (§5.10, §7).

---

## 2. Data and method

### 2.1 What the columns mean

| Column | Meaning (from the code) |
|---|---|
| `gen` | **Number of extinctions since the server process started**, not generations. |
| `max_lineage` | Deepest ancestry depth among creatures alive at that moment (this *is* generations). |
| `avg_*` | Population means of the trait genes (`size`, `speed`, `immunity`, `insulation`, `chloroplast`, `scavenger`, `carnivore`) and of brain connection count. |
| `max_age`, `max_energy` | Maximum over living creatures (ticks, energy units). |
| `births`, `deaths` | Cumulative since process start. |
| `food`, `poison` | Active plant items / active "poison" items (which are also corpses). |
| `fertilizer` | Size of the soil nutrient pool (`globalFertilizer`). |
| `season` | 0 spring, 1 summer, 2 autumn, 3 winter, at the moment of the snapshot. |

A row is written every **10 minutes**, plus an immediate **forced row on every extinction** (which captures the fresh genesis population).

### 2.2 Server sessions (inferred from cumulative counters resetting to 200)

| Session | Start | Last row | Duration | Extinctions | Note |
|---|---|---|---|---|---|
| 0 | 09-17 11:14 | 09-17 11:25 | 0.18 h | 3 | Genesis has ~1,000 food items, 24k fertilizer, unlike later sessions, so the code changed before session 1 |
| 1 | 09-17 11:25 | 09-17 13:34 | 2.15 h | 47 | |
| 2 | 09-17 13:36 | 09-17 20:34 | 6.97 h | 146 | |
| 3 | 09-17 20:34 | 09-21 03:07 | 78.54 h | 1 | First extinction 2.4 min in; the next epoch **survived** |

Sessions 1–3 have statistically identical genesis states, so I treat them as one system. I assume the uploaded `server_v2.js` produced session 3.

### 2.3 Definitions used

- **Epoch duration** = time between successive genesis rows (sessions 0–2 only; 196 completed epochs).
- **Mean lifespan** = population ÷ birth rate (Little's law), in **wall-clock** minutes. It is load-dependent (§7).
- **Body-size state** = "large" when mean size passes 1.8, "small" again when it drops below 1.5 (hysteresis, so noise doesn't flip it).
- Statistics "after h 1" or "after h 10" skip the initial transient.

---

## 3. World mechanics that shape the biology

| Mechanism in the code | Selective consequence |
|---|---|
| 400 founders, random 1–5-wire brains, 1,000 energy each, 25% of initial items toxic | Harsh founder filter; strong early selection for foraging and against poison |
| Metabolism = `0.05·size^0.75` (Kleiber) + `0.01·size·v²` + vision + age + `0.0001 × connections` | Larger bodies cheaper per unit mass; speed and brain size carry real costs |
| Plant item = `60·(1 − carnivore)`; poison/carrion item = `−80 + 140·scavenger` | Scavenger gene is toxic-to-profitable switch at ~0.57; costs nothing on plants |
| `chloroplast + scavenger + carnivore ≤ 1`; photosynthesis only in spring/summer; chloroplast makes movers sessile | Trophic trade-off; autotrophy is weak (`0.1·gene` energy per tick) |
| Winter cost `(1 − insulation)·0.10`, summer cost `insulation·0.05`; Ice/Greenhouse eras rescale both | Normal-era optimum is insulation → 1; Greenhouse era favours lower |
| Mitosis at energy > `300·size` (child costs `200·size`); mating needs mutual intent and > `150·size` | Body size sets reproductive threshold, so it couples to life history |
| All burned energy and dead mass return to `globalFertilizer`; food spawns in proportion to it | Closed nutrient cycle with seasonal spawn rate (spring 0.40, winter 0.05) |
| Winter viral seeding (50%), contact transmission, immunity reduces infection | Potential for host–pathogen selection (not realised, §5.9) |
| Hard clamps: speed 0.5–4, size 0.5–2.5, vision 20–200 | Directional selection can hit a wall |

---

## 4. Chronology of the surviving run

Means over the ±30-minute window around each mark (first row is a single sample, 10 min after genesis).

| Time | Pop | Size | Speed | Connections | Scavenger | Chloroplast | Carnivore | Insulation | Immunity | Max lineage |
|---|---|---|---|---|---|---|---|---|---|---|
| Founders | 600 | 1.50 | 1.75 | 3.0 | 0.004 | 0.004 | 0.004 | 0.50 | 0.50 | 1 |
| 10 min | 296 | 1.22 | 3.62 | 11.0 | 0.11 | 0.080 | 0.057 | 0.35 | 0.54 | 76 |
| h 1 | 181 | 1.67 | 3.85 | 18.8 | 0.43 | 0.058 | 0.051 | 0.63 | 0.36 | 222 |
| h 2 | 162 | 1.64 | 3.79 | 29.7 | 0.76 | 0.064 | 0.050 | 0.76 | 0.21 | 335 |
| h 10 | 210 | 0.97 | 3.82 | 123.5 | 0.71 | 0.073 | 0.056 | 0.87 | 0.35 | 1,727 |
| h 20 | 189 | 2.08 | 3.81 | 233.3 | 0.63 | 0.062 | 0.048 | 0.90 | 0.87 | 3,135 |
| h 30 | 190 | 1.22 | 3.86 | 331.9 | 0.62 | 0.045 | 0.039 | 0.91 | 0.43 | 4,595 |
| h 40 | 153 | 1.18 | 3.89 | 435.8 | 0.79 | 0.048 | 0.054 | 0.84 | 0.32 | 5,989 |
| h 50 | 197 | 1.87 | 3.85 | 497.6 | 0.57 | 0.053 | 0.038 | 0.87 | 0.69 | 7,215 |
| h 60 | 275 | 2.30 | 3.87 | 604.1 | 0.78 | 0.050 | 0.035 | 0.85 | 0.38 | 8,555 |
| h 70 | 241 | 2.28 | 3.85 | 665.2 | 0.79 | 0.056 | 0.036 | 0.80 | 0.62 | 9,719 |
| h 77 | 207 | 2.33 | 3.87 | 716.6 | 0.69 | 0.044 | 0.035 | 0.79 | 0.84 | 10,438 |

Final row (2026-09-21 03:07): pop 527, 1,360,349 births, 1,360,622 deaths, max lineage 10,516, 730 connections.

---

## 5. Biological phenomena observed

### 5.1 Founder bottleneck and repeated mass extinction

**Observed.**
- 196 completed epochs (sessions 0–2): median **1.5 min**, mean 2.8 min, interquartile range 1.1–3.5 min, longest 17.3 min. 99 epochs (51%) lasted under 1.5 minutes; only 8 (4%) lasted ≥10 minutes.
- Every genesis snapshot matches the random priors (mean size 1.502, speed 1.750, immunity 0.499, insulation 0.499, 3.02 connections), a good sanity check that the log reflects the code.
- The 8 epochs that reached a timed log were all near-extinct (pop 3–32, median 8) and all still in season 2. Each was followed by another extinction.
- Compared with founders, those 8 survivor populations already had **larger brains (mean 7.5 vs 3.0 connections)**.

**Reading.**
- A classic **boom-and-bust founder crash**: founders start with 1,000 energy and random brains, expand to the slot cap (400 → 600), and then most lineages starve before selection can act. Most epochs end in **complete extinction through a severe bottleneck**.
- The larger brains in the near-extinct survivors are best read as **survivorship bias**: only creatures with working sensor-to-motor wiring endured. Confidence: high for the pattern, moderate for the mechanism.
- All 8 timed logs land in season 2 because genesis always resets to spring and 10 min is ten seasons, which implies ~55–60 s per season (§7).

![Founder filter](fig1_founder_filter.png)
*Fig. 1: Left: 196 founder epochs, heavily skewed toward immediate collapse. Right: at the 10-minute mark, the eight near-extinct epochs versus the run that survived.*

### 5.2 Evolutionary rescue in the one surviving epoch

**Observed.** At the first timed log (10 min after genesis) the population was 296 (from 600) and already far from the founder state: speed **3.62 (×2.1)**, connections **11 (×3.6)**, scavenger **0.11 (×28)**, chloroplast 0.08, carnivore 0.057, deepest lineage **76 generations**. The standing crop of poison items fell from **76 to 1**. The failed epochs at the same age had speed 0.74–2.43 and populations of 3–32.

**Reading.** This looks like **evolutionary rescue**: a population that would otherwise have gone extinct adapts fast enough (dozens of generations in minutes) to avoid it. The removal of the poison stock is consistent with the scavenger gene evolving in response to it. Chance still plays a role: founder wiring is random, and one success in 197 tries cannot separate a reproducible route from a lucky start. Confidence: high that rapid directional selection occurred, low on why this epoch and not others.

### 5.3 Directional selection to a genetic boundary (speed)

**Observed.** Mean speed was **3.84 ± 0.04** (SD across 471 windows after the first), against a clamp of 4.0. It exceeded 3.7 in 98.7% of windows and crept up only slightly over 78 hours (3.81 → 3.87 in ten-hour block means).

**Reading.** Directional selection drove the trait into the hard clamp, after which **variance is exhausted** (fixation at or near the ceiling). This is a good demonstration of a **constraint on adaptation** set by the model rather than by biology: the quadratic movement cost (`0.01·size·v²`) was clearly outweighed by foraging gains, so the optimum lies beyond the allowed range. Raising the cap would test that. Confidence: high.

![Trait trajectories](fig2_trait_trajectories.png)
*Fig. 2: Speed (top left), brain connections (top right), trophic genes (bottom left), insulation and immunity (bottom right) for the surviving run.*

### 5.4 Trophic evolution: scavenging dominates

**Observed.**
- The scavenger gene rose from 0.004 to ~0.43 by h 1 and ~0.76 by h 2, then stayed around **0.68 on average (range 0.28–0.87)**.
- Chloroplast averages ~0.05 and carnivore ~0.04, both drifting down slowly. The three means sum to ~0.77 (range 0.25–0.95), close to the ≤ 1 trade-off ceiling.
- After h 2 the poison/corpse count is tiny (mean 1.8, median 1, max 8), while plant items average ~67–76 in every season.

**Reading.**
- **Detritivory (scavenging) became the dominant niche.** The likely reason is that the gene turns a −80 toxin into up to +60 energy and costs nothing on ordinary plant items, so it is close to a free advantage. Corpses are eaten almost as fast as they appear, a tight **necromass recycling loop**.
- **No established autotroph or predator guild is visible.** Because only means are logged, a specialist subpopulation below roughly 4–5% cannot be excluded.
- The scavenger mean dips repeatedly (to 0.28–0.5) and recovers. Its correlation with poison count is ~0, so I read the dips as relaxed selection and drift when corpses are scarce, not as frequency-dependent cycling. Confidence: moderate for the mechanism, high for the pattern.

### 5.5 Thermal adaptation: insulation

**Observed.** Insulation went from 0.50 to a mean of **0.845 (SD 0.075)** after h 1, above 0.8 in 81% of windows after h 5. There are **clusters of low values** (< 0.72): h 11.5–14.2 (10 windows), h 54.7–57 (5), and shorter dips near h 66, 70 and 76.

**Reading.**
- Under the code's costs the normal-era optimum is insulation = 1 (winter penalty double the summer one), so this is **directional selection for cold tolerance**, held slightly below the cap by mutation.
- Eras are **not logged**. The low-insulation clusters are consistent with Greenhouse eras (which double summer overheating and halve winter cost), but this is a hypothesis. Confidence: high for the overall trend, low for the era attribution.

### 5.6 Alternative stable states: body size and life history

**Observed.** Mean size is **bimodal** (modes ≈ 1.3 and ≈ 2.2) and switches abruptly:

| State | Starts (UTC) | Approx. length |
|---|---|---|
| Small | from genesis (brief blip near h 2) | ≈13.7 h |
| **Large** | 09-18 10:27 (h 13.8) | 11.6 h |
| Small | 09-18 22:17 (h 25.7) | 15.7 h |
| **Large** | 09-19 14:07 (h 41.5) | 7.5 h |
| Large (after brief dip) | 09-19 22:27 (h 49.8) | 3.5 h |
| Small | 09-20 02:07 (h 53.5) | 2.7 h |
| **Large** | 09-20 04:57 (h 56.3) | 22 h and continuing |

Comparison after h 10:

| | Small state | Large state |
|---|---|---|
| Mean size | 1.29 | 2.16 |
| Population | 191 | 228 |
| Births per minute | 323 | 262 |
| Mean lifespan (min) | 0.62 | 0.90 |
| Oldest individual (ticks) | 11,100 | 16,500 |
| Mean immunity | 0.32 | 0.55 |
| Soil nutrient pool | 7.6k | 12.8k |

**Reading.**
- This is a **fast/slow (r vs K) life-history axis**: small bodies reproduce quickly and die young, large bodies breed slowly and live longer. The deepest-lineage advance also slows (~170/h in h 1–10, ~125–135/h mid-run, ~105/h at the end, though the last figure also reflects the late slowdown), consistent with longer generation times.
- Size in the large state sits within ~5–12% of the 2.5 cap, so a **Cope's-rule-like drift toward large size** is being limited by the clamp.
- Large bodies also have the larger population, the opposite of Damuth's law, possibly because the large state coincides with a richer nutrient pool.
- The small state reaches a mean of **0.88** (h 10.2), 41% below the founder mean, a resource-limited miniaturisation that echoes insular dwarfism only loosely (the code has no island effect).
- The switches are abrupt with long stasis between them: **punctuated equilibrium**. Because only means are logged, I can't tell a whole-population shift from a change in the mix of two clades. A **clade replacement/selective sweep** is the simplest reading. Confidence: high for the two states, moderate for the mechanism.

![Size regimes and life history](fig3_size_regimes_life_history.png)
*Fig. 3: Body-size state (shaded = large), population, and estimated lifespan. The lifespan spike in the last 40 minutes is a slowdown artefact (§7).*

### 5.7 Irruptions and sudden population upshifts

| When (UTC) | Change | Notes |
|---|---|---|
| 09-18 09:47 (h 13.2) | pop 168 → **473**, peak 509 | Births ≈ 2× the surrounding baseline for ~1 h; large-body state takes over 40 min later |
| 09-19 13:27 (h 40.8) | pop 153 → **551**, peak **592** (2026-09-19 13:37) | 98.7% of the 600 slot cap; back to ~275 in 1 h; large-body state takes over 40 min later |
| 09-20 18:27 (h 69.8) | pop 125 → **310**, held at 210–340 for ~5.5 h, then eased to ~170–250 | No size change (already large) |
| 09-21 02:27 (h 77.7) | pop 211 → **516**, `max_age` 17,170 → 7,229, fertilizer 26k → 63k | Only window in the run where the oldest age fell by more than 45% |

**Reading.**
- The first two are classic **irruption then overshoot and decay**. In both, the large-bodied state took over about 40 minutes later (n = 2, so treat as an observation, not a rule).
- The last window is what a **mass mortality of old individuals followed by a recruitment pulse** would look like: the oldest survivor's age collapses while the soil pool jumps. It could be a severe winter/Ice-Age era, a manual meteor, or something else; the log can't say.
- The four upshifts show that **carrying capacity is not fixed**: it stepped from ~200 to ~300 for hours. Confidence: high that the shifts happened, low on causes.

### 5.8 Seasonal ecology and nutrient cycling

Statistics for windows after h 1:

| Season | Mean pop | Mean soil pool | Mean plant items |
|---|---|---|---|
| Spring | 234 | 3.4k | 73 |
| Summer | 222 | 8.7k | 76 |
| Autumn | 218 | 7.5k | 67 |
| **Winter** | **184** | **20.0k** | 73 |

The population differs by season (Kruskal–Wallis p ≈ 3×10⁻¹⁴).

**Reading.**
- A clean **seasonal sawtooth**: winter famine (spawn rate 0.05) lets the pool build up as deaths return energy to the soil, and the spring bloom (0.40) draws it back down (~5.9× swing).
- Population falls ~21% in winter samples.
- Plant items stay flat across seasons (67–76). The nominal spawn rate varies 8× (spring 0.40, winter 0.05), but spawns scale with *pool × rate* and the pool moves the opposite way, so effective spawning varies only ~1.7× (≈0.8–1.4 spawns/tick using mean pools, ignoring eras). That is a built-in **nutrient buffer**, together with consumer-set demand; the means can't separate the two. Confidence: high for the sawtooth, moderate for the buffering reading.

![Seasonality](fig4_seasonality.png)
*Fig. 4: Population and soil nutrient pool by season at the moment of sampling.*

### 5.9 Neutral evolution and the absence of epidemics (immunity)

**Observed.**
- Mean immunity wanders across **0.064–0.961** (mean 0.44, SD 0.25). Its 10-minute autocorrelation is 0.94, falling to 0.73 at 1 h and ~0.08 at 6 h. It correlates with body size (r = 0.35).
- `infected_pop` was non-zero in only **14 of 473 windows**, always exactly **1** creature, always in **winter**.

**Reading.**
- The gene carries **no cost when uninfected** and infections never spread (effective R < 1), so there is **no pathogen-driven selection**. What we see is **genetic drift in a small population** (~200), plus **hitchhiking**: immunity shifts alongside the body-size sweeps in §5.6.
- The single infected creature matches the code's winter seeding (50% chance at each winter's start).
- **The Red Queen hypothesis is not supported here.** Confidence: high for drift and no epidemics, moderate for the hitchhiking link.

### 5.10 Neural complexity growth (probably mostly neutral bloat)

**Observed.** Connections rose from 3 → 11 (10 min) → 124 (h 10) → 233 (h 20) → 436 (h 40) → 604 (h 60) → **730** (end), a near-linear ~10 connections/hour (5.8–12.1/h across 5–10-hour windows) with **no plateau**. That is ≈ 0.07 connections per generation (730 ÷ 10,516) against an expected **+0.10 per birth** from the mutation operator alone (delete −0.2, add-node +0.15, add-connection +0.15). At 730 connections the brain tax (0.073/tick) is **~76% of a size-2.4 body's basal cost** (0.096/tick).

**Reading.**
- Growth at ~70% (or more, since the deepest line overstates mean depth) of what mutation alone would produce says **selection is barely resisting**, consistent with **near-neutral accumulation under a weak drift barrier** (genome/complexity "bloat").
- Code check: in `processBrain`, connections read `nodes[c.in]` from the pre-propagation array, so any connection starting at a **hidden** (≥ 28) or **output** (16–27) node always contributes 0. I confirmed with a test: a direct sensor→motor wire gives 0.76, the same wire split through a hidden node gives 0. Only 16 inputs × 12 outputs = **192 possible functional slots** exist; **add-node mutations functionally delete a live wire while adding a connection**.
- So `avg_connects` overstates real neural elaboration, and this "phenomenon" is better labelled **accumulation of mostly inert structure** than cognitive evolution. Confidence: high for the growth, moderate-to-high for the inert-wiring reading (code-based; I can't see the functional fraction in the log).

### 5.11 Demographic steady state and longevity

**Observed.** Births and deaths agree to 0.02% over 1.36 M events. After h 1 the population averages **213 (SD 67, CV 0.32, range 95–592)**, with ~17,300 births per hour (~290/min). Estimated mean lifespan is **0.6–0.7 min** in small-body periods and **0.8–1.0 min** in large-body periods. The record `max_age` is **26,858 ticks** (2026-09-19 15:37, large state).

**Reading.**
- The population sits at a **resource-limited carrying capacity**, not the slot cap (600), which was approached only once.
- The deepest line advances ~100–170 generations per hour (roughly one generation per 20–35 s of wall-clock for the fastest lineage), which fits inside a mean lifespan of 0.6–1 min because reproduction happens mid-life.
- The oldest individuals live several times the mean lifespan, a heavy longevity tail (tick-rate conversions are uncertain, §7). Confidence: high.

### 5.12 Expected phenomena that were **not** observed

- **Host–pathogen cycles (Red Queen):** no (§5.9).
- **Photosynthetic or predatory guilds:** not evident from means (§5.4).
- **Predator–prey oscillations:** no signal; the log has no per-guild counts.
- **Speciation:** not measurable (no hue, diversity or clade data).
- **Long-run extinction:** none in 78 h, unlike the first 196 epochs.

---

## 6. Summary table

| Phenomenon | Evidence in the log | Confidence |
|---|---|---|
| Founder bottleneck / mass extinction | 196 epochs, median 1.5 min | High |
| Survivorship bias in near-extinct snapshots | 8 epochs, brains 7.5 vs 3.0 | High |
| Evolutionary rescue | Speed ×2.1, connections ×3.6 in 10 min | High (pattern) / Low (why) |
| Directional selection to a ceiling | Speed 3.84 ± 0.04 vs cap 4.0 | High |
| Trophic specialisation (detritivory) | Scavenger ~0.7; poison ≈ 1 | Moderate |
| Thermal adaptation | Insulation 0.50 → 0.85 | High |
| r → K life-history states | Size, lifespan, birth rate contrast | Moderate–High |
| Punctuated equilibrium / clade replacement | Abrupt size switches | Moderate |
| Population irruption and overshoot | Peaks of 509 and 592 | High (pattern) / Low (cause) |
| Carrying capacity | Pop ≈ 200, births ≈ deaths | High |
| Seasonal cycle + nutrient cycling | Winter pool ×5.9, pop −21% | High |
| Genetic drift / hitchhiking | Immunity 0.06–0.97, no epidemics | High / Moderate |
| Neutral complexity accumulation | ~10 connections/h, inert hidden nodes | Moderate–High |
| Red Queen | Not supported | n/a |
| Insular dwarfism | Loose analogy only | Low |

---

## 7. Caveats and code-level notes

1. **Averages only.** A shifted mean can be a whole-population change or a change in the mix of two groups. Fixation, bimodality and guild sizes can only be bounded, not measured.
2. **Sampling vs seasons.** Ten-minute samples alias with the season cycle (~1 min per season early on) and the era cycle (36,000 ticks). Season is a snapshot label; the era is not logged.
3. **Wall-clock vs ticks.** Tick cost grows roughly linearly with the number of living creatures (each scans all 1,500 item slots and 600 creature slots several times per tick), so the sim slows as it fills. Per-minute rates and the lifespan estimate are load-dependent. In the **last ~40 minutes** births per 10 min fell to 1.5–2.1k while population doubled, inflating the lifespan estimate. Three consecutive winter windows with near-identical fertilizer (62.4–63.3k) are most likely **phase-locking of the 10-minute sampling to the seasonal cycle**, not a plateau (hypothesis).
4. **Season length.** All 8 timed logs in sessions 1–2 show season 2. That implies roughly 55–60 s per season (~50 ticks/s) early on, the closest fit to the code's intent, rather than the ~2 minutes in its comment (other solutions exist).
5. **Unlogged interventions.** Radiation bursts (55% saltation per birth for 10 s), meteors (90% kill) and food drops can't be told apart from natural variation. Single-window connection-count dips of 20–28 (e.g. h 61.0, 69.9, 71.2, 75.2) are candidates for radiation bursts, or just noise.
6. **Code version.** Session 0 differs from later sessions, so the code changed between them; subtler edits between sessions 2 and 3 can't be excluded.
7. **Inert hidden nodes** (§5.10): fixing evaluation order (topological order or multiple passes) would make the connection count meaningful.
8. **Infection seeding:** the seeding code picks two independent random creatures, one to infect and one to receive `viralLoad = 1`, so patient zero starts at zero viral load. Minor, but it slightly lowers epidemic potential.
9. **Small samples:** the 8 near-extinct snapshots are tiny (pop 3–32) and only usable as a survivorship signature.

---

## 8. Suggested logging for the next run

- **Per-gene SD or histograms** to see fixation and bimodality directly.
- **Counts per trophic class** (chloroplast/scavenger/carnivore above 0.5), not only means.
- **Era, tick counter and ticks/second**, so rates can be normalised to ticks.
- **Event flags** (meteor, radiation, food drops) and infection counts.
- **Hidden-node count and functional-connection count** per brain.
- **Sampling period not commensurate with the season** (or per-season min/max/mean) to avoid aliasing.

---

## Appendix: figures

| File | Content |
|---|---|
| `fig1_founder_filter.png` | Founder epoch duration histogram; survivors at 10 min |
| `fig2_trait_trajectories.png` | Speed, connections, trophic genes, insulation/immunity |
| `fig3_size_regimes_life_history.png` | Size states, population, estimated lifespan |
| `fig4_seasonality.png` | Population and soil pool by season |

Keep the PNGs in the same folder as this `.md` so the image links resolve.
