import { scaleLinear } from 'd3-scale';
import {
  applyKTInverse,
  calcBbox,
  calcKT,
  calcKTs,
  updateScales,
} from '~/index';


test('calcKT', () => {
  expect(calcKT({
    initMin: 0,
    initMax: 10,
    curMin: 20,
    curMax: 40,
  })).toEqual({k: 2, t: 20});
  expect(calcKT({
    initMin: 10,
    initMax: 20,
    curMin: 50,
    curMax: 70,
  })).toEqual({k: 2, t: 30});
  expect(calcKT({
    initMin: -10,
    initMax: 0,
    curMin: -40,
    curMax: -20,
  })).toEqual({k: 2, t: -20});
  expect(calcKT({
    initMin: -5,
    initMax: 5,
    curMin: 20,
    curMax: 40,
  })).toEqual({k: 2, t: 30});
  expect(calcKT({
    initMin: 1,
    initMax: 1,
    curMin: 2,
    curMax: 2,
  })).toEqual({k: 1, t: 1});
});

test('calcKTs', () => {
  expect(calcKTs(
    {xMin: 0, xMax: 100, yMin: 0, yMax: 100, xWidth: 100, yHeight: 100},
    {xMin: 200, xMax: 300, yMin: 100, yMax: 300, xWidth: 100, yHeight: 200},
  )).toEqual({xk: 1, xt: 200, yk: 2, yt: 100});
});

test('applyKTInverse', () => {
  expect(applyKTInverse(
    [-100, 100],
    1,
    10
  )).toEqual([-110, 90]);
  expect(applyKTInverse(
    [-100, 100],
    2,
    0
  )).toEqual([-50, 50]);
  expect(applyKTInverse(
    [-100, 100],
    2,
    50
  )).toEqual([-75, 25]);
});

test('calcBbox', () => {
  expect(calcBbox(new Map([
    ['p1', {x: 0, y: 0}],
  ]))).toEqual({
    xMin: 0,
    xMax: 0,
    xWidth: 0,
    yMin: 0,
    yMax: 0,
    yHeight: 0,
  });
  expect(calcBbox(new Map([
    ['p1', {x: -10, y: 0}],
    ['p2', {x: -1, y: 5}],
    ['p3', {x: -5, y: 1}],
  ]))).toEqual({
    xMin: -10,
    xMax: -1,
    xWidth: 9,
    yMin: 0,
    yMax: 5,
    yHeight: 5,
  });
});


describe('updateScales', () => {
  test('stationary 60', () => {
    /*
      Simulate pinch zoom in with two fingers spreading outward around 60 (domain) or 600 (range).
      The range is 1000 and the domain is 0-100, initially.
     */
    const xScale = scaleLinear();
    const yScale = scaleLinear();
    xScale.domain([0, 100]).range([0, 1000]);
    yScale.domain([0, 1]).range([0, 1]);
    const originalXScale = xScale.copy();
    const originalYScale = yScale.copy();
    updateScales({
      xScale,
      yScale,
      initialXScale: originalXScale,
      initialYScale: originalYScale,
      initialGestureBBox: {
        xMin: 500,
        xMax: 700,
        xWidth: 200,
        yMin: 0,
        yMax: 1,
        yHeight: 1,
      },
      currentGestureBBox: {
        xMin: 400,
        xMax: 800,
        xWidth: 400,
        yMin: 0,
        yMax: 1,
        yHeight: 1,
      },
      constraint: undefined,
      lockXAxis: false,
      lockYAxis: false,
      preserveAspectRatio: false,
      minZoom: undefined,
      maxZoom: undefined,
      singleAxis: undefined,
    });
    // Expect 60 to still be at 60
    expect(xScale.range()).toEqual([0, 1000]);
    expect(xScale.domain()).toEqual([30, 80]);
    expect(xScale(60)).toBe(600);
  });
});
