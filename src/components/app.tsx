import * as React from "react";

import { HexGrid, Layout, Hexagon, Hex } from 'react-hexgrid';

import './app.css';
import { astralBodies } from "../game/map";

type AppProps = {};

export default function App({ }: AppProps) {
  const mapSize = { width: 66, height: 35 };

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
    let offset = Math.floor(q / 2); // or q>>1
    for (let r = -offset; r < mapSize.height - offset - (q % 2); r++) {
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
              .map((hex, i) => <Hexagon key={i} q={hex.hex.q} r={hex.hex.r} s={hex.hex.s}>{hex.children}</Hexagon>)
          }
        </Layout>
      </HexGrid>
    </div>
  );
}