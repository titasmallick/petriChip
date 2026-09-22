# Comparison: Heavier vs. Lite Artificial-Life Sandboxes

Comparing `server_v2.js` / `evolution_v2_log.csv` (the "heavier" sim — seasons, eras, immunity/insulation, trophic genes, closed nutrient cycle) against `server.js` / `evolution_log.csv` (the "lite" sim — none of that, plus a different metabolism and mating rule). Full detail on each is in `evolution_v2_observation_report.md` and `evolution_lite_observation_report.md`; this note focuses on where they agree, where they diverge, and why the code differences plausibly explain it.

## At a glance

| | Heavier sim | Lite sim |
|---|---|---|
| Log span | 87.9 h (4 server sessions) | 21.7 h (1 continuous session) |
| Total extinctions logged | 346 (199 in early sessions + a further 146 within the "surviving" session before it, too, kept going) | 133 |
| Longest single epoch | **78.5 h**, still alive at the last row | **16.8 h**, ended in extinction |
| Founder-epoch median lifetime | 1.5 min (n=196) | 1.3 min (n=132) |
| Founder-epoch longest outlier | 17.3 min | 77.4 min |
| Population in the long epoch | median 202 (range 95–592), cap 600 never approached until h 78 | median 60 (range 18–139), cap 600 never approached |
| Final lineage depth reached | 10,516 generations (still climbing) | 5,272 generations (epoch ended) |
| Brain-connection growth rate | ~9.2 connections/hour | ~27 connections/hour |
| Final mean speed | 3.87 (cap 4.0) | 3.91 (cap 4.0) |
| Final mean size | 2.39 (floor 0.5, ceiling 2.5) | 0.62 (floor 0.5, ceiling 2.5) |
| What ended the long epoch | Still running when the log ends | Self-poisoning: corpses fill item slots with no decay/recycling, food gets crowded out |

![Head-to-head: founder lethality and sustained population](fig_compare_overview.png)
*Left: both worlds kill almost all founder populations within a couple of minutes; the lite world is marginally harsher (1.3 vs 1.5 min median) but the heavier world has a longer tail of near-misses. Right: the heavier sim's surviving epoch sustains roughly 3.4x the population of the lite sim's.*

## Where the two sims agree

1. **Founder bottleneck is universal.** In both codebases, the overwhelming majority of fresh 100–400-individual founder populations die within 1–2 minutes of wall-clock time, and only a rare epoch escapes. This isn't a tuning artifact of one version — it falls out of the shared genesis logic (random 1–5-wire brains, no learned foraging yet) in both.
2. **Speed converges to its hard cap in both.** Mean speed settles at 3.8–3.9 against a 4.0 clamp in both sims, and stays there for the rest of each surviving epoch — directional selection exhausting available variance at a boundary, independent of the metabolism differences below.
3. **Brain wiring grows roughly linearly with no plateau, and is mostly inert in both.** I checked `processBrain` in both codebases: connections are evaluated in a single forward pass over a stale node array, so any wire sourced from a hidden node or another output reads zero. This is the same bug in both files (confirmed with the same direct test), so in neither sim does "brain complexity" in the log mean much more than "connection count," most of which never fires.
4. **Evolutionary rescue reads as a stochastic, rare event in both**, not something that gets more likely with practice. The heavier sim needed 196 failed founder rounds before one broke through; the lite sim's first-ever attempt happened to succeed for 16.8 hours, and its very last logged epoch shows early signs of the same trajectory. Success or failure looks like it hinges on early luck (which random brains happen to wire up first), not on the world "learning."

## Where they diverge, and why

