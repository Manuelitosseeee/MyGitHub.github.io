import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Ear,
  Gauge,
  Music4,
  Ruler,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { Card, Empty, SectionTitle } from "../../ui/primitives";
import AccordiScreen from "./AccordiScreen";
import ArmonieScreen from "./ArmonieScreen";
import BranoScreen from "./BranoScreen";
import OrecchioScreen from "./OrecchioScreen";
import ScaleScreen from "./ScaleScreen";

export type ToolId = "accordi" | "scale" | "orecchio" | "brano" | "armonie";

export interface ToolDef {
  id: ToolId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

export const TOOLS: ToolDef[] = [
  {
    id: "accordi",
    title: "Allena Accordi",
    subtitle: "Cambia accordo in ritmo, con il diagramma sempre a portata di dito",
    icon: Music4,
  },
  {
    id: "scale",
    title: "Allena Scale",
    subtitle: "Leggi la scala sul pentagramma e fai esercizi con il metronomo",
    icon: Ruler,
  },
  {
    id: "orecchio",
    title: "Allena l'Orecchio",
    subtitle: "Riconosci intervalli, accordi e progressioni, e segui i tuoi progressi",
    icon: Ear,
  },
  {
    id: "brano",
    title: "Allena un Brano",
    subtitle: "Rallenta un passaggio del tuo file audio e ripetilo a passo sicuro",
    icon: Upload,
  },
  {
    id: "armonie",
    title: "Allena Armonie",
    subtitle: "Genera progressioni Pop, emotive e jazz coerenti con il tuo giro",
    icon: Sparkles,
  },
];

const SCREENS: Record<ToolId, () => JSX.Element> = {
  accordi: AccordiScreen,
  scale: ScaleScreen,
  orecchio: OrecchioScreen,
  brano: BranoScreen,
  armonie: ArmonieScreen,
};

/** Intestazione condivisa dalle sottosezioni, con il pulsante indietro. */
export function ToolHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="train-head">
      <button className="train-back" onClick={onBack} aria-label="Torna agli strumenti">
        <ChevronLeft size={20} strokeWidth={2} />
      </button>
      <h1 className="train-title">{title}</h1>
      <div className="train-head-right">{right}</div>
    </div>
  );
}

export default function AllenamentoScreen() {
  const [tool, setTool] = useState<ToolId | null>(null);

  if (tool) {
    const Screen = SCREENS[tool];
    return (
      <div className="screen train-screen">
        <ToolHeader title={TOOLS.find((t) => t.id === tool)!.title} onBack={() => setTool(null)} />
        <Screen />
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-title">Allenamento</div>
      <p className="screen-sub">
        Cinque strumenti per allenare le dita, la vista, l'orecchio e il
        senso armonico. Ognuno è indipendente: usali come e quando vuoi.
      </p>

      <SectionTitle>Strumenti</SectionTitle>
      <div className="train-grid">
        {TOOLS.map(({ id, title, subtitle, icon: Icon }) => (
          <button key={id} className="train-card" onClick={() => setTool(id)}>
            <span className="train-card-ico">
              <Icon size={23} strokeWidth={1.6} />
            </span>
            <span className="train-card-text">
              <span className="train-card-title">{title}</span>
              <span className="train-card-sub">{subtitle}</span>
            </span>
            <ChevronRight size={17} className="train-card-chev" />
          </button>
        ))}
      </div>

      <SectionTitle>Come si usa</SectionTitle>
      <Card className="card-pad">
        <div className="train-note">
          <Gauge size={17} strokeWidth={1.6} />
          <p>
            Nessuno di questi strumenti giudica come suoni: sono un metronomo e
            un quaderno. L'unico che tiene conto delle risposte è{" "}
            <b>Allena l'Orecchio</b>, e i suoi risultati compaiono anche nel
            Diario.
          </p>
        </div>
      </Card>

      {tool === null && TOOLS.length === 0 ? (
        <Empty icon={<Music4 />} title="Nessuno strumento" body="—" />
      ) : null}
    </div>
  );
}
