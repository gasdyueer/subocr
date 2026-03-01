import React, { useEffect, useRef } from 'react';
import { useOcrStore } from '../../stores/useOcrStore';
import { formatTime } from '../../lib/utils';
import { Terminal, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function LogPanel() {
  const { logs, clearLogs } = useOcrStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-400">
          <Terminal className="w-3 h-3" />
          <span>System Logs</span>
        </div>
        <button onClick={clearLogs} className="hover:text-white text-zinc-500">
          <XCircle className="w-3 h-3" />
        </button>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {logs.length === 0 && (
          <div className="text-zinc-600 italic p-2">No logs available...</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 break-all">
            <span className="text-zinc-600 shrink-0">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            {log.frameTime !== undefined && (
              <span className="text-blue-500 shrink-0">
                [{formatTime(log.frameTime)}]
              </span>
            )}
            <span className={cn(
              "flex-1",
              log.level === 'error' && "text-red-400",
              log.level === 'success' && "text-green-400",
              log.level === 'warning' && "text-yellow-400",
              log.level === 'info' && "text-zinc-300"
            )}>
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
