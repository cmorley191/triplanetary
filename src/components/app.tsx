import './app.css';
import "../core/array_extensions";

import * as React from "react";

import { HexGrid, Layout, Hexagon, Hex } from 'react-hexgrid';

import { asteroidFields, astralBodies, astralBodiesMap, AstralBodyType, AstrogationRolloutStep, GameHistoryTurn, GameTurnPhase, OverloadStatus } from "../game/game";
import { nullopt, opt, Optional, optValueOr, throwOnNullopt } from "../core/optional";
import { assertType, asType, Element2TypeOf, ElementTypeOf, getRandomInt, lerp, map2, satisfiesCheck, takeZipAll, tuple2, weightedRandom } from '../core/misc';
import { addPos, fromHex, fullPos, getHexInteractions, magnitude, PathInteractionType, posEqual, Position, scalePos, sides, subPos, subPos_, zeroPos } from '../game/hex';



const mapSize = { width: 66, height: 35 };
export function getRRangeOfQ(q: number): { minInclusive: number, maxExclusive: number } {
  const offset = Math.floor(q / 2); // or q>>1
  return {
    minInclusive: -offset,
    maxExclusive: mapSize.height - offset - (q % 2)
  };
}
export function getQRangeOfR(r: number): { minInclusive: number, maxExclusive: number } {
  return {
    minInclusive: Math.max(-r * 2, 0),
    maxExclusive: Math.min((mapSize.height - 1 - r) * 2 + 1, mapSize.width),
  };
}

const sqrt3 = Math.sqrt(3);

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

function physicsStep(input: {
  thrust: Position,
  ignoredFirstWeakGravityBodyIndices: number[],
  lastPosition: Position,
  position: Position,
}): AstrogationRolloutStep {
  const handledFirstWeakGravityBodyIndices: number[] = [];
  const gravityHexes =
    getHexInteractions({ start: input.lastPosition, end: input.position })
      .interactions
      .skip(posEqual(input.lastPosition, input.position) ? 0 : 1) // skip starting hex - its gravity was applied last step
      .flatMap((interaction) => {
        if (interaction.type == PathInteractionType.Intersection) return [{
          position: interaction.intersectedPosition,
          requiredBodyDirection: nullopt,
        }];
        satisfiesCheck<PathInteractionType.EdgeTrace>(interaction.type);
        return [
          {
            position: interaction.tracedPositions[0],
            requiredBodyDirection: opt(subPos(interaction.tracedPositions[1], interaction.tracedPositions[0])),
          },
          {
            position: interaction.tracedPositions[1],
            requiredBodyDirection: opt(subPos(interaction.tracedPositions[0], interaction.tracedPositions[1])),
          },
        ];
      })
      .map(hex => {
        const gravityBodies = astralBodies.filterTransform((body, iBody): Optional<{ iBody: number, gravity: Position, gravityType: "strong" | "applied weak" | "ignored weak", }> => {
          if (body.type === AstralBodyType.Asteroid) return nullopt;

          const transform = fullPos(subPos(body.position, hex.position));
          const distance = magnitude(transform);
          if (body.type === AstralBodyType.Planet) {
            if (distance != 1) return nullopt;
            if (hex.requiredBodyDirection.hasValue && !posEqual(transform, hex.requiredBodyDirection.value)) return nullopt;
            return opt({
              iBody,
              gravity: transform,
              gravityType: (() => {
                if (!body.weakGravity) return "strong";
                if (handledFirstWeakGravityBodyIndices.includes(iBody)) return "applied weak";
                handledFirstWeakGravityBodyIndices.push(iBody);
                if (input.ignoredFirstWeakGravityBodyIndices.includes(iBody)) return "ignored weak";
                else return "applied weak";
              })(),
            });
          }

          satisfiesCheck<AstralBodyType.Sun>(body.type);
          if (distance == 1) {
            if (hex.requiredBodyDirection.hasValue && !posEqual(transform, hex.requiredBodyDirection.value)) return nullopt;
            return opt({ iBody, gravity: scalePos(transform, 2), gravityType: "strong" });
          } else if (distance == 2) {
            const gravityType = (() => {
              if (handledFirstWeakGravityBodyIndices.includes(iBody)) return "applied weak";
              handledFirstWeakGravityBodyIndices.push(iBody);
              if (input.ignoredFirstWeakGravityBodyIndices.includes(iBody)) return "ignored weak";
              else return "applied weak";
            })();
            if (Math.abs(transform.q) == 1 || Math.abs(transform.r) == 1) return opt({ body, iBody, gravity: transform, gravityType });
            const transformDirection = scalePos(transform, 1 / 2);
            if (hex.requiredBodyDirection.hasValue && !posEqual(transformDirection, hex.requiredBodyDirection.value)) return nullopt;
            return opt({ iBody, gravity: transformDirection, gravityType, })
          }
          else return nullopt;
        });

        const netStrong = gravityBodies.filter(b => b.gravityType === "strong").map(g => g.gravity).reduce(addPos, zeroPos);
        const netWeak = gravityBodies.filter(b => b.gravityType !== "strong").map(g => g.gravity).reduce(addPos, zeroPos);
        const netAppliedWeak = gravityBodies.filter(b => b.gravityType === "applied weak").map(g => g.gravity).reduce(addPos, zeroPos);

        return {
          position: hex.position,
          netStrong,
          netWeak,
          netAppliedWeak,
          net: addPos(netStrong, netAppliedWeak),
          bodies: gravityBodies,
        };
      })
      .filter(h => h.bodies.length > 0);
  const momentumAppliedFromLast = subPos(input.position, input.lastPosition);
  const gravityAppliedFromLast = {
    gravityHexes,
    net: gravityHexes.map(h => h.net).reduce(addPos, zeroPos),
  };
  const netTransform =
    addPos(momentumAppliedFromLast,
      addPos(gravityAppliedFromLast.net,
        input.thrust));
  return {
    momentumAppliedFromLast,
    gravityAppliedFromLast,
    netTransform,
    endPosition: addPos(input.position, netTransform),
  };
}

