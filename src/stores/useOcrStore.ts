import { create } from 'zustand';
import { OcrConfig, ProcessingStats, LogEntry } from '../types';
import { requestQueue } from '../lib/request-queue';
import { workerManager } from '../workers/worker-manager';

interface OcrState {
  config: OcrConfig;
  stats: ProcessingStats;
  logs: LogEntry[];
  isHealthy: boolean;
  availableModels: string[];
  queueStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  };
  workerStats: {
    screenshotWorkers: number;
    ocrWorkers: number;
    activeScreenshotTasks: number;
    activeOcrTasks: number;
  };

  setConfig: (config: Partial<OcrConfig>) => void;
  setStats: (stats: Partial<ProcessingStats>) => void;
  setQueueStats: (queueStats: Partial<OcrState['queueStats']>) => void;
  setWorkerStats: (workerStats: Partial<OcrState['workerStats']>) => void;
  addLog: (level: LogEntry['level'], message: string, frameTime?: number) => void;
  clearLogs: () => void;
  setIsHealthy: (isHealthy: boolean) => void;
  setAvailableModels: (models: string[]) => void;
  resetStats: () => void;
  startProcessing: () => void;
  stopProcessing: () => void;
  pauseProcessing: () => void;
  resumeProcessing: () => void;
  clearQueue: () => void;
}

const DEFAULT_CONFIG: OcrConfig = {
  apiEndpoint: 'http://localhost:1224', // Umi-OCR默认端口
  model: 'Umi-OCR: PaddleOCR (默认)', // Umi-OCR使用内置引擎
  keepAlive: 300, // 5分钟（向后兼容）
  temperature: 0.1, // 向后兼容
  concurrency: 2,
  interval: 1.0, // 每秒1帧
  ocrBackend: 'umi-ocr', // OCR后端类型
  serviceName: 'Umi-OCR服务', // 服务显示名称
};

const DEFAULT_STATS: ProcessingStats = {
  totalFrames: 0,
  processedFrames: 0,
  queued: 0,
  success: 0,
  failed: 0,
  status: 'idle',
};

const DEFAULT_QUEUE_STATS = {
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  total: 0,
};

const DEFAULT_WORKER_STATS = {
  screenshotWorkers: 0,
  ocrWorkers: 0,
  activeScreenshotTasks: 0,
  activeOcrTasks: 0,
};

export const useOcrStore = create<OcrState>((set, get) => ({
  config: DEFAULT_CONFIG,
  stats: DEFAULT_STATS,
  logs: [],
  isHealthy: false,
  availableModels: [],
  queueStats: DEFAULT_QUEUE_STATS,
  workerStats: DEFAULT_WORKER_STATS,

  setConfig: (newConfig) => set((state) => {
    const updatedConfig = { ...state.config, ...newConfig };
    // 确保数值字段有效
    if (typeof updatedConfig.concurrency === 'number' && isNaN(updatedConfig.concurrency)) {
      updatedConfig.concurrency = 2;
    } else if (typeof updatedConfig.concurrency !== 'number') {
      updatedConfig.concurrency = 2;
    }
    if (typeof updatedConfig.interval === 'number' && isNaN(updatedConfig.interval)) {
      updatedConfig.interval = 1.0;
    } else if (typeof updatedConfig.interval !== 'number') {
      updatedConfig.interval = 1.0;
    }
    // 确保值在合理范围内
    updatedConfig.concurrency = Math.max(1, Math.min(10, updatedConfig.concurrency));
    updatedConfig.interval = Math.max(0.1, updatedConfig.interval);
    return { config: updatedConfig };
  }),
  setStats: (newStats) => set((state) => ({ stats: { ...state.stats, ...newStats } })),
  setQueueStats: (newQueueStats) => set((state) => ({
    queueStats: { ...state.queueStats, ...newQueueStats }
  })),
  setWorkerStats: (newWorkerStats) => set((state) => ({
    workerStats: { ...state.workerStats, ...newWorkerStats }
  })),
  addLog: (level, message, frameTime) => set((state) => ({
    logs: [
      {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        level,
        message,
        frameTime,
      },
      ...state.logs.slice(0, 999), // Keep last 1000 logs
    ],
  })),
  clearLogs: () => set({ logs: [] }),
  setIsHealthy: (isHealthy) => set({ isHealthy }),
  setAvailableModels: (availableModels) => set({ availableModels }),
  resetStats: () => set({
    stats: DEFAULT_STATS,
    queueStats: DEFAULT_QUEUE_STATS,
    workerStats: DEFAULT_WORKER_STATS,
  }),
  
  startProcessing: () => {
    set({ stats: { ...get().stats, status: 'running', startTime: Date.now() } });
    get().addLog('info', 'Started OCR processing with queue system');
  },
  
  stopProcessing: () => {
    set({ stats: { ...get().stats, status: 'idle', endTime: Date.now() } });
    requestQueue.clearQueue();
    get().addLog('info', 'Stopped OCR processing and cleared queue');
  },
  
  pauseProcessing: () => {
    set({ stats: { ...get().stats, status: 'paused' } });
    get().addLog('info', 'Paused OCR processing');
  },
  
  resumeProcessing: () => {
    set({ stats: { ...get().stats, status: 'running' } });
    get().addLog('info', 'Resumed OCR processing');
  },
  
  clearQueue: () => {
    requestQueue.clearQueue();
    set({ queueStats: DEFAULT_QUEUE_STATS });
    get().addLog('info', 'Cleared processing queue');
  },
}));
