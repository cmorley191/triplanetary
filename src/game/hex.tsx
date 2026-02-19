import { Hex } from "react-hexgrid";
import { asType, fullyUnpackGenerator, map2, minmax, satisfiesCheck } from "../core/misc";
import { nullopt, nullopt_t, opt, opt_, opt_t, optFromUndefable, Optional } from "../core/optional";

export enum Axis { Q, R, S }

export type Position = { q: number, r: number }
export const zeroPos: { q: 0, r: 0 } = { q: 0, r: 0 };
export function addPos(a: Position, b: Position) { return { q: a.q + b.q, r: a.r + b.r }; }
export function subPos(a: Position, b: Position) { return { q: a.q - b.q, r: a.r - b.r }; }
export function scalePos(p: Position, n: number) { return { q: n * p.q, r: n * p.r }; }
export function posEqual(a: Position, b: Position) { return a.q == b.q && a.r == b.r; }
export type FullPosition = { q: number, r: number, s: number };
export const zeroPos_: { q: 0, r: 0, s: 0 } = { q: 0, r: 0, s: 0 };
export function fullPos(p: Position): FullPosition { return { ...p, s: -(p.q + p.r) }; }
export function addPos_(a: FullPosition, b: FullPosition) { return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s }; }
export function subPos_(a: FullPosition, b: FullPosition) { return { q: a.q - b.q, r: a.r - b.r, s: a.s - b.s }; }
export function scalePos_(p: FullPosition, n: number) { return { q: n * p.q, r: n * p.r, s: n * p.s }; }
export function magnitude(p: FullPosition) { return (Math.abs(p.q) + Math.abs(p.r) + Math.abs(p.s)) / 2; }
export function fromHex(h: Hex): FullPosition { return { q: h.q, r: h.r, s: h.s }; }

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

export function sideFromPosition(p: Position): Optional<Side> {
  return optFromUndefable(sides.filter(s => s.q == p.q && s.r == p.r)[0]);
}

const sqrt3 = Math.sqrt(3);
export const hexPerimeter = [
  { side: asType<Side>()(sideN), point: { x: -1, y: sqrt3 }, vector: { x: 2, y: 0 } },
  { side: sideS, point: { x: -1, y: -sqrt3 }, vector: { x: 2, y: 0 } },
  { side: sideNE, point: { x: 2, y: 0 }, vector: { x: -1, y: sqrt3 } },
  { side: sideSE, point: { x: 2, y: 0 }, vector: { x: -1, y: -sqrt3 } },
  { side: sideNW, point: { x: -2, y: 0 }, vector: { x: 1, y: sqrt3 } },
  { side: sideSW, point: { x: -2, y: 0 }, vector: { x: 1, y: -sqrt3 } },
];

