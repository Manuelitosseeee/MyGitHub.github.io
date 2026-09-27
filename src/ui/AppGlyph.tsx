import type { SVGProps } from "react";

export type AppGlyphName =
  | "home"
  | "studio"
  | "metronome-tab"
  | "metronome"
  | "tuner"
  | "strings"
  | "strings-coil"
  | "settings";

type AppGlyphProps = SVGProps<SVGSVGElement> & {
  name: AppGlyphName;
  size?: number;
  strokeWidth?: number;
};

export function AppGlyph({
  name,
  size = 24,
  strokeWidth = 1.7,
  ...props
}: AppGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {name === "home" ? (
        <>
          <path d="m3.2 10.6 8.8-7.4 8.8 7.4" />
          <path d="M5.6 9.1v11h12.8v-11M9.8 20.1v-6.4h4.4v6.4" />
        </>
      ) : null}
      {name === "studio" ? (
        <>
          <path d="M14.5 4.1v12.3" />
          <path d="m14.5 6.2 6-1.4v11.1" />
          <ellipse cx="11.7" cy="17.8" rx="2.8" ry="1.9" transform="rotate(-18 11.7 17.8)" />
          <ellipse cx="17.8" cy="16.4" rx="2.8" ry="1.9" transform="rotate(-18 17.8 16.4)" />
        </>
      ) : null}
      {name === "metronome-tab" ? (
        <>
          <circle cx="12" cy="13.2" r="8.1" />
          <path d="M9.1 3h5.8M12 5.1V3M16.8 6.1l1.2-1.2M12 8.1v5l3.1 1.8" />
        </>
      ) : null}
      {name === "metronome" ? (
        <>
          <path d="m8.9 4.2-3.7 15a1.1 1.1 0 0 0 1.1 1.4h11.4a1.1 1.1 0 0 0 1.1-1.4l-3.7-15z" />
          <path d="M10.1 6.1 14.9 18M6.4 20.6h11.2" />
          <circle cx="14.7" cy="17.4" r="1.1" fill="currentColor" stroke="none" />
        </>
      ) : null}
      {name === "tuner" ? (
        <>
          <path d="M8 3.3v5.9a4 4 0 0 0 8 0V3.3M12 13.2v7.5" />
          <path d="m10.2 19.3 1.8 2.4 1.8-2.4" />
          <path d="M8 5.5h1.5M14.5 5.5H16" />
        </>
      ) : null}
      {name === "strings" ? (
        <>
          <path d="M9.2 14.8 7 17a3.4 3.4 0 0 1-4.8-4.8l4.2-4.3a3.4 3.4 0 0 1 4.8 0" />
          <path d="m14.8 9.2 2.2-2.2a3.4 3.4 0 1 1 4.8 4.8l-4.2 4.3a3.4 3.4 0 0 1-4.8 0" />
          <path d="m8.6 15.4 6.8-6.8" />
        </>
      ) : null}
      {name === "strings-coil" ? (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5.8" />
          <path d="M5.1 6.8a9 9 0 0 0 12.1 12.1" />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <path d="M12 2.9 14 4l2.3-.4 1.2 2 2.2.9v2.4l1.4 1.9-1.1 2.2.4 2.3-2 1.2-.9 2.2h-2.4l-1.9 1.4-2.2-1.1-2.3.4-1.2-2-2.2-.9v-2.4L3.9 12l1.1-2.2-.4-2.3 2-1.2.9-2.2h2.4z" />
          <circle cx="12" cy="12" r="3.1" />
        </>
      ) : null}
    </svg>
  );
}
