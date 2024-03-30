import { type IBBox } from '~';


export function BBox ({
  bbox: {
    xMin,
    xMax,
    yMin,
    yMax,
  },
  fill,
  label,
}: {
  bbox: IBBox;
  fill: string;
  label: string;
}) {
  const xWidth = Math.max(1, xMax - xMin);
  const yWidth = Math.max(1, yMax - yMin);
  return (
    <g transform={`translate(${xMin}, ${yMin})`}>
      <rect
        x={0}
        y={0}
        width={xWidth}
        height={yWidth}
        fill={fill}
        stroke="#111"
        strokeWidth={1}
      />
      <text dx={5} dy={16} style={{fill: '#111'}}>
        {label}
      </text>
    </g>
  );
}
