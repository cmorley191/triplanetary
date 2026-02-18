import './app.css';
import "../core/array_extensions";

import * as React from "react";

import { HexGrid, Layout, Hexagon, Hex } from 'react-hexgrid';

import { astralBodies, Axis, Corner, cornerE, cornerNE, cornerNW, cornerSE, cornerSW, cornerW, Position, Side, sideN, sideNE, sideNW, sideS, sideSE, sideSW } from "../game/game";
import { nullopt, nullopt_t, opt, opt_, opt_t, Optional } from "../core/optional";
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

  const [destination, setDestination] = React.useState<Optional<Position>>(nullopt);

  const highlighted = React.useMemo<{ position: Position, important: boolean }[]>(() => {
    if (destination.hasValue === false) return [];

    const intersectionsData = getHexIntersections({
      start: appStartingPosition,
      end: destination.value,
    });

    if (intersectionsData.type === PathIntersectionsType.AxisAligned) {
      return (
        [...intersectionsData.iterate()]
          .map(i => ({ position: i.position, important: true }))
      );
    } else if (intersectionsData.type === PathIntersectionsType.EdgeAligned) {
      return (
        fullyUnpackGenerator(intersectionsData.iterate())
          .flatMap(i => [
            { position: i.intersected.position, important: true },
            ...(
              i.passed.hasValue
                ? i.passed.value.positions.map(position => ({ position, important: false }))
                : []
            ),
          ])
      );
    } else {
      satisfiesCheck<PathIntersectionsType.Oblique>(intersectionsData.type);
      return (
        intersectionsData.intersections.flatMap(i => [
          { position: i.intersected, important: true },
          ...(
            i.passed.hasValue
              ? [{ position: i.passed.value, important: false }]
              : []
          ),
        ])
      );
    }
  }, [destination]);

  /*
  const [history, setHistory] = React.useState<{
    thrust: Optional<Side>,
    ignoredFirstWeakGravity: boolean,
  }[]>([]);
  
  const historyMemoizations = React.useRef<{
    startPosition: Position,
    momentumAppliedFromLast: Position,
    gravityAppliedFromLast: {
      hexes: { position: Position, direction: Side, weak: boolean }[],
      net: Position,
    },
    netTransform: Position,
    endPosition: Position,
  }[]>([]);
  React.useEffect(() => {
    history
      .skip(historyMemoizations.current.length)
      .forEach(h => {
        const lastStoredMemoization = historyMemoizations.current[0];
        const lastMemoization =
          lastStoredMemoization === undefined
            ? {
              startPosition: appStartingPosition,
              endPosition: appStartingPosition,
              netTransform: { q: 0, r: 0 } as Position,
            }
            : lastStoredMemoization;
        const gravityAppliedFromLast = 
  
        ;
        historyMemoizations.current.push({
          startPosition: lastMemoization.endPosition,
          momentumAppliedFromLast: lastMemoization.netTransform,
  
        });
      });
  }, [history]);
  */

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
                    if (destination.hasValue) return;

                    setDestination(opt({ q: hex.hex.q, r: hex.hex.r }));
                  }}
                >
                  {hex.children}
                  {
                    (() => {
                      const highlighting = ((): "important" | "not important" | "none" => {
                        if (highlighted.length == 0 && appStartingPosition.q == hex.hex.q && appStartingPosition.r == hex.hex.r) return "important";
                        const hexHighlightings = highlighted.filterTransform((h): Optional<"important" | "not important"> =>
                          (h.position.q == hex.hex.q && h.position.r == hex.hex.r)
                            ? opt(h.important ? "important" : "not important")
                            : nullopt
                        );

                        const [firstHighlighting, secondHighlighting] = hexHighlightings;
                        if (firstHighlighting === undefined) return "none";
                        if (secondHighlighting !== undefined) throw `bad highlightings ${JSON.stringify(hexHighlightings)}`;
                        return firstHighlighting;
                      })();

                      if (highlighting === "none") return undefined;

                      return <circle
                        cx="0"
                        cy="0"
                        r={unitsPerFaceDiameter / 2}
                        fill="pink"
                        fillOpacity={highlighting === "important" ? 1.0 : satisfiesCheck<"not important">(highlighting)(0.3)}
                      />;
                    })()
                  }
                </Hexagon>
              ))
          }
        </Layout>
      </HexGrid>
    </div>
  );
}