import { extent, max } from 'd3-array';
import { scaleLinear } from 'd3-scale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRev } from 'use-rev';

import { useTransform, usePanZoom, normalizeWheelDelta } from '~';

import { zoomSvgData } from './etc/not-random-data';


export default {
  title: 'D3 Examples',
};

// Specify the chart’s dimensions.
const width = 928;
const height = 500;

const data = zoomSvgData;
const dataExtent = extent(data, d => d[0]) as [number, number];
const dataMax = max(data, d => d[1])!;

export function ZoomSVG () {
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
    _xScale.domain(dataExtent);
    _xScale.range([0, width]);
    return _xScale;
  }, []);
  const xScaleRef = useRef(xScale); xScaleRef.current = xScale;

  const yScale = useMemo(() => {
    const _yScale = scaleLinear();
    _yScale.domain([0, dataMax]).nice();
    _yScale.range([height, 0]);
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
    preserveAspectRatio: true,
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

  const {x, y, kx, ky} = useTransform({
    initialXScale: initialXScale.current,
    initialYScale: initialYScale.current,
    xScale,
    yScale,
    scaleRev,
  });

  return (
    <div>
      <p>
        This is a reproduction of the d3 <a href="https://observablehq.com/@d3/zoom" target="_blank">Zoom (SVG)</a> example.
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
            <g transform={`translate(${x}, ${y}) scale(${kx}, ${ky})`}>
              {data.map((d, i) => (
                <circle
                  key={i}
                  cx={d[0]}
                  cy={d[1]}
                  r={1.5}
                />
              ))}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
ZoomSVG.storyName = 'Zoom (SVG)';
