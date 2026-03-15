export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Subtitle {
  id: string;
  startTime: number;   // Seconds
  endTime: number;
  text: string;
}

// Umi-OCR 相关类型
export interface UmiOcrResponse {
  code: number;           // 100: 成功, 101: 无文本, 其他: 失败
  data: UmiOcrDataItem[] | string;
  time: number;           // 识别耗时（秒）
  timestamp: number;      // 任务开始时间戳
}

export interface UmiOcrDataItem {
  text: string;           // 识别文本
  score: number;          // 置信度 (0~1)
  box: number[][];        // 文本框坐标 [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
  end: string;            // 结束符（空格、换行等）
}

export interface UmiOcrOption {
  title: string;
  toolTip?: string;
  default: any;
  type: 'enum' | 'boolean' | 'text' | 'number' | 'var';
  optionsList?: [string, string][];
  isInt?: boolean;
}

export interface UmiOcrOptions {
  [key: string]: UmiOcrOption;
}

export interface OcrConfig {
  apiEndpoint: string;
  model: string;
  keepAlive: number;
  temperature: number;
  concurrency: number;
  interval: number;    // Seconds per frame
  ocrBackend: 'umi-ocr' | 'lmstudio' | 'tesseract'; // OCR后端类型
  serviceName: string; // 服务显示名称
}

export interface ProcessingStats {
  totalFrames: number;
  processedFrames: number;
  queued: number;
  success: number;
  failed: number;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  startTime?: number;
  endTime?: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
  frameTime?: number;
}

// 优化相关类型
export interface DeduplicationConfig {
  enabled: boolean;
  timeWindowMs: number; // 时间窗口（毫秒）
  hashSimilarityThreshold: number; // 哈希相似度阈值（0-1）
  contentSimilarityThreshold: number; // 内容相似度阈值（0-1）
  exactMatchRequired: boolean; // 是否要求完全匹配
  maxCacheSize: number; // 最大缓存条目数

  // 新增字段（向后兼容，提供默认值）
  mergeTimeWindows?: boolean; // 是否合并时间窗口，默认false
  mergeStrategy?: 'union' | 'weighted' | 'best'; // 合并策略，默认'union'
}

export interface CorrectionRule {
  pattern: string;      // 正则表达式模式字符串
  replacement: string;  // 替换文本
}

export interface OcrCorrectionConfig {
  enabled: boolean;
  rules: CorrectionRule[]; // 用户自定义规则
  useDefaultRules: boolean; // 是否使用默认规则
}

export interface SubtitleMergingConfig {
  enabled: boolean;
  maxTimeGap: number;           // 最大合并时间间隔（秒）
  similarityThreshold: number;  // 合并相似度阈值（0-1）
  maxSubtitleLength: number;    // 最大字幕长度（字符）
}

export interface SubtitleOptimizerConfig {
  enabled: boolean;
  merging: SubtitleMergingConfig;
  minSubtitleDuration: number;  // 最小字幕持续时间（秒）
  maxSubtitleDuration: number;  // 最大字幕持续时间（秒）
  ensureContinuity: boolean;    // 确保时间轴连续性
  removeEmpty: boolean;         // 移除空字幕
}

export interface OptimizationConfig {
  deduplication: DeduplicationConfig;
  correction: OcrCorrectionConfig;
  merging: SubtitleMergingConfig;
  enabled: boolean; // 全局优化开关
}
