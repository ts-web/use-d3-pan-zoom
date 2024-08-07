import { scalePow } from 'd3-scale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Axis } from 'react-d3-axis-ts';
import useResizeObserver from 'use-resize-observer';
import { useRev } from 'use-rev';

import { normalizeWheelDelta, usePanZoom, type IScale } from '~';



export default {
  title: 'usePanZoom',
};


export function Story_ZoomConstraints () {
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

  const [scaleRev, bumpRev] = useRev();
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
    minZoom: {
      xSpan: 10,
      ySpan: 5,
    },
    maxZoom: {
      xSpan: 200,
      ySpan: 300,
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

  return <>
    <p>
      This shows the <kbd>minZoom</kbd> and <kbd>maxZoom</kbd> options which specify how "close" or "far" a user can zoom in the chart, in terms of domain values. For example, <kbd>minZoom.xSpan = 10</kbd> will not let the chart zoom in to less than a span of 10 domain values visible in the X axis. This differs from the <kbd>constraint</kbd> because it only limits zooming, not panning.
    </p>
    <p>
      This uses a non-linear chart using an exponential <kbd>scalePow</kbd> scale, so the pixel size of a min/max zoom span will change as you pan. Notice the centered gray "Min Zoom" rectangle changing size as you move along the scale.
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
        {gesture.inProgress ? (
          <g transform={`translate(20, 40)`}>
            <rect
              x={0}
              y={0}
              width={100}
              height={24}
              fill="tomato"
            />
            <text dx={5} dy={16} style={{fill: 'white'}}>
              gesture active
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
        {gesture.minZoom?.xSpan && gesture.minZoom.ySpan ? (
          <ZoomConstraint
            domainX={xScale.invert(chartWidth / 2)}
            domainY={yScale.invert(chartHeight / 2)}
            domainXSpan={gesture.minZoom.xSpan}
            domainYSpan={gesture.minZoom.ySpan}
            xScale={xScale}
            yScale={yScale}
            fill={'#44555530'}
            stroke={'#666'}
            label='Min Zoom'
          />
        ) : null}
        {/* Current zoom span (domain) */}
        <g transform={`translate(20, 40)`}>
          <rect
            x={0}
            y={0}
            width={220}
            height={50}
            fill="white"
            stroke="#666"
            strokeWidth={2}
            rx={2}
            ry={2}
          />
          <text dx={5} dy={20} style={{fill: '#333'}}>
            zoom span X: {Math.floor(getWidth(...xScale.domain()))} (max: {gesture.maxZoom!.xSpan})
          </text>
          <text dx={5} dy={40} style={{fill: '#333'}}>
            zoom span Y: {Math.floor(getWidth(...yScale.domain()))} (max: {gesture.maxZoom!.ySpan})
          </text>
        </g>
      </svg>
    </div>
  </>;
}
Story_ZoomConstraints.storyName = 'Zoom Constraints';

function ZoomConstraint ({
  domainX,
  domainY,
  domainXSpan,
  domainYSpan,
  xScale,
  yScale,
  r = 2,
  fill = 'transparent',
  stroke = '#333',
  strokeWidth = 2,
  label = '',
}: {
  domainX: number;
  domainY: number;
  domainXSpan: number;
  domainYSpan: number;
  xScale: IScale;
  yScale: IScale;
  r?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  label?: string;
}) {
  const domainXSpanHalf = domainXSpan / 2;
  const domainYSpanHalf = domainYSpan / 2;
  const domainX0 = domainX - domainXSpanHalf;
  const domainX1 = domainX + domainXSpanHalf;
  const domainY0 = domainY - domainYSpanHalf;
  const domainY1 = domainY + domainYSpanHalf;
  const rangeX0 = xScale(domainX0);
  const rangeX1 = xScale(domainX1);
  const rangeY1 = yScale(domainY0);
  const rangeY0 = yScale(domainY1);
  const rangeWidth = rangeX1 - rangeX0;
  const rangeHeight = rangeY1 - rangeY0;
  return <>
    <g transform={`translate(${rangeX0}, ${rangeY0})`}>
      <rect
        x={0}
        y={0}
        width={rangeWidth}
        height={rangeHeight}
        rx={r}
        ry={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      {/* label */}
      <text dx={4} dy={16} style={{fill: '#111'}}>
        {label}
      </text>
    </g>
  </>;
}


function getWidth (...ns: number[]): number {
  return Math.abs(Math.min(...ns) - Math.max(...ns));
}
