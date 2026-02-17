import * as React from "react";

import { HexGrid, GridGenerator, Layout, Hexagon, Text, Pattern, Path, Hex } from 'react-hexgrid';

import './app.css';

type AppProps = {};

type AppMachineState = {}

export default function App({ }: AppProps) {
  const mapSize = { width: 35, height: 55 };

  const hexagons = GridGenerator.orientedRectangle(mapSize.height, mapSize.width);

  const renderSizeViewportPercent = 99;

  return (
    <div style={{ maxWidth: `${renderSizeViewportPercent}vw`, maxHeight: `${renderSizeViewportPercent}vh` }}>
      <div style={{
        transformOrigin: "top left",
        transform: "rotate(90deg) translateY(-100%)",
        maxWidth: `${renderSizeViewportPercent}vh`,
        maxHeight: `${renderSizeViewportPercent}vw`,
      }}>
        <HexGrid width={`${renderSizeViewportPercent}vh`} height={`${renderSizeViewportPercent}vw`}>
          <Layout
            size={{ x: 1.05, y: 1.05 }}
            origin={{
              x: -mapSize.width - 10, // no clue why this extra offset is needed to center the grid
              y: -Math.sin(Math.PI / 6) * mapSize.height,
            }}
          >
            {hexagons.map((hex, i) => <Hexagon key={i} q={hex.q} r={hex.r} s={hex.s} />)}
          </Layout>
        </HexGrid>
      </div>
    </div>
  );
}