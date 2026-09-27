import { createContext, useContext } from "react";

export type TabId =
  | "diario"
  | "studio"
  | "allenamento"
  | "metronomo"
  | "accordatore"
  | "corde"
  | "impostazioni";

/** `center: true` = voce centrale della barra, resa leggermente più grande. */
export interface TabDef {
  id: TabId;
  label: string;
  center?: boolean;
}

export const TABS: TabDef[] = [
  { id: "diario", label: "Diario" },
  { id: "studio", label: "Studio" },
  { id: "allenamento", label: "Allenam.", center: true },
  { id: "metronomo", label: "Metronomo" },
  { id: "accordatore", label: "Accordatore" },
  { id: "corde", label: "Corde" },
  { id: "impostazioni", label: "Impost." },
];

export interface NavApi {
  tab: TabId;
  openTab: (t: TabId) => void;
  /** currently open song detail inside the Studio stack (null = library list) */
  songId: string | null;
  openSong: (id: string) => void;
  back: () => void;
}

export const NavContext = createContext<NavApi>({
  tab: "diario",
  openTab: () => undefined,
  songId: null,
  openSong: () => undefined,
  back: () => undefined,
});

export function useNav(): NavApi {
  return useContext(NavContext);
}
