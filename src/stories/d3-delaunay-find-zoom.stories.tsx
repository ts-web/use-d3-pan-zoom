import { Delaunay } from 'd3-delaunay';
import { scaleLinear } from 'd3-scale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRev } from 'use-rev';

import { normalizeWheelDelta, usePanZoom, useTransform } from '~';

import { randomNormalPoints2K } from './etc/not-random-data';


export default {
  title: 'D3 Examples',
};

// Specify the chart’s dimensions.
const width = 928;
const height = 500;

const data = randomNormalPoints2K;

const delaunay = Delaunay.from(data);


export function DelaunayFindZoom () {
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

  const yScale = useMemo(() => {
    const _yScale = scaleLinear();
    _yScale.domain([0, 1]);
    _yScale.range([height, 0]);
    return _yScale;
  }, []);

  const xScale = useMemo(() => {
    const _xScale = scaleLinear();
    // since the height is less than the width, base the width on the height and center the data within it.
    const widthAdj = (1 - (width / height)) / 2;
    _xScale.domain([0 + widthAdj, 1 - widthAdj]);
    _xScale.range([0, width]);
    return _xScale;
  }, []);
  const xScaleRef = useRef(xScale); xScaleRef.current = xScale;

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

  const {tx, ty, kx, ky} = useTransform({
    initialXScale: initialXScale.current,
    initialYScale: initialYScale.current,
    xScale,
    yScale,
    scaleRev,
  });

  const [hoveredPointIdx, setHoveredPointIdx] = useState(-1);

  return (
    <div>
      <p>
        This is a reproduction of the d3 <a href="https://observablehq.com/@d3/delaunay-find-zoom" target="_blank">delaunay.find & zoom</a> example.
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
              cursor: 'crosshair',
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
            onPointerMove={(e) => {
              updateChartOffset();
              const dataX = xScale.invert(e.clientX - chartOffset.current.x);
              const dataY = yScale.invert(e.clientY - chartOffset.current.y);
              const i = delaunay.find(
                dataX,
                dataY,
              );
              setHoveredPointIdx(i);
            }}
          >
            <g transform={`translate(${tx}, ${ty}) scale(${kx}, ${ky})`}>
              {data.map((d, i) => (
                <circle
                  key={i}
                  cx={initialXScale.current(d[0])}
                  cy={initialYScale.current(d[1])}
                  r={1.5}
                />
              ))}
              {/* The hovered point, above the rest */}
              {hoveredPointIdx !== -1 ? (
                <circle
                  cx={initialXScale.current(data[hoveredPointIdx][0])}
                  cy={initialYScale.current(data[hoveredPointIdx][1])}
                  r={1.5}
                  style={{
                    stroke: 'orangered',
                    fill: 'orangered',
                  }}
                />
              ) : undefined}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
DelaunayFindZoom.storyName = 'delaunay.find & zoom';
