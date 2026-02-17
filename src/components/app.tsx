import * as React from "react";

import { HexGrid, GridGenerator, Layout, Hexagon, Text, Pattern, Path, Hex } from 'react-hexgrid';

import './app.css';

type AppProps = {};

type AppMachineState = {}

export default function App({ }: AppProps) {
  const mapSize = { width: 55, height: 35 };

  // Distance from one vertex to the opposite vertex in svg user space. (discovered by messing around with react-hexgrid)
  const unitsPerVertexDiameter = 2;
  // Distance from one face to the opposite face.
  const unitsPerFaceDiameter = unitsPerVertexDiameter * Math.sqrt(3) / 2;
  // Distance from one vertex to the face that marks the next line in the tessellation 
  // (a hexagon's opposite vertex "stabs" into the next line of hexagons in the tessellation)
  const unitsPerVertexSpacing = unitsPerVertexDiameter * 3 / 4;

  const pixelsPerUnit = 12;

  // In the actual game board, hexagons are arranged such that travelling horizontally means you cross hexagon faces.
  // The actual game board is hamburger shaped though, while computer screens are hotdog shaped, so we're rotating the whole board.
  const viewBoxSize = {
    width: unitsPerVertexSpacing * (mapSize.width - 1) + unitsPerVertexDiameter,
    height: unitsPerFaceDiameter * (mapSize.height + 0.5),
  }

  // similar to GridGenerator.orientedRectangle(mapSize.width, mapSize.height), 
  // but with an extra row on top and bottom (the cropped hexagons can still be travelled to)
  let hexagons = [];
  for (let q = 0; q < mapSize.width; q++) {
    let offset = Math.ceil(q / 2); // or q>>1
    for (let r = -offset; r < mapSize.height - offset + 1; r++) {
      hexagons.push(new Hex(q, r, -q - r));
    }
  }

  return (
    <div>
      <HexGrid
        width={viewBoxSize.width * pixelsPerUnit}
        height={viewBoxSize.height * pixelsPerUnit}
        viewBox={`${-unitsPerVertexDiameter / 2} ${-unitsPerFaceDiameter / 2} ${viewBoxSize.width} ${viewBoxSize.height}`}
      >
        <Layout origin={{ x: 0, y: 0 }} size={{ x: 1, y: 1 }}>
          {hexagons.map((hex, i) => <Hexagon key={i} q={hex.q} r={hex.r} s={hex.s} />)}
        </Layout>
      </HexGrid>
    </div>
  );
}