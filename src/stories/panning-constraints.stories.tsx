import { scalePow } from 'd3-scale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Axis } from 'react-d3-axis-ts';
import useResizeObserver from 'use-resize-observer';
import { useRev } from 'use-rev';

import { normalizeWheelDelta, usePanZoom, type IBBox, type IScale } from '~';


export default {
  title: 'usePanZoom',
};


export function Story_PanningConstraints () {
  const [chartElement, setChartElement] = useState<Element | null>();
  const {ref, width: chartWidth = 100} = useResizeObserver<HTMLDivElement>();
  const chartHeight = chartWidth;

  // When the chartElement is resolved, prevent the default action of certain events:
  //   - touchstart — or else touch events on the chart will sometimes get intercepted by the browser for scrolling, page navigation ("swipe"), or full-page pixelated zooming.
  //   - wheel — so that zooming the chart doesn't cause page scrolling.
  //
  // Note: this can't be done inline because JSX syntax doesn't support passing `{passive: false}` when registering event listener callbacks.
  // See https://github.com/facebook/react/issues/6436
  useEffect(() => {
    if (!chartElement) return;
    const preventDefault = (e: Event) => {e.preventDefault();};
    chartElement.addEventListener('touchstart', preventDefault, {passive: false});
    chartElement.addEventListener('wheel', preventDefault, {passive: false});
    return () => {
      chartElement.removeEventListener('touchstart', preventDefault);
      chartElement.removeEventListener('wheel', preventDefault);
    }
  }, [chartElement]);

  // Track the chart's offset, to be used when we calculate a pointer's position relative to the chart.
  const chartOffset = useRef({x: 0, y: 0});
  const updateChartOffset = () => {
    if (!chartElement) return;
    const rect = chartElement.getBoundingClientRect();
    chartOffset.current = {
      x: rect.x,
      y: rect.y,
    };
  }

  // Example chart scales
  const xScale = useMemo(() => {
    const _xScale = scalePow();
    _xScale.exponent(2);
    _xScale.domain([0, 100]);
    _xScale.range([0, 100]);
    return _xScale;
  }, []);
  const yScale = useMemo(() => {
    const _yScale = scalePow();
    _yScale.exponent(2);
    _yScale.domain([0, 100]);
    _yScale.range([100, 0]);
    return _yScale;
  }, []);

  useEffect(() => {
    xScale.range([0, chartWidth]);
  }, [chartWidth, xScale]);
  useEffect(() => {
    yScale.range([chartHeight, 0]);
  }, [chartHeight, yScale]);

  // Constrain the chart to a certain range.
  const constrain = {
    xMin: -100,
    xMax: 100,
    yMin: -100,
    yMax: 100,
  };

  const [scaleRev, bumpRev] = useRev();
  const {
    onPointerDown,
    onPointerUp,
    onWheelZoom,
    gesture,
  } = usePanZoom({
    xScale,
    yScale,
    constrain,
    onUpdate: () => {
      bumpRev();
    },
    registerMoveListener: (onPointerMove) => {
      // Only listen to move events while an interaction is happening.
      // Listen on `document` so that a panning gesture can continue beyond the edge of the chart.
      const handlePointermove = (e: PointerEvent) => {
        onPointerMove(e.pointerId, {
          x: e.clientX - chartOffset.current.x,
          y: e.clientY - chartOffset.current.y,
        });
      };
      document.addEventListener('pointermove', handlePointermove, {passive: false});
      return () => {
        document.removeEventListener('pointermove', handlePointermove);
      };
    },
  });

  return <>
    <p>
      This chart uses the <kbd>constrain</kbd> option to define a fence (in domain values) that the user cannot pan or zoom out of. Zoom out to see the red border of the constraint bounds.
    </p>
    <div ref={ref} style={{
      border: '1px solid #ddd',
      lineHeight: 0,
      maxWidth: 800,
    }}>
      <svg
        ref={setChartElement}
        width={chartWidth}
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{
          overflow: 'hidden',
          userSelect: 'none',
        }}
        onPointerDown={(e) => {
          // Only listen to primary button events (no right-clicks, etc).
          if (e.button !== 0) return;
          // Take note of the chart's on-screen position when the gesture starts.
          updateChartOffset();
          // Capturing the pointer lets panning gestures avoid being interrupted when they stray outside the window bounds.
          e.currentTarget.setPointerCapture(e.pointerId);
          // Report a pointer down, passing coordinates relative to the chart.
          onPointerDown(e.pointerId, {
            x: e.clientX - chartOffset.current.x,
            y: e.clientY - chartOffset.current.y,
          });
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          onPointerUp(e.pointerId);
        }}
        onPointerLeave={(e) => {
          onPointerUp(e.pointerId);
        }}
        onPointerCancel={(e) => {
          onPointerUp(e.pointerId);
        }}
        onWheel={(e) => {
          // Take note of the chart's on-screen position.
          updateChartOffset();
          // Report a wheel zoom event, passing coordinates relative to the chart.
          onWheelZoom({
            center: {
              x: e.clientX - chartOffset.current.x,
              y: e.clientY - chartOffset.current.y,
            },
            zoomRatio: Math.pow(2, normalizeWheelDelta({
              delta: e.deltaY,
              deltaMode: e.deltaMode,
              multiplier: e.ctrlKey ? 10 : 1,
            })),
          });
        }}
      >
        <rect
          x={0}
          y={0}
          width={chartWidth}
          height={chartHeight}
          fill="whitesmoke"
        />
        {gesture.constraint ? <>
          <Constraint
            xScale={xScale}
            yScale={yScale}
            domainBBbox={gesture.constraint}
            fill="transparent"
            stroke="rgba(255, 0, 0, 1)"
            strokeWidth={4}
          />
        </> : null}
        <g transform={`translate(${chartWidth}, 0)`}>
          <Axis
            orient="left"
            scale={yScale}
            tickArguments={[10]}
            color="#f99"
            tickSizeInner={chartWidth - 40}
            tickSizeOuter={chartWidth - 40}
            scaleRev={scaleRev}
          />
        </g>
        <g transform={`translate(0, ${chartHeight})`}>
          <Axis
            orient="top"
            scale={xScale}
            tickArguments={[10]}
            color="#99f"
            tickSizeInner={chartHeight - 40}
            tickSizeOuter={chartHeight - 40}
            scaleRev={scaleRev}
          />
        </g>
        <circle fill="orange" r={20}
          cx={xScale(30)}
          cy={yScale(30)}
        />
        <circle fill="rgba(0, 0, 0, 0.25)" r={20}
          cx={xScale(50)}
          cy={yScale(50)}
        />
        <circle fill="crimson" r={20}
          cx={xScale(30)}
          cy={yScale(70)}
        />
        <circle fill="peachpuff" r={20}
          cx={xScale(70)}
          cy={yScale(30)}
        />
        <circle fill="springgreen" r={20}
          cx={xScale(70)}
          cy={yScale(70)}
        />
      </svg>
    </div>
  </>;
}
Story_PanningConstraints.storyName = 'Panning Constraints';

