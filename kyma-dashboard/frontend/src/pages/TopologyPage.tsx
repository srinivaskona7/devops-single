import { useQuery } from '@tanstack/react-query';
import { useNamespace } from '@/hooks/useNamespace';
import { useNamespaces } from '@/hooks/useClusterData';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { REFETCH_INTERVAL } from '@/lib/constants';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';

interface TopoNode { id: string; kind: string; name: string; status?: string; type?: string; ip?: string; replicas?: number; }
interface TopoEdge { from: string; to: string; }

const KIND_COLOR: Record<string, string> = {
  Deployment: '#6366f1',
  ReplicaSet: '#06b6d4',
  Pod: '#10b981',
  Service: '#f59e0b',
};

const kindOrder = ['Service', 'Deployment', 'ReplicaSet', 'Pod'];

export default function TopologyPage() {
  const ns = useNamespace();
  const [searchParams, setSearchParams] = useSearchParams();
  const nsParam = searchParams.get('namespace') || ns || 'default';
  const { data: nsData } = useNamespaces();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['topology', nsParam],
    queryFn: () => fetch(`/api/topology?namespace=${nsParam}`).then(r => r.json()),
    enabled: !!nsParam,
    refetchInterval: REFETCH_INTERVAL,
  });

  const nodes: TopoNode[] = data?.nodes || [];
  const edges: TopoEdge[] = data?.edges || [];

  // Column-based layout: each kind gets a column, nodes stack vertically
  const NODE_W = 140;
  const NODE_H = 36;
  const COL_GAP = 180;
  const ROW_GAP = 52;
  const COL_START_X = 20;
  const ROW_START_Y = 20;

  const layout = new Map<string, { x: number; y: number }>();
  kindOrder.forEach((kind, col) => {
    const kindNodes = nodes.filter(n => n.kind === kind);
    kindNodes.forEach((node, row) => {
      layout.set(node.id, {
        x: COL_START_X + col * (NODE_W + COL_GAP),
        y: ROW_START_Y + row * (NODE_H + ROW_GAP),
      });
    });
  });

  const maxRows = kindOrder.reduce((max, kind) => Math.max(max, nodes.filter(n => n.kind === kind).length), 0);
  const svgWidth = COL_START_X * 2 + kindOrder.length * (NODE_W + COL_GAP) - COL_GAP;
  const svgHeight = Math.max(220, ROW_START_Y * 2 + maxRows * (NODE_H + ROW_GAP));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary, #f1f5f9)' }}>Resource Topology</h1>
        <select
          value={nsParam}
          onChange={e => setSearchParams({ namespace: e.target.value })}
          className="h-7 px-2 text-xs rounded border"
          style={{ background: '#0d1b2e', borderColor: 'rgba(99,102,241,0.2)', color: '#cbd5e1' }}
        >
          {(nsData?.items || []).map((n: any) => (
            <option key={n.name} value={n.name}>{n.name}</option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {kindOrder.map(kind => (
          <div key={kind} className="flex items-center gap-1.5 text-xs" style={{ color: '#94a3b8' }}>
            <div className="w-3 h-3 rounded" style={{ background: KIND_COLOR[kind] }} />
            {kind}
          </div>
        ))}
      </div>

      {/* SVG topology map */}
      <div className="k-card p-0 overflow-auto">
        {/* Column headers */}
        <div className="flex px-4 py-2 border-b" style={{ borderColor: 'rgba(99,102,241,0.15)' }}>
          {kindOrder.map(kind => (
            <div
              key={kind}
              className="text-xs font-semibold uppercase tracking-wider flex-1 text-center"
              style={{ color: KIND_COLOR[kind] }}
            >
              {kind}s
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="p-6"><LoadingState resource="Topology" /></div>
        ) : isError ? (
          <div className="p-6"><ErrorState title="Failed to load" error={error} onRetry={() => refetch()} /></div>
        ) : nodes.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm" style={{ color: '#64748b' }}>
            No resources found in <strong className="ml-1">{nsParam}</strong>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', padding: '12px 16px' }}>
            <svg width={svgWidth} height={svgHeight} style={{ fontFamily: 'monospace' }}>
              {/* Draw edges */}
              {edges.map((edge, i) => {
                const from = layout.get(edge.from);
                const to = layout.get(edge.to);
                if (!from || !to) return null;
                const isHighlighted = hoveredId === edge.from || hoveredId === edge.to;
                return (
                  <line
                    key={i}
                    x1={from.x + NODE_W} y1={from.y + NODE_H / 2}
                    x2={to.x} y2={to.y + NODE_H / 2}
                    stroke={isHighlighted ? 'rgba(99,102,241,0.7)' : 'rgba(148,163,184,0.25)'}
                    strokeWidth={isHighlighted ? 1.5 : 1}
                    strokeDasharray="4,3"
                  />
                );
              })}

              {/* Draw nodes */}
              {nodes.map(node => {
                const pos = layout.get(node.id);
                if (!pos) return null;
                const color = KIND_COLOR[node.kind] || '#64748b';
                const statusColor = node.status === 'ok' ? '#10b981' : node.status === 'err' ? '#ef4444' : '#f59e0b';
                const isHovered = hoveredId === node.id;
                const displayName = node.name.length > 16 ? node.name.slice(0, 15) + '\u2026' : node.name;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ cursor: 'default' }}
                  >
                    <rect
                      x={0} y={0} width={NODE_W} height={NODE_H} rx={6}
                      fill={isHovered ? `${color}30` : `${color}18`}
                      stroke={color}
                      strokeWidth={isHovered ? 2 : 1.5}
                    />
                    {node.status && (
                      <circle cx={NODE_W - 8} cy={8} r={4} fill={statusColor} />
                    )}
                    <text x={8} y={14} fontSize={9} fill={color} fontWeight="bold" style={{ userSelect: 'none' }}>
                      {node.kind.toUpperCase()}
                    </text>
                    <text x={8} y={28} fontSize={9} fill="rgba(203,213,225,0.85)" style={{ userSelect: 'none' }}>
                      {displayName}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Node list table */}
      {nodes.length > 0 && (
        <div className="k-card p-0">
          <table className="k-table">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Name</th>
                <th>Namespace</th>
                <th>Status / Info</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map(node => (
                <tr
                  key={node.id}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ background: hoveredId === node.id ? 'rgba(99,102,241,0.05)' : undefined }}
                >
                  <td>
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: `${KIND_COLOR[node.kind] || '#64748b'}20`, color: KIND_COLOR[node.kind] || '#94a3b8' }}
                    >
                      {node.kind}
                    </span>
                  </td>
                  <td className="font-mono text-xs" style={{ color: '#818cf8' }}>{node.name}</td>
                  <td className="text-xs" style={{ color: '#64748b' }}>{nsParam}</td>
                  <td>
                    {node.status ? (
                      <span className={node.status === 'ok' ? 'badge-ok' : node.status === 'err' ? 'badge-err' : 'badge-warn'}>
                        {node.status}
                      </span>
                    ) : node.type ? (
                      <span className="text-xs" style={{ color: '#94a3b8' }}>{node.type}</span>
                    ) : (
                      <span className="text-xs" style={{ color: '#475569' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
