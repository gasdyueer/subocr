import React, { useRef, useEffect, useState } from 'react';
import { useSubtitleStore } from '../../stores/useSubtitleStore';
import { useVideoStore } from '../../stores/useVideoStore';
import { formatTime } from '../../lib/utils';
import { Trash2, Download, FileText, FileJson, Settings, Sparkles, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function SubtitleTimeline() {
  const {
    subtitles,
    optimizedSubtitles,
    optimizationEnabled,
    optimizationConfig,
    updateSubtitle,
    deleteSubtitle,
    clearSubtitles,
    optimizeSubtitles,
    setOptimizationEnabled,
    updateOptimizationConfig,
    resetOptimizationConfig
  } = useSubtitleStore();

  const { setCurrentTime } = useVideoStore();
  const listRef = useRef<HTMLDivElement>(null);
  const [showOptimizationSettings, setShowOptimizationSettings] = useState(false);
  const [showOptimizedSubtitles, setShowOptimizedSubtitles] = useState(true);

  // Auto-scroll to bottom if new subtitles added? 
  // Maybe better to keep scroll position unless user is at bottom.
  useEffect(() => {
    if (listRef.current) {
      const el = listRef.current;
      // Simple auto scroll for now
      el.scrollTop = el.scrollHeight;
    }
  }, [subtitles.length]);

  const handleExport = (format: 'srt' | 'txt' | 'json', useOptimized = true) => {
    const exportSubtitles = (useOptimized && optimizationEnabled && optimizedSubtitles.length > 0 && showOptimizedSubtitles)
      ? optimizedSubtitles
      : subtitles;

    if (exportSubtitles.length === 0) {
      toast.error("No subtitles to export");
      return;
    }

    let content = '';
    let mimeType = 'text/plain';
    let ext = 'txt';

    if (format === 'json') {
      content = JSON.stringify(exportSubtitles, null, 2);
      mimeType = 'application/json';
      ext = 'json';
    } else if (format === 'srt') {
      content = exportSubtitles.map((sub, index) => {
        const start = formatTime(sub.startTime).replace('.', ',');
        const end = formatTime(sub.endTime).replace('.', ',');
        return `${index + 1}\n${start} --> ${end}\n${sub.text}\n`;
      }).join('\n');
      ext = 'srt';
    } else {
      content = exportSubtitles.map(s => s.text).join('\n');
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles${useOptimized && optimizationEnabled ? '_optimized' : ''}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as .${ext}${useOptimized && optimizationEnabled ? ' (optimized)' : ''}`);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">
            Timeline ({subtitles.length})
            {optimizationEnabled && optimizedSubtitles.length > 0 && (
              <span className="ml-2 text-xs text-zinc-400">
                → {showOptimizedSubtitles ? `${optimizedSubtitles.length} optimized` : 'original'}
              </span>
            )}
          </h3>
          {optimizationEnabled && (
            <button
              onClick={() => setShowOptimizedSubtitles(!showOptimizedSubtitles)}
              className="p-1 hover:bg-zinc-800 rounded text-xs flex items-center gap-1"
              title={showOptimizedSubtitles ? "Show original subtitles" : "Show optimized subtitles"}
            >
              {showOptimizedSubtitles ? <Eye className="w-3 h-3 text-blue-400" /> : <EyeOff className="w-3 h-3 text-zinc-400" />}
            </button>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setShowOptimizationSettings(!showOptimizationSettings)}
            className={`p-1.5 hover:bg-zinc-800 rounded text-xs flex items-center gap-1 ${optimizationEnabled ? 'text-green-400' : 'text-zinc-400'}`}
            title="Optimization settings"
          >
            <Settings className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleExport('srt', true)}
            className="p-1.5 hover:bg-zinc-800 rounded text-xs flex items-center gap-1"
            title="Export SRT (optimized if enabled)"
          >
            <Download className="w-3 h-3" /> SRT
          </button>
          <button
            onClick={() => handleExport('json', true)}
            className="p-1.5 hover:bg-zinc-800 rounded text-xs flex items-center gap-1"
            title="Export JSON (optimized if enabled)"
          >
            <FileJson className="w-3 h-3" />
          </button>
          <button
            onClick={clearSubtitles}
            className="p-1.5 hover:bg-red-900/30 text-red-400 rounded text-xs"
            title="Clear All"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {showOptimizationSettings && (
        <div className="p-3 border-b border-zinc-800 bg-zinc-900/60">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">Subtitle Optimization</h4>
              <button
                onClick={() => resetOptimizationConfig()}
                className="text-xs text-zinc-400 hover:text-zinc-200"
                title="Reset to default settings"
              >
                Reset defaults
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-300">Enable Optimization</label>
                <button
                  onClick={() => setOptimizationEnabled(!optimizationEnabled)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                    optimizationEnabled ? 'bg-green-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      optimizationEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {optimizationEnabled && (
                <>
                  <div className="border-t border-zinc-800 pt-2">
                    <h5 className="text-xs font-medium text-zinc-400 mb-2">OCR Correction</h5>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-300">Enable OCR correction</label>
                      <button
                        onClick={() => updateOptimizationConfig({
                          correction: {
                            ...optimizationConfig.correction,
                            enabled: !optimizationConfig.correction.enabled
                          }
                        })}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                          optimizationConfig.correction.enabled ? 'bg-blue-600' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            optimizationConfig.correction.enabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-2">
                    <h5 className="text-xs font-medium text-zinc-400 mb-2">Subtitle Merging</h5>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-zinc-300">Enable merging</label>
                      <button
                        onClick={() => updateOptimizationConfig({
                          merging: {
                            ...optimizationConfig.merging,
                            enabled: !optimizationConfig.merging.enabled
                          }
                        })}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                          optimizationConfig.merging.enabled ? 'bg-blue-600' : 'bg-zinc-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            optimizationConfig.merging.enabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {optimizationConfig.merging.enabled && (
                      <div className="space-y-1 pl-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-zinc-300">Max time gap (s)</label>
                          <input
                            type="range"
                            min="0.5"
                            max="5"
                            step="0.1"
                            value={optimizationConfig.merging.maxTimeGap}
                            onChange={(e) => updateOptimizationConfig({
                              merging: {
                                ...optimizationConfig.merging,
                                maxTimeGap: parseFloat(e.target.value)
                              }
                            })}
                            className="w-24 accent-blue-500"
                          />
                          <span className="text-xs w-8 text-right">{optimizationConfig.merging.maxTimeGap.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-zinc-300">Similarity threshold</label>
                          <input
                            type="range"
                            min="0.5"
                            max="1"
                            step="0.05"
                            value={optimizationConfig.merging.similarityThreshold}
                            onChange={(e) => updateOptimizationConfig({
                              merging: {
                                ...optimizationConfig.merging,
                                similarityThreshold: parseFloat(e.target.value)
                              }
                            })}
                            className="w-24 accent-blue-500"
                          />
                          <span className="text-xs w-8 text-right">{optimizationConfig.merging.similarityThreshold.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => optimizeSubtitles()}
                      className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded flex items-center justify-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Re-optimize
                    </button>
                    <button
                      onClick={() => setShowOptimizationSettings(false)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {subtitles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm p-8 text-center">
            <FileText className="w-8 h-8 mb-2 opacity-20" />
            <p>No subtitles yet.</p>
            <p className="text-xs opacity-60">Start recognition to generate subtitles.</p>
          </div>
        ) : (
          (showOptimizedSubtitles && optimizationEnabled && optimizedSubtitles.length > 0 ? optimizedSubtitles : subtitles).map((sub) => (
            <div key={sub.id} className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm group hover:border-zinc-700 transition-colors">
              <div className="flex items-center gap-2 mb-1">
                <div 
                  className="flex items-center gap-1 font-mono text-xs text-blue-400 cursor-pointer hover:underline"
                  onClick={() => setCurrentTime(sub.startTime)}
                >
                  <input 
                    className="bg-transparent w-16 outline-none hover:bg-zinc-800 rounded px-0.5"
                    value={formatTime(sub.startTime)}
                    onChange={(e) => {
                      // Simple parsing logic would be needed here for full editing
                    }}
                    readOnly
                  />
                  <span>→</span>
                  <input 
                    className="bg-transparent w-16 outline-none hover:bg-zinc-800 rounded px-0.5"
                    value={formatTime(sub.endTime)}
                    readOnly
                  />
                </div>
                <div className="flex-1" />
                <button 
                  onClick={() => deleteSubtitle(sub.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-900/50 text-red-500 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <textarea
                value={sub.text}
                onChange={(e) => updateSubtitle(sub.id, { text: e.target.value })}
                className="w-full bg-transparent resize-none outline-none text-zinc-200 placeholder-zinc-600"
                rows={2}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