function Constraint ({
  domainBBbox: {
    xMin: xDomainMin,
    xMax: xDomainMax,
    yMin: yDomainMin,
    yMax: yDomainMax,
  },
  xScale,
  yScale,
  fill,
  stroke = '#111',
  strokeWidth = 1,
}: {
  domainBBbox: Partial<IBBox>;
  xScale: IScale;
  yScale: IScale;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  const leftUnbounded   = xDomainMin === undefined || xDomainMin === -Infinity;
  const rightUnbounded  = xDomainMax === undefined || xDomainMax === +Infinity;
  const topUnbounded    = yDomainMin === undefined || yDomainMin === -Infinity;
  const bottomUnbounded = yDomainMax === undefined || yDomainMax === +Infinity;

  const width  = xScale.range()[0];
  const height = yScale.range()[0];

  const xMin = leftUnbounded   ? 0      : xScale(xDomainMin);
  const xMax = rightUnbounded  ? width  : xScale(xDomainMax);
  const yMin = topUnbounded    ? 0      : yScale(yDomainMin);
  const yMax = bottomUnbounded ? height : yScale(yDomainMax);
  const xWidth = Math.max(1, xMax - xMin);
  const yWidth = Math.max(1, yMax - yMin);

  return <>
    <g transform={`translate(${xMin}, ${yMin})`}>
      {/* fill */}
      <rect
        x={0}
        y={0}
        width={xWidth}
        height={yWidth}
        fill={fill}
        strokeWidth={0}
      />
      {/* label */}
      <text dx={5} dy={16} style={{fill: '#111'}}>
        constraint
      </text>
    </g>
    {/* top line */}
    {topUnbounded ? null : (
      <line
        stroke={stroke}
        strokeWidth={strokeWidth}
        x1={xMin}
        x2={xMax}
        y1={yMin}
        y2={yMin}
      />
    )}
    {/* bottom line */}
    {bottomUnbounded ? null : (
      <line
        stroke={stroke}
        strokeWidth={strokeWidth}
        x1={xMin}
        x2={xMax}
        y1={yMax}
        y2={yMax}
      />
    )}
    {/* right line */}
    {rightUnbounded ? null : (
      <line
        stroke={stroke}
        strokeWidth={strokeWidth}
        x1={xMax}
        x2={xMax}
        y1={yMin}
        y2={yMax}
      />
    )}
    {/* left line */}
    {leftUnbounded ? null : (
      <line
        stroke={stroke}
        strokeWidth={strokeWidth}
        x1={xMin}
        x2={xMin}
        y1={yMin}
        y2={yMax}
      />
    )}
  </>;
}


