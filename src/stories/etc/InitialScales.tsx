import { type IGesture, type IScale } from '~';


/**
 * A faint gray box representing the gesture's initial scale domain.
 */
export function InitialScales ({
  gesture: {
    inProgress,
    initialXScale,
    initialYScale,
  },
  xScale,
  yScale,
}: {
  gesture: IGesture;
  xScale: IScale;
  yScale: IScale;
}) {
  const xRange = initialXScale.domain().map((domainVal) => xScale(domainVal));
  const yRange = initialYScale.domain().map((domainVal) => yScale(domainVal));
  const [x0, x1] = xRange;
  const [y1, y0] = yRange;
  const xWidth = x1 - x0;
  const yWidth = y1 - y0;
  return (
    inProgress ? (
      <g transform={`translate(${x0}, ${y0})`}>
        <rect
          x={0}
          y={0}
          width={xWidth}
          height={yWidth}
          fill="rgba(0, 0, 0, 0.1)"
        />
        <text dx={5} dy={16} style={{fill: '#111'}}>
          initial range
        </text>
      </g>
    ) : null
  );
}
