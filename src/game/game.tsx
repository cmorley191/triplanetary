import { CSSProperties } from "react";

export enum Axis { Q, R, S }

export type Position = { q: number, r: number }

export type SideN = { q: 0, r: -1 }
export const sideN: SideN = { q: 0, r: -1 };
export type SideNE = { q: 1, r: -1 }
export const sideNE: SideNE = { q: 1, r: -1 };
export type SideSE = { q: 1, r: 0 }
export const sideSE: SideSE = { q: 1, r: 0 };
export type SideS = { q: 0, r: 1 }
export const sideS: SideS = { q: 0, r: 1 };
export type SideSW = { q: -1, r: 1 }
export const sideSW: SideSW = { q: -1, r: 1 };
export type SideNW = { q: -1, r: 0 }
export const sideNW: SideNW = { q: -1, r: 0 };
export type Side = SideN | SideNE | SideSE | SideS | SideSW | SideNW
export const sides = [sideN, sideNE, sideSE, sideS, sideSW, sideNW];

export type CornerNE = { q: 1, r: -2 }
export const cornerNE: CornerNE = { q: 1, r: -2 };
export type CornerE = { q: 2, r: -1 }
export const cornerE: CornerE = { q: 2, r: -1 };
export type CornerSE = { q: 1, r: 1 }
export const cornerSE: CornerSE = { q: 1, r: 1 };
export type CornerSW = { q: -1, r: 2 }
export const cornerSW: CornerSW = { q: -1, r: 2 };
export type CornerW = { q: -2, r: 1 }
export const cornerW: CornerW = { q: -2, r: 1 };
export type CornerNW = { q: -1, r: -1 }
export const cornerNW: CornerNW = { q: -1, r: -1 };
export type Corner = CornerNE | CornerE | CornerSE | CornerSW | CornerW | CornerNW

export enum AstralBodyType { Sun, Planet, Asteroid }

export type AstralBody<TName> =
  & {
    name: TName,
    position: Position,
    /// The original game board have some wonky radii, they are stored here for posterity
    /// while the next parameter is a more realistic value / based on my own preferences.
    faceFillOriginal: number,
    /// Basically the radius as a percentage: 100% = all the way to the face of the hex.
    faceFill: number,
    color: CSSProperties["color"],
  }
  & (
    | { type: AstralBodyType.Sun | AstralBodyType.Asteroid }
    | {
      type: AstralBodyType.Planet
      weakGravity: boolean,
      bases:
      | { count: 0 | 6 }
      | { count: 2, axis: Axis }
      | { count: 1, side: Side }
    }
  )

export const astralBodyNames
  : ["Sol", "Mercury", "Venus", "Terra", "Luna", "Mars", "Ceres", "Clandestine", "Jupiter", "Callisto", "Io", "Ganymede", "Europa"]
  = ["Sol", "Mercury", "Venus", "Terra", "Luna", "Mars", "Ceres", "Clandestine", "Jupiter", "Callisto", "Io", "Ganymede", "Europa"];
export type AstralBodyName = (typeof astralBodyNames)[number]
export const astralBodyIndices: {
  [I in Extract<keyof (typeof astralBodyNames), `${number}`> as (typeof astralBodyNames)[I]]:
  I extends `${infer N extends number}` ? N : never
} =
  { "Sol": 0, "Mercury": 1, "Venus": 2, "Terra": 3, "Luna": 4, "Mars": 5, "Ceres": 6, "Clandestine": 7, "Jupiter": 8, "Callisto": 9, "Io": 10, "Ganymede": 11, "Europa": 12 };

export const astralBodiesMap: { [name in (typeof astralBodyNames)[number]]: AstralBody<name> } = {
  "Sol": {
    name: "Sol",
    position: { q: 47, r: -5 },
    faceFill: 0.87,
    faceFillOriginal: 0.87,
    color: "#FFD700",
    type: AstralBodyType.Sun,
  },
  "Mercury": {
    name: "Mercury",
    position: { q: 51, r: -10 },
    faceFill: 0.28,
    faceFillOriginal: 0.27,
    color: "#C3A3B3",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 2, axis: Axis.R },
  },
  "Venus": {
    name: "Venus",
    position: { q: 51, r: -1 },
    faceFill: 0.34,
    faceFillOriginal: 0.38,
    color: "#E5BE83",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  "Terra": {
    name: "Terra",
    position: { q: 41, r: -12 },
    faceFill: 0.35,
    faceFillOriginal: 0.37,
    color: "#1E90FF",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  "Luna": {
    name: "Luna",
    position: { q: 40, r: -14 },
    faceFill: 0.26,
    faceFillOriginal: 0.20,
    color: "#DCDCDC",
    type: AstralBodyType.Planet,
    weakGravity: true,
    bases: { count: 6 },
  },
  "Mars": {
    name: "Mars",
    position: { q: 27, r: 14 },
    faceFill: 0.30,
    faceFillOriginal: 0.40,
    color: "#B22222",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  "Ceres": {
    name: "Ceres",
    position: { q: 20, r: 14 },
    faceFill: 0.19,
    faceFillOriginal: 0.3,
    color: "#E0E0E0",
    type: AstralBodyType.Asteroid,
  },
  "Clandestine": {
    name: "Clandestine",
    position: { q: 21, r: -3 },
    faceFill: 0.16,
    faceFillOriginal: 0.3,
    color: "#999999",
    type: AstralBodyType.Asteroid,
  },
  "Jupiter": {
    name: "Jupiter",
    position: { q: 11, r: 11 },
    faceFill: 0.57,
    faceFillOriginal: 0.54,
    color: "#F4A460",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 0 },
  },
  "Callisto": {
    name: "Callisto",
    position: { q: 11, r: 15 },
    faceFill: 0.28,
    faceFillOriginal: 0.15,
    color: "#C0C0C0",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  "Io": {
    name: "Io",
    position: { q: 13, r: 9 },
    faceFill: 0.26,
    faceFillOriginal: 0.16,
    color: "#FFA500",
    type: AstralBodyType.Planet,
    weakGravity: true,
    bases: { count: 1, side: { q: 1, r: 0 } },
  },
  "Ganymede": {
    name: "Ganymede",
    position: { q: 9, r: 9 },
    faceFill: 0.29,
    faceFillOriginal: 0.14,
    color: "#B3B3FF",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 1, side: { q: 0, r: -1 } },
  },
  "Europa": {
    name: "Europa",
    position: { q: 8, r: 13 },
    faceFill: 0.25,
    faceFillOriginal: 0.15,
    color: "#C0FFFF",
    type: AstralBodyType.Planet,
    weakGravity: true,
    bases: { count: 0 },
  },
}
export const astralBodies: AstralBody<AstralBodyName>[] = astralBodyNames.map(n => astralBodiesMap[n]);
