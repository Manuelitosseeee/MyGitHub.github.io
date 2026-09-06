import { createContext, useContext } from "react";

export type TabId =
  | "diario"
  | "studio"
  | "metronomo"
  | "accordatore"
  | "corde"
  | "impostazioni";

export const TABS: Array<{ id: TabId; label: string }> = [
  { id: "diario", label: "Diario" },
  { id: "studio", label: "Studio" },
  { id: "metronomo", label: "Metro" },
  { id: "accordatore", label: "Accord" },
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
