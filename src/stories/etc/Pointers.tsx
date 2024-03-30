import type { ReactNode } from 'react';

import type { IBBox } from '~';


export function Pointers ({
  pointers,
  edge: {
    xMin,
    xMax,
    yMin,
    yMax,
  },
  showText,
}: {
  pointers: Map<string | number, {x: number; y: number}>;
  edge: IBBox;
  showText?: boolean;
}) {
  const nodes: ReactNode[] = [];

  for (const [_pointerId, {x, y}] of pointers) {
    const pointerId = String(_pointerId);
    const isEdge = (
      x === xMin || x === xMax ||
      y === yMin || y === yMax
    );
    nodes.push(
      <g key={pointerId} transform={`translate(${x}, ${y})`}>
        <circle
          cx={0}
          cy={0}
          r={40}
          fill={isEdge ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)'}
          stroke={isEdge ? '#111' : 'none'}
        />
        {showText ? (
          <text dx={45} dy={0} style={{fill: '#111'}}>
            pointerId: {pointerId}
          </text>
        ) : undefined}
      </g>
    );
  }

  return <>
    {nodes}
  </>;
}
