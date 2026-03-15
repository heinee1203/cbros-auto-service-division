"use client";

import { DAMAGE_ZONES } from "@/lib/constants";
import { DamageSeverity } from "@/types/enums";

type View = "top" | "left" | "right" | "front" | "rear";

interface DamageMarker {
  zone: string;
  severity: string;
  index: number;
}

interface CarSvgProps {
  view: View;
  damageEntries: DamageMarker[];
  onZoneClick: (zoneId: string) => void;
}

// Severity → SVG fill color
const SEVERITY_FILLS: Record<string, string> = {
  COSMETIC: "#bbf7d0", // green-200
  MINOR: "#fef08a",    // yellow-200
  MODERATE: "#fed7aa", // orange-200
  SEVERE: "#fecaca",   // red-200
};

const DEFAULT_FILL = "#f1f5f9";  // slate-100
const HOVER_FILL = "#e2e8f0";    // slate-200
const STROKE_COLOR = "#94a3b8";  // slate-400
const MARKER_BG = "#f59e0b";     // amber-500

// Zone layout definitions per view — { x, y, w, h } in a 400x300 viewBox
type ZoneRect = { x: number; y: number; w: number; h: number; rx?: number };

const TOP_ZONES: Record<string, ZoneRect> = {
  hood:                { x: 145, y: 10,  w: 110, h: 50, rx: 8 },
  left_fender:         { x: 100, y: 10,  w: 40,  h: 50, rx: 4 },
  right_fender:        { x: 260, y: 10,  w: 40,  h: 50, rx: 4 },
  windshield:          { x: 130, y: 65,  w: 140, h: 30, rx: 4 },
  roof:                { x: 120, y: 100, w: 160, h: 70, rx: 8 },
  left_front_door:     { x: 95,  y: 70,  w: 30,  h: 55, rx: 4 },
  right_front_door:    { x: 275, y: 70,  w: 30,  h: 55, rx: 4 },
  left_rear_door:      { x: 95,  y: 130, w: 30,  h: 55, rx: 4 },
  right_rear_door:     { x: 275, y: 130, w: 30,  h: 55, rx: 4 },
  left_quarter_panel:  { x: 100, y: 190, w: 40,  h: 50, rx: 4 },
  right_quarter_panel: { x: 260, y: 190, w: 40,  h: 50, rx: 4 },
  rear_windshield:     { x: 130, y: 195, w: 140, h: 30, rx: 4 },
  trunk:               { x: 145, y: 230, w: 110, h: 50, rx: 8 },
};

const FRONT_ZONES: Record<string, ZoneRect> = {
  hood:            { x: 110, y: 10,  w: 180, h: 50, rx: 8 },
  windshield:      { x: 100, y: 65,  w: 200, h: 55, rx: 6 },
  grille:          { x: 140, y: 160, w: 120, h: 35, rx: 4 },
  front_bumper:    { x: 90,  y: 200, w: 220, h: 45, rx: 6 },
  left_headlight:  { x: 90,  y: 125, w: 60,  h: 30, rx: 4 },
  right_headlight: { x: 250, y: 125, w: 60,  h: 30, rx: 4 },
};

const REAR_ZONES: Record<string, ZoneRect> = {
  trunk:           { x: 110, y: 10,  w: 180, h: 55, rx: 8 },
  rear_windshield: { x: 100, y: 70,  w: 200, h: 55, rx: 6 },
  rear_bumper:     { x: 90,  y: 200, w: 220, h: 45, rx: 6 },
  left_taillight:  { x: 90,  y: 130, w: 60,  h: 30, rx: 4 },
  right_taillight: { x: 250, y: 130, w: 60,  h: 30, rx: 4 },
};

const LEFT_ZONES: Record<string, ZoneRect> = {
  left_fender:        { x: 15,  y: 80,  w: 70,  h: 70, rx: 6 },
  left_front_door:    { x: 90,  y: 60,  w: 80,  h: 100, rx: 4 },
  left_rear_door:     { x: 175, y: 60,  w: 80,  h: 100, rx: 4 },
  left_quarter_panel: { x: 260, y: 80,  w: 70,  h: 70, rx: 6 },
  left_mirror:        { x: 85,  y: 50,  w: 25,  h: 25, rx: 4 },
  left_rocker:        { x: 90,  y: 165, w: 165, h: 30, rx: 4 },
};

const RIGHT_ZONES: Record<string, ZoneRect> = {
  right_fender:        { x: 260, y: 80,  w: 70,  h: 70, rx: 6 },
  right_front_door:    { x: 175, y: 60,  w: 80,  h: 100, rx: 4 },
  right_rear_door:     { x: 90,  y: 60,  w: 80,  h: 100, rx: 4 },
  right_quarter_panel: { x: 15,  y: 80,  w: 70,  h: 70, rx: 6 },
  right_mirror:        { x: 240, y: 50,  w: 25,  h: 25, rx: 4 },
  right_rocker:        { x: 90,  y: 165, w: 165, h: 30, rx: 4 },
};

const VIEW_ZONES: Record<View, Record<string, ZoneRect>> = {
  top: TOP_ZONES,
  front: FRONT_ZONES,
  rear: REAR_ZONES,
  left: LEFT_ZONES,
  right: RIGHT_ZONES,
};

