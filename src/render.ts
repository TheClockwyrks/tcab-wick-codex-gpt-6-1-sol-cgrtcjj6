import type { RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { WickState, WeaponId } from "./types";
import * as C from "./constants";
import { stats, xpNext, row, cooldown } from "./model";
import { menuRects, tabRects, entries, name, description } from "./menus";
export const images: Record<string, CanvasImageSource> = {};
const P = {
  ink: "#0d1922",
  panel: "#14252d",
  edge: "#3c514f",
  gold: "#d4ad6a",
  cream: "#eee4c8",
  muted: "#83958d",
  teal: "#78c7af",
};
function text(
  c: CanvasRenderingContext2D,
  t: string,
  x: number,
  y: number,
  size = 16,
  color = P.cream,
  align: CanvasTextAlign = "left",
  serif = false,
) {
  c.font = `${serif ? "" : "500 "}${size}px ${serif ? "Georgia, serif" : '"Courier New", monospace'}`;
  c.fillStyle = color;
  c.textAlign = align;
  c.fillText(t, x, y);
}
function rect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
) {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}
function picture(
  c: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  w?: number,
  h?: number,
  flip = false,
) {
  const img = images[path];
  if (!img) return;
  c.save();
  c.translate(Math.round(x), Math.round(y));
  if (flip) c.scale(-1, 1);
  const size = img as HTMLImageElement;
  const ww = w ?? size.width,
    hh = h ?? size.height;
  c.drawImage(img, -ww / 2, -hh / 2, ww, hh);
  c.restore();
}
function rule(c: CanvasRenderingContext2D, x: number, y: number, w: number) {
  rect(c, x, y, w, 1, P.edge);
  rect(c, x + w / 2 - 3, y - 2, 5, 5, P.gold);
}
function heading(
  c: CanvasRenderingContext2D,
  kicker: string,
  title: string,
  subtitle: string,
) {
  text(c, kicker, 640, 151, 13, P.gold, "center");
  text(c, title, 640, 207, 38, P.cream, "center", true);
  text(c, subtitle, 640, 240, 14, P.muted, "center");
}
function footer(c: CanvasRenderingContext2D, s: DeepReadonly<WickState>) {
  text(c, "WICK  /  A TEN-MINUTE NIGHT", 48, 684, 12, P.muted);
  text(
    c,
    `${s.muted ? "SOUND OFF" : "SOUND ON"}  [M]`,
    1232,
    684,
    12,
    P.muted,
    "right",
  );
}
function clock(tick: number) {
  const sec = Math.floor(tick / C.TICK_HZ);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
function world(c: CanvasRenderingContext2D, s: DeepReadonly<WickState>) {
  const r = s.run,
    p = r.player,
    ox = C.STAGE_CX - p.x,
    oy = C.STAGE_CY - p.y;
  for (
    let y =
      Math.floor((p.y - C.STAGE_CY) / C.GROUND_TILE_SIZE) * C.GROUND_TILE_SIZE;
    y < p.y + C.STAGE_CY;
    y += C.GROUND_TILE_SIZE
  )
    for (
      let x =
        Math.floor((p.x - C.STAGE_CX) / C.GROUND_TILE_SIZE) *
        C.GROUND_TILE_SIZE;
      x < p.x + C.STAGE_CX;
      x += C.GROUND_TILE_SIZE
    ) {
      c.drawImage(
        images[C.GROUND_TILE_PATH],
        Math.round(x + ox),
        Math.round(y + oy),
        C.GROUND_TILE_SIZE,
        C.GROUND_TILE_SIZE,
      );
    }
  const glow = c.createRadialGradient(640, 360, 18, 640, 360, 310);
  glow.addColorStop(0, "#dfb87015");
  glow.addColorStop(0.5, "#eab65e06");
  glow.addColorStop(1, "#00000000");
  c.fillStyle = glow;
  c.fillRect(0, 0, 1280, 720);
  for (const z of r.zones) {
    const d = C.EFFECT_SPRITES[z.weapon],
      age = Math.max(0, r.tick - (s.visual.born[z.id] ?? r.tick)) / C.TICK_HZ;
    let frame = 0;
    if (z.weapon === "spark")
      frame = Math.min(3, Math.floor((age / C.SPARK_FLASH) * 4));
    if (z.weapon === "flare")
      frame = Math.min(5, Math.floor((age / C.FLARE_FLASH) * 6));
    const path = d.frames > 1 ? `${d.path}/${frame}.png` : d.path;
    c.save();
    if (z.kind === "aura") {
      const w = r.weapons.find((w) => w.id === z.weapon);
      c.globalAlpha =
        w && Math.abs(w.cooldown - cooldown(w.id, w.level, r)) < 0.001
          ? 1
          : 0.55;
    }
    if (z.kind === "puddle") {
      const pulse = z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE;
      c.globalAlpha =
        Math.round(age * C.TICK_HZ) % Math.round(pulse * C.TICK_HZ) === 0
          ? 1
          : 0.7;
    }
    picture(
      c,
      path,
      z.x + ox,
      z.y + oy,
      z.width ?? z.radius * 2,
      z.height ?? z.radius * 2,
    );
    c.restore();
  }
  for (const g of r.gems) picture(c, C.GEM_PATHS[g.tier], g.x + ox, g.y + oy);
  for (const x of r.pickups)
    picture(c, C.PICKUP_PATHS[x.kind], x.x + ox, x.y + oy);
  for (const e of r.enemies) {
    const d = C.ENEMIES[e.type];
    picture(
      c,
      `${C.ENEMY_SHEET_DIR}/${e.type}/${Math.floor(e.age / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES}.png`,
      e.x + ox,
      e.y + oy,
      undefined,
      undefined,
      e.heading.x < 0,
    );
    if (d.rank !== "common") {
      rect(
        c,
        e.x + ox - d.radius,
        e.y + oy - d.radius - 8,
        d.radius * 2,
        3,
        P.ink,
      );
      rect(
        c,
        e.x + ox - d.radius,
        e.y + oy - d.radius - 8,
        d.radius * 2 * Math.max(0, e.hp / e.maxHp),
        3,
        P.gold,
      );
    }
  }
  for (const puff of s.visual.puffs) {
    const f = Math.floor(
      (r.tick - puff.tick) / C.TICK_HZ / (C.PUFF_TIME / C.PUFF_SHEET.frames),
    );
    if (f < C.PUFF_SHEET.frames)
      picture(c, `${C.PUFF_SHEET.dir}/${f}.png`, puff.x + ox, puff.y + oy);
  }
  const walk = s.visual.moving
    ? `${C.LAMPLIGHTER_WALK_SHEET.dir}/${Math.floor((s.visual.moved * C.TICK_DT) / C.WALK_FRAME_TIME) % C.LAMPLIGHTER_WALK_SHEET.frames}.png`
    : C.LAMPLIGHTER_IDLE_PATH;
  picture(c, walk, 640, 360, undefined, undefined, p.facing === "left");
  for (const x of r.projectiles) {
    const d = C.EFFECT_SPRITES[x.weapon];
    picture(
      c,
      d.frames > 1
        ? `${d.path}/${Math.floor((r.tick - (s.visual.born[x.id] ?? r.tick)) / C.TICK_HZ / C.WALK_FRAME_TIME) % d.frames}.png`
        : d.path,
      x.x + ox,
      x.y + oy,
      x.radius * 2,
      x.radius * 2,
    );
  }
  const vignette = c.createRadialGradient(640, 360, 130, 640, 360, 750);
  vignette.addColorStop(0, "#07121b00");
  vignette.addColorStop(0.65, "#07121b33");
  vignette.addColorStop(1, "#07121bcc");
  c.fillStyle = vignette;
  c.fillRect(0, 0, 1280, 720);
  if (r.hurtFlash > 0) {
    c.fillStyle = `rgba(180,55,43,${(r.hurtFlash / C.HURT_FLASH) * 0.22})`;
    c.fillRect(0, 0, 1280, 720);
  }
}
function hud(c: CanvasRenderingContext2D, s: DeepReadonly<WickState>) {
  const r = s.run,
    st = stats(r);
  rect(c, 24, 22, 326, 83, "#0d1922ee", P.edge);
  text(c, "LAMPLIGHTER", 40, 44, 11, P.muted);
  text(
    c,
    `${Math.ceil(r.player.hp)} / ${st.maxHp}`,
    332,
    44,
    12,
    P.cream,
    "right",
  );
  rect(c, 40, 55, 292, 8, "#293638");
  rect(c, 40, 55, 292 * Math.max(0, r.player.hp / st.maxHp), 8, "#c09463");
  text(c, `${C.LEVEL_LABEL} ${r.level}`, 40, 86, 12, P.teal);
  rect(c, 122, 78, 210, 5, "#293638");
  rect(c, 122, 78, 210 * Math.min(1, r.xp / xpNext(r.level)), 5, P.teal);
  rect(c, 543, 22, 194, 82, "#0d1922ee", P.edge);
  text(c, clock(r.tick), 640, 65, 33, P.cream, "center", true);
  text(c, "UNTIL DAWN  10:00", 640, 88, 10, P.gold, "center");
  rect(c, 1107, 22, 149, 59, "#0d1922ee", P.edge);
  text(
    c,
    String(r.kills).padStart(3, "0"),
    1238,
    49,
    24,
    P.cream,
    "right",
    true,
  );
  text(c, "VANQUISHED", 1238, 68, 10, P.muted, "right");
  for (const [group, y, label] of [
    [r.weapons, 606, "TOOLS"],
    [r.passives, 660, "TRINKETS"],
  ] as const) {
    text(c, label, 26, y + 22, 10, P.muted);
    for (let i = 0; i < C.WEAPON_SLOTS; i++) {
      const x = 104 + i * 50,
        item = group[i];
      rect(c, x, y, 38, 36, "#0d1922ee", item ? P.edge : "#2a3b3d");
      if (item) {
        picture(c, C.ICON_PATHS[item.id], x + 19, y + 17);
        if ("cooldown" in item && item.cooldown > 0) {
          const total =
            cooldown(item.id, item.level, r) +
            (item.id === "lantern" ? row(item.id, item.level).duration! : 0);
          rect(
            c,
            x + 2,
            y + 32,
            34 * Math.min(1, item.cooldown / total),
            2,
            P.gold,
          );
        }
        for (let j = 0; j < item.level; j++)
          rect(c, x + j * 4, y + 39, 3, 2, P.gold);
      }
    }
  }
  text(c, "MOVE  WASD / ARROWS", 1252, 658, 11, P.muted, "right");
  text(c, "PAUSE  ESC / P     SOUND  M", 1252, 681, 11, P.muted, "right");
}
function menu(
  c: CanvasRenderingContext2D,
  s: DeepReadonly<WickState>,
  labels: readonly string[],
) {
  const rs = menuRects(s);
  rs.forEach((r, i) => {
    const on = i === s.menuIndex;
    rect(
      c,
      r.x,
      r.y,
      r.width,
      r.height,
      on ? "#263b3c" : "#12232a",
      on ? P.gold : P.edge,
    );
    if (on) {
      rect(c, r.x, r.y, 3, r.height, P.gold);
      text(c, "›", r.x + 18, r.y + r.height / 2 + 7, 25, P.gold);
    }
    if (s.screen === "levelup") {
      const id = s.run.offers[i];
      picture(c, C.ICON_PATHS[id], r.x + 57, r.y + r.height / 2, 32, 32);
      text(c, labels[i], r.x + 88, r.y + 43, 22, P.cream, "left", true);
      const held = [...s.run.weapons, ...s.run.passives].find(
        (x) => x.id === id,
      );
      text(
        c,
        held ? `${C.LEVEL_LABEL} ${held.level + 1}` : C.OFFER_NEW_TEXT,
        r.x + r.width - 25,
        r.y + 41,
        12,
        P.gold,
        "right",
      );
    } else
      text(
        c,
        labels[i],
        r.x + 46,
        r.y + r.height / 2 + 6,
        16,
        on ? P.cream : P.muted,
      );
  });
}
function title(c: CanvasRenderingContext2D, s: DeepReadonly<WickState>) {
  rect(c, 0, 0, 1280, 720, P.ink);
  picture(c, "sprites/title-scene.png", 960, 360, 640, 720);
  const fade = c.createLinearGradient(585, 0, 840, 0);
  fade.addColorStop(0, P.ink);
  fade.addColorStop(1, "#0d192200");
  c.fillStyle = fade;
  c.fillRect(585, 0, 255, 720);
  text(c, "A LAMPLIGHTER’S VIGIL", 132, 125, 12, P.gold);
  text(c, C.TITLE_TEXT, 122, 269, 132, P.cream, "left", true);
  text(c, C.TAGLINE_TEXT.split("").join(" "), 133, 310, 16, P.gold);
  menu(c, s, C.TITLE_ITEMS);
  text(
    c,
    "Walk into the dark. Carry a little dawn.",
    133,
    604,
    16,
    P.muted,
    "left",
    true,
  );
  text(c, "WASD / ARROWS  ·  ENTER TO CHOOSE", 133, 635, 11, P.muted);
  footer(c, s);
}
function almanac(c: CanvasRenderingContext2D, s: DeepReadonly<WickState>) {
  rect(c, 0, 0, 1280, 720, P.ink);
  text(c, C.ALMANAC_TEXT, 84, 68, 34, P.cream, "left", true);
  text(
    c,
    "FIELD NOTES  /  THE NIGHT’S INVENTORY",
    1196,
    65,
    11,
    P.muted,
    "right",
  );
  tabRects(s).forEach((r, i) => {
    rect(
      c,
      r.x,
      r.y,
      r.width,
      r.height,
      s.almanacTab === i ? "#2c3e3c" : P.panel,
      s.almanacTab === i ? P.gold : P.edge,
    );
    text(
      c,
      C.ALMANAC_TABS[i],
      r.x + 20,
      r.y + 30,
      14,
      s.almanacTab === i ? P.gold : P.muted,
    );
  });
  const list = entries(s.almanacTab),
    id = list[s.menuIndex];
  menuRects(s).forEach((r, i) => {
    const idx = s.almanacScroll + i;
    rect(
      c,
      r.x,
      r.y,
      r.width,
      r.height,
      idx === s.menuIndex ? "#2c3e3c" : P.panel,
      idx === s.menuIndex ? P.gold : undefined,
    );
    text(
      c,
      name(list[idx]),
      r.x + 16,
      r.y + 25,
      15,
      idx === s.menuIndex ? P.cream : P.muted,
    );
  });
  rect(c, 431, 183, 765, 420, P.panel, P.edge);
  text(
    c,
    String(s.menuIndex + 1).padStart(2, "0") + " / " + list.length,
    1168,
    219,
    11,
    P.muted,
    "right",
  );
  text(c, name(id), 472, 238, 36, P.cream, "left", true);
  const frame = Math.floor(s.simTime / C.WALK_FRAME_TIME) % 4;
  const center = 820;
  let lines: string[] = [];
  if (s.almanacTab === 0) {
    const w = id as WeaponId,
      d = row(w);
    picture(c, C.ICON_PATHS[w], 560, 333, 72, 72);
    const eff = C.EFFECT_SPRITES[w];
    picture(
      c,
      eff.frames > 1
        ? `${eff.path}/${Math.floor(s.simTime / C.WALK_FRAME_TIME) % eff.frames}.png`
        : eff.path,
      center,
      350,
      Math.min(eff.width * 2, 260),
      Math.min(eff.height * 2, 180),
    );
    lines = [
      `DAMAGE  ${d.damage}`,
      ...(d.cooldown ? [`COOLDOWN  ${d.cooldown}s`] : []),
    ];
  }
  if (s.almanacTab === 1) {
    const p = id as C.PassiveId;
    picture(c, C.ICON_PATHS[p], center, 350, 96, 96);
    lines = [`MAX LEVEL  ${C.PASSIVES[p].maxLevel}`];
  }
  if (s.almanacTab === 2) {
    const e = id as C.EnemyId,
      d = C.ENEMIES[e];
    picture(
      c,
      `${C.ENEMY_SHEET_DIR}/${e}/${frame}.png`,
      center,
      350,
      d.radius * 4,
      d.radius * 4,
    );
    lines = [`HEALTH  ${d.hp}`, `SPEED  ${d.speed}`, `DAMAGE  ${d.damage}`];
  }
  if (s.almanacTab === 3) {
    const g = id as C.GemTier,
      p = id as C.PickupKind;
    picture(c, C.GEM_PATHS[g] ?? C.PICKUP_PATHS[p], center, 350, 72, 72);
    lines = C.GEM_VALUES[g]
      ? [`EXPERIENCE  ${C.GEM_VALUES[g]}`]
      : id === "bread"
        ? [`HEALS  ${C.BREAD_HEAL}`]
        : [];
  }
  lines.forEach((line, i) => text(c, line, 472 + i * 220, 484, 14, P.gold));
  rule(c, 472, 516, 680);
  text(c, description(id), 640, 642, 13, P.cream, "center");
  text(
    c,
    "↑ ↓  BROWSE     ← →  CHANGE TAB     ESC  RETURN",
    640,
    685,
    12,
    P.muted,
    "center",
  );
}
export function render(s: DeepReadonly<WickState>, api: RenderApi) {
  const c = api.ctx;
  c.imageSmoothingEnabled = false;
  if (s.screen === "title") {
    title(c, s);
    return;
  }
  if (s.screen === "almanac") {
    almanac(c, s);
    return;
  }
  if (s.screen === "howto") {
    rect(c, 0, 0, 1280, 720, P.ink);
    heading(
      c,
      "THE LAMPLIGHTER’S HANDBOOK",
      "One light. A long night.",
      "Everything in the dark is drawn to you. Keep walking.",
    );
    const paragraphs = [
      [
        "01  WALK",
        "Move with WASD or the arrow keys. Your tools fire on their own rhythm.",
      ],
      [
        "02  GATHER",
        "Creatures hurt on touch. Their gems raise your level: choose one of three gifts.",
      ],
      [
        "03  BUILD",
        "Carry six tools and six trinkets. Elites leave chests; a max-level tool and its",
      ],
      [
        "",
        "matching trinket transform inside one. Browse every item in the Almanac.",
      ],
      [
        "04  ENDURE",
        "Survive until 10:00. When the Dark arrives, keep your distance until dawn.",
      ],
    ];
    paragraphs.forEach(([t, b], i) => {
      text(c, t, 170, 306 + i * 49, 13, P.gold);
      text(c, b, 345, 306 + i * 49, 14, P.cream);
    });
    text(
      c,
      "ENTER / SPACE  CHOOSE    ESC  BACK / PAUSE    P  PAUSE    M  MUTE",
      640,
      569,
      12,
      P.muted,
      "center",
    );
    text(
      c,
      "Every menu also answers mouse and touch.",
      640,
      594,
      13,
      P.muted,
      "center",
    );
    menu(c, s, ["RETURN TO TITLE"]);
    footer(c, s);
    return;
  }
  world(c, s);
  hud(c, s);
  if (s.screen === "playing") return;
  rect(c, 0, 0, 1280, 720, "#07121bdc");
  rect(c, 318, 102, 644, 500, "#10212bf5", P.edge);
  rule(c, 360, 122, 560);
  if (s.screen === "levelup") {
    heading(
      c,
      "A LITTLE MORE LIGHT",
      C.LEVEL_UP_TEXT,
      "Choose what you carry into the dark.",
    );
    menu(c, s, s.run.offers.map(name));
    text(
      c,
      description(s.run.offers[s.menuIndex] ?? C.LAMP_OIL_ID),
      640,
      561,
      13,
      P.muted,
      "center",
    );
  }
  if (s.screen === "paused") {
    heading(
      c,
      "THE NIGHT CAN WAIT",
      C.PAUSED_TEXT,
      `${clock(s.run.tick)} survived  ·  ${s.run.kills} vanquished`,
    );
    picture(c, C.LAMPLIGHTER_IDLE_PATH, 640, 326, 48, 64);
    menu(c, s, C.PAUSE_ITEMS);
  }
  if (s.screen === "fallen" || s.screen === "dawn") {
    heading(
      c,
      s.screen === "dawn"
        ? "THE FIRST BIRDS ARE SINGING"
        : "ANOTHER LAMP IN THE DARK",
      s.screen === "dawn" ? C.DAWN_TEXT : C.FALLEN_TEXT,
      s.screen === "dawn"
        ? "You carried the light through."
        : "The city remembers its lamplighters.",
    );
    text(c, clock(s.run.tick), 640, 319, 46, P.gold, "center", true);
    text(
      c,
      `LEVEL ${s.run.level}    /    ${s.run.kills} VANQUISHED`,
      640,
      365,
      14,
      P.muted,
      "center",
    );
    menu(c, s, C.END_ITEMS);
  }
  if (s.screen === "chest") {
    heading(c, "A GIFT FROM THE NIGHT", C.CHEST_TEXT, "");
    const result = s.run.chestResult;
    let label = "30 HEALTH RESTORED";
    if (result?.kind === "evolve") {
      label = name(result.weapon);
      picture(c, C.ICON_PATHS[result.weapon], 640, 330, 96, 96);
      text(c, "TRANSFORMED", 640, 422, 12, P.teal, "center");
    }
    if (result?.kind === "level") {
      label = `${name(result.item)}  ·  LEVEL ${result.level}`;
      picture(c, C.ICON_PATHS[result.item], 640, 330, 72, 72);
    }
    text(c, label, 640, 468, 28, P.gold, "center", true);
    menu(c, s, ["CONTINUE"]);
  }
  footer(c, s);
}
