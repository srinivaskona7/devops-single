/**
 * PodTerminal — interactive xterm.js terminal connected via WebSocket to kubectl exec
 *
 * Usage:
 *   <PodTerminal namespace="default" pod="my-pod" container="nginx" onClose={() => {}} />
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { X, RefreshCw, Maximize2, Minimize2, Terminal as TermIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@xterm/xterm/css/xterm.css';

export interface PodTerminalProps {
  namespace: string;
  pod: string;
  container?: string;
  shell?: string;
  onClose?: () => void;
  /** If true, open a generic kubectl shell (no pod) */
  shellMode?: boolean;
}

export function PodTerminal({ namespace, pod, container, shell = '/bin/sh', onClose, shellMode = false }: PodTerminalProps) {
  const termRef      = useRef<HTMLDivElement>(null);
  const xtermRef     = useRef<Terminal | null>(null);
  const fitRef       = useRef<FitAddon | null>(null);
  const wsRef        = useRef<WebSocket | null>(null);
  const [status, setStatus]     = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [expanded, setExpanded] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const reconnectTimer          = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((obj: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    }
  }, []);

  const connect = useCallback(() => {
    // Clean up old connection
    wsRef.current?.close();
    setStatus('connecting');
    setError(null);

    const proto  = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl  = shellMode
      ? `${proto}://${location.host}/ws/shell`
      : `${proto}://${location.host}/ws/exec?namespace=${encodeURIComponent(namespace)}&pod=${encodeURIComponent(pod)}&container=${encodeURIComponent(container || '')}&shell=${encodeURIComponent(shell)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setError(null); // clear any previous error on successful connect
      setTimeout(() => {
        xtermRef.current?.write('\r\n\x1b[32m● Connected\x1b[0m\r\n');
        send({ type: 'input', data: '\r' });
      }, 100);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          const data = msg.encoding === 'base64' ? atob(msg.data) : msg.data;
          xtermRef.current?.write(data);
        } else if (msg.type === 'exit') {
          xtermRef.current?.write(`\r\n\x1b[33m[Process exited with code ${msg.code}]\x1b[0m\r\n`);
          setStatus('disconnected');
        } else if (msg.type === 'error') {
          xtermRef.current?.write(`\r\n\x1b[31m[Error] ${msg.message}\x1b[0m\r\n`);
          setError(msg.message);
          setStatus('error');
        }
      } catch {}
    };

    ws.onerror = () => {
      setStatus('error');
      setError('WebSocket connection failed');
      setTimeout(() => xtermRef.current?.write('\r\n\x1b[31m[Connection error]\x1b[0m\r\n'), 50);
    };

    ws.onclose = (e) => {
      if (!e.wasClean) {
        setStatus('disconnected');
        setTimeout(() => xtermRef.current?.write('\r\n\x1b[33m[Disconnected]\x1b[0m\r\n'), 50);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, pod, container, shell, shellMode]);

  // Init xterm
  useEffect(() => {
    if (!termRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
      theme: {
        background: '#030a18',
        foreground: '#e2e8f0',
        cursor:     '#6366f1',
        black:      '#1e293b',
        red:        '#ef4444',
        green:      '#22c55e',
        yellow:     '#eab308',
        blue:       '#3b82f6',
        magenta:    '#a855f7',
        cyan:       '#06b6d4',
        white:      '#f1f5f9',
        brightBlack:   '#475569',
        brightRed:     '#f87171',
        brightGreen:   '#4ade80',
        brightYellow:  '#facc15',
        brightBlue:    '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan:    '#22d3ee',
        brightWhite:   '#ffffff',
      },
      allowTransparency: true,
      convertEol: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const linksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(linksAddon);
    term.open(termRef.current);

    // Defer fit to after first paint so the container has real dimensions
    requestAnimationFrame(() => {
      try { fitAddon.fit(); } catch {}
    });

    xtermRef.current = term;
    fitRef.current   = fitAddon;

    // Write welcome text after a brief delay to ensure terminal is ready
    setTimeout(() => {
      if (!xtermRef.current) return;
      term.write('\x1b[34mKyma Dashboard — Pod Terminal\x1b[0m\r\n');
      if (!shellMode) {
        term.write(`\x1b[36mConnecting to \x1b[1m${pod}\x1b[0m\x1b[36m${container ? `/${container}` : ''}\x1b[0m\r\n\r\n`);
      }
    }, 50);

    // Send keystrokes to backend
    const disposeKey = term.onData((data) => {
      send({ type: 'input', data });
    });

    // Handle resize
    const disposeResize = term.onResize(({ cols, rows }) => {
      send({ type: 'resize', cols, rows });
    });

    // ResizeObserver to refit on container size change
    const ro = new ResizeObserver(() => { try { fitAddon.fit(); } catch {} });
    ro.observe(termRef.current);

    // Delay first connect slightly so Vite HMR WebSocket finishes its handshake
    const initTimer = setTimeout(() => connect(), 300);

    return () => {
      clearTimeout(initTimer);
      disposeKey.dispose();
      disposeResize.dispose();
      ro.disconnect();
      wsRef.current?.close();
      term.dispose();
      xtermRef.current = null;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []); // mount once

  // Refit when expanded changes
  useEffect(() => {
    setTimeout(() => { try { fitRef.current?.fit(); } catch {} }, 100);
  }, [expanded]);

  const statusDot: Record<typeof status, string> = {
    connecting:   'bg-amber-400 animate-pulse',
    connected:    'bg-emerald-400',
    disconnected: 'bg-slate-500',
    error:        'bg-red-500',
  };

  return (
    <div className={cn(
      'flex flex-col rounded-xl border border-[rgba(99,102,241,0.2)] overflow-hidden',
      expanded ? 'fixed inset-4 z-50 shadow-2xl' : 'h-[420px]',
    )} style={{ background: '#030a18' }}>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[rgba(99,102,241,0.15)] bg-[#060d1f] shrink-0">
        <TermIcon size={13} className="text-indigo-400" />
        {shellMode ? (
          <span className="text-xs font-semibold text-slate-300">kubectl shell</span>
        ) : (
          <>
            <span className="font-mono text-xs text-indigo-300 font-semibold">{pod}</span>
            {container && <span className="text-xs text-slate-500">/{container}</span>}
            <span className="text-xs text-slate-600 bg-white/5 px-1.5 py-0.5 rounded font-mono">{shell}</span>
          </>
        )}

        {/* Status */}
        <div className="flex items-center gap-1.5 ml-1">
          <span className={cn('w-2 h-2 rounded-full shrink-0', statusDot[status])} />
          <span className="text-[10px] text-slate-500 capitalize">{status}</span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* Reconnect */}
          {(status === 'disconnected' || status === 'error') && (
            <button
              onClick={connect}
              title="Reconnect"
              className="p-1.5 rounded text-slate-500 hover:text-emerald-400 hover:bg-white/5 transition-colors"
            >
              <RefreshCw size={12} />
            </button>
          )}
          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(v => !v)}
            title={expanded ? 'Minimize' : 'Maximize'}
            className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              title="Close terminal"
              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── xterm.js container ── */}
      <div ref={termRef} className="flex-1 min-h-0 p-1" style={{ background: '#030a18' }} />

      {/* ── Error banner — only show when not connected ── */}
      {error && status !== 'connected' && (
        <div className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 border-t border-red-500/20 shrink-0">
          {error} —{' '}
          <button onClick={connect} className="underline hover:text-red-300">retry</button>
        </div>
      )}
    </div>
  );
}
