import './app.css';
import "../core/array_extensions";

import * as React from "react";

import { HexGrid, Layout, Hexagon, Hex } from 'react-hexgrid';

import { astralBodies, AstralBodyType, Axis, Corner, cornerE, cornerNE, cornerNW, cornerSE, cornerSW, cornerW, Position, Side, sideN, sideNE, sideNW, sides, sideS, sideSE, sideSW } from "../game/game";
import { nullopt, nullopt_t, opt, opt_, opt_t, optFromUndefable, Optional } from "../core/optional";
import { fullyUnpackGenerator, getRandomInt, minmax, satisfiesCheck } from '../core/misc';



const mapSize = { width: 66, height: 35 };

function getRRangeOfQ(q: number): { minInclusive: number, maxExclusive: number } {
  const offset = Math.floor(q / 2); // or q>>1
  return {
    minInclusive: -offset,
    maxExclusive: mapSize.height - offset - (q % 2)
  };
}

// export temporarily because unused
export function getQRangeOfR(r: number): { minInclusive: number, maxExclusive: number } {
  return {
    minInclusive: Math.max(-r * 2, 0),
    maxExclusive: Math.min((mapSize.height - 1 - r) * 2 + 1, mapSize.width),
  };
}

function addPositions(a: Position, b: Position) { return { q: a.q + b.q, r: a.r + b.r }; }

function positionToSide(p: Position): Optional<Side> {
  return optFromUndefable(sides.filter(s => s.q == p.q && s.r == p.r)[0]);
}

function throwOnNullopt<T>(o: Optional<T>, err: string): T {
  if (o.hasValue === false) throw err;
  return o.value;
}

const sqrt3 = Math.sqrt(3);
const hexSides = [
  { side: sideN, point: { x: -1, y: sqrt3 }, vector: { x: 2, y: 0 } },
  { side: sideS, point: { x: -1, y: -sqrt3 }, vector: { x: 2, y: 0 } },
  { side: sideNE, point: { x: 2, y: 0 }, vector: { x: -1, y: sqrt3 } },
  { side: sideSE, point: { x: 2, y: 0 }, vector: { x: -1, y: -sqrt3 } },
  { side: sideNW, point: { x: -2, y: 0 }, vector: { x: 1, y: sqrt3 } },
  { side: sideSW, point: { x: -2, y: 0 }, vector: { x: 1, y: -sqrt3 } },
];
const epsilon = 1e-6;

