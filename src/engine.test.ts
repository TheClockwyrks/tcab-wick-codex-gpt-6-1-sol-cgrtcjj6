import { describe, it, expect } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createEngine, ConstantClock, type Game } from "@clockwyrks/simple-2d";
import { game, BACKGROUND, type WickState, type WickDebugApi } from "./game";
import * as C from "./constants";

// Native image decoding replaces only the browser-specific decoding boundary.
// The actual engine input, frame loop, state ownership and renderer run unchanged.
async function harness() {
  const target = new EventTarget(),
    canvas = createCanvas(C.STAGE_W, C.STAGE_H);
  const loaded: string[] = [],
    cues: string[] = [];
  const native: Game<WickState, WickDebugApi> = {
    ...game,
    initialize: (api) =>
      game.initialize({
        ...api,
        assets: {
          ...api.assets,
          loadImage: async (path) => {
            loaded.push(path);
            return (await loadImage(
              `assets/${path}`,
            )) as unknown as ImageBitmap;
          },
        },
        audio: {
          ...api.audio,
          load: async (cue, path) => {
            cues.push(path);
            api.audio.define(cue, { freq: 440, gain: 0, durationMs: 1 });
          },
        },
      }),
  };
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game: native,
    background: BACKGROUND,
    layout: C.LAYOUT,
    clock: new ConstantClock(1000 / C.TICK_HZ),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  await engine.initialize();
  const key = (type: string, code: string) =>
    target.dispatchEvent(
      Object.assign(new Event(type), { code, repeat: false }),
    );
  const press = async (code: string) => {
    key("keydown", code);
    await engine.advance(1);
    key("keyup", code);
  };
  return { engine, canvas, loaded, cues, key, press };
}
describe("the game running on Simple 2D", () => {
  it("loads the complete produced sprite set, drives menus and renders frozen overlays", async () => {
    const { engine, canvas, loaded, cues, key, press } = await harness();
    try {
      expect(loaded).toContain(C.LAMPLIGHTER_IDLE_PATH);
      expect(loaded).toContain("sprites/enemies/dark/3.png");
      expect(loaded).toContain("sprites/effects/flare/5.png");
      expect(new Set(loaded).size).toBe(loaded.length);
      expect(cues).toHaveLength(Object.keys(C.CUES).length);
      await engine.advance(1);
      const before = canvas.toBuffer("image/png");
      await press("ArrowDown");
      await press("Enter");
      expect(engine.state.screen).toBe("almanac");
      await press("ArrowRight");
      expect(engine.state.almanacTab).toBe(1);
      expect(canvas.toBuffer("image/png")).not.toEqual(before);
      await press("Escape");
      expect(engine.state.menuIndex).toBe(1);
      await press("ArrowUp");
      await press("Enter");
      expect(engine.state.screen).toBe("playing");
      expect(engine.state.run.tick).toBe(1);
      engine.apply((s) => engine.debug.setSpawning(s, false));
      key("keydown", "KeyD");
      await engine.advance(60);
      key("keyup", "KeyD");
      expect(engine.state.run.player.x).toBeCloseTo(C.MOVE_SPEED);
      await press("KeyP");
      const held = engine.state.run.tick;
      await engine.advance(5);
      expect(engine.state.run.tick).toBe(held);
      expect(engine.diagnostics().every((d) => d.error === undefined)).toBe(
        true,
      );
      await press("KeyP");
      engine.apply((s) => engine.debug.setNextOffers(s, ["ember"]));
      engine.apply((s) => engine.debug.setPendingLevelUps(s, 1));
      await engine.advance(1);
      expect(engine.state.screen).toBe("levelup");
      await press("Space");
      expect(engine.state.run.weapons.some((w) => w.id === "ember")).toBe(true);
    } finally {
      engine.destroy();
    }
  });
  it("runs every weapon through real decoded effects without advancing on render", async () => {
    const { engine, canvas } = await harness();
    try {
      for (const id of [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS]) {
        engine.apply((s) => engine.debug.reset(s));
        engine.apply((s) => engine.debug.setScreen(s, "playing"));
        engine.apply((s) => engine.debug.setSpawning(s, false));
        engine.apply((s) => engine.debug.setEvents(s, false));
        engine.apply((s) => engine.debug.setEnemyContact(s, false));
        engine.apply((s) => engine.debug.setWeapon(s, 0, id, 1));
        engine.apply((s) => engine.debug.spawnEnemy(s, "hound", 60, 0));
        await engine.advance(1);
        expect(
          engine.state.run.projectiles.length + engine.state.run.zones.length,
          id,
        ).toBeGreaterThan(0);
        expect(canvas.toBuffer("image/png").length).toBeGreaterThan(1000);
        const frozen = engine.debug.snapshot(engine.state);
        game.render(engine.state, {
          ctx: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
          frame: () => engine.frame(),
          viewport: () => engine.viewport(),
        });
        expect(engine.debug.snapshot(engine.state)).toEqual(frozen);
      }
    } finally {
      engine.destroy();
    }
  });
});