export function logAllPossibleOrbits(horizon: number, momentum: number = 4) {
  const checkedCache = new Set<string>();
  const stateToCacheKey = (position: Position, momentum: Position, futureIgnores: number[][]) => `${position.q},${position.r},${momentum.q},${momentum.r};${futureIgnores.map(i => i.join(",")).join(";")}`;
  for (let startQ = 0; startQ < mapSize.width; startQ++) {
    const startRRange = getRRangeOfQ(startQ);
    //console.log(`Checking ${JSON.stringify({ startQ })}`);
    for (let startR = startRRange.minInclusive; startR < startRRange.maxExclusive; startR++) {
      const position0 = { q: startQ, r: startR };
      if (astralBodies.some(b => posEqual(b.position, position0))) continue;
      for (let lastQOffset = -momentum; lastQOffset <= momentum; lastQOffset++) {
        for (let lastROffset = -momentum * 1.5; lastROffset <= momentum * 1.5; lastROffset++) {
          const position1 = addPos(position0, { q: lastQOffset, r: lastROffset });
          const ignoresToCheck: number[][][] = [[]];
          const checkedCacheAdditions = new Set<string>();
          while (true) {
            const ignores = ignoresToCheck.pop_(opt(0));
            if (!ignores.hasValue) break;
            const orbit: string[] = [];
            let lastPosition = position0;
            let position = position1;
            for (let iStep = 0; iStep < horizon * 2; iStep++) {
              if (astralBodies.some(b => posEqual(b.position, position))) break;
              const stepIgnores = optValueOr(ignores.value.get(iStep), []);
              const step = physicsStep({
                thrust: zeroPos,
                ignoredFirstWeakGravityBodyIndices: stepIgnores,
                lastPosition,
                position,
              });
              const nextCacheKey = stateToCacheKey(step.endPosition, step.netTransform, ignores.value.slice(iStep + 1));
              //if (nextCacheKey.startsWith(`12,10,1,0;`)) console.log(nextCacheKey);

              if (
                ignores.value.slice(iStep).every(fi => fi.length == 0)
                && step.gravityAppliedFromLast.gravityHexes.some(h => h.bodies.some(b => b.gravityType !== "strong"))
              ) {
                const weakBodies = [...new Set(step.gravityAppliedFromLast.gravityHexes.flatMap(h => h.bodies.filter(b => b.gravityType !== "strong").map(b => b.iBody)))];
                weakBodies.sort();

                const pastIgnores = ignores.value.slice(0, iStep);
                while (pastIgnores.length < iStep) pastIgnores.push([]);
                for (let bodyMask = 1; bodyMask < (1 << weakBodies.length); bodyMask++) {
                  ignoresToCheck.push([...pastIgnores, weakBodies.filter((_, iMask) => (bodyMask & (1 << iMask)) != 0)]);
                }
              }

              const nextCacheKeyWithoutIgnores = stateToCacheKey(step.endPosition, step.netTransform, []);
              orbit.push(nextCacheKeyWithoutIgnores);

              const [orbit0, orbit1] = orbit.take2();
              if (orbit0.hasValue && orbit1.hasValue && nextCacheKeyWithoutIgnores == orbit0.value
              ) {
                if (nextCacheKeyWithoutIgnores != orbit1.value) {
                  console.log(`Orbit: ${JSON.stringify({ position0, position1, length: iStep, ignores: ignores.value.map(i => i.map(iBody => astralBodies[iBody]?.name ?? "")) })}`)
                  break;
                }
              } else {
                if (checkedCache.has(nextCacheKey)) break;
                if (orbit.length < horizon) checkedCacheAdditions.add(nextCacheKey);
              }

              lastPosition = position;
              position = step.endPosition;
            }
          }
          checkedCacheAdditions.forEach(k => checkedCache.add(k));
        }
      }
    }
  }
}

