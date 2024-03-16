

/** `[xDomain, yDomain]`, or `[[xDomainStart, xDomainEnd], [yDomainStart, yDomainEnd]]` */
export type IDomain = readonly [
  xDomain: readonly [xDomainStart: number, xDomainEnd: number],
  yDomain: readonly [yDomainStart: number, yDomainEnd: number],
];

/** `[xRange, yRange]`, or `[[xRangeStart, xRangeEnd], [yRangeStart, yRangeEnd]]` */
export type IRange = readonly [
  xRange: readonly [xRangeStart: number, xRangeEnd: number],
  yRange: readonly [yRangeStart: number, yRangeEnd: number],
];


export interface IScale <TDomain extends number = number> {
  (domainVal: TDomain): number;
  domain: {
    (): TDomain[];
    (newDomain: TDomain[]): void;
  };
  range: {
    // eslint-disable-next-line @typescript-eslint/prefer-function-type
    (): number[];
  };
  invert: (rangeValue: number) => TDomain;
  copy: () => IScale<TDomain>;
}

export interface IGesture {
  inProgress: boolean;
  initialXScale: IScale;
  initialYScale: IScale;
  initialGestureBBox: IBBox;
  currentGestureBBox: IBBox;
  pointerPositions: Map<string | number, {
    x: number;
    y: number;
  }>;
  constraint?: Partial<IBBox>;
  minZoom?: {xSpan?: number; ySpan?: number};
  maxZoom?: {xSpan?: number; ySpan?: number};
  singleAxis?: 'x' | 'y';
}

export interface IBBox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xWidth: number;
  yHeight: number;
}

