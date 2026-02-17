import { CSSProperties } from "react";

export enum Axis { Q, R, S }

export enum AstralBodyType { Sun, Planet, Asteroid }

export type AstralBody =
  & {
    name: string,
    position: { q: number, r: number },
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
      | { count: 1, side: { q: number, r: number } }
    }
  )

export const astralBodies: AstralBody[] = [
  {
    name: "Sol",
    position: { q: 47, r: -5 },
    faceFill: 0.87,
    faceFillOriginal: 0.87,
    color: "#FFD700",
    type: AstralBodyType.Sun,
  },
  {
    name: "Mercury",
    position: { q: 51, r: -10 },
    faceFill: 0.28,
    faceFillOriginal: 0.27,
    color: "#C3A3B3",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 2, axis: Axis.R },
  },
  {
    name: "Venus",
    position: { q: 51, r: -1 },
    faceFill: 0.34,
    faceFillOriginal: 0.38,
    color: "#E5BE83",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  {
    name: "Terra",
    position: { q: 41, r: -12 },
    faceFill: 0.35,
    faceFillOriginal: 0.37,
    color: "#1E90FF",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  {
    name: "Luna",
    position: { q: 40, r: -14 },
    faceFill: 0.26,
    faceFillOriginal: 0.20,
    color: "#DCDCDC",
    type: AstralBodyType.Planet,
    weakGravity: true,
    bases: { count: 6 },
  },
  {
    name: "Mars",
    position: { q: 27, r: 14 },
    faceFill: 0.30,
    faceFillOriginal: 0.40,
    color: "#B22222",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  {
    name: "Ceres",
    position: { q: 20, r: 4 },
    faceFill: 0.19,
    faceFillOriginal: 0.3,
    color: "#E0E0E0",
    type: AstralBodyType.Asteroid,
  },
  {
    name: "Clandestine",
    position: { q: 21, r: -13 },
    faceFill: 0.16,
    faceFillOriginal: 0.3,
    color: "#999999",
    type: AstralBodyType.Asteroid,
  },
  {
    name: "Jupiter",
    position: { q: 11, r: 1 },
    faceFill: 0.57,
    faceFillOriginal: 0.54,
    color: "#F4A460",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 0 },
  },
  {
    name: "Callisto",
    position: { q: 11, r: 5 },
    faceFill: 0.28,
    faceFillOriginal: 0.15,
    color: "#C0C0C0",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  {
    name: "Io",
    position: { q: 13, r: 9 },
    faceFill: 0.26,
    faceFillOriginal: 0.16,
    color: "#FFA500",
    type: AstralBodyType.Planet,
    weakGravity: true,
    bases: { count: 1, side: { q: 1, r: 0 } },
  },
  {
    name: "Ganymede",
    position: { q: 9, r: 9 },
    faceFill: 0.29,
    faceFillOriginal: 0.14,
    color: "#B3B3FF",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 1, side: { q: 0, r: -1 } },
  },
  {
    name: "Europa",
    position: { q: 8, r: 13 },
    faceFill: 0.25,
    faceFillOriginal: 0.15,
    color: "#C0FFFF",
    type: AstralBodyType.Planet,
    weakGravity: true,
    bases: { count: 0 },
  },
]