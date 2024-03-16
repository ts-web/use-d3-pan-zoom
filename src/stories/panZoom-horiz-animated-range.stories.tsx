import { scaleLinear, scalePow } from 'd3-scale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Axis } from 'react-d3-axis-ts';
import { easeOutQuad } from 'tween-functions-ts';
import { useRev } from 'use-rev';

import { normalizeWheelDelta } from '~/panZoom-utils';
import { usePanZoom } from '~/usePanZoom';


export default {
  title: 'PanZoom/X Axis animated range',
};


const chartHeight = 600;
let chartWidth = 1000;
const minWidth = 800;
const maxWidth = 1000;


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

  const xPixelScale = useMemo(() => {
    const _xScale = scaleLinear();
    _xScale.domain([0, chartWidth]);
    _xScale.range([0, chartWidth]);
    return _xScale;
  }, []);

  const xScale = useMemo(() => {
    const _xScale = scalePow();
    _xScale.exponent(2);
    _xScale.domain([0, 100]);
    _xScale.range([0, chartWidth]);
    return _xScale;
  }, []);

  const [, rerender] = useRev();

  useEffect(() => {
    let step = 1;
    let tAni: number;
    const doStep = () => {
      cancelAnimationFrame(tAni);
      if (step === 1) {
        // Grow
        const start = Date.now();
        const ani = () => {
          const newWidth = easeOutQuad(
            Date.now() - start,
            minWidth,
            maxWidth,
            3000,
          );
          chartWidth = newWidth;
          xScale.range([0, newWidth]);
          rerender();
          tAni = requestAnimationFrame(ani);
        };
        tAni = requestAnimationFrame(ani);
        step = 2;
      } else if (step === 2) {
        // Do nothing
        step = 3;
      } else if (step === 3) {
        // Shrink
        const start = Date.now();
        const ani = () => {
          const newWidth = easeOutQuad(
            Date.now() - start,
            maxWidth,
            minWidth,
            3000,
          );
          chartWidth = newWidth;
          xScale.range([0, newWidth]);
          rerender();
          tAni = requestAnimationFrame(ani);
        };
        tAni = requestAnimationFrame(ani);
        step = 4;
      } else if (step === 4) {
        // Do nothing
        step = 1;
      }
    };
    doStep();
    const tStep = setInterval(doStep, 3000);
    return () => {
      cancelAnimationFrame(tAni);
      clearTimeout(tStep);
    }
  }, [xScale, rerender]);

  const yScale = useMemo(() => {
    const _yScale = scaleLinear();
    _yScale.domain([0, 10]);
    _yScale.range([chartHeight, 0]);
    return _yScale;
  }, []);

  const frozenYScale = useMemo(() => yScale.copy(), [yScale]);

  const [rev, bumpRev] = useRev();
  const {
    onPointerDown,
    onPointerUp,
    onWheelZoom,
  } = usePanZoom({
    xScale,
    yScale: frozenYScale,
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
          <circle fill="cadetblue" r={20}
            cx={xScale(40)}
            cy={yScale(5)}
          />
          <circle fill="springgreen" r={20}
            cx={xScale(60)}
            cy={yScale(5)}
          />
          <g transform={`translate(0, ${chartHeight})`}>
            <Axis
              orient="top"
              scale={xPixelScale}
              tickArguments={[20]}
              color="#ccc"
              tickSizeInner={chartHeight - 20}
              tickSizeOuter={chartHeight - 20}
              scaleRev={rev}
            />
            <Axis
              orient="top"
              scale={xScale}
              tickArguments={[10]}
              color="#999"
              tickSizeInner={chartHeight - 40}
              tickSizeOuter={chartHeight - 40}
              scaleRev={rev}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
