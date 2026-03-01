import { create } from 'zustand';
import { Subtitle, OptimizationConfig } from '../types';
import { OcrCorrector } from '../lib/ocr-corrector';
import { SubtitleOptimizer } from '../lib/subtitle-optimizer';

interface SubtitleState {
  subtitles: Subtitle[];
  optimizedSubtitles: Subtitle[];
  optimizationEnabled: boolean;
  optimizationConfig: OptimizationConfig;

  // 基本操作
  addSubtitle: (subtitle: Subtitle) => void;
  updateSubtitle: (id: string, updates: Partial<Subtitle>) => void;
  deleteSubtitle: (id: string) => void;
  clearSubtitles: () => void;
  setSubtitles: (subtitles: Subtitle[]) => void;

  // 优化操作
  optimizeSubtitles: () => Promise<void>;
  applyOptimization: (subtitles: Subtitle[]) => Subtitle[];
  setOptimizationEnabled: (enabled: boolean) => void;
  updateOptimizationConfig: (config: Partial<OptimizationConfig>) => void;
  resetOptimizationConfig: () => void;
}

// 默认优化配置
const defaultOptimizationConfig: OptimizationConfig = {
  enabled: true,
  deduplication: {
    enabled: true,
    timeWindowMs: 2000,
    hashSimilarityThreshold: 0.85,
    contentSimilarityThreshold: 0.85,
    exactMatchRequired: false,
    maxCacheSize: 1000
  },
  correction: {
    enabled: true,
    rules: [],
    useDefaultRules: true
  },
  merging: {
    enabled: true,
    maxTimeGap: 5,
    similarityThreshold: 0.75,
    maxSubtitleLength: 120
  }
};

export const useSubtitleStore = create<SubtitleState>((set, get) => ({
  subtitles: [],
  optimizedSubtitles: [],
  optimizationEnabled: true,
  optimizationConfig: defaultOptimizationConfig,

  // 基本操作
  addSubtitle: (subtitle) => set((state) => {
    console.log(`[SubtitleStore] Adding subtitle:`, subtitle);
    console.log(`[SubtitleStore] Current subtitles before add: ${state.subtitles.length}`);

    const newSubtitles = [...state.subtitles, subtitle].sort((a, b) => a.startTime - b.startTime);

    console.log(`[SubtitleStore] New subtitles count: ${newSubtitles.length}`);
    console.log(`[SubtitleStore] First few subtitles:`, newSubtitles.slice(0, 3));

    // 如果优化启用，自动重新优化
    if (state.optimizationEnabled) {
      const optimized = get().applyOptimization(newSubtitles);
      return {
        subtitles: newSubtitles,
        optimizedSubtitles: optimized
      };
    }

    return { subtitles: newSubtitles };
  }),

  updateSubtitle: (id, updates) => set((state) => {
    const newSubtitles = state.subtitles.map((sub) =>
      sub.id === id ? { ...sub, ...updates } : sub
    );

    // 如果优化启用，自动重新优化
    if (state.optimizationEnabled) {
      const optimized = get().applyOptimization(newSubtitles);
      return {
        subtitles: newSubtitles,
        optimizedSubtitles: optimized
      };
    }

    return { subtitles: newSubtitles };
  }),

  deleteSubtitle: (id) => set((state) => {
    const newSubtitles = state.subtitles.filter((sub) => sub.id !== id);

    // 如果优化启用，自动重新优化
    if (state.optimizationEnabled) {
      const optimized = get().applyOptimization(newSubtitles);
      return {
        subtitles: newSubtitles,
        optimizedSubtitles: optimized
      };
    }

    return { subtitles: newSubtitles };
  }),

  clearSubtitles: () => set({
    subtitles: [],
    optimizedSubtitles: []
  }),

  setSubtitles: (subtitles) => set((state) => {
    const sortedSubtitles = [...subtitles].sort((a, b) => a.startTime - b.startTime);

    // 如果优化启用，自动优化
    if (state.optimizationEnabled) {
      const optimized = get().applyOptimization(sortedSubtitles);
      return {
        subtitles: sortedSubtitles,
        optimizedSubtitles: optimized
      };
    }

    return { subtitles: sortedSubtitles };
  }),

  // 优化操作
  optimizeSubtitles: async () => {
    const state = get();
    const optimized = state.applyOptimization(state.subtitles);
    set({ optimizedSubtitles: optimized });
    console.log(`[SubtitleStore] Optimized subtitles: ${optimized.length} from ${state.subtitles.length}`);
  },

  applyOptimization: (subtitles: Subtitle[]): Subtitle[] => {
    const { optimizationConfig } = get();

    if (!optimizationConfig.enabled || subtitles.length === 0) {
      return [...subtitles];
    }

    let result = [...subtitles];

    try {
      // 1. 应用OCR错误纠正
      if (optimizationConfig.correction.enabled) {
        const corrector = new OcrCorrector(optimizationConfig.correction);
        result = result.map(sub => ({
          ...sub,
          text: corrector.correct(sub.text)
        }));
      }

      // 2. 应用字幕优化（合并、时间轴调整等）
      const optimizerConfig = {
        enabled: true,
        merging: optimizationConfig.merging,
        minSubtitleDuration: 0.5,
        maxSubtitleDuration: 5,
        ensureContinuity: true,
        removeEmpty: true
      };

      const optimizer = new SubtitleOptimizer(optimizerConfig);
      result = optimizer.optimize(result);

      console.log(`[SubtitleStore] Optimization applied: ${subtitles.length} → ${result.length} subtitles`);
    } catch (error) {
      console.error('[SubtitleStore] Optimization error:', error);
      // 出错时返回原始字幕
      return [...subtitles];
    }

    return result;
  },

  setOptimizationEnabled: (enabled) => set((state) => {
    // 如果启用优化，重新计算优化字幕
    if (enabled) {
      const optimized = state.applyOptimization(state.subtitles);
      return {
        optimizationEnabled: enabled,
        optimizedSubtitles: optimized
      };
    } else {
      // 如果禁用优化，清空优化字幕
      return {
        optimizationEnabled: enabled,
        optimizedSubtitles: []
      };
    }
  }),

  updateOptimizationConfig: (config) => set((state) => {
    const newConfig = {
      ...state.optimizationConfig,
      ...config,
      // 深度合并嵌套配置（如果提供了配置）
      deduplication: { ...state.optimizationConfig.deduplication, ...(config.deduplication || {}) },
      correction: { ...state.optimizationConfig.correction, ...(config.correction || {}) },
      merging: { ...state.optimizationConfig.merging, ...(config.merging || {}) }
    };

    // 如果优化启用，重新计算优化字幕
    if (state.optimizationEnabled) {
      const optimized = state.applyOptimization(state.subtitles);
      return {
        optimizationConfig: newConfig,
        optimizedSubtitles: optimized
      };
    }

    return {
      optimizationConfig: newConfig
    };
  }),

  resetOptimizationConfig: () => set((state) => {
    // 如果优化启用，重新计算优化字幕
    if (state.optimizationEnabled) {
      const optimized = state.applyOptimization(state.subtitles);
      return {
        optimizationConfig: defaultOptimizationConfig,
        optimizedSubtitles: optimized
      };
    }

    return {
      optimizationConfig: defaultOptimizationConfig
    };
  })
}));
