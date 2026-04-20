import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useNamespaces } from '@/hooks/useClusterData';
import { useNamespace } from '@/hooks/useNamespace';
import { useParams, useSearchParams } from 'react-router-dom';
import { Terminal, ChevronDown } from 'lucide-react';
import { REFETCH_INTERVAL } from '@/lib/constants';
import type { Pod } from '@/types';
import { PodTerminal } from '@/components/shared/PodTerminal';
import { cn } from '@/lib/utils';

export default function ExecPodPage() {
  const nsFromHook             = useNamespace();
  const { namespace: nsParam } = useParams<{ namespace?: string }>();
  const [searchParams]         = useSearchParams();
  const { data: nsData }       = useNamespaces();

  const [ns, setNs]                               = useState(searchParams.get('namespace') || nsParam || nsFromHook || '');
  const [selectedPod, setSelectedPod]             = useState(searchParams.get('pod') || '');
  const [selectedContainer, setSelectedContainer] = useState('');
  const [shell, setShell]                         = useState('/bin/sh');
  const [sessionKey, setSessionKey]               = useState(0);

  const currentNs = ns || (nsData?.items?.[0]?.name ?? '');

  const { data: podsData } = useQuery<{ items: Pod[] }>({
    queryKey: ['pods', currentNs],
    queryFn: () => api.pods(currentNs),
    enabled: !!currentNs,
    refetchInterval: REFETCH_INTERVAL,
  });

  const pods       = podsData?.items || [];
  const pod        = pods.find(p => p.name === selectedPod);
  const containers = pod?.containers?.map(c => c.name) || [];
  const ready      = !!selectedPod;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Terminal size={20} className="text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Pod Terminal</h1>
        <span className="text-xs text-slate-500 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
          Interactive SSH
        </span>
      </div>

      {/* Connection bar */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-[rgba(99,102,241,0.15)] bg-white/[0.02]">
        {/* Namespace */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Namespace</label>
          <div className="relative">
            <select value={currentNs} onChange={e => { setNs(e.target.value); setSelectedPod(''); setSelectedContainer(''); }}
              className="h-8 pl-3 pr-7 text-sm bg-[#0d1b2e] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 appearance-none cursor-pointer">
              <option value="">Select namespace</option>
              {(nsData?.items || []).map(n => <option key={n.name} value={n.name}>{n.name}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Pod */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Pod</label>
          <div className="relative">
            <select value={selectedPod} onChange={e => { setSelectedPod(e.target.value); setSelectedContainer(''); }}
              className="h-8 pl-3 pr-7 text-sm bg-[#0d1b2e] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 appearance-none cursor-pointer min-w-[220px]">
              <option value="">Select pod</option>
              {pods.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Container (only if multi-container) */}
        {containers.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Container</label>
            <div className="relative">
              <select value={selectedContainer} onChange={e => setSelectedContainer(e.target.value)}
                className="h-8 pl-3 pr-7 text-sm bg-[#0d1b2e] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 appearance-none cursor-pointer">
                <option value="">Auto (first)</option>
                {containers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Shell */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Shell</label>
          <div className="relative">
            <select value={shell} onChange={e => setShell(e.target.value)}
              className="h-8 pl-3 pr-7 text-sm bg-[#0d1b2e] border border-[rgba(99,102,241,0.2)] rounded text-slate-300 appearance-none cursor-pointer">
              <option value="/bin/sh">/bin/sh</option>
              <option value="/bin/bash">/bin/bash</option>
              <option value="/bin/ash">/bin/ash</option>
              <option value="/bin/zsh">/bin/zsh</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        </div>

        {/* Connect button */}
        <button onClick={() => setSessionKey(k => k + 1)} disabled={!ready}
          className={cn(
            'h-8 px-5 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors',
            ready ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-white/5 text-slate-600 cursor-not-allowed'
          )}>
          <Terminal size={12} />
          {sessionKey === 0 ? 'Connect' : 'Reconnect'}
        </button>
      </div>

      {/* Terminal */}
      {ready && sessionKey > 0 ? (
        <div className="flex-1 min-h-0">
          <PodTerminal
            key={`${selectedPod}-${selectedContainer}-${sessionKey}`}
            namespace={currentNs}
            pod={selectedPod}
            container={selectedContainer}
            shell={shell}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[rgba(99,102,241,0.15)] text-slate-600">
          <Terminal size={36} className="opacity-20" />
          <p className="text-sm">Select a namespace + pod, then click <strong className="text-slate-400">Connect</strong></p>
          <p className="text-xs">Opens an interactive shell via <code className="text-slate-500">kubectl exec -i</code></p>
        </div>
      )}
    </div>
  );
}
