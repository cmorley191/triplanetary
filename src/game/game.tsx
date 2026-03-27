import { CSSProperties } from "react";
import { Axis, Position, Side } from "./hex";
import { Optional } from "../core/optional";

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
    faceFill: 0.29,
    faceFillOriginal: 0.27,
    color: "#B3A3AA",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 2, axis: Axis.R },
  },
  "Venus": {
    name: "Venus",
    position: { q: 51, r: -1 },
    faceFill: 0.35,
    faceFillOriginal: 0.38,
    color: "#E5CEA3",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  "Terra": {
    name: "Terra",
    position: { q: 41, r: -12 },
    faceFill: 0.37,
    faceFillOriginal: 0.37,
    color: "#1E90FF",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  "Luna": {
    name: "Luna",
    position: { q: 40, r: -14 },
    faceFill: 0.25,
    faceFillOriginal: 0.20,
    color: "#DCDCDC",
    type: AstralBodyType.Planet,
    weakGravity: true,
    bases: { count: 6 },
  },
  "Mars": {
    name: "Mars",
    position: { q: 27, r: 14 },
    faceFill: 0.31,
    faceFillOriginal: 0.40,
    color: "#B22222",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  "Ceres": {
    name: "Ceres",
    position: { q: 20, r: 14 },
    faceFill: 0.18,
    faceFillOriginal: 0.3,
    color: "#D0D0D0",
    type: AstralBodyType.Asteroid,
  },
  "Clandestine": {
    name: "Clandestine",
    position: { q: 21, r: -3 },
    faceFill: 0.15,
    faceFillOriginal: 0.3,
    color: "#BBBBDD",
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
    faceFill: 0.27,
    faceFillOriginal: 0.15,
    color: "#907000",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 6 },
  },
  "Io": {
    name: "Io",
    position: { q: 13, r: 9 },
    faceFill: 0.25,
    faceFillOriginal: 0.16,
    color: "#CCC200",
    type: AstralBodyType.Planet,
    weakGravity: true,
    bases: { count: 1, side: { q: 1, r: 0 } },
  },
  "Ganymede": {
    name: "Ganymede",
    position: { q: 9, r: 9 },
    faceFill: 0.28,
    faceFillOriginal: 0.14,
    color: "#A3A3EE",
    type: AstralBodyType.Planet,
    weakGravity: false,
    bases: { count: 1, side: { q: 0, r: -1 } },
  },
  "Europa": {
    name: "Europa",
    position: { q: 8, r: 13 },
    faceFill: 0.24,
    faceFillOriginal: 0.15,
    color: "#C0FFFF",
    type: AstralBodyType.Planet,
    weakGravity: true,
    bases: { count: 0 },
  },
}
export const astralBodies: AstralBody<AstralBodyName>[] = astralBodyNames.map(n => astralBodiesMap[n]);

export const asteroidFields = [
  { q: 17, rs: [24, 25] },
  { q: 18, rs: [23] },
  { q: 19, rs: [3, 21, 23, 24] },
  { q: 20, denseRs: [-3, -2], rs: [-6, 1, 13, 16, 18] },
  { q: 21, denseRs: [-4, -2], rs: [-10, -9, -8, -5, 3, 18, 19, 21] },
  { q: 22, denseRs: [-4, -3], rs: [-6, -1, 0, 2, 4, 7, 21] },
  { q: 23, denseRs: [-4], rs: [-9, -1, 9, 11, 20, 21, 22] },
  { q: 24, rs: [-12, -11, -8, 2, 4, 5, 6, 9, 20] },
  { q: 25, rs: [-10, -9, -7, -5, -3, -1, 2, 5, 6, 10] },
  { q: 26, rs: [-10, -7, -4, -1, 2, 5, 7] },
  { q: 27, rs: [-2, -1, 1, 4, 8] },
  { q: 28, rs: [4, 6] },
].flatMap(q =>
  q.rs.map(r => ({ r, dense: false }))
    .concat(q.denseRs?.map(r => ({ r, dense: true })) ?? [])
    .map(f => ({ position: { q: q.q, r: f.r }, dense: f.dense }))
);

export enum OverloadStatus { Unsupported, Used, Available };
export enum GameTurnPhase { Astrogation, Combat, Resupply, Complete };

export type AstrogationRolloutStep = {
  momentumAppliedFromLast: Position,
  gravityAppliedFromLast: {
    gravityHexes: {
      position: Position,
      netStrong: Position,
      netWeak: Position,
      netAppliedWeak: Position,
      net: Position,
      bodies: {
        iBody: number,
        gravity: Position,
        gravityType: "strong" | "applied weak" | "ignored weak",
      }[],
    }[],
    net: Position,
  },
  netTransform: Position,
  endPosition: Position,
}

export type GameHistoryTurnStartingState = {
  ships: (
    | { eliminated: true }
    | {
      eliminated: false,
      position: Position,
      ballisticRollout: AstrogationRolloutStep,
      fuelMax: number,
      fuelCurrent: number,
      overload: OverloadStatus,
      //gunStrength: number,
      //damage: number,
    }
  )[][], // [player][]
};

export type GameHistoryTurnAstrogationInProgress = {
  astrogationsInProgress: {
    ignoredFirstWeakGravityBodies: (
      & { iBody: number }
      & (
        | { planned: false }
        | { planned: true, plannedIgnore: boolean }
      )
    )[],
    thrust:
    | { planned: false }
    | {
      planned: true,
      thrust: Optional<Position>,
      overloaded: boolean,
      endFuel: number,
      endOverload: OverloadStatus,
    },
    rollout: AstrogationRolloutStep,
  }[], // [active player ship]
};
// resolving "plan ignore gravity" and "plan thrust" is pretty trivial -- just do it in the app

export type GameHistoryTurnAstrogationComplete = {
  astrogation: {
    ignoredFirstWeakGravityBodies: number[],
    thrust: Optional<Position>,
    overloaded: boolean,
    endFuel: number,
    endOverload: OverloadStatus,
    rollout: AstrogationRolloutStep,
  }[], // [active player ship]
};
// committing Astrogation is pretty trivial -- just do it in the app
/*
export enum GameHistoryTurnCombatEventType { Asteroid, GunAttack }
export type InProgressSequence<T extends any[]> =
  T extends [infer TName, infer THead]
  ? Optional<{ [K in TName & string]: THead }>
  : T extends [infer TName, infer THead, ...infer TTail]
  ? Optional<
    & { [K in TName & string]: THead }
    & { continuation: InProgressSequence<TTail> }
  >
  : never;
export type OmitAll<TObject, TKeys> =
  TKeys extends []
  ? TObject
  : TKeys extends [infer THead, ...infer TTail]
  ? THead extends string
  ? TTail extends string[]
  ? OmitAll<Omit<TObject, THead>, TTail>
  : never
  : never
  : never;
export type GameHistoryTurnCombatAsteroidEvent = {
  type: GameHistoryTurnCombatEventType.Asteroid,
  iShip: number,
  field: Position,
  impact: Optional<{
    damage: number,
  }>,
};
export type GameHistoryTurnCombatGunAttackEvent = {
  type: GameHistoryTurnCombatEventType.GunAttack,
  iShipsAssailants: number[],
  targets: {
    iPlayer: number,
    iShip: number,
  }[],
  attackStrengths: number[], // strength[target]
  defense: {
    iPlayer: number,
    iPlayersWillingToCoordinateWith: number[],
  }[],
  counterattack: {
    iPlayer: number,
    strengths: number[], // strength[assailant_target]
  }[],
};
export type GameHistoryTurnCombatInProgress = {
  events: (
    | GameHistoryTurnCombatAsteroidEvent
    | GameHistoryTurnCombatGunAttackEvent
  )[],
  inProgressEvent: (
    & OmitAll<GameHistoryTurnCombatGunAttackEvent, ['defense', 'counterattack', 'attack']>
    & {
      defense:
      | { planned: false }
      | { planned: true, defensePlan: GameHistoryTurnCombatGunAttackEvent['defense'] },

    }
  )
};
*/

export type GameHistoryTurn =
  & {
    iPlayerActive: number,
    startingState: GameHistoryTurnStartingState,
  }
  & (
    | ({ phase: GameTurnPhase.Astrogation } & GameHistoryTurnAstrogationInProgress)
    | (
      & {
        phase:
        //| GameTurnPhase.Combat
        //| GameTurnPhase.Resupply
        | GameTurnPhase.Complete
      }
      & GameHistoryTurnAstrogationComplete
    )
  )
