import React from 'react';
import { VideoUploader } from './components/video/VideoUploader';
import { VideoPlayer } from './components/video/VideoPlayer';
import { OcrSettings } from './components/ocr/OcrSettings';
import { SubtitleTimeline } from './components/timeline/SubtitleTimeline';
import { LogPanel } from './components/logs/LogPanel';
import { useVideoStore } from './stores/useVideoStore';
import { Toaster } from 'sonner';
import { ScanText } from 'lucide-react';

function App() {
  const file = useVideoStore((state) => state.file);

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-blue-500/30">
      <Toaster position="top-right" theme="dark" />
      
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 flex items-center px-6 bg-zinc-950/50 backdrop-blur fixed top-0 w-full z-50">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <ScanText className="w-4 h-4 text-white" />
          </div>
          <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            SubOCR
          </span>
          <span className="text-xs font-normal text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded ml-2">
            v1.0
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm text-zinc-400">
          <a href="https://lmstudio.ai/" target="_blank" className="hover:text-white transition-colors">
            LM Studio
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Docs
          </a>
        </div>
      </header>

      {/* Main Layout */}
      <main className="pt-14 h-screen flex flex-col md:flex-row overflow-hidden">
        
        {/* Left Sidebar - Settings & Logs */}
        <aside className="w-full md:w-80 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0 z-20">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <OcrSettings />
          </div>
          <div className="h-1/3 border-t border-zinc-800 min-h-[200px]">
            <LogPanel />
          </div>
        </aside>

        {/* Center - Video Area */}
        <section className="flex-1 flex flex-col min-w-0 bg-zinc-950/50 relative">
          <div className="flex-1 p-6 flex flex-col overflow-hidden">
            {!file ? (
              <VideoUploader />
            ) : (
              <VideoPlayer />
            )}
          </div>
        </section>

        {/* Right Sidebar - Timeline */}
        <aside className="w-full md:w-80 border-l border-zinc-800 bg-zinc-950 shrink-0 z-20">
          <SubtitleTimeline />
        </aside>

      </main>
    </div>
  );
}

export default App;
