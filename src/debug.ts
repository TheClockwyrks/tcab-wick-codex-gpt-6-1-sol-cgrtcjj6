import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { WickState, EnemyId, WeaponId, PassiveId, Screen } from "./types";
import type { WickDebugApi, WickSnapshot } from "./debug-types";
import {
  copy,
  initial,
  stats,
  xpNext,
  pool,
  windowIndex,
  commons,
  choose,
  spawnEnemy,
  projectile,
  zone,
  rollDrop,
  row,
  unit,
} from "./model";
import { menuRects, tabRects } from "./menus";
const valid = (yes: unknown): void => {
  if (!yes) throw new RangeError("Invalid Wick debug argument");
};
const finite = (...n: number[]) => n.every(Number.isFinite);
const integer = (n: number, min = 0, max = Infinity) =>
  Number.isInteger(n) && n >= min && n <= max;
const nonnegative = (n: number) => Number.isFinite(n) && n >= 0;
const screens: readonly Screen[] = [
  "title",
  "howto",
  "almanac",
  "playing",
  "levelup",
  "chest",
  "paused",
  "fallen",
  "dawn",
];
function enemy(s: ReturnType<typeof copy>, id: number) {
  const e = s.run.enemies.find((e) => e.id === id);
  valid(e);
  return e!;
}
function cleanHits(s: ReturnType<typeof copy>) {
  const ids = new Set(s.run.enemies.map((e) => e.id));
  for (const x of [...s.run.projectiles, ...s.run.zones])
    x.hits = x.hits.filter((h) => ids.has(h.enemy));
  return s;
}
export function snapshot(input: DeepReadonly<WickState>): WickSnapshot {
  const { visual: _, ...s } = copy(input);
  void _;
  const r = s.run,
    st = stats(r);
  return {
    ...s,
    version: C.WICK_DEBUG_VERSION,
    run: {
      ...r,
      time: r.tick / C.TICK_HZ,
      xpToNext: xpNext(r.level),
      maxHp: st.maxHp,
      armor: st.armor,
      moveSpeed: st.moveSpeed,
      pickupRadius: st.pickupRadius,
      spawnWindow: windowIndex(r.tick),
      aliveCommons: commons(r),
      pool: s.screen === "levelup" ? pool(r) : [],
    },
  } as WickSnapshot;
}
export const debug: WickDebugApi = {
  version: C.WICK_DEBUG_VERSION,
  reset: (s) => ({ ...initial(), muted: s.muted }),
  snapshot,
  reconcile: (s) => copy(s),
  menuRects,
  tabRects,
  setScreen(s, name) {
    valid(screens.includes(name));
    return {
      ...copy(s),
      screen: name,
      menuIndex: 0,
      almanacTab: 0,
      almanacScroll: 0,
      accumulator: name === "playing" ? s.accumulator : 0,
    };
  },
  choose(s, i) {
    const n = copy(s);
    choose(n, i);
    return n;
  },
  setSpawning: (s, on) => toggle(s, "spawning", on),
  setEvents: (s, on) => toggle(s, "events", on),
  setDespawning: (s, on) => toggle(s, "despawning", on),
  setEnemyMotion: (s, on) => toggle(s, "enemyMotion", on),
  setEnemyContact: (s, on) => toggle(s, "enemyContact", on),
  setWeaponFire: (s, on) => toggle(s, "weaponFire", on),
  setEffectMotion: (s, on) => toggle(s, "effectMotion", on),
  setDrops: (s, on) => toggle(s, "drops", on),
  setProgression: (s, on) => toggle(s, "progression", on),
  setTick(s, tick) {
    valid(integer(tick, 0, C.DAWN_TIME * C.TICK_HZ - 1));
    const n = copy(s);
    n.run.tick = tick;
    return n;
  },
  setSpawnTimer(s, t) {
    valid(nonnegative(t));
    const n = copy(s);
    n.run.spawnTimer = t;
    return n;
  },
  setNextSpawnAngle(s, d) {
    valid(finite(d) && d >= 0 && d < 360);
    const n = copy(s);
    n.run.nextSpawnAngle = d;
    return n;
  },
  setNextSwarmAngle(s, d) {
    valid(finite(d) && d >= 0 && d < 360);
    const n = copy(s);
    n.run.nextSwarmAngle = d;
    return n;
  },
  setNextSpawnType(s, id) {
    valid(C.ENEMY_IDS.includes(id));
    const n = copy(s);
    n.run.nextSpawnType = id;
    return n;
  },
  setNextPuddleOffset(s, x, y) {
    valid(finite(x, y) && Math.hypot(x, y) <= C.OIL_SCATTER);
    const n = copy(s);
    n.run.nextPuddleOffset = { x, y };
    return n;
  },
  setNextStrikeTarget(s, id) {
    const n = copy(s);
    enemy(n, id);
    n.run.nextStrikeTarget = id;
    return n;
  },
  setNextChestItem(s, id) {
    valid(
      C.BASE_WEAPON_IDS.includes(id as C.BaseWeaponId) ||
        C.PASSIVE_IDS.includes(id as PassiveId),
    );
    const n = copy(s);
    n.run.nextChestItem = id;
    return n;
  },
  setNextDrop(s, kind) {
    valid(["bread", "draft", "none"].includes(kind));
    const n = copy(s);
    n.run.nextDrop = kind;
    return n;
  },
  rollDrop: () => rollDrop(),
  setPlayerPosition(s, x, y) {
    valid(finite(x, y));
    const n = copy(s);
    n.run.player.x = x;
    n.run.player.y = y;
    return n;
  },
  setFacing(s, facing) {
    valid(facing === "left" || facing === "right");
    const n = copy(s);
    n.run.player.facing = facing;
    return n;
  },
  setHp(s, hp) {
    valid(finite(hp));
    const n = copy(s);
    n.run.player.hp = hp;
    return n;
  },
  setLevel(s, level) {
    valid(integer(level, 1));
    const n = copy(s);
    n.run.level = level;
    return n;
  },
  setXp(s, xp) {
    valid(nonnegative(xp));
    const n = copy(s);
    n.run.xp = xp;
    return n;
  },
  setKills(s, kills) {
    valid(integer(kills));
    const n = copy(s);
    n.run.kills = kills;
    return n;
  },
  setPendingLevelUps(s, count) {
    valid(integer(count));
    const n = copy(s);
    n.run.pendingLevelUps = count;
    return n;
  },
  setNextOffers(s, ids) {
    valid(
      ids.length >= 1 &&
        ids.length <= C.OFFER_COUNT &&
        new Set(ids).size === ids.length &&
        ids.every((id) =>
          [
            ...C.BASE_WEAPON_IDS,
            ...C.EVOLUTION_IDS,
            ...C.PASSIVE_IDS,
            C.LAMP_OIL_ID,
          ].includes(id as C.BaseWeaponId),
        ),
    );
    const n = copy(s);
    n.run.nextOffers = [...ids];
    return n;
  },
  setWeapon(s, slot, id, level) {
    valid(
      C.BASE_WEAPON_IDS.includes(id as C.BaseWeaponId) ||
        C.EVOLUTION_IDS.includes(id as C.EvolutionId),
    );
    valid(
      integer(slot, 0, Math.min(s.run.weapons.length, C.WEAPON_SLOTS - 1)) &&
        integer(
          level,
          1,
          C.EVOLUTION_IDS.includes(id as C.EvolutionId)
            ? 1
            : C.MAX_WEAPON_LEVEL,
        ),
    );
    valid(
      !s.run.weapons.some(
        (w, i) => i !== slot && (w.id === id || sameFamily(w.id, id)),
      ),
    );
    const n = copy(s);
    n.run.weapons[slot] = {
      id,
      level,
      cooldown:
        s.run.weapons[slot]?.id === id ? s.run.weapons[slot].cooldown : 0,
    };
    return n;
  },
  setWeaponCooldown(s, slot, seconds) {
    valid(integer(slot, 0, s.run.weapons.length - 1) && nonnegative(seconds));
    const n = copy(s);
    n.run.weapons[slot].cooldown = seconds;
    return n;
  },
  removeWeapon(s, slot) {
    valid(integer(slot, 0, s.run.weapons.length - 1));
    const n = copy(s);
    n.run.weapons.splice(slot, 1);
    return n;
  },
  setPassive(s, slot, id, level) {
    valid(
      C.PASSIVE_IDS.includes(id) &&
        integer(
          slot,
          0,
          Math.min(s.run.passives.length, C.PASSIVE_SLOTS - 1),
        ) &&
        integer(level, 1, C.PASSIVES[id].maxLevel),
    );
    valid(!s.run.passives.some((p, i) => i !== slot && p.id === id));
    const n = copy(s);
    n.run.passives[slot] = { id, level };
    return n;
  },
  removePassive(s, slot) {
    valid(integer(slot, 0, s.run.passives.length - 1));
    const n = copy(s);
    n.run.passives.splice(slot, 1);
    return n;
  },
  spawnEnemy(s, type, x, y) {
    valid(C.ENEMY_IDS.includes(type) && finite(x, y));
    const n = copy(s);
    spawnEnemy(n, type, x, y);
    return n;
  },
  setEnemyPosition(s, id, x, y) {
    valid(finite(x, y));
    const n = copy(s),
      e = enemy(n, id);
    e.x = x;
    e.y = y;
    return n;
  },
  setEnemyHp(s, id, hp) {
    valid(finite(hp) && hp > 0);
    const n = copy(s);
    enemy(n, id).hp = hp;
    return n;
  },
  setEnemyHeading(s, id, x, y) {
    valid(finite(x, y) && Math.hypot(x, y) > 0);
    const n = copy(s);
    enemy(n, id).heading = unit(x, y);
    return n;
  },
  setEnemyAge(s, id, seconds) {
    valid(nonnegative(seconds));
    const n = copy(s);
    enemy(n, id).age = seconds;
    return n;
  },
  setEnemyContactCooldown(s, id, seconds) {
    valid(nonnegative(seconds));
    const n = copy(s);
    enemy(n, id).contactCooldown = seconds;
    return n;
  },
  removeEnemy(s, id) {
    const n = copy(s);
    enemy(n, id);
    n.run.enemies = n.run.enemies.filter((e) => e.id !== id);
    return cleanHits(n);
  },
  clearEnemies(s) {
    const n = copy(s);
    n.run.enemies = [];
    return cleanHits(n);
  },
  spawnProjectile(s, w, x, y, vx, vy, pierce) {
    valid(
      ["ember", "pin", "shard", "sconce", "beacon", "hail"].includes(w) &&
        finite(x, y, vx, vy) &&
        integer(pierce, -1) &&
        (w !== "sconce" || Math.hypot(vx, vy) > 0),
    );
    const n = copy(s);
    projectile(n, w, x, y, vx, vy, pierce);
    return n;
  },
  clearProjectiles(s) {
    const n = copy(s);
    n.run.projectiles = [];
    return n;
  },
  spawnPuddle(s, w, x, y) {
    valid(["oil-splash", "blaze"].includes(w) && finite(x, y));
    const n = copy(s);
    const d = row(w, n.run.weapons.find((a) => a.id === w)?.level ?? 1);
    const z = zone(n, w, "puddle", x, y, d.duration!);
    n.visual.born[z.id] = n.run.tick + 1;
    return n;
  },
  clearZones(s) {
    const n = copy(s);
    n.run.zones = [];
    n.visual.orbits = {};
    return n;
  },
  spawnGem(s, tier, x, y) {
    valid(C.GEM_TIERS.includes(tier) && finite(x, y));
    const n = copy(s);
    n.run.gems.push({ id: n.run.nextId++, tier, x, y, attracted: false });
    return n;
  },
  setGemAttracted(s, id, attracted) {
    valid(typeof attracted === "boolean");
    const n = copy(s),
      g = n.run.gems.find((g) => g.id === id);
    valid(g);
    g!.attracted = attracted;
    return n;
  },
  clearGems(s) {
    const n = copy(s);
    n.run.gems = [];
    return n;
  },
  spawnPickup(s, kind, x, y) {
    valid(C.PICKUP_KINDS.includes(kind) && finite(x, y));
    const n = copy(s);
    n.run.pickups.push({ id: n.run.nextId++, kind, x, y });
    return n;
  },
  clearPickups(s) {
    const n = copy(s);
    n.run.pickups = [];
    return n;
  },
};
function toggle(
  s: DeepReadonly<WickState>,
  key:
    | "spawning"
    | "events"
    | "despawning"
    | "enemyMotion"
    | "enemyContact"
    | "weaponFire"
    | "effectMotion"
    | "drops"
    | "progression",
  on: boolean,
) {
  valid(typeof on === "boolean");
  return { ...copy(s), [key]: on };
}
function sameFamily(a: WeaponId, b: WeaponId) {
  return C.EVOLUTION_IDS.some(
    (e) =>
      (a === e && b === C.EVOLUTIONS[e].from) ||
      (b === e && a === C.EVOLUTIONS[e].from),
  );
}
// Keep this module's public vocabulary checked against the canonical aliases.
export type DebugEnemy = EnemyId;
