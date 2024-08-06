import { scaleLinear } from 'd3-scale';
import { useEffect, useMemo, useRef, useState } from 'react';
import useResizeObserver from 'use-resize-observer';
import { useRev } from 'use-rev';

import { normalizeWheelDelta, usePanZoom, useTransform } from '~';

import { Pointers } from './etc/Pointers';
import imageFile from './etc/taylor-kopel-JNm1dAElVtE-unsplash-min.jpg';


export default {
  title: 'useTransform',
};



export function Story () {
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
    const _xScale = scaleLinear();
    _xScale.domain([0, 100]);
    _xScale.range([0, 100]);
    return _xScale;
  }, []);

  const yScale = useMemo(() => {
    const _yScale = scaleLinear();
    _yScale.domain([0, 100]);
    _yScale.range([100, 0]);
    return _yScale;
  }, []);

  const initialXScale = useRef(xScale.copy());
  const initialYScale = useRef(yScale.copy());

  useEffect(() => {
    xScale.range([0, chartWidth]);
  }, [chartWidth, xScale]);
  useEffect(() => {
    yScale.range([chartHeight, 0]);
  }, [chartHeight, yScale]);
  useEffect(() => {
    initialXScale.current.range([0, chartWidth]);
  }, [chartWidth]);
  useEffect(() => {
    initialYScale.current.range([chartHeight, 0]);
  }, [chartHeight]);

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

  return (
    <>
      <p>
        The <kbd>useTransform</kbd> hook allows you to transform a <kbd>g</kbd> group element with
        <kbd>transform()</kbd> and <kbd>scale()</kbd>.
        However, you must have a reference to the initial scales in order for a transformation to be calculated.
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

          <g transform={`translate(${tx}, ${ty}) scale(${kx}, ${ky})`}>
            <rect
              fill='antiquewhite'
              stroke='#000'
              strokeWidth={1.5}
              x={100}
              y={100}
              width={600}
              height={450}
            />
            <g transform='translate(220, 150) scale(0.5)'>
              <image
                href={imageFile}
                x={50}
                y={50}
              />
            </g>
            <circle
              cx={150}
              cy={180}
              r={6}
              fill='limegreen'
            />
            <circle
              cx={200}
              cy={450}
              r={12}
              fill='limegreen'
            />
            <circle
              cx={610}
              cy={200}
              r={24}
              fill='limegreen'
            />
            <circle
              cx={610}
              cy={450}
              r={64}
              fill='limegreen'
            />

            <text
              dx={580}
              dy={140}
            >
              inside the group
            </text>
          </g>


          <text
            dx={xScale(80)}
            dy={yScale(47)}
            textAnchor='middle'
          >
            outside the group
          </text>
          <circle
            cx={xScale(80)}
            cy={yScale(40)}
            r={24}
            fill='tomato'
          />

          <g transform={`translate(${xScale(85)}, ${yScale(43)}) scale(0.5)`}>
            <image
              href={imageFile}
              x={0}
              y={0}
            />
          </g>


          {gesture.inProgress ? <>
            <Pointers
              pointers={gesture.pointerPositions}
              edge={gesture.currentGestureBBox}
            />
          </> : null}
        </svg>
      </div>
    </>
  );
}
Story.storyName = 'Transforming grouped elements';

