import type { AppSkin, FontChoice } from "./types";

/** Fonts the Carattere setting can pick (besides "auto"). */
export type ConcreteFont = Exclude<FontChoice, "auto">;

export interface SkinInfo {
  id: AppSkin;
  name: string;
  tagline: string;
  /** Base font of the design — used only while Carattere = "auto". */
  baseFont: ConcreteFont;
  /** Light-mode surface colors used by the little picker preview. */
  prev: {
    bg: string;
    card: string;
    text: string;
    /** Rounded look of the mini card in the preview (px). */
    radius: number;
  };
}

/**
 * The ten "Aspetto Totale" options. Option #1 (`default`) is the current look;
 * the other nine are full redesigns: colors, shapes and (as base font) type,
 * applied through skins.css keyed on html[data-skin="…"]. The Carattere
 * setting stays fully independent: when it's not "auto" it wins over
 * `baseFont`.
 */
export const SKINS: SkinInfo[] = [
  {
    id: "default",
    name: "Default",
    tagline: "L'aspetto attuale di MyGitHub",
    baseFont: "system",
    prev: { bg: "#eef0f4", card: "#ffffff", text: "#1c1c1e", radius: 18 },
  },
  {
    id: "sabbia",
    name: "Sabbia",
    tagline: "Caldo mediterraneo, forme morbide e materiche",
    baseFont: "serif",
    prev: { bg: "#efe3cf", card: "#fdf6ea", text: "#4a3a24", radius: 22 },
  },
  {
    id: "oceano",
    name: "Oceano",
    tagline: "Vetro traslucido con profondità acquatiche",
    baseFont: "rounded",
    prev: { bg: "#d5e8ef", card: "rgba(255,255,255,0.72)", text: "#12324a", radius: 26 },
  },
  {
    id: "vinile",
    name: "Vinile",
    tagline: "Hi-fi retrò: crema, bordeaux e ottone",
    baseFont: "sans",
    prev: { bg: "#e8dcc2", card: "#f6ecd4", text: "#3c2320", radius: 14 },
  },
  {
    id: "acciaio",
    name: "Acciaio",
    tagline: "Metallo spazzolato, precisione tecnica",
    baseFont: "system",
    prev: { bg: "#c9ccd4", card: "#e6e8ee", text: "#23262d", radius: 10 },
  },
  {
    id: "editoriale",
    name: "Editoriale",
    tagline: "Minimalismo da rivista, geometrie nette",
    baseFont: "sans",
    prev: { bg: "#ffffff", card: "#f3f3ef", text: "#111111", radius: 4 },
  },
  {
    id: "lavagna",
    name: "Lavagna",
    tagline: "Studio su lavagna: grafite e gessetto",
    baseFont: "mono",
    prev: { bg: "#31312e", card: "#45433d", text: "#f0e8d4", radius: 14 },
  },
  {
    id: "bosco",
    name: "Bosco",
    tagline: "Verde naturale, tattile e avvolgente",
    baseFont: "system",
    prev: { bg: "#dde4d2", card: "#f6f4e6", text: "#24301e", radius: 24 },
  },
  {
    id: "liquido",
    name: "Liquido",
    tagline: "Superfici gommose, lucide ed elastiche",
    baseFont: "rounded",
    prev: { bg: "#dfe0f6", card: "#ffffff", text: "#232447", radius: 30 },
  },
  {
    id: "rinascimento",
    name: "Rinascimento",
    tagline: "Carta antica, inchiostro e fili d'oro",
    baseFont: "serif",
    prev: { bg: "#e7dcc2", card: "#f2e8cf", text: "#322618", radius: 10 },
  },
];

export const SKIN_BY_ID: Record<AppSkin, SkinInfo> = Object.fromEntries(
  SKINS.map((s) => [s.id, s])
) as Record<AppSkin, SkinInfo>;

/** Valid skin ids (used to sanitize old stored settings). */
export const VALID_SKINS: readonly AppSkin[] = SKINS.map((s) => s.id);

/** Valid font choices (used to sanitize old stored settings). */
export const VALID_FONTS: readonly FontChoice[] = [
  "auto",
  "system",
  "rounded",
  "serif",
  "mono",
  "sans",
];

/** Base font of a design (used when Carattere is "auto"). */
export function skinBaseFont(skin: AppSkin): ConcreteFont {
  return SKIN_BY_ID[skin].baseFont;
}
