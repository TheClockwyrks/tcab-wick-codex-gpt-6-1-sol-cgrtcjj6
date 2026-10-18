import * as C from "./constants";
import type { DeepReadonly, DeepWritable } from "ts-essentials";
import type {
  WickState,
  RunState,
  WeaponId,
  OfferId,
  EnemyId,
  ProjectileState,
  ZoneState,
} from "./types";
// Only a detached transition draft is writable. Engine-owned input is never mutated.
export type Draft = DeepWritable<WickState>;
export const copy = (s: DeepReadonly<WickState>): Draft =>
  structuredClone(s) as Draft;
export const idleRun = (): RunState => ({
  tick: 0,
  level: 1,
  xp: 0,
  kills: 0,
  player: { x: 0, y: 0, facing: "right", hp: C.BASE_MAX_HP },
  hurtFlash: 0,
  weapons: [],
  passives: [],
  enemies: [],
  projectiles: [],
  zones: [],
  gems: [],
  pickups: [],
  offers: [],
  nextOffers: null,
  pendingLevelUps: 0,
  chestResult: null,
  spawnTimer: 0,
  firedEvents: [],
  nextId: 0,
  nextSpawnAngle: null,
  nextSwarmAngle: null,
  nextSpawnType: null,
  nextPuddleOffset: null,
  nextStrikeTarget: null,
  nextChestItem: null,
  nextDrop: null,
});
export const initial = (): WickState => ({
  visual: {
    moved: 0,
    moving: false,
    born: {},
    orbits: {},
    puffs: [],
    press: null,
  },
  screen: "title",
  menuIndex: 0,
  almanacTab: 0,
  almanacScroll: 0,
  run: idleRun(),
  accumulator: 0,
  simTime: 0,
  muted: false,
  spawning: true,
  events: true,
  despawning: true,
  enemyMotion: true,
  enemyContact: true,
  weaponFire: true,
  effectMotion: true,
  drops: true,
  progression: true,
});
export function fresh(s: Draft) {
  s.run = copy({ ...s, run: idleRun() }).run;
  s.visual = {
    moved: 0,
    moving: false,
    born: {},
    orbits: {},
    puffs: [],
    press: null,
  };
  s.run.weapons = [{ id: "taper", level: 1, cooldown: 0 }];
  s.screen = "playing";
  s.menuIndex = 0;
  s.almanacScroll = 0;
  s.almanacTab = 0;
  s.accumulator = 0;
}
export const xpNext = (level: number) => C.XP_BASE + C.XP_STEP * (level - 1);
export function stats(r: DeepReadonly<RunState>) {
  const p = (id: C.PassiveId) =>
    r.passives.find((p) => p.id === id)?.level ?? 0;
  return {
    damageMul: 1 + C.WICK_DAMAGE_PER_LEVEL * p("wick"),
    cooldownMul: 1 - C.OIL_COOLDOWN_PER_LEVEL * p("oil"),
    areaMul: 1 + C.GLASS_AREA_PER_LEVEL * p("glass"),
    armor: C.BRASS_ARMOR_PER_LEVEL * p("brass"),
    amountBonus: C.MIRROR_AMOUNT_PER_LEVEL * p("mirror"),
    moveSpeed: C.MOVE_SPEED * (1 + C.BELLOWS_SPEED_PER_LEVEL * p("bellows")),
    maxHp: C.BASE_MAX_HP + C.TALLOW_HP_PER_LEVEL * p("tallow"),
    recovery: C.BASE_RECOVERY + C.TINDER_RECOVERY_PER_LEVEL * p("tinder"),
    xpMul: 1 + C.SOOT_XP_PER_LEVEL * p("soot"),
    pickupRadius: C.PICKUP_RADIUS * (1 + C.LURE_PICKUP_PER_LEVEL * p("lure")),
  };
}
export type Row = {
  damage: number;
  cooldown?: number;
  width?: number;
  height?: number;
  radius?: number;
  orbit?: number;
  duration?: number;
  amount?: number;
  speed?: number;
  pierce?: number;
  area?: number;
};
export function row(id: WeaponId, level = 1): Row {
  if (id in C.WEAPON_LEVELS)
    return C.WEAPON_LEVELS[id as C.BaseWeaponId][level - 1];
  return {
    pyre: C.PYRE_STATS,
    beacon: C.BEACON_STATS,
    hail: C.HAIL_STATS,
    chandelier: C.CHANDELIER_STATS,
    corona: C.CORONA_STATS,
    blaze: C.BLAZE_STATS,
  }[id as C.EvolutionId];
}
export const cooldown = (
  id: WeaponId,
  level: number,
  r: DeepReadonly<RunState>,
) =>
  Math.max(
    C.MIN_COOLDOWN,
    (row(id, level).cooldown ?? 0) * stats(r).cooldownMul,
  );
