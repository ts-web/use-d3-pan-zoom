import { max, sort } from 'd3-array';
import { autoType, csvParse } from 'd3-dsv';
import { scaleBand, scaleLinear } from 'd3-scale';
import uniqueId from 'lodash/uniqueId';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Axis } from 'react-d3-axis-ts';
import { useRev } from 'use-rev';

import { normalizeWheelDelta, usePanZoom } from '~';

import csv from './etc/alphabet.csv';


interface IDatum {
  letter: string;
  frequency: number;
}
const data = csvParse(csv, autoType) as IDatum[];
const dataSorted = sort(data, d => -d.frequency);
const dataMax = max(dataSorted, d => d.frequency)!;
const dataExtent = dataSorted.map(d => d.letter);


export default {
  title: 'D3 Examples',
};

// Specify the chart’s dimensions.
const width = 928;
const height = 500;
const marginTop = 20;
const marginRight = 10;
const marginBottom = 30;
const marginLeft = 40;

export function ZoomableBarChart () {
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

  const xBandScale = useMemo(() => {
    const _xScale = scaleBand();
    _xScale.domain(dataExtent);
    _xScale.range([0, 1]);
    _xScale.padding(0.1);
    return _xScale;
  }, []);

  const xScale = useMemo(() => {
    const _xScale = scaleLinear();
    _xScale.domain([0, 1]);
    _xScale.range([0, width]);
    return _xScale;
  }, []);
  const xScaleRef = useRef(xScale); xScaleRef.current = xScale;

  const xBandScaleForAxis = useMemo(() => {
    const _xScale = scaleBand();
    _xScale.domain(dataExtent);
    _xScale.range([marginLeft, width - marginRight]);
    _xScale.padding(0.1);
    return _xScale;
  }, []);
  // sync the x axis scale
  xBandScaleForAxis.range([
    xScale(0),
    xScale(1),
  ]);

  const yScale = useMemo(() => {
    const _yScale = scaleLinear();
    _yScale.domain([0, dataMax]).nice();
    _yScale.range([height - marginBottom, marginTop]);
    return _yScale;
  }, []);

  const [scaleRev, bumpRev] = useRev();

  const {
    onPointerDown,
    onPointerUp,
    onWheelZoom,
  } = usePanZoom({
    xScale,
    yScale,
    constrain: {
      xMin: 0,
      xMax: 1,
      yMin: -Infinity,
      yMax: Infinity,
    },
    minZoom: {xSpan: 0.2},
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

  // Create a clip-path with a unique ID.
  const clipId = useMemo(() => uniqueId('clip'), []);
  const xAxisClipId = useMemo(() => uniqueId('xAxisClip'), []);

  return (
    <div>
      <p>
        This is a reproduction of the d3 <a href='https://observablehq.com/@d3/zoomable-bar-chart' target='_blank'>Zoomable bar chart</a> example.
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
              />
            </g>
            <g clipPath={`url(#${xAxisClipId})`}>
              <g transform={`translate(0, ${height - marginBottom})`}>
                <Axis
                  orient='bottom'
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                  scale={xBandScaleForAxis as any}
                  tickSizeOuter={0}
                  scaleRev={scaleRev}
                />
              </g>
            </g>
            <g clipPath={`url(#${clipId})`}>
              {data.map((d, i) => {
                const bandX = xBandScale(d.letter);
                if (bandX === undefined) return null;
                const x1 = xScale(bandX);
                const x2 = xScale(bandX + xBandScale.bandwidth());
                return (
                  <rect key={i}
                    fill='steelblue'
                    x={x1}
                    y={yScale(d.frequency)}
                    height={yScale(0) - yScale(d.frequency)}
                    width={x2 - x1}
                  />
                );
              })}
            </g>
          </svg>
        </div>
      </div>
      <p>
        This chart uses <kbd>scaleBand</kbd> which is an ordinal scale. Ordinal scales can't directly be used with <kbd>usePanZoom</kbd> because they don't have the <kbd>.invert()</kbd> method. This uncovers a fundamental difference between <kbd>usePanZoom</kbd> and <kbd>d3-pan-zoom</kbd>. Whereas <kbd>d3-pan-zoom</kbd> animates a scale's <i>range</i>, <kbd>usePanZoom</kbd> animates a scale's <i>domain</i>.
      </p>
      <p>
        In order to use a band scale with <kbd>usePanZoom</kbd>, this story uses a linear X scale for the chart, with a domain of 0 to 1. Then separately, the band scale is created with a range of 0 to 1. This separate scale is used when positioning elements, by doing <kbd>const xPixel = xScale(xBandScale(bandValue))</kbd>.
      </p>
      <p>
        For the X axis marks, this needs yet another scale, because it expects a scale with a range that has been scaled.
        This chart uses the <kbd>Axis</kbd> from the <a href='https://www.npmjs.com/package/react-d3-axis-ts' target='_blank'>react-d3-axis-ts</a> package, and passes it a second band scale (<kbd>xBandScaleForAxis</kbd>)
        which must be synchronized with the main x scale like this: <kbd>xBandScaleForAxis.range([xScale(0), xScale(1)])</kbd>.
      </p>
    </div>
  );
}
