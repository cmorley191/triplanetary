import Point from "react-hexgrid/lib/models/Point";

export function addPoint(a: Point, b: Point): Point { return { x: a.x + b.x, y: a.y + b.y }; }
export function subPoint(a: Point, b: Point): Point { return { x: a.x - b.x, y: a.y - b.y }; }
export function scalePoint(p: Point, s: number): Point { return { x: p.x * s, y: p.y * s }; }
