import { useRef, useCallback } from 'react';
import { calcBbox, updateScales, zoom } from './panZoom-utils';
import type { IBBox, IGesture, IScale } from './types';

const SINGLE_AXIS_THRESHOLD = 100;

/**
 * `usePanZoom` — manipulate a pair of X and Y domains using a view.
 * Supports multi-touch user interactions and non-linear scales.
 *
 * Paradigm:
 * Each axis has a scale. A scale has a domain and a range. Each are represented by two numbers.
 * (`usePanZoom` does not support scales that have non-numeric domains, i.e. those without `invert` methods)
 * A domain has two numbers: the start and the end. This indicates the visible portion of the data.
 * The range also has two numbers, which are the view dimensions. So a range will be [0, width] or [height, 0].
 *
 * # Y range is flipped
 * The Y domain goes from small values to large, as per the convention.
 * But in the DOM view element, Y=0 is at the top, and Y gets larger as it goes downward.
 * However, in a chart, Y=0 is at the bottom and the larger values go upward.
 * So the chart's Y domain is the reverse of the DOM view.
 * To render properly, we invert the Y scale's range.
 * This paints the low domain values at the bottom of the chart, and the high domain values at the top of the chart.
 * In summary:
 *    - DOM Y=0      = top of chart    = domain max.
 *    - DOM Y=height = bottom of chart = domain min.
 *
 * The x and y scales must be passed in as d3 scales (or a compatible callable object with `domain`, `range`, `invert`, and `copy` methods).
 * `usePanZoom` will modify the scales' domains in-place, and will call `onUpdate` (but not on each update; only on animation frames).
 *
 * Method:
 *  - N pointers define a bbox in range space. When a pointer is added, it creates a new bbox (committing the previous gesture).
 *  - When pointers move, this bbox may resize. When compared to the origin bbox, the difference is applied to the domain as well.
 *    - The bbox difference is described by a center and width.
 *  - At the time when a bbox origin is described, the domain is snapshotted. When the gesture is in progress,
 *    the original bbox and domain will be referenced to produce the new domain.
 *
 */