export function logAllHexInteractions(max_distance: number) {
  const hexes = [];
  for (let q = -max_distance; q <= max_distance; q++) {
    const minR = (2 * max_distance - Math.abs(q) + q) / -2
    const maxR = (2 * max_distance - Math.abs(q) - q) / 2
    for (let r = minR; r <= maxR; r++) {
      hexes.push(
        `  (${q}, ${r}): [\n${//
        getHexInteractions({ start: zeroPos, end: { q, r } })
          .interactions
          .map((interaction) => {
            const timeFraction = ((): [number, number] => {
              for (let denom = 1; denom <= 100; denom++) {
                for (let num = 0; num <= denom; num++) {
                  if (Math.abs(num / denom - interaction.time) < 1e-13) return [num, denom]
                }
              }
              console.log(`Couldn't rationalize ${interaction.time}`);
              return [-1, -1];
            })()
            if (interaction.type == PathInteractionType.Intersection) {
              if (!interaction.tangentPosition.hasValue) {
                return `    (${timeFraction[0]}, ${timeFraction[1]}, 0, ((${interaction.intersectedPosition.q}, ${interaction.intersectedPosition.r}),)),\n`;
              } else {
                return `    (${timeFraction[0]}, ${timeFraction[1]}, 1, ((${interaction.intersectedPosition.q}, ${interaction.intersectedPosition.r}), (${interaction.tangentPosition.value.q}, ${interaction.tangentPosition.value.r}))),\n`;
              }
            } else {
              satisfiesCheck<PathInteractionType.EdgeTrace>(interaction.type);
              return `    (${timeFraction[0]}, ${timeFraction[1]}, 2, ((${interaction.tracedPositions[0].q}, ${interaction.tracedPositions[0].r}), (${interaction.tracedPositions[1].q}, ${interaction.tracedPositions[1].r}))),\n`;
            }
          })
          .join("")
        }  ],\n`
      );
    }
  }
  console.log([
    `{\n`,
    ...hexes,
    `}\n`,
  ].join(""))
}

type AppProps = {};
export default function App({ }: AppProps) {

  // React.useEffect(() => { logAllPossibleOrbits(20); }, []);
  // React.useEffect(() => { logAllHexInteractions(20); }, []);

  const playerCount = 2;

  const [history, setHistoryRaw] = React.useState<{
    pastTurns: (GameHistoryTurn & { phase: GameTurnPhase.Complete })[],
    currentTurn: GameHistoryTurn
  }>(() => {
    const ships =
      Array(playerCount).fill(false)
        .map((_, iPlayer) => {
          const relativeOrbit = (() => {
            const s = getRandomInt(sides.length);
            return {
              lastPosition: throwOnNullopt(sides.get(s), "sides random index impossibility"),
              position: throwOnNullopt(sides.get((s + (getRandomInt(2) * 2 - 1) + sides.length) % sides.length), "sides modulo index impossibility"),
            };
          })();
          const planetPosition = astralBodiesMap[iPlayer == 0 ? "Venus" : "Ganymede"].position;
          const orbit = {
            lastPosition: addPos(planetPosition, relativeOrbit.lastPosition),
            position: addPos(planetPosition, relativeOrbit.position),
          };
          return [{
            eliminated: false as false,
            position: orbit.position,
            ballisticRollout: physicsStep({
              thrust: zeroPos,
              ignoredFirstWeakGravityBodyIndices: [],
              lastPosition: orbit.lastPosition,
              position: orbit.position,
            }),
            fuelMax: 20,
            fuelCurrent: 20,
            overload: OverloadStatus.Available,
          }];
        });

    const iPlayerActive = getRandomInt(ships.length);

    return {
      pastTurns: [],
      currentTurn: {
        iPlayerActive,
        startingState: { ships },
        phase: GameTurnPhase.Astrogation,
        astrogationsInProgress: [{
          ignoredFirstWeakGravityBodies: [],
          thrust: { planned: false },
          rollout:
            throwOnNullopt(throwOnNullopt(
              ships.get(iPlayerActive), "ships random index impossibility")
              .get(0), "no ships")
              .ballisticRollout,
        }],
      },
    };
  });

  const setHistoryAstrogationNewAstrogation = (newHistory: typeof history & { currentTurn: { phase: GameTurnPhase.Astrogation } }) => {
    setHistoryRaw({
      ...newHistory,
      currentTurn: {
        ...newHistory.currentTurn,
        astrogationsInProgress:
          throwOnNullopt(newHistory.currentTurn.startingState.ships.get(newHistory.currentTurn.iPlayerActive), "unexpected active player")
            .takeZip(newHistory.currentTurn.astrogationsInProgress)
            .map(([start, astrogation]) => {
              return start.eliminated
                ? astrogation
                : ({
                  ...astrogation,
                  rollout: physicsStep({
                    thrust: astrogation.thrust.planned === true && astrogation.thrust.thrust.hasValue ? astrogation.thrust.thrust.value : zeroPos,
                    ignoredFirstWeakGravityBodyIndices: astrogation.ignoredFirstWeakGravityBodies.filterTransform(i => i.planned && i.plannedIgnore ? opt(i.iBody) : nullopt),
                    lastPosition: subPos(start.position, start.ballisticRollout.momentumAppliedFromLast),
                    position: start.position,
                  }),
                });
            })
      }
    })
  };

  // Distance from one vertex to the opposite vertex in svg user space. (discovered by messing around with react-hexgrid)
  const unitsPerVertexDiameter = 2;
  // Distance from one face to the opposite face.
  const unitsPerFaceDiameter = unitsPerVertexDiameter * sqrt3 / 2;
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
      const p = fullPos({ q, r });
      hexagons.push(new Hex(p.q, p.r, p.s));
    }
  }

  const generatedAsteroidFields = React.useMemo(() => {
    const allFields = asteroidFields.map(f => ({ ...f, astralBody: false }))
      .concat(astralBodies.filter(b => b.type == AstralBodyType.Asteroid).map(b => ({
        position: b.position,
        astralBody: true,
        dense: (() => {
          const sideNeighbors = sides.map((s) => asteroidFields.filter(f2 => posEqual(f2.position, addPos(b.position, s))).emptyOrSingleOrThrow());
          return (
            sideNeighbors.some(n => n.hasValue)
            && (
              sideNeighbors.filter(n => n.hasValue && n.value.dense).length
              >= sideNeighbors.filter(n => n.hasValue && !n.value.dense).length
            )
          );
        })(),
      })));
    return allFields
      .map(f => {
        const asteroids = [];

        const sideNeighbors = sides.map((s) => allFields.filter(f2 => posEqual(f2.position, addPos(f.position, s))).emptyOrSingleOrThrow());
        const neighborCount = sideNeighbors.filter(n => n.hasValue).length;

        const nAsteroids =
          f.astralBody
            ? Math.ceil(getRandomInt(10) * neighborCount / 6) + 3
            : f.dense
              ? getRandomInt(15) + 20
              : getRandomInt(10) + 10;

        const radii = []
        for (let i = 0; i < nAsteroids; i++) {
          radii.push(Math.pow(i / (nAsteroids - 1), f.dense ? 1.7 : 2));
        }

        const standardShadeRange: [number[], number[]] = [[73, 24, 20], [187, 137, 104]];
        const denseShadeRange: typeof standardShadeRange = [[55, 60, 89], [204, 206, 225]];

        let centers = 0;
        for (let i = 0; i < nAsteroids; i++) {
          const { theta, distance: unclearedDistance, shadeRange } = (() => {
            const [thisShadeRange, oppositeShadeRange] = f.dense ? [denseShadeRange, standardShadeRange] : [standardShadeRange, denseShadeRange];
            const outlier = Math.pow(Math.random(), f.dense ? 2.5 : 6);
            const shadeRange = map2(thisShadeRange, (thisShade, i) => thisShade.takeZip(oppositeShadeRange[i]).map(([a, b]) => lerp(a, b, outlier)));

            if (
              !f.astralBody
              && (
                nAsteroids - i + centers <= 4
                || Math.random() < lerp(0, f.dense ? 0.25 : 0.15, neighborCount / 6)
              )
            ) {
              centers += 1;
              return {
                theta: Math.random() * Math.PI,
                distance: lerp(-1 / 3, 1 / 3, Math.random()),
                shadeRange: shadeRange,
              };
            }

            const sideCornerNeighbors = sides.map((_, i) => {
              const left = throwOnNullopt(sideNeighbors.get((i + 5) % 6), "sideNeighbors wrong size");
              const right = throwOnNullopt(sideNeighbors.get((i + 1) % 6), "sideNeightbors wrong size");
              const result = tuple2([left, right]);
              return result;
            });
            const iSide =
              throwOnNullopt(
                weightedRandom(
                  sideNeighbors.takeZip(sideCornerNeighbors).map(p =>
                    (f.astralBody ? 0 : 1)
                    + (!p[0].hasValue ? 0 : p[0].value.dense ? 9 : 6)
                    + p[1].reduce((a, b) => a + (!b.hasValue ? 0 : f.astralBody ? 0.25 : b.value.dense ? 2.5 : 1.5), 0)
                  )),
                "sideNeighbors wrong size"
              );
            const neighbor = throwOnNullopt(sideNeighbors.get(iSide), "sideNeighbors wrong size");
            const maxThetaVariation = Math.PI / 6;
            const thetaVariation = lerp(-maxThetaVariation, maxThetaVariation, Math.random());
            const cornerNeighbor = throwOnNullopt(sideCornerNeighbors.get(iSide), "sideNeighbors wrong size")[thetaVariation > 0 ? 0 : 1];
            const distance = (neighbor.hasValue && !f.astralBody)
              ? Math.pow(Math.random(), 0.2)
              : Math.random();

            return {
              theta: Math.PI / 2 - iSide * Math.PI / 3 + Math.PI * 2 + thetaVariation,
              distance,
              shadeRange:
                ((): typeof standardShadeRange => {
                  const neighborShadeRange = !neighbor.hasValue ? shadeRange : neighbor.value.dense ? denseShadeRange : standardShadeRange;
                  const cornerNeighborShadeRange = !cornerNeighbor.hasValue ? neighborShadeRange : cornerNeighbor.value.dense ? denseShadeRange : standardShadeRange;
                  const neighborsShadeRange: typeof standardShadeRange = [
                    neighborShadeRange[0].takeZip(cornerNeighborShadeRange[0]).map(([a, b]) => lerp(a, b, Math.abs(thetaVariation) / maxThetaVariation)),
                    neighborShadeRange[1].takeZip(cornerNeighborShadeRange[1]).map(([a, b]) => lerp(a, b, Math.abs(thetaVariation) / maxThetaVariation)),
                  ];
                  return [
                    shadeRange[0].takeZip(neighborsShadeRange[0]).map(([a, b]) => lerp(a, b, Math.pow(distance, 2))),
                    shadeRange[1].takeZip(neighborsShadeRange[1]).map(([a, b]) => lerp(a, b, Math.pow(distance, 2))),
                  ];
                })()
            };
          })();
          const distance =
            f.astralBody
              ? Math.sign(unclearedDistance) * ((Math.abs(unclearedDistance) + 5) / 6)
              : unclearedDistance;

          const radius = Math.min(1, Math.max(0,
            throwOnNullopt(radii.pop_(opt(getRandomInt(radii.length))), "impossible out of bounds") // so clear that this is [0, radii.length)
            + lerp(-0.1, 0.1, Math.random())
          ));

          const shade = Math.random();
          asteroids.push({
            x: Math.cos(theta) * distance,
            y: -Math.sin(theta) * distance,
            radius,
            shade: assertType<React.SVGProps<SVGCircleElement>['fill']>(`rgb(${shadeRange[0].takeZip(shadeRange[1]).map(d => lerp(d[0], d[1], shade)).join(",")})`),
          });
        }
        return { ...f, asteroids };
      });
  }, []);

  return (
    <div style={{ margin: 10 }}>
      <div>
        <label>
          <input
            type="checkbox"
            checked={
              (() => {
                if (history.currentTurn.phase === GameTurnPhase.Astrogation) {
                  const ignore = throwOnNullopt(history.currentTurn.astrogationsInProgress.get(0), "one ship scenario")
                    .ignoredFirstWeakGravityBodies.emptyOrSingleOrThrow("no double weak body on map");
                  return ignore.hasValue && ignore.value.planned && ignore.value.plannedIgnore;
                }
                return false;
              })()
            }
            disabled={
              !(
                history.currentTurn.phase === GameTurnPhase.Astrogation
                && throwOnNullopt(history.currentTurn.astrogationsInProgress.get(0), "one ship scenario")
                  .ignoredFirstWeakGravityBodies.length > 0
              )
            }
            onChange={(e) => {
              if (history.currentTurn.phase !== GameTurnPhase.Astrogation) return;
              const ignore = throwOnNullopt(history.currentTurn.astrogationsInProgress.get(0), "one ship scenario")
                .ignoredFirstWeakGravityBodies.emptyOrSingleOrThrow("no double weak body on map");
              if (ignore.hasValue === false) return;
              setHistoryAstrogationNewAstrogation({
                ...history,
                currentTurn: {
                  ...history.currentTurn,
                  astrogationsInProgress: [{
                    ...throwOnNullopt(history.currentTurn.astrogationsInProgress.get(0), "one ship scenario"),
                    ignoredFirstWeakGravityBodies: [{
                      ...ignore.value,
                      planned: true,
                      plannedIgnore: e.target.checked,
                    }],
                  }],
                },
              });
            }}
          />
          Ignore Weak Gravity
        </label>
        <button
          disabled={
            !(
              history.currentTurn.phase === GameTurnPhase.Astrogation
              && history.currentTurn.astrogationsInProgress.every(s =>
                s.ignoredFirstWeakGravityBodies.every(i => i.planned)
                && s.thrust.planned
              )
            )
          }
          onClick={(_e) => {
            if (history.currentTurn.phase !== GameTurnPhase.Astrogation) return;
            const astrogations = history.currentTurn.astrogationsInProgress
              .filterTransform((astrogation): Optional<ElementTypeOf<(GameHistoryTurn & { phase: GameTurnPhase.Complete })["astrogation"]>> => {
                const ignores = astrogation.ignoredFirstWeakGravityBodies.filterTransform(i => i.planned ? opt(i) : nullopt);
                if (ignores.length !== astrogation.ignoredFirstWeakGravityBodies.length) return nullopt;
                if (!astrogation.thrust.planned) return nullopt;
                return opt({
                  ignoredFirstWeakGravityBodies: ignores.filterTransform(i => i.plannedIgnore ? opt(i.iBody) : nullopt),
                  ...astrogation.thrust,
                  rollout: astrogation.rollout,
                });
              });
            if (astrogations.length !== history.currentTurn.astrogationsInProgress.length) return;
            const newIPlayerActive = (history.currentTurn.iPlayerActive + 1) % playerCount;
            const newState: GameHistoryTurn["startingState"] = {
              ships: history.currentTurn.startingState.ships.map((s, iPlayer) => {
                if (iPlayer !== history.currentTurn.iPlayerActive) return s;
                return s.takeZip(astrogations)
                  .map(([start, astrogation]): Element2TypeOf<GameHistoryTurn["startingState"]["ships"]> =>
                    start.eliminated
                      ? start
                      : ({
                        eliminated: false,
                        position: astrogation.rollout.endPosition,
                        ballisticRollout: physicsStep({
                          thrust: zeroPos,
                          ignoredFirstWeakGravityBodyIndices: [],
                          lastPosition: start.position,
                          position: astrogation.rollout.endPosition,
                        }),
                        fuelMax: start.fuelMax,
                        fuelCurrent: astrogation.endFuel,
                        overload: astrogation.endOverload,
                      })
                  );
              }),
            };
            setHistoryRaw({
              pastTurns: history.pastTurns.concat({
                iPlayerActive: history.currentTurn.iPlayerActive,
                startingState: history.currentTurn.startingState,
                phase: GameTurnPhase.Complete,
                astrogation: astrogations
              }),
              currentTurn: {
                iPlayerActive: newIPlayerActive,
                startingState: newState,
                phase: GameTurnPhase.Astrogation,
                astrogationsInProgress:
                  throwOnNullopt(newState.ships.get(newIPlayerActive), "unexpected active player")
                    .map((s): ElementTypeOf<(GameHistoryTurn & { phase: GameTurnPhase.Astrogation })["astrogationsInProgress"]> =>
                      s.eliminated
                        ? {
                          ignoredFirstWeakGravityBodies: [],
                          thrust: {
                            planned: true,
                            thrust: nullopt,
                            overloaded: false,
                            endFuel: 0,
                            endOverload: OverloadStatus.Unsupported,
                          },
                          rollout: {
                            momentumAppliedFromLast: zeroPos,
                            gravityAppliedFromLast: {
                              gravityHexes: [],
                              net: zeroPos,
                            },
                            netTransform: zeroPos,
                            endPosition: zeroPos,
                          },
                        }
                        : {
                          ignoredFirstWeakGravityBodies: [...new Set(
                            s.ballisticRollout.gravityAppliedFromLast.gravityHexes.flatMap(h =>
                              h.bodies.filterTransform(b => b.gravityType === "strong" ? nullopt : opt(b.iBody))))]
                            .map(iBody => ({ iBody, planned: false })),
                          thrust: { planned: false },
                          rollout: s.ballisticRollout,
                        }
                    ),
              },
            });
          }}
        >
          Submit Turn
        </button>
      </div>

      <div>
        <HexGrid
          width={viewBoxSize.width * pixelsPerUnit}
          height={viewBoxSize.height * pixelsPerUnit}
          viewBox={`${-unitsPerVertexDiameter / 2} ${-unitsPerFaceDiameter / 2} ${viewBoxSize.width} ${viewBoxSize.height}`}
        >
          <Layout origin={{ x: 0, y: 0 }} size={{ x: 1, y: 1 }}>
            {
              hexagons
                .map((hex, ihex) => (
                  <Hexagon
                    key={ihex}
                    q={hex.q}
                    r={hex.r}
                    s={hex.s}
                    onClick={() => {
                      if (history.currentTurn.phase !== GameTurnPhase.Astrogation) return;
                      const ship = throwOnNullopt(throwOnNullopt(
                        history.currentTurn.startingState.ships.get(history.currentTurn.iPlayerActive), "unexpected active player")
                        .get(0), "one ship scenario");
                      if (ship.eliminated) return;
                      const transform = subPos_(fromHex(hex), fullPos(ship.position));
                      const distance = magnitude(transform);
                      console.log(`click ${JSON.stringify({ hex, position: ship.position, distance })}`);
                      if (distance > 2) return;
                      const overload = distance > 1;
                      if (ship.overload !== OverloadStatus.Available && overload) return;
                      const fuelUse = distance;
                      if (fuelUse > ship.fuelCurrent) return;
                      setHistoryAstrogationNewAstrogation({
                        ...history,
                        currentTurn: {
                          ...history.currentTurn,
                          astrogationsInProgress: [{
                            ...throwOnNullopt(history.currentTurn.astrogationsInProgress.get(0), "one ship scenario"),
                            thrust: {
                              planned: true,
                              thrust: distance == 0 ? nullopt : opt(transform),
                              overloaded: overload,
                              endFuel: ship.fuelCurrent - fuelUse,
                              endOverload: overload ? OverloadStatus.Used : ship.overload,
                            },
                          }],
                        },
                      });
                    }}
                  >
                    {
                      generatedAsteroidFields
                        .filter(f => posEqual(f.position, fromHex(hex)))
                        .map((f, iField) => {
                          const radiusRange: [number, number] = [0.01, 0.11];
                          const spread = 1.3;
                          return f.asteroids.map((a, iAsteroid) =>
                            <circle
                              key={`${iField};${iAsteroid}`}
                              cx={a.x * unitsPerFaceDiameter / 2 * (1 - radiusRange[1]) * spread}
                              cy={a.y * unitsPerFaceDiameter / 2 * (1 - radiusRange[1]) * spread}
                              r={lerp(radiusRange[0], radiusRange[1], a.radius) * unitsPerVertexDiameter / 2}
                              fill={a.shade}
                              fillOpacity="1.0"
                            />
                          );
                        })[0]
                    }
                    {
                      astralBodies
                        .filter(body => posEqual(body.position, fromHex(hex)))
                        .map(((body, ibody) => (
                          <circle
                            key={`${ihex},${ibody}`}
                            cx="0"
                            cy="0"
                            r={unitsPerFaceDiameter / 2 * body.faceFill}
                            fill={body.color}
                            fillOpacity="1.0"
                          />
                        )))
                    }
                    {
                      // axes
                      (() => {
                        if (!(hex.q % 10 == 0 && hex.r % 10 == 0)) return undefined;
                        return <circle
                          cx="0"
                          cy="0"
                          r={unitsPerFaceDiameter / 2 * 0.1}
                          fill="white"
                          fillOpacity="0.0" // disabled, was 0.3
                        />
                      })()
                    }
                    {
                      // ships
                      history.currentTurn.startingState.ships
                        .map((ships, iPlayer) => ({ iPlayer, ships }))
                        .rotate((history.currentTurn.iPlayerActive + 1) % playerCount) // render the active player's ships last / on top
                        .flatMap(playerShips =>
                          playerShips.ships.filterTransform((ship, iShip) => {
                            if (ship.eliminated || !posEqual(ship.position, fromHex(hex))) return nullopt;
                            const width = unitsPerFaceDiameter / 2 * 1;
                            return opt(<rect
                              key={`${playerShips.iPlayer}.${iShip}`}
                              x={-width / 2}
                              y={-width / 2}
                              width={width}
                              height={width}
                              fill={playerShips.iPlayer == 0 ? "pink" : "lime"}
                              fillOpacity="1.0"
                            />);
                          }))
                    }
                    {
                      // arrows
                      throwOnNullopt(
                        history.pastTurns
                          .concat(
                            history.currentTurn.phase == GameTurnPhase.Astrogation
                              ? []
                              : [history.currentTurn]
                          )
                          .map(t => {
                            return {
                              iPlayerActive: t.iPlayerActive,
                              astrogation:
                                throwOnNullopt(t.startingState.ships.get(t.iPlayerActive), "iPlayerActive and ships length mismatch")
                                  .takeZip(t.astrogation)
                                  .map(([startingState, astrogation]) =>
                                    startingState.eliminated
                                      ? asType<{ eliminated: true }>()({ eliminated: true })
                                      : {
                                        eliminated: false as false,
                                        startPosition: startingState.position,
                                        ignoredFirstWeakGravityBodies: astrogation.ignoredFirstWeakGravityBodies,
                                        thrust: astrogation.thrust,
                                        overloaded: astrogation.overloaded,
                                        rollout: astrogation.rollout,
                                      }
                                  ),
                            };
                          })
                          .concat({
                            iPlayerActive: history.currentTurn.iPlayerActive,
                            astrogation:
                              history.currentTurn.phase == GameTurnPhase.Astrogation
                                ? throwOnNullopt(history.currentTurn.startingState.ships.get(history.currentTurn.iPlayerActive), "iPlayerActive and ships length mismatch")
                                  .takeZip(history.currentTurn.astrogationsInProgress)
                                  .map(([startingState, astrogationInProgress]) =>
                                    startingState.eliminated
                                      ? asType<{ eliminated: true }>()({ eliminated: true })
                                      : {
                                        eliminated: false as false,
                                        startPosition: startingState.position,
                                        ignoredFirstWeakGravityBodies:
                                          astrogationInProgress.ignoredFirstWeakGravityBodies
                                            .filter(b => b.planned && b.plannedIgnore)
                                            .map(b => b.iBody),
                                        thrust:
                                          astrogationInProgress.thrust.planned
                                            ? astrogationInProgress.thrust.thrust
                                            : nullopt,
                                        overloaded:
                                          astrogationInProgress.thrust.planned && astrogationInProgress.thrust.thrust.hasValue
                                            ? magnitude(fullPos(astrogationInProgress.thrust.thrust.value)) > 1
                                            : false,
                                        rollout: astrogationInProgress.rollout,
                                      }
                                  )
                                : []
                          })
                          .map((t, iTurn) => ({ iTurn, ...t }))
                          .groupByAtMost(t => t.iPlayerActive, new Set(Array(playerCount).fill(false).map((_, i) => i))), "turn has unexpected active player")
                        .rotate((history.currentTurn.iPlayerActive + 1) % playerCount) // render the active player's ships last / on top
                        .flatMap(playerHistory =>
                          takeZipAll(...playerHistory.group.map(turn => turn.astrogation.map(shipAstrogation => ({
                            iTurn: turn.iTurn,
                            astrogation: shipAstrogation,
                          }))))
                            .flatMap((shipHistory, iShip) =>
                              shipHistory.flatMap(shipTurn => {
                                if (shipTurn.astrogation.eliminated === true) return [];
                                if (!posEqual(shipTurn.astrogation.startPosition, fromHex(hex))) return [];
                                const dx = unitsPerVertexSpacing * (shipTurn.astrogation.rollout.netTransform.q);
                                const dy = unitsPerFaceDiameter * (shipTurn.astrogation.rollout.netTransform.r + shipTurn.astrogation.rollout.netTransform.q / 2);
                                const d = Math.sqrt(dx * dx + dy * dy);
                                const scale = (d - unitsPerFaceDiameter * 0.3) / d;
                                return [
                                  <Arrow
                                    key={`${playerHistory.key};${iShip};${shipTurn.iTurn};transform`}
                                    x2={unitsPerVertexSpacing * (shipTurn.astrogation.rollout.netTransform.q) * scale}
                                    y2={unitsPerFaceDiameter * (shipTurn.astrogation.rollout.netTransform.r + shipTurn.astrogation.rollout.netTransform.q / 2) * scale}
                                    color="white"
                                    strokeWidth={0.2}
                                    opacity={Math.max(0, 1 + (shipTurn.iTurn - history.pastTurns.length + 2) / 10)}
                                  />,
                                  ...(() => {
                                    if (history.pastTurns.length - shipTurn.iTurn + 1 > 5) return [];
                                    const subArrows: ({ props: ArrowProps } & { transform: Position, key: string })[] = [
                                      {
                                        key: "momentum",
                                        transform: shipTurn.astrogation.rollout.momentumAppliedFromLast,
                                        props: {
                                          color: "green",
                                          strokeWidth: 0.1,
                                          opacity: 0.5,
                                        },
                                      },
                                      {
                                        key: "gravity",
                                        transform: shipTurn.astrogation.rollout.gravityAppliedFromLast.net,
                                        props: {
                                          color: "#600c94",
                                          strokeWidth: 0.1,
                                          opacity: 0.7,
                                        }
                                      },
                                    ].concat(
                                      shipTurn.astrogation.thrust.hasValue
                                        ? [{
                                          key: "thrust",
                                          transform: shipTurn.astrogation.thrust.value,
                                          props: {
                                            color: "orange",
                                            strokeWidth: 0.13,
                                            opacity: 0.8,
                                          },
                                        }]
                                        : []
                                    );

                                    let pos = { x: 0, y: 0 };
                                    return subArrows.filter(a => !posEqual(a.transform, zeroPos)).map(a => {
                                      const startPos = pos;
                                      pos = { x: pos.x + unitsPerVertexSpacing * a.transform.q, y: pos.y + unitsPerFaceDiameter * (a.transform.r + a.transform.q / 2) };
                                      return <Arrow
                                        key={`${playerHistory.key};${iShip};${shipTurn.iTurn};${a.key}`}
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
                            )
                        )
                    }
                  </Hexagon>
                ))
            }
          </Layout>
        </HexGrid>
      </div>
    </div >
  );
}
