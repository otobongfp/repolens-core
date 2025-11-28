import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import NodeDetailsModal from './NodeDetailsModal';
import { useGraphData } from '../context/GraphDataProvider';

export default function GraphView({
  fullscreen,
  setFullscreen,
}: {
  fullscreen?: boolean;
  setFullscreen?: (v: boolean) => void;
}) {
  const { graph } = useGraphData();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [browserFullscreen, setBrowserFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Browser fullscreen functions
  const enterBrowserFullscreen = () => {
    if (svgRef.current) {
      if (svgRef.current.requestFullscreen) {
        svgRef.current.requestFullscreen();
      } else if ((svgRef.current as any).webkitRequestFullscreen) {
        (svgRef.current as any).webkitRequestFullscreen();
      } else if ((svgRef.current as any).msRequestFullscreen) {
        (svgRef.current as any).msRequestFullscreen();
      }
    }
  };

  const exitBrowserFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen();
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen();
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setBrowserFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener(
        'webkitfullscreenchange',
        handleFullscreenChange,
      );
      document.removeEventListener(
        'msfullscreenchange',
        handleFullscreenChange,
      );
    };
  }, []);

  useEffect(() => {
    if (
      !graph ||
      !Array.isArray(graph.nodes) ||
      !Array.isArray(graph.edges) ||
      !svgRef.current ||
      !containerRef.current
    ) {
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Use full browser dimensions when in browser fullscreen, otherwise use container dimensions
    const width = browserFullscreen
      ? window.innerWidth
      : Math.max(400, containerRect.width); // Reduced minimum width for mobile
    const height = browserFullscreen
      ? window.innerHeight
      : Math.max(400, window.innerHeight * 0.6); // Responsive height

    svg.attr('width', width).attr('height', height);

    // Create main group for zoom/pan
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 5]) // Allow more extreme zoom levels for complex graphs
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom as any);

    const nodes = graph.nodes.map((n: any) => ({ ...n }));

    // Create a set of valid node IDs for quick lookup
    const validNodeIds = new Set(nodes.map((n: any) => n.id));

    // Filter edges to only include those where both source and target nodes exist
    const links = graph.edges
      .filter((e: any) => {
        const hasSource = validNodeIds.has(e.from);
        const hasTarget = validNodeIds.has(e.to);
        if (!hasSource || !hasTarget) {
          console.warn(
            `Skipping edge ${e.from} -> ${e.to}: ${
              !hasSource ? 'source missing' : 'target missing'
            }`,
          );
        }
        return hasSource && hasTarget;
      })
      .map((e: any) => ({
        source: e.from,
        target: e.to,
        type: e.type,
        meta: e.meta,
      }));

    // Enhanced force simulation for better layout
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(150), // Increased distance for less clustering
      )
      .force('charge', d3.forceManyBody().strength(-500)) // Stronger repulsion
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20)); // Prevent node overlap

    const link = g
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', 1.5)
      .append('title')
      .text((d: any) => {
        let label = `${d.type}`;
        if (d.meta && d.meta.line) label += ` (line ${d.meta.line})`;
        return label;
      });

    const node = (
      g
        .append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll('g')
        .data(nodes)
        .join('g') as any
    )
      .call(drag(simulation))
      .style('cursor', 'pointer')
      .on('click', (event: any, d: any) => {
        setSelectedNode(d);
        setIsModalOpen(true);
      })
      .on('mouseover', function (this: any, event: any, d: any) {
        d3.select(this)
          .select('circle')
          .transition()
          .duration(200)
          .attr('r', browserFullscreen ? 16 : 12);
        d3.select(this)
          .select('text')
          .transition()
          .duration(200)
          .style('font-weight', 'bold');
      })
      .on('mouseout', function (this: any, event: any, d: any) {
        d3.select(this)
          .select('circle')
          .transition()
          .duration(200)
          .attr('r', browserFullscreen ? 12 : 8);
        d3.select(this)
          .select('text')
          .transition()
          .duration(200)
          .style('font-weight', 'normal');
      });

    node
      .append('circle')
      .attr('r', browserFullscreen ? 12 : 8)
      .attr('fill', (d: any) => colorForType(d.type, d.meta))
      .style('filter', 'drop-shadow(0 0 4px rgba(255,255,255,0.1))');

    node.append('title').text((d: any) => {
      if (d.type === 'file') {
        return `${d.label} (file)\nPath: ${d.path}`;
      } else if (d.type === 'function') {
        if (d.meta?.external) {
          return `${d.label} (external function)\nCalled from: ${
            d.meta?.parent_file || 'unknown'
          }`;
        } else {
          return `${d.label} (function)\nFile: ${d.path}\nLines: ${d.meta?.start_line}-${d.meta?.end_line}`;
        }
      } else if (d.type === 'class') {
        return `${d.label} (class)\nFile: ${d.path}\nLines: ${d.meta?.start_line}-${d.meta?.end_line}`;
      } else if (d.type === 'import') {
        return `${d.label} (import)\nSource: ${d.meta?.source_file}`;
      }
      return `${d.label} (${d.type})`;
    });

    node
      .append('text')
      .text((d: any) => d.label)
      .attr('x', browserFullscreen ? 16 : 12)
      .attr('y', '0.31em')
      .attr('fill', '#1db470')
      .style('font-size', browserFullscreen ? '14px' : '10px');

    simulation.on('tick', () => {
      svg
        .selectAll('line')
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Auto-fit to view after simulation settles
    setTimeout(() => {
      const bounds = g.node()?.getBBox();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        const scale = Math.min(
          (width - 100) / bounds.width,
          (height - 100) / bounds.height,
          1,
        );
        const transform = d3.zoomIdentity
          .translate(
            width / 2 - (bounds.x + bounds.width / 2) * scale,
            height / 2 - (bounds.y + bounds.height / 2) * scale,
          )
          .scale(scale);
        svg.call(zoom.transform as any, transform);
      }
    }, 1500); // Wait longer for complex graphs to settle

    function colorForType(type: string, meta?: any) {
      switch (type) {
        case 'file':
          return '#1f77b4';
        case 'function':
          return meta?.external ? '#9467bd' : '#2ca02c'; // Purple for external functions
        case 'class':
          return '#ff7f0e';
        case 'import':
          return '#d62728';
        default:
          return '#888';
      }
    }

    function drag(simulation: any) {
      function dragstarted(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
      function dragged(event: any, d: any) {
        d.fx = event.x;
        d.fy = event.y;
      }
      function dragended(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      return d3
        .drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
  }, [graph, browserFullscreen]);

  const resetZoom = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg
        .transition()
        .duration(750)
        .call(d3.zoom().transform as any, d3.zoomIdentity);
    }
  };

  const zoomIn = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg
        .transition()
        .duration(300)
        .call(d3.zoom().scaleBy as any, 1.3);
    }
  };

  const zoomOut = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg
        .transition()
        .duration(300)
        .call(d3.zoom().scaleBy as any, 1 / 1.3);
    }
  };

  return (
    <div
      className={`relative flex w-full items-center justify-center ${
        fullscreen ? 'h-full' : ''
      }`}
    >
      {/* Container fullscreen button */}
      {setFullscreen && (
        <button
          className='bg-primary hover:bg-primary/80 absolute top-2 right-2 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 text-xs text-white shadow-lg transition sm:top-4 sm:right-4 sm:text-sm'
          onClick={() => setFullscreen(!fullscreen)}
          title='Toggle container fullscreen'
          aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          <span className='hidden sm:inline'>
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </span>
          <span className='sm:hidden'>{fullscreen ? 'Exit' : 'Full'}</span>
        </button>
      )}

      {/* Browser fullscreen button */}
      <button
        className='bg-primary absolute top-2 right-12 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 text-xs text-white shadow-lg transition hover:bg-[#158452] sm:top-4 sm:right-16 sm:text-sm'
        onClick={
          browserFullscreen ? exitBrowserFullscreen : enterBrowserFullscreen
        }
        title={
          browserFullscreen
            ? 'Exit browser fullscreen'
            : 'Enter browser fullscreen'
        }
        aria-label={
          browserFullscreen
            ? 'Exit browser fullscreen'
            : 'Enter browser fullscreen'
        }
      >
        <span className='hidden sm:inline'>
          {browserFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </span>
        <span className='sm:hidden'>{browserFullscreen ? 'Exit' : 'Full'}</span>
      </button>

      {/* Zoom controls */}
      <div className='absolute top-2 left-2 z-10 flex items-center gap-1 rounded-lg bg-black/20 p-1.5 backdrop-blur-xs sm:top-4 sm:left-4 sm:gap-2 sm:p-2'>
        <span className='hidden text-xs text-white/60 sm:inline'>
          Zoom: {Math.round(zoomLevel * 100)}%
        </span>
        <span className='text-xs text-white/60 sm:hidden'>
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={zoomOut}
          className='flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-white/20 bg-white/10 px-2 py-2 text-xs hover:bg-white/20 sm:px-2'
          title='Zoom Out'
          aria-label='Zoom Out'
        >
          −
        </button>
        <button
          onClick={resetZoom}
          className='flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-white/20 bg-white/10 px-2 py-2 text-xs hover:bg-white/20 sm:px-2'
          title='Reset Zoom'
          aria-label='Reset Zoom'
        >
          ⌂
        </button>
        <button
          onClick={zoomIn}
          className='flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-white/20 bg-white/10 px-2 py-2 text-xs hover:bg-white/20 sm:px-2'
          title='Zoom In'
          aria-label='Zoom In'
        >
          +
        </button>
      </div>

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className={`relative overflow-auto rounded border bg-white/5 shadow ${
          fullscreen ? 'h-[90vh] w-full' : 'h-[400px] w-full sm:h-[600px]'
        } ${browserFullscreen ? 'h-full w-full' : ''}`}
      >
        <svg
          ref={svgRef}
          className={`block ${fullscreen ? 'h-full w-full' : ''} ${
            browserFullscreen ? 'h-full w-full' : ''
          }`}
        />

        {/* Navigation hint overlay */}
        <div className='absolute bottom-2 left-2 rounded-sm bg-black/20 px-2 py-1 text-xs text-white/40 sm:bottom-4 sm:left-4'>
          <span className='hidden sm:inline'>
            Drag to pan • Scroll to zoom • Click nodes for details
          </span>
          <span className='sm:hidden'>Drag • Scroll • Tap</span>
        </div>
      </div>

      {/* Node Details Modal */}
      <NodeDetailsModal
        node={selectedNode}
        graph={graph}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedNode(null);
        }}
      />
    </div>
  );
}
