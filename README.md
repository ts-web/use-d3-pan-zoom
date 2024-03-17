[![npm version](https://img.shields.io/npm/v/use-d3-pan-zoom.svg)](https://www.npmjs.com/package/use-d3-pan-zoom)
[![Downloads](https://img.shields.io/npm/dm/use-d3-pan-zoom.svg)](https://www.npmjs.com/package/use-d3-pan-zoom)

# use-d3-pan-zoom

A React hook replacement for `d3-zoom`.

`usePanZoom` attaches to a "chart" DOM element (e.g. a SVG element),
transforming user interactions (mouse, touch, wheel) to mutations to a given pair of X and Y d3 scales.
User gestures modify the domains of these scales.

### Features
- Supports multi-touch interactions (e.g. 2+ fingers).
- Unbounded interactions (a panning gesture can continue beyond the edge of the chart and even the window).
- Full d3 scale support. Properly handles both linear and non-linear scales (e.g. `scalePow`).
- Lock X or Y axis.
- Full UI customizability.

### Limitations
- No support yet for preserving the aspect ratio (PRs welcome).
- No support yet for the mobile "double tap to zoom" interaction or "long press to zoom out" (PRs welcome).
- Rotation gestures are not supported. This library is meant for 2D xy charts where rotation is not used.
- Not very good support for minExtent/maxExtent constraints, or customizing the constraint method (contain vs cover), or elasticity.


## Scales

In d3, each axis is represented by a scale, where the range represents the chart size in pixels, and
the domain represents the data being shown. Each are represented by two numbers:
- The domain is the start and the end of the currently visible extent of the data.
- The range is `[0, chartWidth]` for the x scale, or `[chartHeight, 0]` for the y scale.

Note: `usePanZoom` does not support scales that have non-numeric domains, i.e. scales without `invert` methods.

`usePanZoom` accepts the x and y scales either as actual d3 scales or a compatible callable object with `domain`, `range`, `invert`, and `copy` methods (See `IScale`).
`usePanZoom` will modify the scales' domains in-place, and will call `onUpdate` on each animation frame that the domain changed.


### The Y range is flipped
In a Y scale, the convention is to invert the `range`, making it `[chartHeight, 0]` instead of `[0, chartHeight]`.
The reason is that in the DOM, Y=0 is at the top, and Y gets larger as it goes downward.
However, the `domain` is not inverted; i.e. `[lowValue, highValue]`.
This is a d3 convention that paints the low values at the bottom of a chart, and high values at the top of the chart.

To summarize:
| DOM           | Chart           | Scale domain |
| ------------- | --------------- | ------------ |
| Y=0           | top of chart    | high values  |
| Y=chartHeight | bottom of chart | low values   |


## Gestures

One or more _pointers_ define a bbox in pixel space. When a new pointer is added (such as a second or third finger touching the screen), it ends the previous gesture and defines a new origin bbox.
- When pointers move, the bbox resizes. The origin bbox is compared to the current bbox, and the difference is applied to the domain.
- Along with the origin bbox, the origin domain is saved as well. When the gesture is in progress, the calculations are done using the origin domain, not the current domain. This avoids error, because otherwise, JS floating-point math inaccuracies would accumulate on each move, making the interaction feel sloppy.



## Usage
This is a "headless component" — a hook that gives you the tools to build your own UI component.

Here is a standard example:

```tsx
import { scalePow } from 'd3-scale';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePanZoom, normalizeWheelDelta } from 'use-d3-pan-zoom';

export function MyChart () {
  const chartWidth = 1000;
  const chartHeight = 600;
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

  // Create scales
  const sampleXDomainStart = 0;
  const sampleXDomainEnd = 100;
  const sampleYDomainStart = 0;
  const sampleYDomainEnd = 100;
  // the scale objects should be memoized and never change
  const xScale = useMemo(() => {
    return scalePow().exponent(2);
  }, []);
  const yScale = useMemo(() => {
    return scalePow().exponent(2);
  }, []);
  // update the scale domains if you want to programmatically set the chart extent.
  useEffect(() => {
    xScale.domain([sampleXDomainStart, sampleXDomainEnd]);
  }, [sampleXDomainStart, sampleXDomainEnd, xScale]);
  useEffect(() => {
    yScale.domain([sampleYDomainStart, sampleYDomainEnd]);
  }, [sampleYDomainStart, sampleYDomainEnd, yScale]);
  // update the scale ranges when the view size changes.
  useEffect(() => {
    xScale.range([0, chartWidth]);
  }, [chartWidth, xScale]);
  useEffect(() => {
    yScale.range([chartHeight, 0]);
  }, [chartHeight, yScale]);

  // Create a point to draw
  const pointDomainX = 30;
  const pointDomainY = 30;

  const {
    onPointerDown,
    onPointerUp,
    onWheelZoom,
  } = usePanZoom({
    xScale,
    yScale,
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

  return (
    <div style={{
      width: chartWidth,
      height: chartHeight,
      border: '1px solid #666',
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
        <circle fill="orange" r={20}
          cx={xScale(pointDomainX)}
          cy={yScale(pointDomainY)}
        />
      </svg>
    </div>
  );
}
```