export enum PathIntersectionsType { AxisAligned, EdgeAligned, Oblique };
export function getHexIntersections(path: { start: Position, end: Position })
  : (
    | {
      type: PathIntersectionsType.Oblique,
      intersections: { time: number, intersected: Position, passed: Optional<Position> }[]
    }
    | {
      type: PathIntersectionsType.AxisAligned,
      parallelTo: Axis,
      direction: Side,
      length: number,
      iterate: () => Generator<{ time: number, position: Position }, void, void>
    }
    | {
      type: PathIntersectionsType.EdgeAligned,
      perpendicularTo: Axis,
      direction: Corner,
      passedDirections: [Side, Side],
      length: number,
      iterate: () => Generator<
        {
          intersected: { time: number, position: Position },
          passed: opt_t<{ time: number, positions: [Position, Position] }>,
        },
        {
          intersected: { time: number, position: Position },
          passed: nullopt_t,
        },
        void
      >,
    }
  ) {

  const fullPath = { start: fullPos(path.start), end: fullPos(path.end) };
  const transform = subPos_(fullPath.end, fullPath.start);

  const alignedAxis = ((): Optional<{ parallelTo: Axis, direction: Side, length: number }> => {
    if (transform.q == 0) return opt({ parallelTo: Axis.Q, direction: transform.r > 0 ? sideS : sideN, length: Math.abs(transform.r) });
    else if (transform.r == 0) return opt({ parallelTo: Axis.R, direction: transform.q > 0 ? sideSE : sideNW, length: Math.abs(transform.q) });
    else if (transform.s == 0) return opt({ parallelTo: Axis.S, direction: transform.q > 0 ? sideNE : sideSW, length: Math.abs(transform.q) });
    else return nullopt;
  })();
  if (alignedAxis.hasValue) {
    const iterate = function* (): Generator<{ time: number, position: Position }, void, void> {
      for (let i = 0; i <= alignedAxis.value.length; i++) {
        yield {
          time: Math.max(0, (i - 1 / 2) / alignedAxis.value.length),
          position: addPos(path.start, scalePos(alignedAxis.value.direction, i)),
        };
      }
    };
    return {
      type: PathIntersectionsType.AxisAligned,
      ...alignedAxis.value,
      iterate,
    };
  }

  const perpendicularAxis = ((): Optional<{ perpendicularTo: Axis, direction: Corner, passedDirections: [Side, Side], length: number }> => {
    if (transform.q == transform.r) return opt(
      transform.q > 0
        ? { perpendicularTo: Axis.S, direction: cornerSE, passedDirections: [sideSE, sideS], length: transform.q }
        : { perpendicularTo: Axis.S, direction: cornerNW, passedDirections: [sideNW, sideN], length: -transform.q }
    );
    else if (transform.q * 2 == -transform.r) return opt(
      transform.q > 0
        ? { perpendicularTo: Axis.R, direction: cornerNE, passedDirections: [sideN, sideNE], length: transform.q }
        : { perpendicularTo: Axis.R, direction: cornerSW, passedDirections: [sideS, sideSW], length: -transform.q }
    );
    else if (transform.q == -transform.r * 2) return opt(
      transform.q > 0
        ? { perpendicularTo: Axis.Q, direction: cornerE, passedDirections: [sideNE, sideSE], length: -transform.r }
        : { perpendicularTo: Axis.Q, direction: cornerW, passedDirections: [sideSW, sideNW], length: transform.r }
    );
    else return nullopt;
  })();
  if (perpendicularAxis.hasValue) {
    const iterate = function* ()
      : Generator<
        {
          intersected: { time: number, position: Position },
          passed: opt_t<{ time: number, positions: [Position, Position] }>,
        },
        {
          intersected: { time: number, position: Position },
          passed: nullopt_t,
        },
        void
      > {
      let i = 0;
      while (true) {
        const intersected = {
          time: Math.max(0, (i - 1 / 3) / perpendicularAxis.value.length),
          position: addPos(path.start, scalePos(perpendicularAxis.value.direction, i)),
        };

        if (i >= perpendicularAxis.value.length) return { intersected, passed: nullopt };

        yield {
          intersected,
          passed: opt_({
            time: (i + 1 / 3) / perpendicularAxis.value.length,
            positions: map2(perpendicularAxis.value.passedDirections, passedDirection => addPos(intersected.position, passedDirection)),
          }),
        };

        i++;
      }
    };

    return {
      type: PathIntersectionsType.EdgeAligned,
      ...perpendicularAxis.value,
      iterate,
    }
  }

  // The remainder can be handled with a slimmed down line segment intersection checker, since we've already eliminated
  // vertical lines (q axis), parallel lines (axis perpendicular), and colinear triplets (path endpoints are in the center of a hexagon).

  const interactions: {
    time: number,
    position: Position,
    intersected: boolean,
  }[] = [];

  const qRange = minmax(0, transform.q);
  const rRange = minmax(0, transform.r);

  const transformCartesian = { x: 3 * transform.q, y: sqrt3 * (2 * transform.r + transform.q) };

  for (let q = qRange.min; q <= qRange.max; q++) {
    for (let r = rRange.min; r <= rRange.max; r++) {
      const center = { x: 3 * q, y: sqrt3 * (2 * r + q) };
      let sideEndpointsIntersected = 0;
      let sideFacesIntersected = 0;
      let earliestTime = 1;
      // analytical solution is so hard
      const epsilon = 1e-6;
      hexPerimeter.forEach(side => {
        const a = (center.x + side.point.x) * transformCartesian.y - (center.y + side.point.y) * transformCartesian.x;
        const d = transformCartesian.x * side.vector.y - transformCartesian.y * side.vector.x;
        const s = a / d;
        if (s <= -epsilon || s >= 1 + epsilon) return;
        if (s <= epsilon || s >= 1 - epsilon) sideEndpointsIntersected++;
        else sideFacesIntersected++;
        earliestTime = Math.min(earliestTime, Math.max(0, ((center.x + side.point.x) * side.vector.y - (center.y + side.point.y) * side.vector.x) / d));
        //console.log(JSON.stringify({ transform, q, r, side: side.side, s }));
      });

      if (sideEndpointsIntersected == 0 && sideFacesIntersected == 0) { continue; } // miss

      const interactionIsIntersection = (() => {
        if (sideEndpointsIntersected == 2 && sideFacesIntersected == 0) return false; // tangent
        else if (sideEndpointsIntersected > 2 || sideFacesIntersected > 0) return true;
        else throw `${JSON.stringify({ transform, q, r })}`;
      })();

      const existingTime = interactions.filterTransform(i => Math.abs(i.time - earliestTime) <= epsilon ? opt(i.time) : nullopt).get(0);
      if (existingTime.hasValue) earliestTime = existingTime.value;

      interactions.push({
        time: earliestTime,
        position: addPos(path.start, { q, r }),
        intersected: interactionIsIntersection,
      });
    }
  }

  const groupedInteractions =
    interactions
      .groupBy(i => i.time)
      .everyTransform((g): Optional<{ time: number, intersected: Position, passed: Optional<Position> }> => {
        const [firstInteraction, secondInteraction, thirdInteraction] = g.group.take3();
        if (!firstInteraction.hasValue || thirdInteraction.hasValue) return nullopt;
        if (!secondInteraction.hasValue) {
          if (!firstInteraction.value.intersected) return nullopt;
          return opt({ time: firstInteraction.value.time, intersected: firstInteraction.value.position, passed: nullopt });
        }
        // unnecessary sanity check that groupBy is working
        if (firstInteraction.value.time != secondInteraction.value.time) return nullopt;
        if (firstInteraction.value.intersected) {
          if (secondInteraction.value.intersected) return nullopt;
          return opt({ time: firstInteraction.value.time, intersected: firstInteraction.value.position, passed: opt(secondInteraction.value.position) });
        }
        if (!secondInteraction.value.intersected) return nullopt;
        return opt({ time: firstInteraction.value.time, intersected: secondInteraction.value.position, passed: opt(firstInteraction.value.position) });
      });

  if (groupedInteractions.hasValue === false) throw `bad interactions ${JSON.stringify(interactions)}`;

  groupedInteractions.value.sort((a, b) => a.time - b.time);

  return {
    type: PathIntersectionsType.Oblique,
    intersections: groupedInteractions.value,
  };
}

