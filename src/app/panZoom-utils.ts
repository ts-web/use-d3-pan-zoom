import type { IBBox, IGesture, IScale } from './types';

/**
 * Set the domains of the given `xScale` and `yScale`
 * based on how the bbox has changed
 * (the difference between the initial and current bboxes).
 */
export function updateScales({
  xScale,
  yScale,
  initialXScale,
  initialYScale,
  initialGestureBBox,
  currentGestureBBox,
  constraint,
  lockXAxis,
  lockYAxis,
  preserveAspectRatio,
  minZoom: {
    xSpan: minXSpan,
    ySpan: minYSpan,
  } = {},
  maxZoom: {
    xSpan: maxXSpan,
    ySpan: maxYSpan,
  } = {},
  singleAxis,
}: {
  xScale: IScale;
  yScale: IScale;
  initialXScale: IScale;
  initialYScale: IScale;
  initialGestureBBox: IBBox;
  currentGestureBBox: IBBox;
  constraint: Partial<IBBox> | undefined;
  lockXAxis: boolean;
  lockYAxis: boolean;
  preserveAspectRatio: boolean | undefined;
  minZoom: {xSpan?: number; ySpan?: number} | undefined;
  maxZoom: {xSpan?: number; ySpan?: number} | undefined;
  singleAxis: IGesture['singleAxis'];
}): void {
  const squareInitialGestureBbox = preserveAspectRatio ? squareify(initialGestureBBox) : initialGestureBBox;
  const squareCurrentGestureBBox = preserveAspectRatio ? squareify(currentGestureBBox) : currentGestureBBox;

  const {xk, xt, yk, yt} = calcKTs(squareInitialGestureBbox, squareCurrentGestureBBox);

  const rangeOfNewXDomain = applyKTInverse(xScale.range(), xk, xt);
  const rangeOfNewYDomain = applyKTInverse(yScale.range(), yk, yt);

  const newXDomain = rangeOfNewXDomain.map((xRangeVal) => initialXScale.invert(xRangeVal)) as [number, number];
  const newYDomain = rangeOfNewYDomain.map((yRangeVal) => initialYScale.invert(yRangeVal)) as [number, number];

  const newXDomainClamped = increaseToSpan(minXSpan, decreaseToSpan(maxXSpan, newXDomain));
  const newYDomainClamped = increaseToSpan(minYSpan, decreaseToSpan(maxYSpan, newYDomain));

  constrain({
    xDomain: newXDomainClamped,
    yDomain: newYDomainClamped,
    constraint,
    xScale,
    yScale,
  });

  if (lockXAxis && lockYAxis) return;

  // Update the x scale.
  // The X scale should be update if the predominant gesture axis is X, or if there is no predominant gesture axis.
  if (!lockXAxis && (!singleAxis || singleAxis === 'x')) {
    xScale.domain(newXDomainClamped);
  }
  if (!lockYAxis && (!singleAxis || singleAxis === 'y')) {
    yScale.domain(newYDomainClamped);
  }
}

export function zoom ({
  xScale,
  yScale,
  center,
  zoomRatio,
  constraint,
  lockXAxis,
  lockYAxis,
  minZoom: {
    xSpan: minXSpan,
    ySpan: minYSpan,
  } = {},
  maxZoom: {
    xSpan: maxXSpan,
    ySpan: maxYSpan,
  } = {},
}: {
  xScale: IScale;
  yScale: IScale;
  center: {x: number; y: number};
  zoomRatio: number;
  constraint: Parameters<typeof constrain>[0]['constraint'];
  lockXAxis: boolean;
  lockYAxis: boolean;
  minZoom: {xSpan?: number; ySpan?: number} | undefined;
  maxZoom: {xSpan?: number; ySpan?: number} | undefined;
}) {
  if (zoomRatio === 1) return;

  const [xRangeStart, xRangeEnd] = xScale.range();
  const [yRangeEnd, yRangeStart] = yScale.range();
  const rangeXSpan = xRangeEnd - xRangeStart;
  const rangeYSpan = yRangeEnd - yRangeStart;

  const xReduce = (1 - zoomRatio) * rangeXSpan;
  const yReduce = (1 - zoomRatio) * rangeYSpan;
  const rX = center.x / rangeXSpan;
  const rY = center.y / rangeYSpan;

  const newXRangeStart = xRangeStart - (xReduce * rX);
  const newXRangeEnd   = xRangeEnd   + (xReduce * (1 - rX));
  const newYRangeStart = yRangeStart - (yReduce * rY);
  const newYRangeEnd   = yRangeEnd   + (yReduce * (1 - rY));

  const previousXDomain = xScale.domain() as [number, number];
  const previousYDomain = yScale.domain() as [number, number];

  let newXDomain = [newXRangeStart, newXRangeEnd].map((rangeVal) => xScale.invert(rangeVal)) as [number, number];
  let newYDomain = [newYRangeEnd, newYRangeStart].map((rangeVal) => yScale.invert(rangeVal)) as [number, number];

  newXDomain = clampToMaxSpan(maxXSpan, previousXDomain, clampToMinSpan(minXSpan, previousXDomain, newXDomain));
  newYDomain = clampToMaxSpan(maxYSpan, previousYDomain, clampToMinSpan(minYSpan, previousYDomain, newYDomain));

  if (lockXAxis) newXDomain = previousXDomain;
  if (lockYAxis) newYDomain = previousYDomain;

  constrain({
    xDomain: newXDomain,
    yDomain: newYDomain,
    constraint,
    xScale,
    yScale,
  });

  xScale.domain(newXDomain);
  yScale.domain(newYDomain);
}

