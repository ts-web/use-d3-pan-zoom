import { useMemo } from 'react';
import type { IScale } from './types';
import { calcKT } from './panZoom-utils';


/**
 * A React hook for claculating the transform of an overall gesture.
 * Use this when you want to apply a transform to an entire `g` container.
 *
 * This requires specifying the initial domains.
 * The transform is  (x, y, kx, ky).
 * This represents the x and y offset of the gesture, and the x/y scale factors.
 */
export function useTransform ({
  initialXScale,
  initialYScale,
  xScale,
  yScale,
  scaleRev,
}: {
  initialXScale: IScale;
  initialYScale: IScale;
  xScale: IScale;
  yScale: IScale;
  scaleRev: unknown;
}): {
  tx: number;
  ty: number;
  kx: number;
  ky: number;
} {
  return useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    scaleRev;
    const [initialXRangeStart, initialXRangeEnd] = initialXScale.range();

    const [initialYRangeStart, initialYRangeEnd] = initialYScale.range();
    const [currentXRangeStart, currentXRangeEnd] = initialXScale.domain().map(xScale);
    const [currentYRangeStart, currentYRangeEnd] = initialYScale.domain().map(yScale);

    const {k: kx, t: tx} = calcKT({
      initMin: initialXRangeStart,
      initMax: initialXRangeEnd,
      curMin: currentXRangeStart,
      curMax: currentXRangeEnd,
    });

    const {k: ky, t: ty} = calcKT({
      initMin: initialYRangeStart,
      initMax: initialYRangeEnd,
      curMin: currentYRangeStart,
      curMax: currentYRangeEnd,
    });

    return {
      tx,
      ty,
      kx,
      ky,
    };
  }, [scaleRev, initialXScale, initialYScale, xScale, yScale]);
}