export const timer = (n: number) =>
  n - C.TICK_DT < C.TICK_DT / 2 ? 0 : n - C.TICK_DT;
export const dist = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export function unit(x: number, y: number, facing = 1) {
  const n = Math.hypot(x, y);
  return n ? { x: x / n, y: y / n } : { x: facing, y: 0 };
}
export const randomItem = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];
export function pool(r: DeepReadonly<RunState>): OfferId[] {
  const out: OfferId[] = [];
  for (const id of C.BASE_WEAPON_IDS) {
    const w = r.weapons.find((w) => w.id === id);
    if (
      w
        ? w.level < C.MAX_WEAPON_LEVEL
        : r.weapons.length < C.WEAPON_SLOTS &&
          !C.EVOLUTION_IDS.some(
            (e) =>
              C.EVOLUTIONS[e].from === id && r.weapons.some((w) => w.id === e),
          )
    )
      out.push(id);
  }
  for (const id of C.PASSIVE_IDS) {
    const p = r.passives.find((p) => p.id === id);
    if (
      p
        ? p.level < C.PASSIVES[id].maxLevel
        : r.passives.length < C.PASSIVE_SLOTS
    )
      out.push(id);
  }
  return out;
}
export function openLevel(s: Draft) {
  const p = pool(s.run);
  const posed = s.run.nextOffers;
  s.run.nextOffers = null;
  if (
    posed &&
    new Set(posed).size === posed.length &&
    posed.every((id) => (p.length ? p.includes(id) : id === C.LAMP_OIL_ID))
  )
    s.run.offers = [...posed];
  else {
    s.run.offers = [];
    while (p.length && s.run.offers.length < C.OFFER_COUNT) {
      const id = randomItem(p);
      s.run.offers.push(id);
      p.splice(p.indexOf(id), 1);
    }
    if (!s.run.offers.length) s.run.offers = [C.LAMP_OIL_ID];
  }
  s.screen = "levelup";
  s.menuIndex = 0;
  s.accumulator = 0;
}
export function gain(s: Draft, id: OfferId) {
  const r = s.run;
  if (id === C.LAMP_OIL_ID) {
    r.player.hp = Math.min(stats(r).maxHp, r.player.hp + C.LAMP_OIL_HEAL);
    return;
  }
  if (id in C.PASSIVES) {
    const pid = id as C.PassiveId;
    const p = r.passives.find((p) => p.id === id);
    if (p) p.level++;
    else r.passives.push({ id: pid, level: 1 });
    if (pid === "tallow") r.player.hp += C.TALLOW_HP_PER_LEVEL;
  } else {
    const w = r.weapons.find((w) => w.id === id);
    if (w) w.level++;
    else r.weapons.push({ id: id as WeaponId, level: 1, cooldown: 0 });
  }
}
export function choose(s: Draft, index: number) {
  if (!Number.isInteger(index) || !s.run.offers[index])
    throw new RangeError("Invalid offer");
  gain(s, s.run.offers[index]);
  s.run.pendingLevelUps = Math.max(0, s.run.pendingLevelUps - 1);
  s.run.offers = [];
  s.menuIndex = 0;
  if (s.run.pendingLevelUps) openLevel(s);
  else s.screen = "playing";
}
export function chest(s: Draft) {
  const r = s.run;
  const posed = r.nextChestItem;
  r.nextChestItem = null;
  for (const w of r.weapons) {
    const evo = C.EVOLUTION_IDS.find(
      (id) =>
        C.EVOLUTIONS[id].from === w.id &&
        w.level === C.MAX_WEAPON_LEVEL &&
        r.passives.some((p) => p.id === C.EVOLUTIONS[id].passive),
    );
    if (evo) {
      w.id = evo;
      w.level = 1;
      w.cooldown = 0;
      r.chestResult = { kind: "evolve", weapon: evo };
      return;
    }
  }
  const p = pool(r).filter(
    (id) =>
      r.weapons.some((w) => w.id === id) || r.passives.some((p) => p.id === id),
  );
  if (p.length) {
    const id = posed && p.includes(posed) ? posed : randomItem(p);
    gain(s, id);
    r.chestResult = {
      kind: "level",
      item: id as WeaponId | C.PassiveId,
      level: [...r.weapons, ...r.passives].find((p) => p.id === id)!.level,
    };
  } else {
    r.player.hp = Math.min(stats(r).maxHp, r.player.hp + C.CHEST_HEAL);
    r.chestResult = { kind: "heal" };
  }
}
export function spawnEnemy(s: Draft, type: EnemyId, x: number, y: number) {
  const r = s.run;
  const data = C.ENEMIES[type];
  const hp =
    data.hp *
    (data.rank === "common"
      ? 1 + C.HP_SCALE_PER_MINUTE * Math.floor(r.tick / C.TICK_HZ / 60)
      : 1);
  r.enemies.push({
    id: r.nextId++,
    type,
    x,
    y,
    hp,
    maxHp: hp,
    heading: unit(
      r.player.x - x,
      r.player.y - y,
      r.player.facing === "right" ? 1 : -1,
    ),
    age: 0,
    contactCooldown: 0,
  });
}
export function projectile(
  s: Draft,
  weapon: ProjectileState["weapon"],
  x: number,
  y: number,
  vx: number,
  vy: number,
  pierce: number,
) {
  const r = s.run,
    d = row(weapon, r.weapons.find((w) => w.id === weapon)?.level ?? 1),
    st = stats(r),
    u = unit(vx, vy);
  s.visual.born[r.nextId] = r.tick;
  r.projectiles.push({
    id: r.nextId++,
    weapon,
    x,
    y,
    vx,
    vy,
    ax: weapon === "sconce" ? -C.SCONCE_DECEL * u.x : 0,
    ay: weapon === "sconce" ? -C.SCONCE_DECEL * u.y : 0,
    radius: d.radius! * st.areaMul,
    damage: d.damage * st.damageMul,
    ttl: d.duration!,
    pierce,
    hits: [],
  });
}
export function zone(
  s: Draft,
  weapon: WeaponId,
  kind: ZoneState["kind"],
  x: number,
  y: number,
  ttl: number | null,
) {
  const r = s.run,
    d = row(weapon, r.weapons.find((w) => w.id === weapon)?.level ?? 1),
    st = stats(r);
  const z: DeepWritable<ZoneState> = {
    id: r.nextId++,
    weapon,
    kind,
    x,
    y,
    radius: (d.radius ?? d.area ?? 0) * st.areaMul,
    damage: d.damage * st.damageMul,
    ttl,
    hits: [],
  };
  if (kind === "slash") {
    z.width = d.width! * st.areaMul;
    z.height = d.height! * st.areaMul;
  }
  s.visual.born[z.id] = r.tick;
  r.zones.push(z);
  return z;
}
export function rollDrop() {
  return Math.random() < C.BREAD_CHANCE
    ? "bread"
    : Math.random() < C.DRAFT_CHANCE
      ? "draft"
      : "none";
}
export const windowIndex = (tick: number) =>
  Math.min(
    C.SPAWN_WINDOWS.length - 1,
    Math.floor(tick / C.TICK_HZ / C.SPAWN_WINDOW),
  );
export const commons = (r: DeepReadonly<RunState>) =>
  r.enemies.filter(
    (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
  ).length;
