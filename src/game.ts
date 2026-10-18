import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import type { WickState } from "./types";
import type { WickDebugApi } from "./debug-types";
import {
  initial,
  copy,
  fresh,
  idleRun,
  choose,
  stats,
  xpNext,
  windowIndex,
  type Draft,
} from "./model";
import { debug } from "./debug";
import { tick } from "./simulation";
import { images, render } from "./render";
import { entries, inside, menuRects, tabRects } from "./menus";
export type * from "./types";
export type * from "./debug-types";
export const BACKGROUND = "#0d1922";
function title(s: Draft, index = 0) {
  s.screen = "title";
  s.menuIndex = index;
  s.almanacTab = 0;
  s.almanacScroll = 0;
  s.run = copy({ ...s, run: idleRun() }).run;
  s.visual = { ...initial().visual } as Draft["visual"];
  s.accumulator = 0;
}
function accept(s: Draft, sound: (c: C.CueName) => void) {
  const screen = s.screen,
    i = s.menuIndex;
  if (screen === "title") {
    sound(C.CUES.menuConfirm);
    if (i === 0) fresh(s);
    else {
      s.screen = i === 1 ? "almanac" : "howto";
      s.menuIndex = 0;
      s.almanacScroll = 0;
      s.almanacTab = 0;
    }
  } else if (screen === "paused") {
    sound(C.CUES.menuConfirm);
    if (i === 0) {
      s.screen = "playing";
      s.menuIndex = 0;
    } else title(s);
  } else if (screen === "fallen" || screen === "dawn") {
    sound(C.CUES.menuConfirm);
    if (i === 0) fresh(s);
    else title(s);
  } else if (screen === "levelup") {
    choose(s, i);
    sound(C.CUES.choose);
    if (s.screen === "levelup") sound(C.CUES.levelUp);
  } else if (screen === "chest") {
    s.screen = "playing";
    s.run.chestResult = null;
    s.menuIndex = 0;
  } else if (screen === "howto") title(s, 2);
}
function changeTab(s: Draft, i: number) {
  s.almanacTab = (i + C.ALMANAC_TABS.length) % C.ALMANAC_TABS.length;
  s.menuIndex = 0;
  s.almanacScroll = 0;
}
function input(s: Draft, api: UpdateApi, sound: (c: C.CueName) => void) {
  const screen = s.screen;
  const edges = Object.fromEntries(
    C.ACTIONS.map((id) => [id, api.input.pressed(id)]),
  ) as Record<C.ActionName, boolean>;
  if (edges.mute) api.audio.setMuted(!api.audio.muted());
  if (screen === "playing") {
    if (edges.pause || edges.back) {
      s.screen = "paused";
      s.menuIndex = 0;
    }
    return;
  }
  if (screen === "paused" && (edges.pause || edges.back)) {
    s.screen = "playing";
    s.menuIndex = 0;
    return;
  }
  if (edges.back) {
    if (screen === "almanac") {
      title(s, 1);
      return;
    }
    if (screen === "howto") {
      title(s, 2);
      return;
    }
    if (screen === "fallen" || screen === "dawn") {
      title(s);
      return;
    }
  }
  if (screen === "almanac" && (edges.left || edges.right)) {
    changeTab(s, s.almanacTab + (edges.right ? 1 : -1));
    sound(C.CUES.menuMove);
  }
  const count =
    screen === "almanac" ? entries(s.almanacTab).length : menuRects(s).length;
  if (
    ["title", "almanac", "levelup", "paused", "fallen", "dawn"].includes(
      screen,
    ) &&
    (edges.up || edges.down) &&
    count
  ) {
    s.menuIndex = (s.menuIndex + (edges.down ? 1 : -1) + count) % count;
    sound(C.CUES.menuMove);
    if (screen === "almanac")
      s.almanacScroll = Math.max(
        0,
        Math.min(
          count - C.ALMANAC_ROWS,
          Math.max(
            Math.min(s.almanacScroll, s.menuIndex),
            s.menuIndex - C.ALMANAC_ROWS + 1,
          ),
        ),
      );
  }
  if (screen === "almanac") {
    const wheel = Math.trunc(api.input.wheel().y / C.WHEEL_ROW);
    s.almanacScroll = Math.max(
      0,
      Math.min(Math.max(0, count - C.ALMANAC_ROWS), s.almanacScroll + wheel),
    );
  }
  // Keyboard edges finish before pointer samples, and never spill into a new screen.
  if (edges.confirm && screen !== "howto" && screen !== "almanac") {
    accept(s, sound);
    return;
  }
  let pointerConfirm = false;
  const rects = menuRects(s),
    tabs = tabRects(s);
  for (const sample of api.input.pointerSamples()) {
    if (!sample.primary) continue;
    const i = rects.findIndex((r) => inside(r, sample.x, sample.y)),
      t = tabs.findIndex((r) => inside(r, sample.x, sample.y));
    if (
      ((sample.type === "move" &&
        sample.device !== "touch" &&
        !sample.buttons.includes("primary")) ||
        (sample.type === "down" && sample.button === "primary")) &&
      i >= 0 &&
      screen !== "howto" &&
      screen !== "chest"
    ) {
      const index = i + (screen === "almanac" ? s.almanacScroll : 0);
      if (s.menuIndex !== index) {
        s.menuIndex = index;
        sound(C.CUES.menuMove);
      }
    }
    if (sample.type === "down" && sample.button === "primary") {
      s.visual.press =
        i >= 0
          ? { id: sample.id, index: i, tab: false }
          : t >= 0
            ? { id: sample.id, index: t, tab: true }
            : null;
    }
    if (sample.type === "up" && sample.button === "primary") {
      const press = s.visual.press;
      s.visual.press = null;
      if (press && press.id === sample.id) {
        if (press.tab && press.index === t) {
          if (t !== s.almanacTab) {
            changeTab(s, t);
            sound(C.CUES.menuMove);
          }
        } else if (!press.tab && press.index === i) pointerConfirm = true;
      }
    }
  }
  if (pointerConfirm && screen !== "almanac") accept(s, sound);
}
export const game: Game<WickState, WickDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    const paths = [
      C.LAMPLIGHTER_IDLE_PATH,
      C.GROUND_TILE_PATH,
      "sprites/title-scene.png",
      ...Object.values(C.GEM_PATHS),
      ...Object.values(C.PICKUP_PATHS),
      ...Object.values(C.ICON_PATHS),
    ];
    for (const sheet of [
      C.LAMPLIGHTER_WALK_SHEET,
      C.PUFF_SHEET,
      ...C.ENEMY_IDS.map((id) => ({
        dir: `${C.ENEMY_SHEET_DIR}/${id}`,
        frames: C.ENEMY_FRAMES,
      })),
    ])
      for (let i = 0; i < sheet.frames; i++)
        paths.push(`${sheet.dir}/${i}.png`);
    for (const d of Object.values(C.EFFECT_SPRITES)) {
      if (d.frames === 1) paths.push(d.path);
      else for (let i = 0; i < d.frames; i++) paths.push(`${d.path}/${i}.png`);
    }
    await Promise.all([
      ...paths.map(async (path) => {
        images[path] = await api.assets.loadImage(path);
      }),
      ...Object.entries(C.CUE_PATHS).map(([cue, path]) =>
        api.audio.load(cue, path),
      ),
    ]);
    const register = api.diagnostics.register;
    register("screen", (s) => s.screen);
    register("clock", (s) => (s.run.tick / C.TICK_HZ).toFixed(2));
    register(
      "level / xp",
      (s) => `${s.run.level} / ${s.run.xp.toFixed(1)} / ${xpNext(s.run.level)}`,
    );
    register(
      "hp",
      (s) => `${Math.ceil(s.run.player.hp)} / ${stats(s.run).maxHp}`,
    );
    register("kills", (s) => s.run.kills);
    register(
      "position",
      (s) =>
        `${s.run.player.x.toFixed(1)}, ${s.run.player.y.toFixed(1)} ${s.run.player.facing}`,
    );
    register(
      "enemies / window",
      (s) => `${s.run.enemies.length} / ${windowIndex(s.run.tick)}`,
    );
    register(
      "projectiles / zones",
      (s) => `${s.run.projectiles.length} / ${s.run.zones.length}`,
    );
    register("gems", (s) => s.run.gems.length);
    register(
      "weapons",
      (s) =>
        s.run.weapons
          .map((w) => `${w.id} ${w.level} ${w.cooldown.toFixed(1)}`)
          .join(", ") || "none",
    );
    register(
      "passives",
      (s) =>
        s.run.passives.map((p) => `${p.id} ${p.level}`).join(", ") || "none",
    );
    register("pendingLevelUps", (s) => s.run.pendingLevelUps);
    for (const key of [
      "spawning",
      "events",
      "despawning",
      "enemyMotion",
      "enemyContact",
      "weaponFire",
      "effectMotion",
      "drops",
      "progression",
    ] as const)
      register(key, (s) => s[key]);
    return [initial(), debug];
  },
  update(state: DeepReadonly<WickState>, api, dt) {
    const s = copy(state);
    s.simTime += dt;
    const menuCues = new Set<C.CueName>();
    input(s, api, (cue) => menuCues.add(cue));
    for (const cue of menuCues) api.audio.play(cue);
    if (s.screen === "playing") {
      s.accumulator += dt;
      const dx = api.input.value("right") - api.input.value("left"),
        dy = api.input.value("down") - api.input.value("up");
      while (
        s.accumulator >= C.TICK_DT - C.TICK_EPSILON &&
        s.screen === "playing"
      ) {
        s.accumulator -= C.TICK_DT;
        if (Math.abs(s.accumulator) < C.TICK_EPSILON) s.accumulator = 0;
        const cues = new Set<C.CueName>();
        tick(s, dx, dy, (c) => cues.add(c));
        for (const c of cues) api.audio.play(c);
      }
    }
    if (s.screen !== "playing") s.accumulator = 0;
    s.muted = api.audio.muted();
    const music = ["playing", "levelup", "chest", "paused"].includes(s.screen),
      hum =
        s.screen === "playing" &&
        s.run.weapons.some((w) => w.id === "halo" || w.id === "corona");
    for (const [cue, on] of [
      [C.CUES.music, music],
      [C.CUES.hum, hum],
    ] as const) {
      if (on) api.audio.loop(cue);
      else api.audio.stop(cue);
    }
    return s;
  },
  render,
};