// Car outline path (simplified) per view
const CAR_OUTLINES: Record<View, string> = {
  top:
    "M200,5 C250,5 290,15 300,30 L310,70 C315,100 315,180 310,220 L300,260 C290,275 250,285 200,285 C150,285 110,275 100,260 L90,220 C85,180 85,100 90,70 L100,30 C110,15 150,5 200,5 Z",
  front:
    "M80,250 L80,120 C80,60 120,10 200,10 C280,10 320,60 320,120 L320,250 C320,260 310,270 300,270 L100,270 C90,270 80,260 80,250 Z",
  rear:
    "M80,250 L80,120 C80,60 120,10 200,10 C280,10 320,60 320,120 L320,250 C320,260 310,270 300,270 L100,270 C90,270 80,260 80,250 Z",
  left:
    "M10,170 L10,130 C10,90 30,60 70,50 L140,40 C160,35 200,35 260,40 L330,50 C370,60 390,90 390,130 L390,170 C390,200 370,210 350,210 L50,210 C30,210 10,200 10,170 Z",
  right:
    "M10,170 L10,130 C10,90 30,60 70,50 L140,40 C160,35 200,35 260,40 L330,50 C370,60 390,90 390,130 L390,170 C390,200 370,210 350,210 L50,210 C30,210 10,200 10,170 Z",
};

// Wheel positions per view
const WHEEL_POSITIONS: Record<View, { cx: number; cy: number; r: number }[]> = {
  top: [],
  front: [
    { cx: 105, cy: 255, r: 22 },
    { cx: 295, cy: 255, r: 22 },
  ],
  rear: [
    { cx: 105, cy: 255, r: 22 },
    { cx: 295, cy: 255, r: 22 },
  ],
  left: [
    { cx: 65, cy: 200, r: 28 },
    { cx: 335, cy: 200, r: 28 },
  ],
  right: [
    { cx: 65, cy: 200, r: 28 },
    { cx: 335, cy: 200, r: 28 },
  ],
};

export function CarSvg({ view, damageEntries, onZoneClick }: CarSvgProps) {
  const zones = VIEW_ZONES[view];
  const outline = CAR_OUTLINES[view];
  const wheels = WHEEL_POSITIONS[view];

  // Build a lookup: zone → { severity, index }
  const damageMap = new Map<string, DamageMarker>();
  for (const entry of damageEntries) {
    // If multiple entries on same zone, use worst severity
    const existing = damageMap.get(entry.zone);
    if (!existing) {
      damageMap.set(entry.zone, entry);
    }
  }

  // Resolve zone labels
  const zoneLabels = new Map<string, string>();
  for (const z of DAMAGE_ZONES) {
    zoneLabels.set(z.id, z.label);
  }

  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-auto max-w-md mx-auto"
      role="img"
      aria-label={`Car ${view} view damage diagram`}
    >
      {/* Car outline */}
      <path
        d={outline}
        fill="none"
        stroke={STROKE_COLOR}
        strokeWidth="2"
        opacity={0.4}
      />

      {/* Wheels */}
      {wheels.map((w, i) => (
        <circle
          key={`wheel-${i}`}
          cx={w.cx}
          cy={w.cy}
          r={w.r}
          fill="#334155"
          opacity={0.25}
        />
      ))}

      {/* Clickable zones */}
      {Object.entries(zones).map(([zoneId, rect]) => {
        const damage = damageMap.get(zoneId);
        const fill = damage
          ? SEVERITY_FILLS[damage.severity] || DEFAULT_FILL
          : DEFAULT_FILL;
        const label = zoneLabels.get(zoneId) || zoneId;

        return (
          <g
            key={zoneId}
            onClick={() => onZoneClick(zoneId)}
            className="cursor-pointer group"
            role="button"
            tabIndex={0}
            aria-label={`${label}${damage ? ` — damaged` : ""}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onZoneClick(zoneId);
              }
            }}
          >
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              rx={rect.rx || 2}
              fill={fill}
              stroke={damage ? "#d97706" : STROKE_COLOR}
              strokeWidth={damage ? 2 : 1}
              className="transition-colors group-hover:opacity-80"
            />
            {/* Zone label */}
            <text
              x={rect.x + rect.w / 2}
              y={rect.y + rect.h / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.min(rect.w / 5, 10)}
              fill="#475569"
              className="pointer-events-none select-none"
            >
              {label.length > 12 ? label.slice(0, 10) + ".." : label}
            </text>

            {/* Damage marker circle */}
            {damage && (
              <>
                <circle
                  cx={rect.x + rect.w - 6}
                  cy={rect.y + 6}
                  r={8}
                  fill={MARKER_BG}
                  className="pointer-events-none"
                />
                <text
                  x={rect.x + rect.w - 6}
                  y={rect.y + 6}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="9"
                  fontWeight="bold"
                  fill="white"
                  className="pointer-events-none select-none"
                >
                  {damage.index}
                </text>
              </>
            )}

            {/* Hover overlay */}
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              rx={rect.rx || 2}
              fill={HOVER_FILL}
              opacity={0}
              className="group-hover:opacity-40 transition-opacity"
            />
          </g>
        );
      })}
    </svg>
  );
}
