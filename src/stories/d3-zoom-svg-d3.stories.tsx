/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as d3 from 'd3';
import { useEffect, useState } from 'react';

import { zoomSvgData } from './not-random-data';


export default {
  title: 'D3 Examples',
};


export function ZoomSVGD3 () {
  const [container, setContainer] = useState<HTMLElement | null>();

  useEffect(() => {
    if (!container) return;

    // Copied from https://observablehq.com/@d3/zoom

    // Specify the chart’s dimensions.
    const width = 928;
    const height = 500;

    const data = zoomSvgData;

    const svg = d3.create('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
    ;

    const g = svg.append('g');

    g.selectAll('circle')
      .data(data)
      .join('circle')
        .attr('cx', ([x]) => x)
        .attr('cy', ([, y]) => y)
        .attr('r', 1.5)
    ;

    svg.call(
      d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([1, 8])
        .on('zoom', zoomed) as any
    );

    function zoomed({transform}: any) {
      g.attr('transform', transform);
    }

    container.appendChild(svg.node()!);
  }, [container]);

  return (
    <div>
      <p>
        This is the d3 <a href='https://observablehq.com/@d3/zoom' target='_blank'>Zoom (SVG)</a> example, for reference. This is implemented in <kbd>d3</kbd>, and doesn't use <kbd>use-d3-pan-zoom</kbd>.
      </p>
      <div
        ref={setContainer}
        style={{
          border: '1px solid #666',
          display: 'inline-block',
          lineHeight: 0,
        }}
      />
    </div>
  );
}
ZoomSVGD3.storyName = 'Zoom (SVG) (d3 implementation)';
