import { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Send } from 'lucide-react';

export default function TerminalPage() {
  const termRef = useRef<HTMLDivElement>(null);
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string[]>(['# Kyma Terminal — type kubectl or helm commands below', '']);
  const [loading, setLoading] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const runCommand = async () => {
    if (!command.trim()) return;
    const cmd = command.trim();
    setCommand('');
    setOutput(prev => [...prev, `$ ${cmd}`]);
    setLoading(true);

    try {
      // Use SSE streaming endpoint
      const url = `/run?action=k8s&arg=${encodeURIComponent(cmd)}`;
      const evtSource = new EventSource(url);
      let buf = '';

      evtSource.onmessage = (e) => {
        if (e.data === '[DONE]') {
          evtSource.close();
          setLoading(false);
          return;
        }
        buf += e.data + '\n';
        setOutput(prev => {
          const next = [...prev];
          if (next[next.length - 1]?.startsWith('$')) {
            next.push(buf);
          } else {
            next[next.length - 1] = buf;
          }
          return next;
        });
      };
      evtSource.onerror = () => {
        evtSource.close();
        setLoading(false);
        setOutput(prev => [...prev, 'Error: connection failed']);
      };
    } catch (e: any) {
      setOutput(prev => [...prev, `Error: ${e.message}`]);
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') runCommand();
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-2">
        <TerminalIcon size={18} className="text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Terminal</h1>
        <span className="text-xs text-slate-500">kubectl / helm commands</span>
      </div>

      <div className="flex-1 k-card bg-[#060d1f] flex flex-col min-h-[400px]" ref={termRef}>
        {/* Output area */}
        <div
          ref={outputRef}
          className="flex-1 overflow-auto p-4 font-mono text-xs text-slate-300 space-y-0.5 max-h-[calc(100vh-320px)]"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
        >
          {output.map((line, i) => (
            <div key={i} className={line.startsWith('$') ? 'text-cyan-400' : line.startsWith('Error') ? 'text-red-400' : 'text-slate-300'}>
              {line}
            </div>
          ))}
          {loading && <div className="text-slate-500 animate-pulse">Running...</div>}
        </div>

        {/* Input bar */}
        <div className="border-t border-[rgba(99,102,241,0.15)] p-3 flex items-center gap-2">
          <span className="text-cyan-400 font-mono text-sm">$</span>
          <input
            className="flex-1 bg-transparent font-mono text-sm text-white placeholder:text-slate-600 focus:outline-none"
            placeholder="kubectl get pods -n kyma-system"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            autoFocus
          />
          <button
            onClick={runCommand}
            disabled={loading || !command.trim()}
            className="h-7 w-7 flex items-center justify-center rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            <Send size={12} className="text-white" />
          </button>
        </div>
      </div>

      {/* Quick commands */}
      <div className="flex flex-wrap gap-2">
        {[
          'kubectl get nodes',
          'kubectl get pods -n kyma-system',
          'kubectl get namespaces',
          'helm list -A',
          'kubectl version --short',
          'kubectl top nodes',
        ].map(cmd => (
          <button
            key={cmd}
            onClick={() => setCommand(cmd)}
            className="h-6 px-2 text-[11px] bg-white/5 hover:bg-white/10 border border-white/[0.08] rounded text-slate-400 hover:text-slate-200 font-mono transition-colors"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}
