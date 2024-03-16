import { useRef, useCallback } from 'react';
import { calcBbox, updateScales, zoom } from './panZoom-utils';
import type { IBBox, IGesture, IScale } from './types';

const SINGLE_AXIS_THRESHOLD = 100;



/** The return value of `usePanZoom` */
export interface IResult {
  /**
   * Call `onPointerDown` on pointer down events, passing the pointerId.
   */
  onPointerDown: (
    pointerId: number,
    pos: {x: number; y: number},
  ) => void;

  /**
   * Call `onPointerUp` on pointer up events, passing the pointerId.
   */
  onPointerUp: (
    pointerId: number,
  ) => void;

  /**
   * Call `onWheelZoom` on wheel events from the chart element.
   * Pass a position relative to the chart element.
   * The zoomRatio is a number from `0..1` corresponding to the proportion of the domain to zoom by.
   */
  onWheelZoom: (opts: {
    center: {x: number; y: number};
    zoomRatio: number;
  }) => void;

  /**
   * This is the gesture state. Not usually needed.
   */
  gesture: IGesture;
}


/**
 * `usePanZoom` — manipulate a pair of X and Y domains using a view.
 */
export function usePanZoom ({
  xScale,
  yScale,
  onUpdate,
  constrain,
  minZoom,
  maxZoom,
  registerMoveListener,
}: {
  xScale: IScale;
  yScale: IScale;
  onUpdate?: () => void;
  constrain?: Partial<IBBox>;
  minZoom?: {xSpan?: number; ySpan?: number};
  maxZoom?: {xSpan?: number; ySpan?: number};
  /**
   * Implement this function to properly handle pointer move events.
   * It should add a pointer move event listener, and return a function that removes it.
   * This way, pointer move events are ignored unless the chart is actually being interacted with.
   * This is important, because the pointer move listener must be attached on the entire document (for freedom of movement).
   */
  registerMoveListener: (
    /**
     * Call `onPointerMove` for every move of every pointer, passing the pointer position relative to the view element.
     */
    onPointerMove: (
      pointerId: number,
      pos: {x: number; y: number},
    ) => void,
  ) => (() => void);
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
    constraint: constrain,
    minZoom,
    maxZoom,
  });

  gestureRef.current.constraint = constrain;
  gestureRef.current.minZoom = minZoom;
  gestureRef.current.maxZoom = maxZoom;

  const updateTimeoutRef = useRef<number | undefined>();
  const update = useCallback(() => {
    updateTimeoutRef.current = undefined;
    onUpdateRef.current?.();
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

  const registerMoveListenerRef = useRef(registerMoveListener); registerMoveListenerRef.current = registerMoveListener;
  const removeMoveListenerRef = useRef<(() => void) | undefined>();

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

      const onPointerMove = (
        pointerId: number,
        pos: {x: number; y: number},
      ) => {
        const gesture = gestureRef.current;
        if (!gesture.inProgress) return;
        const _commitGesture = commitGestureRef.current;
        const _scheduleUpdate = scheduleUpdateRef.current;

        gesture.pointerPositions.set(pointerId, pos);
        gesture.currentGestureBBox = calcBbox(gesture.pointerPositions);
        _commitGesture(gesture);
        _scheduleUpdate();
      };
      removeMoveListenerRef.current = registerMoveListenerRef.current(onPointerMove);
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

  const onPointerUp = useCallback((
    pointerId: number,
  ) => {
    const _gesture = gestureRef.current;
    if (!_gesture.inProgress) return;
    const _commitGesture = commitGestureRef.current;
    const _scheduleUpdate = scheduleUpdateRef.current;
    const _resetGesture = resetGestureRef.current;

    _gesture.currentGestureBBox = calcBbox(_gesture.pointerPositions);
    _commitGesture(_gesture);
    _scheduleUpdate();
    _gesture.pointerPositions.delete(pointerId);
    _resetGesture(_gesture);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- wrong; function calls change gesture state
    if (!_gesture.inProgress) {
      // At the end of the interaction, stop listening to move events.
      removeMoveListenerRef.current?.();
      removeMoveListenerRef.current = undefined;
    }
  }, []);

  const onWheelZoom = useCallback(({
    center,
    zoomRatio,
  }: {
    center: {x: number; y: number};
    zoomRatio: number;
  }) => {
    const _gesture = gestureRef.current;
    // Ignore wheel events if a gesture is in progress, because they simply don't work and add visual jitter.
    if (_gesture.inProgress) return;
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
    onPointerUp,
    onWheelZoom,
    gesture: gestureRef.current,
  };
}
