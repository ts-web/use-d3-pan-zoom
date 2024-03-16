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


const height = 600;
let width = 1000;
const minWidth = 800;
const maxWidth = 1000;


export function Story () {
  const xPixelScale = useMemo(() => {
    const _xScale = scaleLinear();
    _xScale.domain([0, width]);
    _xScale.range([0, width]);
    return _xScale;
  }, []);

  const xScale = useMemo(() => {
    const _xScale = scalePow();
    _xScale.exponent(2);
    _xScale.domain([0, 100]);
    _xScale.range([0, width]);
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
          width = newWidth;
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
          width = newWidth;
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
    _yScale.range([height, 0]);
    return _yScale;
  }, []);

  const frozenYScale = useMemo(() => yScale.copy(), [yScale]);

  const [rev, bumpRev] = useRev();
  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheelZoom,
    gesture,
  } = usePanZoom({
    xScale,
    yScale: frozenYScale,
    onUpdate: () => {
      bumpRev();
    },
  });

  const handlePointermove = (e: PointerEvent) => {
    onPointerMove(e.pointerId, {
      x: e.clientX - viewRectRef.current!.x,
      y: e.clientY - viewRectRef.current!.y,
    });
  }

  const [viewEl, setViewEl] = useState<Element | null>();
  const viewRectRef = useRef<DOMRect>();
  const measure = () => {
    viewRectRef.current = viewEl!.getBoundingClientRect();
  }

  // preventDefault of certain events.
  // This can't be done in JSX callbacks because they can't specify `{passive: false}`.
  useEffect(() => {
    if (!viewEl) return;
    const preventDefault = (e: Event) => {
      e.preventDefault();
    };
    // 'touchstart' needs to be canceled or else the UA will sometimes hijack the touch for scrolling, page navigation ("swipe"), or full-page pixelated zooming.
    viewEl.addEventListener('touchstart', preventDefault, {passive: false});
    // 'wheel' needs to be canceled so that the page doesn't scroll.
    viewEl.addEventListener('wheel', preventDefault, {passive: false});
    return () => {
      viewEl.removeEventListener('touchstart', preventDefault);
      viewEl.removeEventListener('wheel', preventDefault);
    }
  }, [viewEl]);

  return (
    <div style={{
      width,
      height,
      border: '1px solid #666',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
      }}>
        <svg
          ref={setViewEl}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{
            overflow: 'hidden',
            userSelect: 'none',
          }}
          onPointerDown={(e) => {
            // ignore right-clicks and middle-clicks.
            if (e.button !== 0) return;
            measure();
            if (!gesture.inProgress) {
              document.addEventListener('pointermove', handlePointermove, {passive: false});
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            onPointerDown(e.pointerId, {
              x: e.clientX - viewRectRef.current!.x,
              y: e.clientY - viewRectRef.current!.y,
            });
          }}
          onPointerUp={(e) => {
            if (gesture.inProgress) {
              e.currentTarget.releasePointerCapture(e.pointerId);
              onPointerUp(e.pointerId);
            } else {
              document.removeEventListener('pointermove', handlePointermove);
            }
          }}
          onPointerLeave={(e) => {
            if (!gesture.inProgress) return;
            onPointerUp(e.pointerId);
          }}
          onPointerCancel={(e) => {
            if (!gesture.inProgress) return;
            onPointerUp(e.pointerId);
          }}
          onWheel={(e) => {
            // Ignore wheel events if a gesture is in progress, because they simply don't work and add visual jitter.
            if (gesture.inProgress) return;
            measure();
            onWheelZoom({
              center: {
                x: e.clientX - viewRectRef.current!.x,
                y: e.clientY - viewRectRef.current!.y,
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
            width={width}
            height={height}
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
          <g transform={`translate(0, ${height})`}>
            <Axis
              orient="top"
              scale={xPixelScale}
              tickArguments={[20]}
              color="#ccc"
              tickSizeInner={height - 20}
              tickSizeOuter={height - 20}
              scaleRev={rev}
            />
            <Axis
              orient="top"
              scale={xScale}
              tickArguments={[10]}
              color="#999"
              tickSizeInner={height - 40}
              tickSizeOuter={height - 40}
              scaleRev={rev}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
