import { describe, it, expect } from "vitest";
import type { UpdateApi } from "@clockwyrks/simple-2d";
import { game } from "./game";
import { debug } from "./debug";
import { copy, initial, fresh, stats, pool } from "./model";
import { tick } from "./simulation";
import * as C from "./constants";
import type { WickState } from "./types";
function setup() {
  const s = copy(initial());
  fresh(s);
  s.spawning = false;
  s.events = false;
  s.enemyContact = false;
  s.enemyMotion = false;
  return s;
}
function step(s: WickState, n = 1) {
  const d = copy(s);
  for (let i = 0; i < n && d.screen === "playing"; i++) tick(d, 0, 0, () => {});
  return d;
}
function frameApi(edges: string[] = [], held: Record<string, number> = {}) {
  let muted = false;
  return {
    input: {
      pressed: (s: string) => edges.includes(s),
      value: (s: string) => held[s] ?? 0,
      pointerSamples: () => [],
      wheel: () => ({ x: 0, y: 0 }),
    },
    audio: {
      play: () => {},
      loop: () => {},
      stop: () => {},
      setMuted: (m: boolean) => {
        muted = m;
      },
      muted: () => muted,
    },
  } as unknown as UpdateApi;
}
describe("fixed ticks, input and state ownership", () => {
  it("consumes exact ticks across differently divided frames", () => {
    const api = frameApi([], { right: 1, down: 1 }),
      start = setup();
    let a: WickState = start,
      b: WickState = start;
    a = game.update(a, api, 0.5);
    for (let i = 0; i < 30; i++) b = game.update(b, api, C.TICK_DT);
    expect(a.run.tick).toBe(30);
    expect(debug.snapshot(a).run).toEqual(debug.snapshot(b).run);
    expect(a.simTime).toBeCloseTo(b.simTime);
    expect(Math.hypot(a.run.player.x, a.run.player.y)).toBeCloseTo(90);
    expect(start.run.tick).toBe(0);
  });
  it("runs entry frame ticks, pauses without ticking, discards remainders", () => {
    const a = game.update(initial(), frameApi(["confirm"]), C.TICK_DT);
    expect(a.run.tick).toBe(1);
    const b = game.update(a, frameApi(["pause"]), 0.5);
    expect(b.screen).toBe("paused");
    expect(b.run.tick).toBe(1);
    expect(b.accumulator).toBe(0);
    const c = game.update(b, frameApi(["back"]), C.TICK_DT);
    expect(c.run.tick).toBe(2);
  });
  it("adds simTime while menus freeze the world and toggles mute", () => {
    const s = game.update(initial(), frameApi(["mute"]), 0.5);
    expect(s.simTime).toBe(0.5);
    expect(s.run.tick).toBe(0);
    expect(s.muted).toBe(true);
  });
});
describe("weapon collision and lifetimes", () => {
  it("slashes only on creation and leaves real drops", () => {
    let s = debug.spawnEnemy(setup(), "moth", 60, 0);
    s = debug.setNextDrop(s, "bread");
    const t = step(s);
    expect(t.run.enemies).toHaveLength(0);
    expect(t.run.kills).toBe(1);
    expect(t.run.gems).toHaveLength(1);
    expect(t.run.pickups[0].kind).toBe("bread");
    expect(t.run.zones[0].width).toBe(C.TAPER_LEVELS[0].width);
    const added = debug.spawnEnemy(t, "rat", 60, 0);
    expect(step(added).run.enemies[0].hp).toBe(C.ENEMIES.rat.hp);
  });
  it("hits finite projectiles in id order and spends pierce", () => {
    let s: WickState = setup();
    s = debug.setWeaponFire(s, false);
    s = debug.spawnEnemy(s, "hound", 50, 0);
    s = debug.spawnEnemy(s, "hound", 50, 0);
    s = debug.spawnProjectile(s, "ember", 50, 0, 0, 0, 0);
    const t = step(s);
    expect(t.run.enemies.map((e) => e.hp)).toEqual([110, 120]);
    expect(t.run.projectiles).toHaveLength(0);
  });
  it("touching projectiles re-hit exactly at the interval", () => {
    let s: WickState = setup();
    s = debug.setWeaponFire(s, false);
    s = debug.spawnEnemy(s, "hound", 50, 0);
    s = debug.spawnProjectile(s, "shard", 50, 0, 0, 0, -1);
    const a = step(s);
    expect(a.run.enemies[0].hp).toBe(112);
    expect(step(a, 29).run.enemies[0].hp).toBe(112);
    expect(step(a, 30).run.enemies[0].hp).toBe(104);
  });
  it("puddles pulse on the first tick and keep their created stats", () => {
    let s: WickState = setup();
    s = debug.setWeaponFire(s, false);
    s = debug.spawnEnemy(s, "hound", 100, 0);
    s = debug.spawnPuddle(s, "oil-splash", 100, 0);
    s = debug.setPassive(s, 0, "wick", 5);
    const t = step(s);
    expect(t.run.enemies[0].hp).toBe(116);
    expect(step(t, 18).run.enemies[0].hp).toBe(112);
  });
  it("places an aura with firing disabled and removes it when unheld", () => {
    let s: WickState = debug.setWeapon(setup(), 0, "corona", 1);
    s = debug.setWeaponFire(s, false);
    const a = step(s);
    expect(a.run.zones[0].ttl).toBe(null);
    const b = step(debug.removeWeapon(a, 0));
    expect(b.run.zones).toHaveLength(0);
  });
  it("flare leaves the Dark untouched", () => {
    let s: WickState = debug.setWeapon(setup(), 0, "flare", 1);
    s = debug.spawnEnemy(s, "dark", 100, 0);
    s = debug.spawnEnemy(s, "moth", 100, 0);
    const t = step(s);
    expect(t.run.enemies.map((e) => e.type)).toEqual(["dark"]);
    expect(t.run.enemies[0].hp).toBe(10000);
  });
  it("sconce integrates position before acceleration and shard bounces", () => {
    let s: WickState = debug.setWeaponFire(setup(), false);
    s = debug.spawnProjectile(s, "sconce", 0, 0, 600, 0, -1);
    s = debug.spawnProjectile(s, "shard", 639, 0, 600, 0, -1);
    const t = step(s);
    expect(t.run.projectiles[0].x).toBe(10);
    expect(t.run.projectiles[0].vx).toBe(590);
    expect(t.run.projectiles[1].x).toBe(640);
    expect(t.run.projectiles[1].vx).toBe(-600);
  });
});
describe("progression, chests and endings", () => {
  it("queues overflow levels, honors a short posed offer and freezes", () => {
    let s: WickState = debug.setNextOffers(setup(), ["ember"]);
    s = debug.spawnGem(s, "large", 0, 0);
    const t = step(s, 20);
    expect(t.screen).toBe("levelup");
    expect(t.run.tick).toBe(1);
    expect(t.run.level).toBe(2);
    expect(t.run.xp).toBe(5);
    expect(t.run.offers).toEqual(["ember"]);
    const next = debug.choose(t, 0);
    expect(next.screen).toBe("playing");
    expect(next.run.weapons[1].id).toBe("ember");
  });
  it("evolves the first eligible slot, excludes its base from pool", () => {
    let s: WickState = debug.setWeapon(setup(), 0, "taper", 8);
    s = debug.setPassive(s, 0, "wick", 1);
    s = debug.spawnPickup(s, "chest", 0, 0);
    const t = step(s);
    expect(t.screen).toBe("chest");
    expect(t.run.chestResult).toEqual({ kind: "evolve", weapon: "pyre" });
    expect(pool(t.run)).not.toContain("taper");
  });
  it("chest leveling Tallow raises health and its maximum", () => {
    let s: WickState = debug.setWeapon(setup(), 0, "taper", 8);
    s = debug.setPassive(s, 0, "tallow", 1);
    s = debug.setHp(s, 50);
    s = debug.spawnPickup(s, "chest", 0, 0);
    const t = step(s);
    expect(t.run.player.hp).toBe(65);
    expect(stats(t.run).maxHp).toBe(130);
  });
  it("draft attracts all gems, while progression off retains xp", () => {
    let s: WickState = debug.setProgression(setup(), false);
    s = debug.spawnGem(s, "large", 500, 0);
    s = debug.spawnPickup(s, "draft", 0, 0);
    const t = step(s, 60);
    expect(t.run.gems).toHaveLength(0);
    expect(t.run.xp).toBe(10);
    expect(t.run.level).toBe(1);
  });
  it("dawn takes precedence over falling and opening overlays", () => {
    let s: WickState = debug.setTick(setup(), 35999);
    s = debug.setHp(s, 0);
    s = debug.setPendingLevelUps(s, 2);
    const t = step(s);
    expect(t.screen).toBe("dawn");
    expect(t.run.pendingLevelUps).toBe(2);
  });
});
describe("director and debug contract", () => {
  it("spawns the exact scripted swarm with a posed direction", () => {
    let s: WickState = debug.setTick(setup(), 3599);
    s = debug.setEvents(s, true);
    s = debug.setNextSwarmAngle(s, 0);
    const t = step(s);
    expect(t.run.enemies).toHaveLength(24);
    expect(t.run.enemies[0].x).toBe(C.SPAWN_DISTANCE);
    expect(t.run.enemies[0].y).toBe(-C.SWARM_LINE / 2);
    expect(t.run.enemies[0].heading).toEqual({ x: -1, y: -0 });
    expect(t.run.firedEvents).toEqual([60]);
  });
  it("spawns a posed type and angle, scaled at the current clock", () => {
    let s: WickState = debug.setTick(setup(), 3600);
    s = debug.setSpawning(s, true);
    s = debug.setNextSpawnType(s, "rat");
    s = debug.setNextSpawnAngle(s, 90);
    const t = step(s);
    expect(t.run.enemies[0].type).toBe("rat");
    expect(t.run.enemies[0].y).toBeCloseTo(760);
    expect(t.run.enemies[0].hp).toBeCloseTo(15 * 1.15);
    expect(t.run.nextSpawnType).toBe(null);
  });
  it("poses never mutate the source, readings reconcile immediately", () => {
    const s = setup(),
      p = debug.setPassive(s, 0, "bellows", 5);
    expect(s.run.passives).toHaveLength(0);
    expect(debug.snapshot(p).run.moveSpeed).toBe(270);
    expect(debug.reconcile(p)).toEqual(p);
    expect(debug.reset(p)).toEqual(initial());
  });
  it("rejects invalid domains and preserves cooldown on level poses", () => {
    let s: WickState = debug.setWeaponCooldown(setup(), 0, 1.4);
    s = debug.setWeapon(s, 0, "taper", 3);
    expect(s.run.weapons[0].cooldown).toBe(1.4);
    expect(() => debug.setTick(s, -1)).toThrow();
    expect(() => debug.setNextSpawnAngle(s, 360)).toThrow();
    expect(() => debug.setNextPuddleOffset(s, 401, 0)).toThrow();
    expect(() => debug.setEnemyHp(s, 999, 0)).toThrow();
    expect(() => debug.choose(s, 0)).toThrow();
    expect(() => debug.setWeapon(s, 1, "pyre", 1)).toThrow();
  });
});

