import { scalePow } from 'd3-scale';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Axis } from 'react-d3-axis-ts';
import { useRev } from 'use-rev';

import { normalizeWheelDelta } from '~/panZoom-utils';
import type { IBBox, IGesture, IScale } from '~/types';
import { usePanZoom } from '~/usePanZoom';


export default {
  title: 'PanZoom/Constraint',
};


const width = 1000;
const height = 600;


export function Story () {
  const xScale = useMemo(() => {
    const _xScale = scalePow();
    _xScale.exponent(2);
    _xScale.domain([0, 100]);
    _xScale.range([0, width]);
    return _xScale;
  }, []);

  const yScale = useMemo(() => {
    const _yScale = scalePow();
    _yScale.exponent(2);
    _yScale.domain([0, 100]);
    _yScale.range([height, 0]);
    return _yScale;
  }, []);

  const constraint = useMemo((): Partial<IBBox> => ({
    xMin: -100,
    xMax: 100,
    yMin: -100,
    yMax: 100,
  }), []);

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
    constraint,
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
          {gesture.constraint ? <>
            <Constraint
              xScale={xScale}
              yScale={yScale}
              domainBBbox={gesture.constraint}
              fill="transparent"
              stroke="rgba(255, 0, 0, 1)"
              strokeWidth={4}
            />
          </> : null}
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
          <InitialScales
            gesture={gesture}
            xScale={xScale}
            yScale={yScale}
          />
          {gesture.inProgress ? <>
            <BBox
              bbox={gesture.initialGestureBBox}
              fill="rgba(0, 0, 255, 0.2)"
              label="initial bbox"
            />
            <BBox
              bbox={gesture.currentGestureBBox}
              fill="rgba(255, 0, 0, 0.2)"
              label="current bbox"
            />
            <Pointers
              pointers={gesture.pointerPositions}
              edge={gesture.currentGestureBBox}
            />
          </> : null}
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
        </svg>
      </div>
    </div>
  );
}

function Constraint ({
  domainBBbox: {
    xMin: xDomainMin,
    xMax: xDomainMax,
    yMin: yDomainMin,
    yMax: yDomainMax,
  },
  xScale,
  yScale,
  fill,
  stroke = '#111',
  strokeWidth = 1,
}: {
  domainBBbox: Partial<IBBox>;
  xScale: IScale;
  yScale: IScale;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  const leftUnbounded   = xDomainMin === undefined || xDomainMin === -Infinity;
  const rightUnbounded  = xDomainMax === undefined || xDomainMax === +Infinity;
  const topUnbounded    = yDomainMin === undefined || yDomainMin === -Infinity;
  const bottomUnbounded = yDomainMax === undefined || yDomainMax === +Infinity;

  const width  = xScale.range()[0];
  const height = yScale.range()[0];

  const xMin = leftUnbounded   ? 0      : xScale(xDomainMin);
  const xMax = rightUnbounded  ? width  : xScale(xDomainMax);
  const yMin = topUnbounded    ? 0      : yScale(yDomainMin);
  const yMax = bottomUnbounded ? height : yScale(yDomainMax);
  const xWidth = Math.max(1, xMax - xMin);
  const yWidth = Math.max(1, yMax - yMin);

  return <>
    <g transform={`translate(${xMin}, ${yMin})`}>
      {/* fill */}
      <rect
        x={0}
        y={0}
        width={xWidth}
        height={yWidth}
        fill={fill}
        strokeWidth={0}
      />
      {/* label */}
      <text dx={5} dy={16} style={{fill: '#111'}}>
        constraint
      </text>
    </g>
    {/* top line */}
    {topUnbounded ? null : (
      <line
        stroke={stroke}
        strokeWidth={strokeWidth}
        x1={xMin}
        x2={xMax}
        y1={yMin}
        y2={yMin}
      />
    )}
    {/* bottom line */}
    {bottomUnbounded ? null : (
      <line
        stroke={stroke}
        strokeWidth={strokeWidth}
        x1={xMin}
        x2={xMax}
        y1={yMax}
        y2={yMax}
      />
    )}
    {/* right line */}
    {rightUnbounded ? null : (
      <line
        stroke={stroke}
        strokeWidth={strokeWidth}
        x1={xMax}
        x2={xMax}
        y1={yMin}
        y2={yMax}
      />
    )}
    {/* left line */}
    {leftUnbounded ? null : (
      <line
        stroke={stroke}
        strokeWidth={strokeWidth}
        x1={xMin}
        x2={xMin}
        y1={yMin}
        y2={yMax}
      />
    )}
  </>;
}



function InitialScales ({
  gesture: {
    inProgress,
    initialXScale,
    initialYScale,
  },
  xScale,
  yScale,
}: {
  gesture: IGesture;
  xScale: IScale;
  yScale: IScale;
}) {
  const xRange = initialXScale.domain().map((domainVal) => xScale(domainVal));
  const yRange = initialYScale.domain().map((domainVal) => yScale(domainVal));
  const [x0, x1] = xRange;
  const [y1, y0] = yRange;
  const xWidth = x1 - x0;
  const yWidth = y1 - y0;
  return (
    inProgress ? (
      <g transform={`translate(${x0}, ${y0})`}>
        <rect
          x={0}
          y={0}
          width={xWidth}
          height={yWidth}
          fill="rgba(0, 0, 0, 0.1)"
        />
        <text dx={5} dy={16} style={{fill: '#111'}}>
          initial range
        </text>
      </g>
    ) : null
  );
}

function BBox ({
  bbox: {
    xMin,
    xMax,
    yMin,
    yMax,
  },
  fill,
  label,
}: {
  bbox: IBBox;
  fill: string;
  label: string;
}) {
  const xWidth = Math.max(1, xMax - xMin);
  const yWidth = Math.max(1, yMax - yMin);
  return (
    <g transform={`translate(${xMin}, ${yMin})`}>
      <rect
        x={0}
        y={0}
        width={xWidth}
        height={yWidth}
        fill={fill}
        stroke="#111"
        strokeWidth={1}
      />
      <text dx={5} dy={16} style={{fill: '#111'}}>
        {label}
      </text>
    </g>
  );
}

function Pointers ({
  pointers,
  edge: {
    xMin,
    xMax,
    yMin,
    yMax,
  },
}: {
  pointers: Map<string | number, {x: number; y: number}>;
  edge: IBBox;
}) {
  const nodes: ReactNode[] = [];

  for (const [_pointerId, {x, y}] of pointers) {
    const pointerId = String(_pointerId);
    const isEdge = (
      x === xMin || x === xMax ||
      y === yMin || y === yMax
    );
    nodes.push(
      <g key={pointerId} transform={`translate(${x}, ${y})`}>
        <circle
          cx={0}
          cy={0}
          r={40}
          fill={isEdge ? 'rgba(255, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)'}
          stroke={isEdge ? '#111' : 'none'}
        />
        <text dx={45} dy={0} style={{fill: '#111'}}>
          pointerId: {pointerId}
        </text>
      </g>
    );
  }

  return <>
    {nodes}
  </>;
}