enum PathIntersectionsType { AxisAligned, EdgeAligned, Oblique };
function getHexIntersections(path: { start: Position, end: Position })
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

  const fullPath = {
    start: { q: path.start.q, r: path.start.r, s: -(path.start.q + path.start.r) },
    end: { q: path.end.q, r: path.end.r, s: -(path.end.q + path.end.r) },
  };
  const transform = {
    q: fullPath.end.q - fullPath.start.q,
    r: fullPath.end.r - fullPath.start.r,
    s: fullPath.end.s - fullPath.start.s,
  };

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
          position: {
            q: path.start.q + alignedAxis.value.direction.q * i,
            r: path.start.r + alignedAxis.value.direction.r * i,
          },
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
          position: {
            q: path.start.q + perpendicularAxis.value.direction.q * i,
            r: path.start.r + perpendicularAxis.value.direction.r * i,
          },
        };

        if (i >= perpendicularAxis.value.length) return { intersected, passed: nullopt };

        yield {
          intersected,
          passed: opt_({
            time: (i + 1 / 3) / perpendicularAxis.value.length,
            positions: [
              {
                q: intersected.position.q + perpendicularAxis.value.passedDirections[0].q,
                r: intersected.position.r + perpendicularAxis.value.passedDirections[0].r,
              },
              {
                q: intersected.position.q + perpendicularAxis.value.passedDirections[1].q,
                r: intersected.position.r + perpendicularAxis.value.passedDirections[1].r,
              }
            ],
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
      hexSides.forEach(side => {
        const a = (center.x + side.point.x) * transformCartesian.y - (center.y + side.point.y) * transformCartesian.x;
        const d = transformCartesian.x * side.vector.y - transformCartesian.y * side.vector.x;
        const s = a / d;
        // analytical solution is so hard
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

      const existingTime = interactions.filterTransform(i => Math.abs(i.time - earliestTime) <= epsilon ? opt(i.time) : nullopt)[0];
      if (existingTime !== undefined) earliestTime = existingTime;

      interactions.push({
        time: earliestTime,
        position: { q: path.start.q + q, r: path.start.r + r },
        intersected: interactionIsIntersection,
      });
    }
  }

  const groupedInteractions =
    interactions
      .groupBy(i => i.time)
      .everyTransform((g): Optional<{ time: number, intersected: Position, passed: Optional<Position> }> => {
        const [firstInteraction, secondInteraction, thirdInteraction] = g.group;
        if (firstInteraction === undefined || thirdInteraction !== undefined) return nullopt;
        if (secondInteraction === undefined) {
          if (!firstInteraction.intersected) return nullopt;
          return opt({ time: firstInteraction.time, intersected: firstInteraction.position, passed: nullopt });
        }
        // unnecessary sanity check that groupBy is working
        if (firstInteraction.time != secondInteraction.time) return nullopt;
        if (firstInteraction.intersected) {
          if (secondInteraction.intersected) return nullopt;
          return opt({ time: firstInteraction.time, intersected: firstInteraction.position, passed: opt(secondInteraction.position) });
        }
        if (!secondInteraction.intersected) return nullopt;
        return opt({ time: firstInteraction.time, intersected: secondInteraction.position, passed: opt(firstInteraction.position) });
      });

  if (groupedInteractions.hasValue === false) throw `bad interactions ${JSON.stringify(interactions)}`;

  groupedInteractions.value.sort((a, b) => a.time - b.time);

  /*
  const gridTransform = {
    x: transform.q * 3,
    y: transform.q + transform.r * 2,
  };
  //const transformAbs = { q: Math.abs(transform.q), r: Math.abs(transform.r) };
  const transformSign = { q: Math.sign(transform.q), r: Math.sign(transform.r) };
 
  yield {
    intersected: {
      time: 0,
      position: { q: path.start.q, r: path.start.r },
    },
  };
 
  for (let centerQ = 0; (transform.q > 0) ? (centerQ < transform.q) : (centerQ > transform.q); centerQ += transformSign.q) {
    const checkpointsGridX: [number, number, number, number] = [
      centerQ * 3,
      centerQ * 3 + transformSign.q,
      centerQ * 3 + transformSign.q * 2,
      (centerQ + transformSign.q) * 3,
    ];
    const checkpointsGridY: [number, number, number, number] = [
      checkpointsGridX[0] * gridTransform.y / gridTransform.x,
      checkpointsGridX[1] * gridTransform.y / gridTransform.x,
      checkpointsGridX[2] * gridTransform.y / gridTransform.x,
      checkpointsGridX[3] * gridTransform.y / gridTransform.x,
    ];
    console.log(JSON.stringify(checkpointsGridY));
    const startR = (checkpointsGridY[0] - centerQ) / 2;
    const endR = (checkpointsGridY[3] - centerQ - transformSign.q) / 2;
    console.log(JSON.stringify({ startR, endR }));
 
    let testHex = { q: centerQ, r: Math.round(startR), gridY: centerQ + Math.round(startR) * 2 };
    while (true) {
      if (
        testHex.q != centerQ
        && testHex.r - transformSign.r / 2 > endR
      ) {
        break;
      }
 
      const intersectionType = ((): IntersectionType => {
        if (testHex.gridY + transformSign.r <= checkpointsGridY[1]) {
          if (testHex.q == centerQ) return IntersectionType.EnteringBorder;
        }
 
        if (testHex.gridY - transformSign.r >= checkpointsGridY[2]) {
          if (testHex.q != centerQ) return IntersectionType.ExitedBorder;
        }
 
        if (testHex.q % 2 == 1) {
          if (testHex.gridY == checkpointsGridY[1] && testHex.gridY - transformSign.r >= checkpointsGridY[0]) return IntersectionType.TangentCheckpoint1;
          if (testHex.gridY - transformSign.r == checkpointsGridY[1] && testHex.gridY >= checkpointsGridY[2]) return IntersectionType.TangentCheckpoint1;
          if (testHex.gridY + transformSign.r == checkpointsGridY[2] && testHex.gridY <= checkpointsGridY[1]) return IntersectionType.TangentCheckpoint2;
        } else {
          if (testHex.gridY == checkpointsGridY[2] && testHex.gridY + transformSign.r <= checkpointsGridY[3]) return IntersectionType.TangentCheckpoint2;
        }
 
 
 
 
        if (testHex.gridY + transformSign.r > checkpointsGridY[1] && testHex.gridY - transformSign.r < checkpointsGridY[2]) return IntersectionType.InBorder;
 
        return IntersectionType.Miss;
      })();
      const doYield = (
        intersectionType == IntersectionType.EnteringBorder
        || intersectionType == IntersectionType.InBorder
        || intersectionType == IntersectionType.ExitedBorder
      );
 
      console.log(JSON.stringify({ testHex, intersectionType }));
 
      if (doYield) {
        yield { intersected: { time: 0, position: { q: path.start.q + testHex.q, r: path.start.r + testHex.r } } };
      }
 
      if (testHex.q == centerQ) testHex = { q: testHex.q + transformSign.q, r: testHex.r, gridY: testHex.gridY + transformSign.r };
      else testHex = { q: testHex.q - transformSign.q, r: testHex.r + transformSign.r, gridY: testHex.gridY + transformSign.r };
    }
  }
  */

  return {
    type: PathIntersectionsType.Oblique,
    intersections: groupedInteractions.value,
  };
}

enum PathInteractionType { Intersection, EdgeTrace }
type PathInteraction =
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
function getHexInteractions(path: { start: Position, end: Position }) {
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
                  type: PathInteractionType.EdgeTrace as PathInteractionType.EdgeTrace,
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

function onlyIntersectionInteractionsFilterTransform(i: PathInteraction): Optional<PathInteraction & { type: PathInteractionType.Intersection }> {
  if (i.type === PathInteractionType.EdgeTrace) return nullopt;
  return opt_(i);
}

type ArrowProps = React.SVGProps<SVGLineElement> & {
  id?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
};

const Arrow: React.FC<ArrowProps> = ({
  id = "arrowhead",
  x1 = 0,
  y1 = 0,
  x2 = 100,
  y2 = 0,
  strokeWidth = 2,
  color = "currentColor",
  style = {},
  className = "",
  ...props
}) => {
  return (
    <>
      <defs>
        <marker
          id={id}
          markerWidth="5"
          markerHeight="3.5"
          refX="5"
          refY="1.75"
          orient="auto"
        >
          <polygon
            className={`arrowhead ${className}`}
            points="0 0, 5 1.75, 0 3.5"
            fill={color}
            style={style}
          />
        </marker>
      </defs>

      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeWidth}
        markerEnd={`url(#${id})`}
        style={style}
        className={className}
        {...props}
      />
    </>
  );
};




type AppProps = {};
export default function App({ }: AppProps) {
  const appStartingPosition = React.useMemo<Position>(() => {
    while (true) {
      const q = getRandomInt(mapSize.width);
      const rRange = getRRangeOfQ(q);
      const r = getRandomInt(rRange.maxExclusive - rRange.minInclusive) + rRange.minInclusive;
      if (astralBodies.some(body => body.position.q == q && body.position.r == r)) {
        continue;
      }
      return { q, r };
    }
  }, []);

  const [history, setHistoryRaw] = React.useState<{
    thrust: Optional<Side>,
    ignoredFirstWeakGravityBodyIndices: number[],
  }[]>([]);

  const historyMemoizations = React.useRef<{
    startPosition: Position,
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
        }[]
      }[],
      net: Position,
    },
    netTransform: Position,
    endPosition: Position,
  }[]>([]);

  const setHistory = (newHistory: typeof history) => {
    setHistoryRaw(newHistory);

    newHistory
      .skip(historyMemoizations.current.length)
      .forEach(h => {
        const lastStoredMemoization = historyMemoizations.current[historyMemoizations.current.length - 1];
        const { startPosition: lastStartPosition, endPosition: startPosition, netTransform: momentumAppliedFromLast } =
          lastStoredMemoization === undefined
            ? {
              startPosition: appStartingPosition,
              endPosition: appStartingPosition,
              netTransform: { q: 0, r: 0 } as Position,
            }
            : lastStoredMemoization;
        const handledFirstWeakGravityBodyIndices: number[] = [];
        const hexInteractions =
          getHexInteractions({ start: lastStartPosition, end: startPosition })
            .interactions.filterTransform(onlyIntersectionInteractionsFilterTransform);
        const gravityHexes =
          getHexInteractions({ start: lastStartPosition, end: startPosition })
            .interactions.filterTransform(onlyIntersectionInteractionsFilterTransform)
            .skip(hexInteractions.length == 1 ? 0 : 1)
            .map(hex => {
              const gravityBodies = astralBodies.filterTransform((body, iBody): Optional<{ iBody: number, gravity: Position, gravityType: "strong" | "applied weak" | "ignored weak", }> => {
                if (body.type === AstralBodyType.Asteroid) return nullopt;

                const transformPartial = { q: body.position.q - hex.intersectedPosition.q, r: body.position.r - hex.intersectedPosition.r };
                const transform = { ...transformPartial, s: -(transformPartial.q + transformPartial.r) };
                const distance = (Math.abs(transform.q) + Math.abs(transform.r) + Math.abs(transform.s)) / 2;
                if (body.type === AstralBodyType.Planet) {
                  if (distance != 1) return nullopt;
                  return opt({
                    iBody,
                    gravity: transformPartial,
                    gravityType: (() => {
                      if (!body.weakGravity) return "strong";
                      if (handledFirstWeakGravityBodyIndices.includes(iBody)) return "applied weak";
                      handledFirstWeakGravityBodyIndices.push(iBody);
                      if (h.ignoredFirstWeakGravityBodyIndices.includes(iBody)) return "ignored weak";
                      else return "applied weak";
                    })(),
                  });
                }

                satisfiesCheck<AstralBodyType.Sun>(body.type);
                if (distance == 1) {
                  return opt({ iBody, gravity: { q: transform.q * 2, r: transform.r * 2 }, gravityType: "strong" });
                } else if (distance == 2) {
                  if (Math.abs(transform.q) == 1 || Math.abs(transform.r) == 1) return opt({ body, iBody, gravity: transformPartial, gravityType: "strong" });
                  else return opt({ iBody, gravity: { q: transform.q / 2, r: transform.r / 2 }, gravityType: "strong" })
                }
                else return nullopt;
              });

              const netStrong = gravityBodies.filter(b => b.gravityType === "strong").map(g => g.gravity).reduce(addPositions, { q: 0, r: 0 });
              const netWeak = gravityBodies.filter(b => b.gravityType !== "strong").map(g => g.gravity).reduce(addPositions, { q: 0, r: 0 });
              const netAppliedWeak = gravityBodies.filter(b => b.gravityType === "applied weak").map(g => g.gravity).reduce(addPositions, { q: 0, r: 0 });

              return {
                position: hex.intersectedPosition,
                netStrong,
                netWeak,
                netAppliedWeak,
                net: { q: netStrong.q + netAppliedWeak.q, r: netStrong.r + netAppliedWeak.r },
                bodies: gravityBodies,
              };
            })
            .filter(h => h.bodies.length > 0);
        const gravityAppliedFromLast = {
          gravityHexes,
          net: gravityHexes.map(h => h.net).reduce(addPositions, { q: 0, r: 0 }),
        };
        const netTransform = addPositions(
          momentumAppliedFromLast,
          h.thrust.hasValue === false ? gravityAppliedFromLast.net : addPositions(gravityAppliedFromLast.net,
            h.thrust.value));
        historyMemoizations.current.push({
          startPosition,
          momentumAppliedFromLast,
          gravityAppliedFromLast,
          netTransform,
          endPosition: addPositions(startPosition, netTransform),
        });
        console.log(`push memo ${JSON.stringify(historyMemoizations.current[historyMemoizations.current.length - 1])}`);
      });
  };

  const lastHistory = historyMemoizations.current[historyMemoizations.current.length - 1];
  const shipPositionPartial =
    lastHistory === undefined
      ? appStartingPosition
      : lastHistory.endPosition;
  const shipPosition = { ...shipPositionPartial, s: -(shipPositionPartial.q + shipPositionPartial.r) };

  console.log(`render ${JSON.stringify({ shipPosition, history, memos: historyMemoizations.current.length })}`);

  // Distance from one vertex to the opposite vertex in svg user space. (discovered by messing around with react-hexgrid)
  const unitsPerVertexDiameter = 2;
  // Distance from one face to the opposite face.
  const unitsPerFaceDiameter = unitsPerVertexDiameter * Math.sqrt(3) / 2;
  // Distance from one vertex to the face that marks the next line in the tessellation 
  // (a hexagon's opposite vertex "stabs" into the next line of hexagons in the tessellation)
  const unitsPerVertexSpacing = unitsPerVertexDiameter * 3 / 4;

  const pixelsPerUnit = 13;

  // In the actual game board, hexagons are arranged such that travelling horizontally means you cross hexagon faces.
  // The actual game board is hamburger shaped though, while computer screens are hotdog shaped, so we're rotating the whole board.
  const viewBoxSize = {
    width: unitsPerVertexSpacing * (mapSize.width - 1) + unitsPerVertexDiameter,
    height: unitsPerFaceDiameter * (mapSize.height + 0.5),
  }

  // similar to GridGenerator.orientedRectangle, but cropped hexagons are removed
  let hexagons = [];
  for (let q = 0; q < mapSize.width; q++) {
    const rRange = getRRangeOfQ(q);
    for (let r = rRange.minInclusive; r < rRange.maxExclusive; r++) {
      hexagons.push(new Hex(q, r, -q - r));
    }
  }

  return (
    <div style={{ margin: 10 }}>
      <HexGrid
        width={viewBoxSize.width * pixelsPerUnit}
        height={viewBoxSize.height * pixelsPerUnit}
        viewBox={`${-unitsPerVertexDiameter / 2} ${-unitsPerFaceDiameter / 2} ${viewBoxSize.width} ${viewBoxSize.height}`}
      >
        <Layout origin={{ x: 0, y: 0 }} size={{ x: 1, y: 1 }}>
          {
            hexagons
              .map((hex, ihex) => ({
                hex,
                children:
                  astralBodies
                    .filter(body => body.position.q == hex.q && body.position.r == hex.r)
                    .map(((body, ibody) => (
                      <circle
                        key={`${ihex},${ibody}`}
                        cx="0"
                        cy="0"
                        r={unitsPerFaceDiameter / 2 * body.faceFill}
                        fill={body.color}
                        fillOpacity="1.0"
                      />
                    ))),
              }))
              .map((hex, i) => (
                <Hexagon
                  key={i}
                  q={hex.hex.q}
                  r={hex.hex.r}
                  s={hex.hex.s}
                  onClick={() => {
                    const transform = { q: hex.hex.q - shipPosition.q, r: hex.hex.r - shipPosition.r, s: hex.hex.s - shipPosition.s };
                    const distance = (Math.abs(transform.q) + Math.abs(transform.r) + Math.abs(transform.s)) / 2;
                    console.log(`click ${JSON.stringify({ hex, shipPosition, distance })}`);
                    if (distance > 1) return;

                    setHistory([
                      ...history,
                      {
                        thrust:
                          distance == 0
                            ? nullopt
                            : opt_(throwOnNullopt(positionToSide(transform), "bad thrust side")),
                        ignoredFirstWeakGravityBodyIndices: [],
                      },
                    ]);

                    console.log("set history");
                  }}
                >
                  {hex.children}
                  {
                    (() => {
                      if (!(shipPosition.q == hex.hex.q && shipPosition.r == hex.hex.r)) return undefined;
                      const width = unitsPerFaceDiameter / 2 * 1;
                      return <rect
                        x={-width / 2}
                        y={-width / 2}
                        width={width}
                        height={width}
                        fill={"pink"}
                        fillOpacity="1.0"
                      />;
                    })()
                  }
                  {
                    history.takeZip(historyMemoizations.current)
                      .flatMap(([h, m], i) => {
                        if (!(hex.hex.q == m.startPosition.q && hex.hex.r == m.startPosition.r)) return [];
                        const dx = unitsPerVertexSpacing * (m.netTransform.q);
                        const dy = unitsPerFaceDiameter * (m.netTransform.r + m.netTransform.q / 2);
                        const d = Math.sqrt(dx * dx + dy * dy);
                        const scale = (d - unitsPerFaceDiameter * 0.3) / d;
                        return [
                          <Arrow
                            key={`${i}transform`}
                            x2={unitsPerVertexSpacing * (m.netTransform.q) * scale}
                            y2={unitsPerFaceDiameter * (m.netTransform.r + m.netTransform.q / 2) * scale}
                            color="white"
                            strokeWidth={0.2}
                            opacity={Math.max(0, 1 + (i - history.length + 1) / 10)}
                          />,
                          ...(() => {
                            if (history.length - i > 5) return [];
                            const subArrows: ({ props: ArrowProps } & { transform: Position, key: string })[] = [
                              {
                                key: "momentum",
                                transform: m.momentumAppliedFromLast,
                                props: {
                                  color: "green",
                                  strokeWidth: 0.1,
                                  opacity: 0.5,
                                },
                              },
                              {
                                key: "gravity",
                                transform: m.gravityAppliedFromLast.net,
                                props: {
                                  color: "#600c94",
                                  strokeWidth: 0.1,
                                  opacity: 0.7,
                                }
                              },
                              {
                                key: "thrust",
                                transform: h.thrust.hasValue ? h.thrust.value : { q: 0, r: 0 },
                                props: {
                                  color: "orange",
                                  strokeWidth: 0.13,
                                  opacity: 0.8,
                                },
                              },
                            ];

                            let pos = { x: 0, y: 0 };
                            return subArrows.filter(a => !(a.transform.q == 0 && a.transform.r == 0)).map(a => {
                              const startPos = pos;
                              pos = { x: pos.x + unitsPerVertexSpacing * a.transform.q, y: pos.y + unitsPerFaceDiameter * (a.transform.r + a.transform.q / 2) };
                              return <Arrow
                                key={`${i}${a.key}`}
                                x1={startPos.x}
                                y1={startPos.y}
                                x2={pos.x}
                                y2={pos.y}
                                color={a.props.color}
                                {...a.props}
                              />;
                            });
                          })()
                        ];
                      })
                  }
                </Hexagon>
              ))
          }
        </Layout>
      </HexGrid>
    </div>
  );
}