export function usePanZoom ({
  xScale,
  yScale,
  onUpdate,
  constraint,
  minZoom,
  maxZoom,
}: {
  xScale: IScale;
  yScale: IScale;
  onUpdate: () => void;
  constraint?: Partial<IBBox>;
  minZoom?: {xSpan?: number; ySpan?: number};
  maxZoom?: {xSpan?: number; ySpan?: number};
}): IResult {
  const xScaleRef = useRef(xScale); xScaleRef.current = xScale;
  const yScaleRef = useRef(yScale); yScaleRef.current = yScale;
  const onUpdateRef = useRef(onUpdate); onUpdateRef.current = onUpdate;

  const gestureRef = useRef<IGesture>({
    inProgress: false,
    initialXScale: xScale, // dummy default
    initialYScale: yScale, // dummy default
    initialGestureBBox: {xMin: 0, xMax: 0, yMin: 0, yMax: 0, xWidth: 0, yHeight: 0}, // dummy default
    currentGestureBBox: {xMin: 0, xMax: 0, yMin: 0, yMax: 0, xWidth: 0, yHeight: 0}, // dummy default
    pointerPositions: new Map(),
    constraint,
    minZoom,
    maxZoom,
  });

  gestureRef.current.constraint = constraint;
  gestureRef.current.minZoom = minZoom;
  gestureRef.current.maxZoom = maxZoom;

  const updateTimeoutRef = useRef<number | undefined>();
  const update = useCallback(() => {
    updateTimeoutRef.current = undefined;
    onUpdateRef.current();
  }, []);
  const scheduleUpdate = useCallback(() => {
    if (!updateTimeoutRef.current) {
      updateTimeoutRef.current = requestAnimationFrame(update);
    }
  }, [update]);
  const scheduleUpdateRef = useRef(scheduleUpdate); scheduleUpdateRef.current = scheduleUpdate;

  const commitGesture = useCallback((gesture: IGesture) => {
    const _xScale = xScaleRef.current;
    const _yScale = yScaleRef.current;
    updateScales({
      xScale: _xScale,
      yScale: _yScale,
      initialXScale: gesture.initialXScale,
      initialYScale: gesture.initialYScale,
      initialGestureBBox: gesture.initialGestureBBox,
      currentGestureBBox: gesture.currentGestureBBox,
      constraint: gesture.constraint,
      minZoom: gesture.minZoom,
      maxZoom: gesture.maxZoom,
      singleAxis: gesture.singleAxis,
    });
  }, []);
  const commitGestureRef = useRef(commitGesture); commitGestureRef.current = commitGesture;

  const resetGesture = useCallback((gesture: IGesture) => {
    if (gesture.pointerPositions.size === 0) {
      gesture.inProgress = false;
      return;
    }
    const bbox = calcBbox(gesture.pointerPositions);
    if (gesture.pointerPositions.size < 2) {
      gesture.singleAxis = undefined;
    } else {
      const isXNarrow = (bbox.xWidth < SINGLE_AXIS_THRESHOLD);
      const isYNarrow = (bbox.yHeight < SINGLE_AXIS_THRESHOLD);
      const bothAreNarrow = (isXNarrow && isYNarrow);
      const predominantlyX = (bbox.xWidth / bbox.yHeight > 1.2);
      const predominantlyY = (bbox.xWidth / bbox.yHeight < 0.8);
      gesture.singleAxis = (bothAreNarrow) ?
        (predominantlyY) ? 'y' : (predominantlyX) ? 'x' : undefined :
        (isXNarrow) ?
          'y' :
          isYNarrow ?
            'x':
            undefined
      ;
    }
    gesture.initialGestureBBox = bbox;
    gesture.currentGestureBBox = bbox;
    gesture.initialXScale = xScaleRef.current.copy();
    gesture.initialYScale = yScaleRef.current.copy();
  }, []);
  const resetGestureRef = useRef(resetGesture); resetGestureRef.current = resetGesture;

  /**
   * `onPointerDown` is called by the consumer when a new pointer has been pressed.
   * It includes the view-space coordinates and a pointer ID.
   * When this happens, we create a new gesture, resetting all pointers to have new origins.
   * Since a new pointer doesn't actually change the gesture, there is no need to update it.
   */
  const onPointerDown = useCallback((
    pointerId: number,
    pos: {x: number; y: number},
  ) => {
    const _gesture = gestureRef.current;
    const _commitGesture = commitGestureRef.current;
    const _scheduleUpdate = scheduleUpdateRef.current;
    const _resetGesture = resetGestureRef.current;

    if (!_gesture.inProgress) {
      // Case: first pointer pressed down.
      _gesture.inProgress = true;
      _gesture.pointerPositions.set(pointerId, pos);
      _resetGesture(_gesture);
    } else {
      // Case: second or Nth pointer pressed down.
      // Commit the current gesture and start a new one.
      _commitGesture(_gesture);
      _scheduleUpdate();
      _gesture.pointerPositions.set(pointerId, pos);
      _resetGesture(_gesture);
    }
    _scheduleUpdate();
  }, []);

  const onPointerMove = useCallback((
    pointerId: number,
    pos: {x: number; y: number},
  ) => {
    const gesture = gestureRef.current;
    const _commitGesture = commitGestureRef.current;
    const _scheduleUpdate = scheduleUpdateRef.current;

    if (!gesture.inProgress) return;
    gesture.pointerPositions.set(pointerId, pos);
    gesture.currentGestureBBox = calcBbox(gesture.pointerPositions);
    _commitGesture(gesture);
    _scheduleUpdate();
  }, []);

  const onPointerUp = useCallback((
    pointerId: number,
  ) => {
    const _gesture = gestureRef.current;
    const _commitGesture = commitGestureRef.current;
    const _scheduleUpdate = scheduleUpdateRef.current;
    const _resetGesture = resetGestureRef.current;

    _gesture.currentGestureBBox = calcBbox(_gesture.pointerPositions);
    _commitGesture(_gesture);
    _scheduleUpdate();
    _gesture.pointerPositions.delete(pointerId);
    _resetGesture(_gesture);
  }, []);

  const onWheelZoom = useCallback(({
    center,
    zoomRatio,
  }: {
    center: {x: number; y: number};
    zoomRatio: number;
  }) => {
    const _gesture = gestureRef.current;
    const _xScale = xScaleRef.current;
    const _yScale = yScaleRef.current;
    const _scheduleUpdate = scheduleUpdateRef.current;

    zoom({
      xScale: _xScale,
      yScale: _yScale,
      center,
      zoomRatio,
      constraint: _gesture.constraint,
      minZoom: _gesture.minZoom,
      maxZoom: _gesture.maxZoom,
    });

    _scheduleUpdate();
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheelZoom,
    gesture: gestureRef.current,
  };
}


/** The return value of `usePanZoom` */
export interface IResult {
  onPointerDown: (
    pointerId: number,
    pos: {x: number; y: number},
  ) => void;

  onPointerMove: (
    pointerId: number,
    pos: {x: number; y: number},
  ) => void;

  onPointerUp: (
    pointerId: number,
  ) => void;

  onWheelZoom: (opts: {
    center: {x: number; y: number};
    zoomRatio: number;
  }) => void;

  gesture: IGesture;
}
