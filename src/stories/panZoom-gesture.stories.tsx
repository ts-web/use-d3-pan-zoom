import { scalePow } from 'd3-scale';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Axis } from 'react-d3-axis-ts';
import { useRev } from 'use-rev';

import { normalizeWheelDelta } from '~/panZoom-utils';
import type { IBBox, IGesture, IScale } from '~/types';
import { usePanZoom } from '~/usePanZoom';


export default {
  title: 'Show Gesture',
};


const chartWidth = 1000;
const chartHeight = 600;


export function Story () {
  const [chartElement, setChartElement] = useState<Element | null>();

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

  const xScale = useMemo(() => {
    const _xScale = scalePow();
    _xScale.exponent(2);
    _xScale.domain([0, 100]);
    _xScale.range([0, chartWidth]);
    return _xScale;
  }, []);

  const yScale = useMemo(() => {
    const _yScale = scalePow();
    _yScale.exponent(2);
    _yScale.domain([0, 100]);
    _yScale.range([chartHeight, 0]);
    return _yScale;
  }, []);

  const [rev, bumpRev] = useRev();
  const {
    onPointerDown,
    onPointerUp,
    onWheelZoom,
    gesture,
  } = usePanZoom({
    xScale,
    yScale,
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

  // preventDefault of certain events.
  // This can't be done in JSX callbacks because they can't specify `{passive: false}`.
  useEffect(() => {
    if (!chartElement) return;
    const preventDefault = (e: Event) => {
      e.preventDefault();
    };
    // 'touchstart' needs to be canceled or else the UA will sometimes hijack the touch for scrolling, page navigation ("swipe"), or full-page pixelated zooming.
    chartElement.addEventListener('touchstart', preventDefault, {passive: false});
    // 'wheel' needs to be canceled so that the page doesn't scroll.
    chartElement.addEventListener('wheel', preventDefault, {passive: false});
    return () => {
      chartElement.removeEventListener('touchstart', preventDefault);
      chartElement.removeEventListener('wheel', preventDefault);
    }
  }, [chartElement]);

  return (
    <div style={{
      width: chartWidth,
      height: chartHeight,
      border: '1px solid #666',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
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
          <g transform={`translate(${chartWidth}, 0)`}>
            <Axis
              orient="left"
              scale={yScale}
              tickArguments={[10]}
              color="#f99"
              tickSizeInner={chartWidth - 40}
              tickSizeOuter={chartWidth - 40}
              scaleRev={rev}
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
              scaleRev={rev}
            />
          </g>
          <InitialScales
            gesture={gesture}
            xScale={xScale}
            yScale={yScale}
          />
          {gesture.inProgress ? <>
            <BBox
              bbox={gesture.initialGestureBBox}
              fill="rgba(0, 0, 255, 0.2)"
              label="initial bbox"
            />
            <BBox
              bbox={gesture.currentGestureBBox}
              fill="rgba(255, 0, 0, 0.2)"
              label="current bbox"
            />
            <Pointers
              pointers={gesture.pointerPositions}
              edge={gesture.currentGestureBBox}
            />
          </> : null}
          {gesture.inProgress ? (
            <g transform={`translate(20, 40)`}>
              <rect
                x={0}
                y={0}
                width={100}
                height={40}
                fill="tomato"
              />
              <text dx={5} dy={16} style={{fill: 'white'}}>
                gesture active
              </text>
              <text dx={5} dy={32} style={{fill: 'white'}}>
                {gesture.singleAxis ?? 'both axes'}
              </text>
            </g>
          ) : null}
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
    </div>
  );
}


function InitialScales ({
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

function BBox ({
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

function Pointers ({
  pointers,
  edge: {
    xMin,
    xMax,
    yMin,
    yMax,
  },
}: {
  pointers: Map<string | number, {x: number; y: number}>;
  edge: IBBox;
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
        <text dx={45} dy={0} style={{fill: '#111'}}>
          pointerId: {pointerId}
        </text>
      </g>
    );
  }

  return <>
    {nodes}
  </>;
}
