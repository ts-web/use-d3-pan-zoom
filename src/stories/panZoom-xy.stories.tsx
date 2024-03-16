import { scalePow } from 'd3-scale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Axis } from 'react-d3-axis-ts';
import { useRev } from 'use-rev';

import { normalizeWheelDelta } from '~/panZoom-utils';
import { usePanZoom } from '~/usePanZoom';


export default {
  title: 'PanZoom/X and Y Axis',
};


const width = 1000;
const height = 600;


export function Story () {
  const xScale = useMemo(() => {
    // const _xScale = scaleLinear();
    const _xScale = scalePow();
    _xScale.exponent(2);
    _xScale.domain([0, 100]);
    _xScale.range([0, width]);
    return _xScale;
  }, []);

  const yScale = useMemo(() => {
    // const _yScale = scaleLinear();
    const _yScale = scalePow();
    _yScale.exponent(2);
    _yScale.domain([0, 100]);
    _yScale.range([height, 0]);
    return _yScale;
  }, []);

  const [rev, bumpRev] = useRev();
  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheelZoom,
    gesture,
  } = usePanZoom({
    xScale,
    yScale,
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
          <g transform={`translate(${width}, 0)`}>
            <Axis
              orient="left"
              scale={yScale}
              tickArguments={[10]}
              color="#f99"
              tickSizeInner={width - 40}
              tickSizeOuter={width - 40}
              scaleRev={rev}
            />
          </g>
          <g transform={`translate(0, ${height})`}>
            <Axis
              orient="top"
              scale={xScale}
              tickArguments={[10]}
              color="#99f"
              tickSizeInner={height - 40}
              tickSizeOuter={height - 40}
              scaleRev={rev}
            />
          </g>
          <circle fill="orange" r={20}
            cx={xScale(30)}
            cy={yScale(30)}
          />
          <circle fill="lightgray" r={20}
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