export function constrain ({
  xDomain,
  yDomain,
  constraint: domainConstraint,
  xScale,
  yScale,
}: {
  xDomain: number[];
  yDomain: number[];
  constraint: Partial<IBBox> | undefined;
  xScale: IScale;
  yScale: IScale;
}) {
  // If there is no constraint, do nothing.
  if (!domainConstraint) return;

  // We must do these calculations in range values,
  // because the domain is non-linear, but the mouse movements are linear,
  // and we can't easily adjust a domain that has been panned past the constraint edge,
  // because while we may know the distance past in domain values,
  // we can't simply subtract that value from both edges, because it's non-linear. This is pixel logic.
  const newXRange = xDomain.map(xScale) as [number, number];
  const newYRange = yDomain.map(yScale) as [number, number];
  const rangeConstraint = {
    xMin: domainConstraint.xMin === undefined ? -Infinity : xScale(domainConstraint.xMin),
    xMax: domainConstraint.xMax === undefined ? +Infinity : xScale(domainConstraint.xMax),
    yMax /* flipped */: domainConstraint.yMin === undefined ? -Infinity : yScale(domainConstraint.yMin),
    yMin /* flipped */: domainConstraint.yMax === undefined ? +Infinity : yScale(domainConstraint.yMax),
  };
  const {xMin, xMax, yMin, yMax} = rangeConstraint;

  const rangeConstraintWidth = xMax - xMin;
  const rangeConstraintHeight = yMax - yMin;

  const leftIsOut  = newXRange[0] < xMin;
  const rightIsOut = newXRange[1] > xMax;
  const topIsOut    = newYRange[1] < yMin;
  const bottomIsOut = newYRange[0] > yMax;

  const prevXRange = xScale.range() as [number, number];
  const prevXRangeWidth = prevXRange[1] - prevXRange[0];
  const prevYRange = yScale.range() as [number, number];
  const prevYRangeHeight = prevYRange[0] - prevYRange[1];

  const newRangeWidth  = newXRange[1] - newXRange[0];
  const newRangeHeight = newYRange[0] - newYRange[1];
  // The constraining should not change the domain width when panning,
  // but when zooming, it may be clamped if the domain becomes larger than the constraint extent.
  if (newRangeWidth >= rangeConstraintWidth) {
    // In this case, the new domain is larger than the constraint width, whether it's actually out
    // on both sides or not (doesn't matter). We can just clamp both edges to the constraint.
    xDomain[0] = Number(xScale.invert(xMin));
    xDomain[1] = Number(xScale.invert(xMax));
  } else if (newRangeWidth !== prevXRangeWidth) {
    // The zooming case
    // When zooming at the edge, the zoom target will shift.
    if (leftIsOut) {
      xDomain[0] = Number(xScale.invert(xMin));
      xDomain[1] = Number(xScale.invert(xMin + newRangeWidth));
    }
    if (rightIsOut) {
      xDomain[0] = Number(xScale.invert(xMax - newRangeWidth));
      xDomain[1] = Number(xScale.invert(xMax));
    }
  } else {
    // Otherwise, the new domain is smaller than the constraint. Since it's smaller, it cannot be out on both sides at once.
    // We preserve the previous width for pans but not for zooms.
    if (leftIsOut) {
      xDomain[0] = Number(xScale.invert(xMin));
      xDomain[1] = Number(xScale.invert(xMin + prevXRangeWidth));
    }
    if (rightIsOut) {
      xDomain[0] = Number(xScale.invert(xMax - prevXRangeWidth));
      xDomain[1] = Number(xScale.invert(xMax));
    }
  }
  // Again for the Y axis
  if (newRangeHeight >= rangeConstraintHeight) {
    yDomain[1] = Number(yScale.invert(yMin));
    yDomain[0] = Number(yScale.invert(yMax));
  } else if (newRangeHeight !== prevYRangeHeight) {
    // The zooming case
    // When zooming at the edge, the zoom target will shift.
    if (topIsOut) {
      yDomain[1] = Number(yScale.invert(yMin));
      yDomain[0] = Number(yScale.invert(yMin + newRangeHeight));
    }
    if (bottomIsOut) {
      yDomain[1] = Number(yScale.invert(yMax - newRangeHeight));
      yDomain[0] = Number(yScale.invert(yMax));
    }
  } else {
    // Otherwise, the new domain is smaller than the constraint. Since it's smaller, it cannot be out on both sides at once.
    // We preserve the previous width for pans but not for zooms.
    if (topIsOut) {
      yDomain[1] = Number(yScale.invert(yMin));
      yDomain[0] = Number(yScale.invert(yMin + prevYRangeHeight));
    }
    if (bottomIsOut) {
      yDomain[1] = Number(yScale.invert(yMax - prevYRangeHeight));
      yDomain[0] = Number(yScale.invert(yMax));
    }
  }
}

