import { scaleLinear } from 'd3-scale';
import { useEffect, useMemo, useRef, useState } from 'react';
import useResizeObserver from 'use-resize-observer';
import { useRev } from 'use-rev';

import { normalizeWheelDelta, usePanZoom } from '~';

import { Pointers } from './etc/Pointers';


export default {
  title: 'usePanZoom',
};


export function Story_PredominantGestures () {
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

  useEffect(() => {
    xScale.range([0, chartWidth]);
  }, [chartWidth, xScale]);
  useEffect(() => {
    yScale.range([chartHeight, 0]);
  }, [chartHeight, yScale]);

  const [, bumpRev] = useRev();
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
    <div>
      <p>
        Touch interactions may be detected as <b>single-axis gestures</b> (resizing horizontally only, or vertically only).
        This happens when the pointers have negligible offset in a certain axis. When that happens, the gesture becomes single-axis for the duration of the gesture.
      </p>
      <p>
        This is an important feature in a gesture library, because in cases like this where the pointers are very close together in a given axis, any change in that distance will cause a large and unexpected movement. So a gesture library should prevent that.
      </p>
      <p>
        Example: when the user is doing a vertical expand gesture, the pointers are vertically in line with each other, and they may have about 1px of horizontal distance between them. If that distance becomes 2px, that's a 200% increase in the horizontal direction. To move the chart 200% in the horizontal direction would be unexpected and jarring, especially since the user is just doing a vertical gesture!
      </p>
      <p>
        In the chart below, use two fingers to do a vertical zoom, and then do a horizontal zoom. Arrows will appear indicating whether it's a vertical or horizontal gesture, or both.
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
          {gesture.inProgress ? <>
            <Pointers
              pointers={gesture.pointerPositions}
              edge={gesture.currentGestureBBox}
            />
          </> : null}
          <circle
            cx={xScale(20)}
            cy={yScale(20)}
            r={25}
            fill='limegreen'
          />
          <circle
            cx={xScale(20)}
            cy={yScale(40)}
            r={25}
            fill='limegreen'
          />
          <circle
            cx={xScale(40)}
            cy={yScale(40)}
            r={25}
            fill='limegreen'
          />
          <circle
            cx={xScale(40)}
            cy={yScale(20)}
            r={25}
            fill='limegreen'
          />

          {gesture.inProgress && !gesture.singleAxis || gesture.singleAxis === 'x' ? (
            <g transform={`translate(150, 500)`}>
              <path d="M0 15L25 29.4338V0.566243L0 15ZM239 15L214 0.566243V29.4338L239 15ZM22.5 17.5H216.5V12.5H22.5V17.5Z" fill="black"/>
            </g>
          ) : undefined}

          {gesture.inProgress && !gesture.singleAxis || gesture.singleAxis === 'y' ? (
            <g transform={`translate(100, 250)`}>
              <path d="M14.5 0.5L0.066246 25.5L28.9338 25.5L14.5 0.5ZM14.5 239.5L28.9338 214.5L0.0662377 214.5L14.5 239.5ZM12 23L12 217L17 217L17 23L12 23Z" fill="black"/>
            </g>
          ) : undefined}

        </svg>
      </div>
    </div>
  );
}
Story_PredominantGestures.storyName = 'Predominant Gesture Detection'