| Divergence | Heavier sim | Lite sim | Likely code reason |
|---|---|---|---|
| **Final body size** | Grows toward the size ceiling (2.4, near cap 2.5) | Shrinks toward the size floor (0.6, near floor 0.5) | Metabolism cost functions point opposite ways: the heavier sim's Kleiber-style `size^0.75` baseline cost makes large bodies cheap *per unit mass*, while its movement cost only scales with `size·v²`; the lite sim's baseline (`0.015·size`) and movement cost (`0.005·size·|motor|`) are both linear in size with no economy of scale, so being small is close to strictly cheaper there. Same evolutionary process, opposite optimum, because the cost curves differ. |
| **Why the long epoch eventually stalls/ends** | Still alive at h 78.5 — no terminal crisis observed, though population and traits keep swinging (irruptions, size-regime switches) | Ends at h 16.8 via apparent self-poisoning: no scavenger gene, no nutrient decay, so every death permanently occupies an item slot as poison, squeezing out food over time | The heavier sim closes the nutrient loop (`globalFertilizer`, corpse decay, a scavenger gene that turns toxin into food) — deaths get recycled. The lite sim has no such recycling: item slots only clear when eaten, and poison is uniformly costly with no gene to mitigate it. This is arguably the single biggest structural difference between the two worlds. |
| **Population ceiling reached** | Up to 592 of 600 (nearly saturates the slot cap during irruptions) | Never exceeds 139 of 600 | Consistent with the point above — a resource-recycling world can support far more standing biomass than one that slowly fills with unusable "toxic waste." |
| **Brain growth rate** | ~9.2 connections/hour | ~27 connections/hour (3x faster) | The lite sim's smaller, faster-cycling population (shorter generations, more total events per hour once corrected for population size) pushes more mutation events through per hour of wall clock; also plausible that a smaller node/connection space per brain (fewer total gene categories to mutate) concentrates more mutation budget onto brain wiring specifically — this is a hypothesis, not confirmed from the log. |
| **Ecological richness** | Seasons, two Ice-Age/Greenhouse eras, immunity/insulation genes, three trophic guilds (autotroph/scavenger/carnivore) | None of the above — a flat, unseasonal world with only speed/size/vision genes | By design: the lite build is a stripped-down version of the same NEAT-brain/mitosis/mating engine, with the ecological subsystems removed. Everything that depended on those subsystems in the heavier report (seasonal population dips, insulation adaptation, trophic specialization, immunity drift) simply cannot occur here — it's a scope difference, not a different outcome. |
| **Mating rule** | Requires a mutual neural "intent" output (an evolved behavioral signal) | Requires colour (`hue`) similarity (a fixed phenotype-matching rule) | Different design choice for how assortative mating works; the lite sim's version doesn't require any neural computation to mate, only a similar starting-condition trait, which is a simpler and probably weaker form of assortative mating. Hue isn't logged in either sim's CSV, so neither report can confirm actual mating-driven clustering from the data alone. |
| **Predation rule** | Requires a `carnivore` gene *and* a neural "aggression" output *and* a 1.2x size edge | Requires only a 1.5x size edge and an energy edge — no gene, no neural signal | The heavier sim makes predation an evolved strategy; the lite sim makes it a mechanical consequence of any size mismatch. Neither log records kill counts, so predation's actual role is inferred from code in both reports, not measured directly. |

## Bottom line

Both sandboxes tell the same core story about the shared NEAT-brain/mitosis engine: genesis is a near-lethal filter, speed selection saturates at the model's ceiling almost immediately, and logged "brain growth" mostly is not doing anything (same latent bug in both). Where they differ is almost entirely explained by the ecological plumbing the heavier version adds back in: nutrient recycling and a toxin-mitigating gene let it sustain a much larger population and push body size toward the opposite extreme, while the lite version's leaner, unrecycled economy lets it run small and fast but eventually chokes on its own dead.

## Caveats

These comparisons inherit the caveats of both underlying reports (population-mean-only logging, wall-clock rates that depend on population load, and code-inferred mechanisms that the logs can't directly confirm — see each report's own caveats section). The two logs also differ enormously in scale (87.9 h across 4 sessions vs. 21.7 h in one), so "total extinction count" and similar cumulative figures aren't directly comparable; the epoch-duration and rate comparisons above are the more apples-to-apples ones.