/**
 * Calculate the `m` and `b` of `y = mx + b` for two points.
 */
export function calcMB (
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
): {m: number; b: number} {
  // Use this classic equation:
  //    y = mx + b
  // mapping x to old (init) and y to new (cur).
  // m = (y2 - y1) / (x2 - x1)
  const dividend = (y2 - y1);
  const divisor  = (x2 - x1);
  if (divisor === 0) {
    return {m: Infinity, b: 0};
  }
  const m = dividend / divisor;
  // Derive b by plugging in an [x,y] coord. (Remembering that x is old (init) and y is new (cur)).
  // y = mx + b
  // y - mx = b
  // b = y - mx
  const b = y1 - (m * x1);

  return {m, b};
}

export function calcKTs (
  initialBBox: IBBox,
  currentBBox: IBBox,
): {
  xk: number;
  xt: number;
  yk: number;
  yt: number;
} {
  const {
    xMin: initXMin,
    xMax: initXMax,
    yMin: initYMin,
    yMax: initYMax,
  } = initialBBox;
  const {
    xMin: curXMin,
    xMax: curXMax,
    yMin: curYMin,
    yMax: curYMax,
  } = currentBBox;

  const {k: xk, t: xt} = calcKT({
    initMin: initXMin,
    initMax: initXMax,
    curMin: curXMin,
    curMax: curXMax,
  });
  const {k: yk, t: yt} = calcKT({
    initMin: initYMin,
    initMax: initYMax,
    curMin: curYMin,
    curMax: curYMax,
  });

  return {xk, xt, yk, yt};
}

/**
 * Calculate two numbers (k,t) by which an old range value can be transformed into a new range value by doing `kx + t`.
 */
export function calcKT ({
  initMin,
  initMax,
  curMin,
  curMax,
}: {
  initMin: number;
  initMax: number;
  curMin: number;
  curMax: number;
}): {k: number; t: number} {
  // Use this classic equation:
  //    y = mx + b
  // mapping x to old (init) and y to new (cur).
  // `m` will be `k` and `b` will be `t`.
  // m = (y2 - y1) / (x2 - x1)
  const dividend = (curMax - curMin) || 0.00000001;
  const divisor = (initMax - initMin) || 0.00000001;
  const m = dividend / divisor;
  // Derive b by plugging in an [x,y] coord. (Remembering that x is old (init) and y is new (cur)).
  // y = mx + b
  // y - mx = b
  // b = y - mx
  const b = curMin - (m * initMin);

  return {k: m, t: b};
}

