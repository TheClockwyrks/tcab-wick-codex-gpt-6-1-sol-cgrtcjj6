import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { WickState } from "./types";
import type { WickRect } from "./debug-types";
export function entries(tab: number): readonly string[] {
  return [
    [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS],
    C.PASSIVE_IDS,
    C.ENEMY_IDS,
    [...C.GEM_TIERS, ...C.PICKUP_KINDS],
  ][tab];
}
export function menuRects(s: DeepReadonly<WickState>): WickRect[] {
  if (s.screen === "playing") return [];
  if (s.screen === "almanac")
    return entries(s.almanacTab)
      .slice(s.almanacScroll, s.almanacScroll + C.ALMANAC_ROWS)
      .map((_, i) => ({ x: 84, y: 183 + i * 42, width: 310, height: 38 }));
  if (s.screen === "howto" || s.screen === "chest")
    return [{ x: 440, y: 605, width: 400, height: 52 }];
  const n =
    s.screen === "title"
      ? C.TITLE_ITEMS.length
      : s.screen === "levelup"
        ? s.run.offers.length
        : 2;
  return Array.from({ length: n }, (_, i) =>
    s.screen === "title"
      ? { x: 130, y: 365 + i * 66, width: 390, height: 54 }
      : s.screen === "levelup"
        ? { x: 380, y: 260 + i * 85, width: 520, height: 70 }
        : { x: 440, y: 415 + i * 68, width: 400, height: 54 },
  );
}
export function tabRects(s: DeepReadonly<WickState>): WickRect[] {
  return s.screen === "almanac"
    ? C.ALMANAC_TABS.map((_, i) => ({
        x: 84 + i * 285,
        y: 104,
        width: 265,
        height: 48,
      }))
    : [];
}
export const inside = (r: WickRect, x: number, y: number) =>
  x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
export function name(id: string): string {
  return (
    C.WEAPON_NAMES[id as C.WeaponId] ??
    C.PASSIVES[id as C.PassiveId]?.name ??
    C.ENEMIES[id as C.EnemyId]?.name ??
    C.GEM_NAMES[id as C.GemTier] ??
    C.PICKUP_NAMES[id as C.PickupKind] ??
    C.LAMP_OIL_NAME
  );
}
export function description(id: string): string {
  return (
    C.WEAPON_DESCRIPTIONS[id as C.WeaponId] ??
    C.PASSIVE_DESCRIPTIONS[id as C.PassiveId] ??
    C.ENEMY_DESCRIPTIONS[id as C.EnemyId] ??
    C.GEM_DESCRIPTIONS[id as C.GemTier] ??
    C.PICKUP_DESCRIPTIONS[id as C.PickupKind] ??
    C.LAMP_OIL_DESCRIPTION
  );
}