export enum PathInteractionType { Intersection, EdgeTrace }
export type PathInteraction =
  & { time: number }
  & (
    | {
      type: PathInteractionType.Intersection,
      intersectedPosition: Position,
      tangentPosition: Optional<Position>,
    }
    | {
      type: PathInteractionType.EdgeTrace,
      tracedPositions: [Position, Position],
    }
  )
export function getHexInteractions(path: { start: Position, end: Position }) {
  const intersectionsData = getHexIntersections(path);
  if (intersectionsData.type === PathIntersectionsType.AxisAligned) {
    return {
      ...intersectionsData,
      interactions:
        [...intersectionsData.iterate()]
          .map((i): PathInteraction => ({ time: i.time, type: PathInteractionType.Intersection, intersectedPosition: i.position, tangentPosition: nullopt }))
    };
  } else if (intersectionsData.type === PathIntersectionsType.EdgeAligned) {
    return {
      ...intersectionsData,
      interactions:
        fullyUnpackGenerator(intersectionsData.iterate())
          .flatMap((i): PathInteraction[] => [
            { time: i.intersected.time, type: PathInteractionType.Intersection, intersectedPosition: i.intersected.position, tangentPosition: nullopt },
            ...(
              i.passed.hasValue
                ? [{
                  time: i.passed.value.time,
                  type: asType<PathInteractionType.EdgeTrace>()(PathInteractionType.EdgeTrace),
                  tracedPositions: i.passed.value.positions,
                }]
                : []
            ),
          ])
    };
  } else {
    satisfiesCheck<PathIntersectionsType.Oblique>(intersectionsData.type);
    return {
      ...intersectionsData,
      interactions:
        intersectionsData.intersections.map((i): PathInteraction => ({
          time: i.time,
          type: PathInteractionType.Intersection,
          intersectedPosition: i.intersected,
          tangentPosition: i.passed,
        }))
    };
  }
}

export function onlyIntersectionInteractionsFilterTransform(i: PathInteraction): Optional<PathInteraction & { type: PathInteractionType.Intersection }> {
  if (i.type === PathInteractionType.EdgeTrace) return nullopt;
  return opt_(i);
}