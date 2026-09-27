/** Diagramma di accordo per chitarra.
 *
 *  Mostra: nome dell'accordo, corde da suonare e da non suonare, tasto di ogni
 *  dita con il relativo numero, ed eventuale barrè. È lo stesso componente
 *  usato da Allena Accordi e da Allena Armonie. */

import { FINGER_NAMES, type ChordShape } from "./chords";

const W = 132;
const H = 172;
const PAD_X = 16;
const PAD_TOP = 30;
/** Numero di tasti disegnati (il nut incluso quando baseFret = 0). */
const ROWS = 5;
const STRING_GAP = (W - PAD_X * 2) / 5;
const FRET_H = 22;

export function ChordDiagram({
  shape,
  compact = false,
}: {
  shape: ChordShape;
  compact?: boolean;
}) {
  const gridW = STRING_GAP * 5;
  const left = (W - gridW) / 2;
  const nut = shape.baseFret === 0;
  const fretsShown = nut ? ROWS : ROWS - 1;
  const yOf = (fret: number) => {
    // Prima riga: tasto 1 (o "0" aperto) subito sotto la cordiera.
    const idx = nut ? fret : fret - shape.baseFret + 1;
    return PAD_TOP + idx * FRET_H;
  };
  const gridH = fretsShown * FRET_H;
  const bottom = PAD_TOP + gridH;
  const muted = shape.frets.filter((f) => f === null).length;
  const minPlayed = shape.frets
    .filter((f): f is number => f !== null)
    .reduce((a, b) => Math.min(a, b), 99);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chord-svg"
      role="img"
      aria-label={`Diagramma accordo ${shape.name}`}
    >
      {/* Nome dell'accordo */}
      <text
        x={W / 2}
        y={compact ? 15 : 20}
        textAnchor="middle"
        className="chord-svg-name"
        fontSize={compact ? 15 : 18}
      >
        {shape.name}
      </text>

      {/* Corde verticali: le 3 più acute a sinistra come nei diagrammati classici */}
      {[...Array(6)].map((_, i) => {
        const x = W - PAD_X - i * STRING_GAP;
        const dead = shape.frets[i] === null;
        return (
          <line
            key={`s${i}`}
            x1={x}
            y1={PAD_TOP}
            x2={x}
            y2={bottom}
            className="chord-svg-string"
            strokeWidth={dead ? 1 : 0.9 + (5 - i) * 0.22}
            strokeDasharray={dead ? "2 2.5" : undefined}
            opacity={dead ? 0.4 : 1}
          />
        );
      })}

      {/* Traverse: la cordiera è più spessa e senza numero di tasto */}
      {[...Array(fretsShown + 1)].map((_, i) => {
        const y = PAD_TOP + i * FRET_H;
        const isNut = nut && i === 0;
        return (
          <line
            key={`f${i}`}
            x1={left}
            y1={y}
            x2={W - PAD_X}
            y2={y}
            className="chord-svg-fret"
            strokeWidth={isNut ? 4 : 1.1}
          />
        );
      })}

      {/* Numeri dei tasti laterali, quando la posizione non parte dalla prima */}
      {!nut
        ? [...Array(fretsShown)].map((_, i) => (
            <text
              key={`n${i}`}
              x={left - 5}
              y={PAD_TOP + i * FRET_H + FRET_H / 2 + 4}
              textAnchor="end"
              className="chord-svg-fretno"
              fontSize={9}
            >
              {i === 0 ? shape.baseFret : i === 1 && shape.baseFret + 1 < 10 ? shape.baseFret + 1 : ""}
            </text>
          ))
        : null}

      {/* X sulle corde non suonate */}
      {shape.frets.map((f, i) => {
        if (f !== null) return null;
        const x = W - PAD_X - i * STRING_GAP;
        return (
          <g key={`x${i}`}>
            <line x1={x - 4.2} y1={PAD_TOP - 9} x2={x + 4.2} y2={PAD_TOP - 1} className="chord-svg-x" />
            <line x1={x + 4.2} y1={PAD_TOP - 9} x2={x - 4.2} y2={PAD_TOP - 1} className="chord-svg-x" />
          </g>
        );
      })}

      {/* O (corda aperta) sulle corde suonate a tasto 0 */}
      {shape.frets.map((f, i) => {
        if (f !== 0) return null;
        const x = W - PAD_X - i * STRING_GAP;
        return (
          <circle
            key={`o${i}`}
            cx={x}
            cy={PAD_TOP - 5}
            r={4.2}
            className="chord-svg-open"
            strokeWidth={1.2}
          />
        );
      })}

      {/* Barrè */}
      {shape.barre ? (
        <rect
          x={W - PAD_X - shape.barre.to * STRING_GAP - 8.5}
          y={yOf(shape.barre.fret) - 8.5}
          width={(shape.barre.to - shape.barre.from) * STRING_GAP + 17}
          height={17}
          rx={8.5}
          className="chord-svg-barre"
        />
      ) : null}

      {/* Dita */}
      {shape.frets.map((f, i) => {
        if (f === null || f === 0) return null;
        const onBarre = shape.barre !== null && f === shape.barre.fret && i >= shape.barre.from && i <= shape.barre.to;
        if (onBarre) return null;
        const x = W - PAD_X - i * STRING_GAP;
        return (
          <circle
            key={`d${i}`}
            cx={x}
            cy={yOf(f)}
            r={8}
            className="chord-svg-finger"
          />
        );
      })}

      {/* Numeri delle dita dentro i puntini */}
      {shape.frets.map((f, i) => {
        if (f === null || f === 0) return null;
        const onBarre = shape.barre !== null && f === shape.barre.fret && i >= shape.barre.from && i <= shape.barre.to;
        if (onBarre) return null;
        const x = W - PAD_X - i * STRING_GAP;
        return (
          <text
            key={`t${i}`}
            x={x}
            y={yOf(f) + 3.4}
            textAnchor="middle"
            className="chord-svg-digit"
            fontSize={9.5}
          >
            {shape.fingers[i]}
          </text>
        );
      })}

      {/* Dita usate, in chiaro sotto al diagramma */}
      <text
        x={W / 2}
        y={bottom + 17}
        textAnchor="middle"
        className="chord-svg-hint"
        fontSize={9.5}
      >
        {shape.hasBarre
          ? `barrè ${shape.barre?.fret}ª · ${FINGER_NAMES.slice(1).join(" ")}`
          : `dita: ${[...new Set(shape.fingers.filter((f) => f > 0))]
              .sort()
              .map((f) => FINGER_NAMES[f])
              .join(" · ")}`}
      </text>
      <text
        x={W / 2}
        y={bottom + 31}
        textAnchor="middle"
        className="chord-svg-hint"
        fontSize={9.5}
      >
        {muted > 0 ? `${muted} cord${muted === 1 ? "a" : "e"}mute` : "6 corde"}
        {minPlayed === 0 ? " · a corda aperta" : ` · tasto ${minPlayed}`}
      </text>
    </svg>
  );
}