/**
 * Calculate a new range that applies the t,k of a gesture
 * and maps it to how the edges adjust, which is the inverse:
 *    - if the gesture grows, the edges contract.
 *    - if the gesture pans right, the edges move left.
 */
export function applyKTInverse (
  range: number[],
  k: number,
  t: number,
): [number, number] {
  const [range0, range1] = range;
  return [
    (range0 - t) / k,
    (range1 - t) / k,
  ];
}

/**
 * Calculate a new range that applies the t,k of a gesture
 * and maps it to how the edges adjust, which is the inverse:
 *    - if the gesture grows, the edges contract.
 *    - if the gesture pans right, the edges move left.
 */
export function calcBbox (
  pointerPositions: IGesture['pointerPositions'],
): IBBox {
  if (pointerPositions.size === 0) throw new Error('No pointers');
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const {x, y} of pointerPositions.values()) {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  return {
    xMin,
    xMax,
    yMin,
    yMax,
    xWidth: xMax - xMin,
    yHeight: yMax - yMin,
  };
}

export function normalizeWheelDelta ({
  delta,
  deltaMode,
  multiplier = 1,
}: {
  delta: number;
  deltaMode: number;
  multiplier?: number;
}): number {
  return (
    -delta
    *
    (
      deltaMode === 0 ?
        // pixels
        0.002 :
        // line and page (doesn't matter)
        0.05
    )
    *
    multiplier
  );
}


export function clampToMaxSpan (
  maxDomainSpan: number | undefined,
  previousDomain: [number, number],
  domain: [number, number],
): [number, number] {
  if (maxDomainSpan === undefined) return domain;
  const [d0, d1] = domain;
  const dWidth = d1 - d0;
  if (dWidth <= maxDomainSpan) return domain;
  return clampToSpan(maxDomainSpan, previousDomain, domain);
}

export function clampToMinSpan (
  minDomainSpan: number | undefined,
  previousDomain: [number, number],
  domain: [number, number],
): [number, number] {
  if (minDomainSpan === undefined) return domain;
  const [d0, d1] = domain;
  const dWidth = d1 - d0;
  if (dWidth >= minDomainSpan) return domain;
  return clampToSpan(minDomainSpan, previousDomain, domain);
}

export function clampToSpan (
  span: number,
  previousDomain: [number, number],
  domain: [number, number],
): [number, number] {
  const [d0, d1] = domain;
  const dWidth = d1 - d0;
  const [p0, p1] = previousDomain;
  const pWidth = p1 - p0;
  // x is the width, y is the left side of the domain.
  const {m, b} = calcMB([pWidth, p0], [dWidth, d0]);
  // y = mx + b
  const clamped0 = (m * span) + b;
  const clamped1 = clamped0 + span;
  return [clamped0, clamped1];
}

export function increaseToSpan (
  minDomainSpan: number | undefined,
  domain: [number, number],
): [number, number] {
  if (minDomainSpan === undefined) return domain;
  const [d0, d1] = domain;
  const dWidth = d1 - d0;
  // We only need to increase the width if it's less than the min width. So if it's greater than or equal, return.
  if (dWidth >= minDomainSpan) return domain;
  const diffHalf = (minDomainSpan - dWidth) / 2;
  return [d0 - diffHalf, d1 + diffHalf];
}

export function decreaseToSpan (
  maxDomainSpan: number | undefined,
  domain: [number, number],
): [number, number] {
  if (maxDomainSpan === undefined) return domain;
  const [d0, d1] = domain;
  const dWidth = d1 - d0;
  // We only need to decrease the width if it's greater than the max width. So if it's less than or equal, return.
  if (dWidth <= maxDomainSpan) return domain;
  const diffHalf = (dWidth - maxDomainSpan) / 2;
  return [d0 + diffHalf, d1 - diffHalf];
}


function squareify (
  bbox: IBBox,
): IBBox {
  const isHoriz = bbox.xWidth > bbox.yHeight;
  const sideExtra = Math.abs(bbox.xWidth - bbox.yHeight);
  const sideExtraHalf = sideExtra / 2;
  if (isHoriz) {
    return {
      ...bbox,
      yMax: bbox.yMax + sideExtraHalf,
      yMin: bbox.yMin - sideExtraHalf,
    };
  } else {
    return {
      ...bbox,
      xMax: bbox.xMax + sideExtraHalf,
      xMin: bbox.xMin - sideExtraHalf,
    };
  }
}
