import { extent, max } from 'd3-array';
import { csvParse, autoType } from 'd3-dsv';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { curveStepAfter, area as d3Area } from 'd3-shape';
import uniqueId from 'lodash/uniqueId';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Axis } from 'react-d3-axis-ts';
import { useRev } from 'use-rev';

import { normalizeWheelDelta } from '~/panZoom-utils';
import { usePanZoom } from '~/usePanZoom';

import csv from './flights.csv';


interface IDatum {
  date: Date;
  value: number;
}
const data = csvParse(csv, autoType) as IDatum[];


export default {
  title: 'D3 Examples',
};

// Specify the chart’s dimensions.
const width = 928;
const height = 500;
const marginTop = 20;
const marginRight = 20;
const marginBottom = 30;
const marginLeft = 30;

export function ZoomableAreaChart () {
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
    const _xScale = scaleUtc();
    _xScale.domain(extent<IDatum, Date>(data, d => d.date) as [Date, Date]);
    _xScale.range([marginLeft, width - marginRight]);
    return _xScale;
  }, []);
  const xScaleRef = useRef(xScale); xScaleRef.current = xScale;

  const yScale = useMemo(() => {
    const _yScale = scaleLinear();
    _yScale.domain([0, max(data, d => d.value)!]).nice();
    _yScale.range([height - marginBottom, marginTop]);
    return _yScale;
  }, []);

  const [rev, bumpRev] = useRev();

  useEffect(() => {
    // I don't have a library to do the same animation. This is the end state.
    xScaleRef.current.domain([
      new Date('1998-04-02T00:00:00.000Z'),
      new Date('2003-07-02T11:59:59.999Z'),
    ]);
    bumpRev();
  }, [bumpRev]);

  const {
    onPointerDown,
    onPointerUp,
    onWheelZoom,
  } = usePanZoom({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    xScale: xScale as any,
    yScale,
    lockYAxis: true,
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

  const pathD = d3Area<IDatum>()
    .curve(curveStepAfter)
    .x(d => xScale(d.date))
    .y0(yScale(0))
    .y1(d => yScale(d.value))(data)!
  ;

  // Create a clip-path with a unique ID.
  const clipId = useMemo(() => uniqueId('clip'), []);

  return (
    <div>
      <p>
        This is a reproduction of the d3 <a href="https://observablehq.com/@d3/zoomable-area-chart" target="_blank">Zoomable area chart</a> example.
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
            <path
              clipPath={`url(#${clipId})`}
              fill='steelblue'
              d={pathD}
            />
            <g transform={`translate(${marginLeft}, 0)`}>
              <Axis
                orient="left"
                scale={yScale}
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- todo
                tickArguments={[null, 's'] as any}
                scaleRev={rev}
              />
            </g>
            <g transform={`translate(0, ${height - marginBottom})`}>
              <Axis
                orient="bottom"
                scale={xScale}
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any -- todo
                tickArguments={[width / 80] as any}
                tickSizeOuter={0}
                scaleRev={rev}
              />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
