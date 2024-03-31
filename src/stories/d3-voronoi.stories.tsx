import { extent } from 'd3-array';
import { Delaunay } from 'd3-delaunay';
import { scaleLinear } from 'd3-scale';
import uniqueId from 'lodash/uniqueId';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Axis } from 'react-d3-axis-ts';
import { useRev } from 'use-rev';

import { normalizeWheelDelta, usePanZoom, useTransform } from '~';

import { voronoiData as data } from './etc/not-random-data';


const dataXExtent = extent(data, (d) => d[0]) as [number, number];
const dataYExtent = extent(data, (d) => d[1]) as [number, number];



export default {
  title: 'D3 Examples',
};

// Specify the chart’s dimensions.
const width = 928;
const height = 500;
const marginTop = 0;
const marginRight = 10;
const marginBottom = 20;
const marginLeft = 30;

export function VoronoiChart () {
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
    const _xScale = scaleLinear();
    _xScale.domain(dataXExtent);
    _xScale.range([marginLeft, width - marginRight]);
    return _xScale;
  }, []);
  const xScaleRef = useRef(xScale); xScaleRef.current = xScale;

  const yScale = useMemo(() => {
    const _yScale = scaleLinear();
    _yScale.domain(dataYExtent);
    _yScale.range([height - marginBottom, marginTop]);
    return _yScale;
  }, []);

  const initialXScale = useRef(xScale.copy());
  const initialYScale = useRef(yScale.copy());

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

  const {kx, ky} = useTransform({
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
    .voronoi([35, 0, width, height - 25])
    .render()
  ;


  return (
    <div>
      <p>
        This is a reproduction of the d3 <a href='https://observablehq.com/@d3/x-y-zoom' target='_blank'>X/Y Zoom</a> example.
      </p>
      <div style={{
        width: width,
        height: height,
        border: '1px solid #666',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
        }}>
          <svg
            ref={setChartElement}
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
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
                width={width - marginLeft - marginRight}
                height={height - marginTop - marginBottom}
              />
            </clipPath>
            <clipPath id={xAxisClipId}>
              <rect
                x={marginLeft}
                y={height - marginBottom}
                width={width - marginLeft - marginRight}
                height={marginBottom}
              />
            </clipPath>
            <g transform={`translate(${marginLeft}, 0)`}>
              <Axis
                orient='left'
                scale={yScale}
                scaleRev={scaleRev}
                tickArguments={[12 * (height / width)]}
              />
            </g>
            <g clipPath={`url(#${xAxisClipId})`}>
              <g transform={`translate(0, ${height - marginBottom})`}>
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
              {data.map((d, i) => (
                  <ellipse key={i}
                    fill={d[2]}
                    cx={scaledPositions[i][0]}
                    cy={scaledPositions[i][1]}
                    rx={6 * Math.sqrt(Math.max(kx, ky))}
                    ry={6 * Math.sqrt(Math.max(kx, ky))}
                  />
                ))}
            </g>
          </svg>
        </div>
      </div>
      <p>
        This uses <kbd>d3-delaunay</kbd> to generate voronoi lines on-the-fly. This is especially visible when using a multi-finger gesture to distort the chart.
      </p>
    </div>
  );
}
VoronoiChart.storyName = 'X/Y Zoom (Voronoi)';
