import * as C from "./constants";
import {
  type Draft,
  stats,
  row,
  timer,
  dist,
  unit,
  cooldown,
  zone,
  projectile,
  spawnEnemy,
  windowIndex,
  commons,
  randomItem,
  chest,
  rollDrop,
  xpNext,
  openLevel,
} from "./model";
import type { WeaponId } from "./types";
export type Sound = (cue: C.CueName) => void;
const radians = (n: number) => (n * Math.PI) / 180;
function fire(s: Draft, id: WeaponId, level: number) {
  const r = s.run,
    d = row(id, level),
    st = stats(r),
    p = r.player,
    n = (d.amount ?? 1) + st.amountBonus,
    face = p.facing === "right" ? 1 : -1;
  const near = [...r.enemies].sort(
    (a, b) => dist(a, p) - dist(b, p) || a.id - b.id,
  );
  const aim = near[0]
    ? unit(near[0].x - p.x, near[0].y - p.y, face)
    : { x: face, y: 0 };
  if (id === "taper" || id === "pyre") {
    for (let i = 0; i < Math.min(C.TAPER_MAX_AMOUNT, n); i++)
      zone(
        s,
        id,
        "slash",
        p.x + (face * (i ? -1 : 1) * d.width! * st.areaMul) / 2,
        p.y,
        C.SLASH_FLASH,
      );
  } else if (id === "ember" || id === "beacon") {
    for (const e of near.slice(0, n)) {
      const u = unit(e.x - p.x, e.y - p.y, face);
      projectile(s, id, p.x, p.y, u.x * d.speed!, u.y * d.speed!, d.pierce!);
    }
  } else if (id === "pin" || id === "hail") {
    for (let i = 0; i < n; i++)
      projectile(
        s,
        id,
        p.x,
        p.y + (i - (n - 1) / 2) * C.PIN_SPREAD,
        face * d.speed!,
        0,
        d.pierce!,
      );
  } else if (id === "shard" || id === "sconce") {
    if (id === "sconce" && !near.length) return;
    for (let i = 0; i < n; i++) {
      const a =
        Math.atan2(aim.y, aim.x) +
        radians(
          (i - (n - 1) / 2) *
            (id === "shard" ? C.SHARD_SPREAD : C.SCONCE_SPREAD),
        );
      projectile(
        s,
        id,
        p.x,
        p.y,
        Math.cos(a) * d.speed!,
        Math.sin(a) * d.speed!,
        C.INFINITE_PIERCE,
      );
    }
  } else if (id === "oil-splash" || id === "blaze") {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 2 * Math.PI,
        len = C.OIL_SCATTER * Math.sqrt(Math.random()),
        off =
          i === 0 && r.nextPuddleOffset
            ? r.nextPuddleOffset
            : { x: Math.cos(a) * len, y: Math.sin(a) * len };
      zone(s, id, "puddle", p.x + off.x, p.y + off.y, d.duration!);
    }
    r.nextPuddleOffset = null;
  } else if (id === "spark") {
    const eligible = near.filter((e) => dist(e, p) <= C.SPARK_RANGE);
    if (!eligible.length) return;
    const posed = eligible.find((e) => e.id === r.nextStrikeTarget);
    r.nextStrikeTarget = null;
    for (let i = 0; i < n && eligible.length; i++) {
      const e = i === 0 && posed ? posed : randomItem(eligible);
      eligible.splice(eligible.indexOf(e), 1);
      zone(s, id, "strike", e.x, e.y, C.SPARK_FLASH);
    }
  } else if (id === "flare") zone(s, id, "burst", p.x, p.y, C.FLARE_FLASH);
  else if (id === "lantern" || id === "chandelier") {
    for (let i = 0; i < n; i++) {
      const angle = (i * 2 * Math.PI) / n,
        z = zone(
          s,
          id,
          "lantern",
          p.x + Math.cos(angle) * d.orbit! * st.areaMul,
          p.y + Math.sin(angle) * d.orbit! * st.areaMul,
          id === "chandelier" ? null : d.duration!,
        );
      s.visual.orbits[z.id] = { orbit: d.orbit! * st.areaMul, angle };
    }
  }
}
function director(s: Draft) {
  const r = s.run,
    p = r.player;
  if (s.despawning)
    r.enemies = r.enemies.filter(
      (e) =>
        C.ENEMIES[e.type].rank !== "common" || dist(e, p) <= C.DESPAWN_DISTANCE,
    );
  const ring = (type: C.EnemyId) => {
    const a = radians(r.nextSpawnAngle ?? Math.random() * 360);
    r.nextSpawnAngle = null;
    spawnEnemy(
      s,
      type,
      p.x + Math.cos(a) * C.SPAWN_DISTANCE,
      p.y + Math.sin(a) * C.SPAWN_DISTANCE,
    );
  };
  if (s.events)
    for (const e of C.EVENTS)
      if (r.tick === e.time * C.TICK_HZ && !r.firedEvents.includes(e.time)) {
        r.firedEvents.push(e.time);
        r.firedEvents.sort((a, b) => a - b);
        if (e.kind === "spawn") ring(e.type);
        else {
          const a = radians(r.nextSwarmAngle ?? Math.random() * 360),
            dx = Math.cos(a),
            dy = Math.sin(a);
          r.nextSwarmAngle = null;
          for (let i = 0; i < C.SWARM_SIZE; i++) {
            const t =
              ((i - (C.SWARM_SIZE - 1) / 2) * C.SWARM_LINE) /
              (C.SWARM_SIZE - 1);
            spawnEnemy(
              s,
              e.type,
              p.x + dx * C.SPAWN_DISTANCE - dy * t,
              p.y + dy * C.SPAWN_DISTANCE + dx * t,
            );
            r.enemies[r.enemies.length - 1].heading = { x: -dx, y: -dy };
          }
        }
      }
  if (s.spawning) {
    if (windowIndex(r.tick) !== windowIndex(r.tick - 1)) r.spawnTimer = 0;
    r.spawnTimer = timer(r.spawnTimer);
    const w = C.SPAWN_WINDOWS[windowIndex(r.tick)];
    if (!r.spawnTimer && commons(r) < w.cap) {
      const type =
        r.nextSpawnType && w.types.includes(r.nextSpawnType)
          ? r.nextSpawnType
          : randomItem(w.types);
      r.nextSpawnType = null;
      ring(type);
      r.spawnTimer = w.interval;
    }
  }
  const live = new Set(r.enemies.map((e) => e.id));
  for (const x of [...r.projectiles, ...r.zones])
    x.hits = x.hits.filter((h) => live.has(h.enemy));
}
export function tick(s: Draft, dx: number, dy: number, sound: Sound) {
  const r = s.run,
    p = r.player,
    st = stats(r),
    oldId = r.nextId;
  // Phases 1–3: clock, normalized movement, then recovery.
  r.tick++;
  const movement = unit(dx, dy, 0);
  s.visual.moving = !!(dx || dy);
  if (s.visual.moving) {
    s.visual.moved++;
    p.x += movement.x * st.moveSpeed * C.TICK_DT;
    p.y += movement.y * st.moveSpeed * C.TICK_DT;
  }
  if (dx) p.facing = dx > 0 ? "right" : "left";
  p.hp = Math.min(st.maxHp, p.hp + st.recovery * C.TICK_DT);
  // Phase 4: derive a weaver’s anchor before updating its age.
  for (const e of r.enemies) {
    const data = C.ENEMIES[e.type];
    let x = e.x,
      y = e.y;
    if (data.behavior === "weave") {
      const off =
        C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * e.age) / C.WISP_PERIOD);
      x += e.heading.y * off;
      y -= e.heading.x * off;
    }
    e.age += C.TICK_DT;
    if (
      s.enemyMotion &&
      (data.behavior === "drift" || Math.hypot(p.x - x, p.y - y) > 0)
    ) {
      if (data.behavior !== "drift")
        e.heading = unit(p.x - x, p.y - y, p.facing === "right" ? 1 : -1);
      x += e.heading.x * data.speed * C.TICK_DT;
      y += e.heading.y * data.speed * C.TICK_DT;
      if (data.behavior === "weave") {
        const off =
          C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * e.age) / C.WISP_PERIOD);
        x -= e.heading.y * off;
        y += e.heading.x * off;
      }
      e.x = x;
      e.y = y;
    }
  }
  // Phase 5: fire in slot order; permanent shape placement is never gated.
  const pulses = new Set<WeaponId>();
  for (const w of r.weapons) {
    if (s.weaponFire && w.id !== "chandelier") {
      w.cooldown = timer(w.cooldown);
      if (!w.cooldown) {
        pulses.add(w.id);
        fire(s, w.id, w.level);
        w.cooldown =
          cooldown(w.id, w.level, r) +
          (w.id === "lantern" ? row(w.id, w.level).duration! : 0);
      }
    }
  }
  r.zones = r.zones.filter(
    (z) =>
      !["aura", "lantern"].includes(z.kind) ||
      r.weapons.some((w) => w.id === z.weapon),
  );
  for (const w of r.weapons) {
    if (w.id === "halo" || w.id === "corona") {
      let z = r.zones.find((z) => z.weapon === w.id && z.kind === "aura");
      if (!z) z = zone(s, w.id, "aura", p.x, p.y, null);
      const d = row(w.id, w.level);
      z.x = p.x;
      z.y = p.y;
      z.radius = d.radius! * st.areaMul;
      z.damage = d.damage * st.damageMul;
    }
    if (w.id === "chandelier") {
      w.cooldown = 0;
      const n = C.CHANDELIER_STATS.amount + st.amountBonus;
      let set = r.zones.filter((z) => z.weapon === w.id);
      if (set.length !== n) {
        const angle = set[0] ? (s.visual.orbits[set[0].id]?.angle ?? 0) : 0;
        r.zones = r.zones.filter((z) => z.weapon !== w.id);
        fire(s, w.id, w.level);
        set = r.zones.filter((z) => z.weapon === w.id);
        for (const z of set) s.visual.orbits[z.id].angle += angle;
      }
      for (const z of set) {
        z.radius = C.CHANDELIER_STATS.radius * st.areaMul;
        z.damage = C.CHANDELIER_STATS.damage * st.damageMul;
        s.visual.orbits[z.id].orbit = C.CHANDELIER_STATS.orbit * st.areaMul;
      }
    }
  }
  // Phase 6: newly fired shapes hit now, but age and move from the next tick.
  for (const x of [...r.projectiles, ...r.zones]) {
    if (x.id < oldId) {
      if (x.ttl !== null) x.ttl = timer(x.ttl);
      x.hits = x.hits
        .map((h) => ({ ...h, cooldown: timer(h.cooldown) }))
        .filter((h) => h.cooldown > 0);
    }
  }
  r.projectiles = r.projectiles.filter((x) => x.ttl > 0);
  r.zones = r.zones.filter((x) => x.ttl === null || x.ttl > 0);
  for (const x of r.projectiles)
    if (x.id < oldId && s.effectMotion) {
      x.x += x.vx * C.TICK_DT;
      x.y += x.vy * C.TICK_DT;
      x.vx += x.ax * C.TICK_DT;
      x.vy += x.ay * C.TICK_DT;
      if (x.weapon === "shard") {
        for (const axis of ["x", "y"] as const) {
          const half = axis === "x" ? C.STAGE_CX : C.STAGE_CY,
            v = axis === "x" ? "vx" : "vy";
          const lo = p[axis] - half,
            hi = p[axis] + half;
          if (x[axis] < lo) {
            x[axis] = lo;
            if (x[v] < 0) x[v] = -x[v];
          }
          if (x[axis] > hi) {
            x[axis] = hi;
            if (x[v] > 0) x[v] = -x[v];
          }
        }
      }
    }
  for (const z of r.zones)
    if (z.kind === "lantern") {
      const o = s.visual.orbits[z.id];
      if (o) {
        if (z.id < oldId && s.effectMotion)
          o.angle += radians(C.LANTERN_ANGULAR_SPEED) * C.TICK_DT;
        z.x = p.x + Math.cos(o.angle) * o.orbit;
        z.y = p.y + Math.sin(o.angle) * o.orbit;
      }
    }
  const damage = (
    e: Draft["run"]["enemies"][number],
    amount: number,
    weapon: WeaponId,
  ) => {
    const hp = e.hp;
    e.hp -= amount;
    sound(C.CUES.hit);
    if (weapon === "pyre") p.hp = Math.min(st.maxHp, p.hp + C.PYRE_HEAL);
    if (weapon === "corona" && hp > 0 && e.hp <= 0)
      p.hp = Math.min(st.maxHp, p.hp + C.CORONA_HEAL);
  };
  // Resolve all shapes before removing any enemy, including overkill hits.
  const spent = new Set<number>();
  for (const x of r.projectiles) {
    for (const e of r.enemies) {
      if (
        x.hits.some((h) => h.enemy === e.id) ||
        dist(x, e) >= x.radius + C.ENEMIES[e.type].radius
      )
        continue;
      damage(e, x.damage, x.weapon);
      x.hits.push({
        enemy: e.id,
        cooldown:
          x.pierce === C.INFINITE_PIERCE
            ? x.weapon === "sconce"
              ? C.SCONCE_REHIT
              : C.SHARD_REHIT
            : x.ttl,
      });
      if (x.pierce !== C.INFINITE_PIERCE) {
        if (x.pierce === 0) {
          spent.add(x.id);
          break;
        }
        x.pierce--;
      }
    }
  }
  r.projectiles = r.projectiles.filter((x) => !spent.has(x.id));
  for (const z of r.zones) {
    const age = r.tick - (s.visual.born[z.id] ?? r.tick);
    const pulse =
      z.kind === "aura"
        ? pulses.has(z.weapon)
        : z.kind === "puddle"
          ? age %
              Math.round(
                (z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE) *
                  C.TICK_HZ,
              ) ===
            0
          : z.kind === "lantern" || age === 0;
    if (!pulse) continue;
    for (const e of r.enemies) {
      const radius = C.ENEMIES[e.type].radius;
      let overlap = dist(z, e) < z.radius + radius;
      if (z.kind === "slash") {
        const x = Math.max(Math.abs(e.x - z.x) - z.width! / 2, 0),
          y = Math.max(Math.abs(e.y - z.y) - z.height! / 2, 0);
        overlap = Math.hypot(x, y) < radius;
      }
      if (z.kind === "strike" || z.kind === "burst")
        overlap = dist(z, e) <= z.radius;
      if (z.kind === "burst" && C.FLARE_IMMUNE.includes(e.type)) continue;
      if (!overlap || z.hits.some((h) => h.enemy === e.id)) continue;
      damage(e, z.damage, z.weapon);
      if (z.kind === "lantern")
        z.hits.push({ enemy: e.id, cooldown: C.LANTERN_REHIT });
    }
  }
  for (const e of r.enemies)
    if (e.hp <= 0) {
      r.kills++;
      sound(C.CUES.kill);
      s.visual.puffs.push({ x: e.x, y: e.y, tick: r.tick });
      if (s.drops) {
        const d = C.ENEMIES[e.type];
        if (d.drop === "chest")
          r.pickups.push({ id: r.nextId++, kind: "chest", x: e.x, y: e.y });
        else if (d.drop)
          r.gems.push({
            id: r.nextId++,
            tier: d.drop,
            x: e.x,
            y: e.y,
            attracted: false,
          });
        if (d.rank === "common") {
          const drop = r.nextDrop ?? rollDrop();
          r.nextDrop = null;
          if (drop !== "none")
            r.pickups.push({ id: r.nextId++, kind: drop, x: e.x, y: e.y });
        }
      }
    }
  r.enemies = r.enemies.filter((e) => e.hp > 0);
  const live = new Set(r.enemies.map((e) => e.id));
  for (const x of [...r.projectiles, ...r.zones])
    x.hits = x.hits.filter((h) => live.has(h.enemy));
  // Phase 7: each surviving enemy has an independent contact timer.
  r.hurtFlash = timer(r.hurtFlash);
  for (const e of r.enemies) {
    e.contactCooldown = timer(e.contactCooldown);
    if (
      s.enemyContact &&
      !e.contactCooldown &&
      dist(e, p) < C.PLAYER_RADIUS + C.ENEMIES[e.type].radius
    ) {
      p.hp -= Math.max(C.MIN_DAMAGE_TAKEN, C.ENEMIES[e.type].damage - st.armor);
      e.contactCooldown = C.CONTACT_COOLDOWN;
      r.hurtFlash = C.HURT_FLASH;
      sound(C.CUES.hurt);
    }
  }
  // Phases 8–9: pickups precede gems, so drafts and chest stat gains apply now.
  let gotChest = false;
  r.pickups = r.pickups.filter((x) => {
    if (
      dist(x, p) >= C.PICKUP_ITEM_RADIUS + C.PLAYER_RADIUS ||
      (x.kind === "chest" && gotChest)
    )
      return true;
    if (x.kind === "bread") {
      p.hp = Math.min(stats(r).maxHp, p.hp + C.BREAD_HEAL);
      sound(C.CUES.pickup);
    }
    if (x.kind === "draft") {
      for (const g of r.gems) g.attracted = true;
      sound(C.CUES.pickup);
    }
    if (x.kind === "chest") {
      gotChest = true;
      chest(s);
      if (r.chestResult?.kind === "evolve") sound(C.CUES.evolve);
    }
    return false;
  });
  const collectionStats = stats(r);
  r.gems = r.gems.filter((g) => {
    let d = dist(g, p);
    if (d <= collectionStats.pickupRadius) g.attracted = true;
    if (g.attracted && g.id < oldId && d > 0) {
      const step = Math.min(d, C.GEM_SPEED * C.TICK_DT);
      g.x += ((p.x - g.x) / d) * step;
      g.y += ((p.y - g.y) / d) * step;
      d = dist(g, p);
    }
    if (d <= C.COLLECT_RADIUS) {
      r.xp += C.GEM_VALUES[g.tier] * collectionStats.xpMul;
      sound(C.CUES.gem);
      if (s.progression)
        while (r.xp >= xpNext(r.level)) {
          r.xp -= xpNext(r.level);
          r.level++;
          r.pendingLevelUps++;
        }
      return false;
    }
    return true;
  });
  // Phases 10–12: director, endings, then overlays, in that precedence.
  director(s);
  s.visual.puffs = s.visual.puffs.filter(
    (p) => r.tick - p.tick < C.PUFF_TIME * C.TICK_HZ,
  );
  const active = new Set([...r.projectiles, ...r.zones].map((x) => x.id));
  for (const key of Object.keys(s.visual.born))
    if (!active.has(+key)) delete s.visual.born[+key];
  for (const key of Object.keys(s.visual.orbits))
    if (!active.has(+key)) delete s.visual.orbits[+key];
  if (r.tick >= C.DAWN_TIME * C.TICK_HZ) {
    s.screen = "dawn";
    s.menuIndex = 0;
    sound(C.CUES.dawn);
  } else if (p.hp <= 0) {
    s.screen = "fallen";
    s.menuIndex = 0;
    sound(C.CUES.fallen);
  } else if (gotChest) {
    s.screen = "chest";
    s.menuIndex = 0;
    sound(C.CUES.chest);
  } else if (r.pendingLevelUps) {
    openLevel(s);
    sound(C.CUES.levelUp);
  }
}
