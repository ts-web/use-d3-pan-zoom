import { Delaunay } from 'd3-delaunay';
import { scaleLinear } from 'd3-scale';
import uniqueId from 'lodash/uniqueId';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Axis } from 'react-d3-axis-ts';
import useResizeObserver from 'use-resize-observer';
import { useRev } from 'use-rev';

import { normalizeWheelDelta, usePanZoom, useTransform } from '~';

import { orangeColors100, randomPoints100 } from './etc/not-random-data';

const data = randomPoints100;


export default {
  title: 'D3 Examples',
};

// Specify the chart’s dimensions.
const marginTop = 0;
const marginRight = 0;
const marginBottom = 20;
const marginLeft = 30;

export function VoronoiChart () {
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
      x: rect.x + marginLeft,
      y: rect.y,
    };
  }

  const yScale = useMemo(() => {
    const _yScale = scaleLinear();
    _yScale.domain([0, 1]);
    _yScale.range([100 - marginBottom, marginTop]);
    return _yScale;
  }, []);

  const xScale = useMemo(() => {
    const _xScale = scaleLinear();
    _xScale.domain([0, 1]);
    _xScale.range([marginLeft, 100 - marginRight]);
    return _xScale;
  }, []);
  const xScaleRef = useRef(xScale); xScaleRef.current = xScale;

  const initialXScale = useRef(xScale.copy());
  const initialYScale = useRef(yScale.copy());

  useEffect(() => {
    xScale.range([marginLeft, chartWidth - marginRight]);
  }, [chartWidth, xScale]);
  useEffect(() => {
    yScale.range([chartHeight - marginBottom, marginTop]);
  }, [chartHeight, yScale]);
  useEffect(() => {
    initialXScale.current.range([marginLeft, chartWidth - marginRight]);
  }, [chartWidth]);
  useEffect(() => {
    initialYScale.current.range([chartHeight - marginBottom, marginTop]);
  }, [chartHeight]);

  const [scaleRev, bumpRev] = useRev();

  const {
    onPointerDown,
    onPointerUp,
    onWheelZoom,
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

  // Create a clip-path with a unique ID.
  const clipId = useMemo(() => uniqueId('clip'), []);
  const xAxisClipId = useMemo(() => uniqueId('xAxisClip'), []);

  const {tx, ty, kx, ky} = useTransform({
    initialXScale: initialXScale.current,
    initialYScale: initialYScale.current,
    xScale,
    yScale,
    scaleRev,
  });

  const scaledPositions = data.map((d) => ([
    xScale(d[0]),
    yScale(d[1]),
  ] as [number, number]))

  const voronoiD = Delaunay
    .from(scaledPositions)
    .voronoi([marginLeft, 0, chartWidth, chartHeight - marginBottom])
    .render()
  ;

  return (
    <div>
      <p>
        This is a reproduction of the d3 <a href='https://observablehq.com/@d3/x-y-zoom' target='_blank'>X/Y Zoom</a> example.
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
          <clipPath id={clipId}>
            <rect
              x={marginLeft}
              y={marginTop}
              width={chartWidth - marginLeft - marginRight}
              height={chartHeight - marginTop - marginBottom}
            />
          </clipPath>
          <clipPath id={xAxisClipId}>
            <rect
              x={marginLeft}
              y={chartHeight - marginBottom}
              width={chartWidth - marginLeft - marginRight}
              height={marginBottom}
            />
          </clipPath>
          <g transform={`translate(${marginLeft}, 0)`}>
            <Axis
              orient='left'
              scale={yScale}
              scaleRev={scaleRev}
              tickArguments={[12 * (chartHeight / chartWidth)]}
            />
          </g>
          <g clipPath={`url(#${xAxisClipId})`}>
            <g transform={`translate(0, ${chartHeight - marginBottom})`}>
              <Axis
                orient='bottom'
                scale={xScale}
                scaleRev={scaleRev}
                tickArguments={[12]}
              />
            </g>
          </g>
          <g clipPath={`url(#${clipId})`}>
            <path
              d={voronoiD}
              fill='none'
              stroke='#ccc'
              strokeWidth={0.5}
            />
            <g transform={`translate(${tx}, ${ty}) scale(${kx}, ${ky})`}>
              {data.map((d, i) => (
                <ellipse key={i}
                  fill={orangeColors100[i]}
                  cx={initialXScale.current(d[0])}
                  cy={initialYScale.current(d[1])}
                  rx={6 * (1 / Math.sqrt(Math.max(kx, ky)))}
                  ry={6 * (1 / Math.sqrt(Math.max(kx, ky)))}
                />
              ))}
            </g>
          </g>
        </svg>
      </div>
      <p>
        This uses <kbd>d3-delaunay</kbd> to generate voronoi lines on-the-fly. This is especially visible when using a multi-finger gesture to distort the chart.
      </p>
    </div>
  );
}
VoronoiChart.storyName = 'X/Y Zoom (Voronoi)';
