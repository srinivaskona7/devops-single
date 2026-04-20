import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, Play, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

const DEFAULT_YAML = `apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  namespace: default
spec:
  containers:
  - name: main
    image: nginx:alpine
    resources:
      limits:
        cpu: "100m"
        memory: "64Mi"
`;

export default function YamlApplyPage() {
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyYaml = async () => {
    if (!yaml.trim()) { setError('YAML content is empty'); return; }
    setLoading(true);
    setError(null);
    setOutput('');
    try {
      const res = await fetch('/api/apply-manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setOutput(data.output || 'Applied successfully');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode size={18} className="text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Apply YAML</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYaml(DEFAULT_YAML)}
            className="h-7 px-2 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-300 flex items-center gap-1"
          >
            <RefreshCw size={12} /> Reset
          </button>
          <button
            onClick={applyYaml}
            disabled={loading}
            className="h-7 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded text-xs text-white flex items-center gap-1.5"
          >
            <Play size={12} />
            {loading ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-[400px]">
        {/* Editor */}
        <div className="flex-1 k-card p-0 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="yaml"
            value={yaml}
            onChange={v => setYaml(v || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>

        {/* Output */}
        {(output || error) && (
          <div className="w-80 k-card bg-[#060d1f] flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              {error
                ? <AlertCircle size={14} className="text-red-400" />
                : <CheckCircle size={14} className="text-emerald-400" />
              }
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {error ? 'Error' : 'Applied'}
              </span>
            </div>
            {error ? (
              <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap break-all overflow-auto flex-1">{error}</pre>
            ) : (
              <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap break-all overflow-auto flex-1">{output}</pre>
            )}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-600">
        Tip: Use <code className="text-indigo-400">---</code> to separate multiple resources in one document.
      </div>
    </div>
  );
}