describe("phase boundaries and menu contacts", () => {
  it("keeps a Chandelier set at its existing angle when Mirror adds a lantern", () => {
    let s: WickState = debug.setWeapon(setup(), 0, "chandelier", 1);
    s = step(s, 12);
    const angle = s.visual.orbits[s.run.zones[0].id].angle;
    s = debug.setPassive(s, 0, "mirror", 1);
    const t = step(s);
    expect(t.run.zones).toHaveLength(5);
    expect(t.visual.orbits[t.run.zones[0].id].angle).toBeCloseTo(angle);
    expect(t.run.zones[0].id).toBeGreaterThan(s.run.zones[3].id);
  });
  it("reads a chest passive gain before collecting gems on the same tick", () => {
    let s: WickState = debug.setWeapon(setup(), 0, "taper", 8);
    s = debug.setPassive(s, 0, "soot", 1);
    s = debug.setProgression(s, false);
    s = debug.spawnPickup(s, "chest", 0, 0);
    s = debug.spawnGem(s, "small", 0, 0);
    const t = step(s);
    expect(t.run.passives[0].level).toBe(2);
    expect(t.run.xp).toBeCloseTo(1.2);
  });
  it("keeps a posed strike outcome while Spark has no eligible target", () => {
    let s: WickState = debug.setWeapon(setup(), 0, "spark", 1);
    s = debug.spawnEnemy(s, "hound", 1000, 0);
    const id = s.run.enemies[0].id;
    s = debug.setNextStrikeTarget(s, id);
    s = step(s);
    expect(s.run.nextStrikeTarget).toBe(id);
    s = debug.setEnemyPosition(s, id, 100, 0);
    s = debug.setWeaponCooldown(s, 0, 0);
    expect(step(s).run.nextStrikeTarget).toBe(null);
  });
  it("arms only primary contacts, cancels a drag-off, and applies keyboard edges first", () => {
    type Sample = ReturnType<UpdateApi["input"]["pointerSamples"]>[number];
    const sample = (
      type: Sample["type"],
      x: number,
      y: number,
      button: Sample["button"] = "primary",
    ): Sample => ({
      type,
      x,
      y,
      id: 1,
      primary: true,
      device: "mouse",
      button,
      buttons: type === "down" ? [button!] : [],
    });
    const pointer = (s: WickState, samples: Sample[], edges: string[] = []) => {
      const a = frameApi(edges);
      return game.update(
        s,
        { ...a, input: { ...a.input, pointerSamples: () => samples } },
        C.TICK_DT,
      );
    };
    let s = pointer(initial(), [sample("down", 300, 523)]);
    expect(s.menuIndex).toBe(2);
    s = pointer(s, [sample("up", 40, 40)]);
    expect(s.screen).toBe("title");
    expect(s.menuIndex).toBe(2);
    s = pointer(s, [sample("down", 300, 392, "secondary")]);
    expect(s.menuIndex).toBe(2);
    s = pointer(s, [sample("move", 300, 392, null)]);
    expect(s.menuIndex).toBe(0);
    s = pointer(s, [sample("move", 300, 458, null)], ["confirm"]);
    expect(s.screen).toBe("playing");
    expect(s.run.tick).toBe(1);
  });
});
