/**
 * 字幕优化模块
 * 用于合并相邻字幕、优化时间轴、提高可读性
 */

import { Subtitle, SubtitleMergingConfig, SubtitleOptimizerConfig } from '../types';

export class SubtitleOptimizer {
  private config: SubtitleOptimizerConfig;

  constructor(config?: Partial<SubtitleOptimizerConfig>) {
    this.config = {
      enabled: true,
      merging: {
        enabled: true,
        maxTimeGap: 2,
        similarityThreshold: 0.85,
        maxSubtitleLength: 100
      },
      minSubtitleDuration: 0.5,
      maxSubtitleDuration: 5,
      ensureContinuity: true,
      removeEmpty: true,
      ...config
    };

    // 如果提供了merging配置，合并它
    if (config?.merging) {
      this.config.merging = { ...this.config.merging, ...config.merging };
    }
  }

  /**
   * 优化字幕序列
   * @param subtitles 原始字幕数组
   * @returns 优化后的字幕数组
   */
  optimize(subtitles: Subtitle[]): Subtitle[] {
    if (!this.config.enabled || subtitles.length === 0) {
      return [...subtitles];
    }

    let result = [...subtitles];

    // 1. 移除空字幕
    if (this.config.removeEmpty) {
      result = this.removeEmptySubtitles(result);
    }

    // 2. 合并相邻字幕
    if (this.config.merging.enabled) {
      result = this.mergeAdjacentSubtitles(result);
    }

    // 3. 调整字幕持续时间
    result = this.adjustDurations(result);

    // 4. 确保时间轴连续性
    if (this.config.ensureContinuity) {
      result = this.ensureTimeContinuity(result);
    }

    // 5. 重新生成ID（可选）
    result = this.regenerateIds(result);

    return result;
  }

  /**
   * 移除空字幕或纯空格字幕
   */
  private removeEmptySubtitles(subtitles: Subtitle[]): Subtitle[] {
    return subtitles.filter(sub => {
      const trimmedText = sub.text.trim();
      return trimmedText.length > 0 && trimmedText !== '';
    });
  }

  /**
   * 合并相邻字幕
   */
  private mergeAdjacentSubtitles(subtitles: Subtitle[]): Subtitle[] {
    if (subtitles.length <= 1) {
      return subtitles;
    }

    const merged: Subtitle[] = [];
    let current = { ...subtitles[0] };

    for (let i = 1; i < subtitles.length; i++) {
      const next = subtitles[i];
      const timeGap = next.startTime - current.endTime;
      const similarity = this.calculateSimilarity(current.text, next.text);

      const shouldMerge =
        timeGap <= this.config.merging.maxTimeGap &&
        similarity >= this.config.merging.similarityThreshold &&
        this.canMergeText(current.text, next.text);

      if (shouldMerge) {
        // 合并字幕
        current = {
          ...current,
          endTime: next.endTime,
          text: this.mergeText(current.text, next.text)
        };
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
    return merged;
  }

  /**
   * 计算文本相似度（基于共同单词比例）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) {
      return 0;
    }

    const normalized1 = text1.toLowerCase().trim();
    const normalized2 = text2.toLowerCase().trim();

    if (normalized1 === normalized2) {
      return 1;
    }

    // 分词（简单空格分割）
    const words1 = normalized1.split(/\s+/).filter(w => w.length > 0);
    const words2 = normalized2.split(/\s+/).filter(w => w.length > 0);

    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }

    // 计算共同单词比例
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 检查是否可以合并文本（长度限制）
   */
  private canMergeText(text1: string, text2: string): boolean {
    const mergedLength = text1.length + text2.length + 1; // +1 for space
    return mergedLength <= this.config.merging.maxSubtitleLength;
  }

  /**
   * 合并两个文本
   */
  private mergeText(text1: string, text2: string): string {
    const trimmed1 = text1.trim();
    const trimmed2 = text2.trim();

    if (!trimmed1) return trimmed2;
    if (!trimmed2) return trimmed1;

    // 如果text2是text1的子串或相似，避免重复
    if (trimmed1.includes(trimmed2) || trimmed2.includes(trimmed1)) {
      return trimmed1.length > trimmed2.length ? trimmed1 : trimmed2;
    }

    // 否则合并，用空格分隔
    return `${trimmed1} ${trimmed2}`.trim();
  }

  /**
   * 调整字幕持续时间
   */
  private adjustDurations(subtitles: Subtitle[]): Subtitle[] {
    return subtitles.map(sub => {
      const duration = sub.endTime - sub.startTime;
      let newStartTime = sub.startTime;
      let newEndTime = sub.endTime;

      // 确保最小持续时间
      if (duration < this.config.minSubtitleDuration) {
        newEndTime = newStartTime + this.config.minSubtitleDuration;
      }

      // 确保最大持续时间
      if (duration > this.config.maxSubtitleDuration) {
        newEndTime = newStartTime + this.config.maxSubtitleDuration;
      }

      // 如果调整了时间，返回新字幕
      if (newStartTime !== sub.startTime || newEndTime !== sub.endTime) {
        return {
          ...sub,
          startTime: newStartTime,
          endTime: newEndTime
        };
      }

      return sub;
    });
  }

  /**
   * 确保时间轴连续性（无重叠，最小间隔）
   */
  private ensureTimeContinuity(subtitles: Subtitle[]): Subtitle[] {
    if (subtitles.length <= 1) {
      return subtitles;
    }

    const result: Subtitle[] = [];
    const minGap = 0.1; // 最小间隔0.1秒

    for (let i = 0; i < subtitles.length; i++) {
      const current = { ...subtitles[i] };

      // 如果是第一个字幕，确保开始时间不早于0
      if (i === 0) {
        current.startTime = Math.max(0, current.startTime);
      }

      // 如果不是最后一个字幕，检查与下一个字幕的重叠
      if (i < subtitles.length - 1) {
        const next = subtitles[i + 1];

        // 如果当前字幕结束时间晚于下一个字幕开始时间，调整
        if (current.endTime > next.startTime) {
          current.endTime = next.startTime - minGap;
        }

        // 确保最小间隔
        if (current.endTime + minGap > next.startTime) {
          current.endTime = next.startTime - minGap;
        }

        // 确保持续时间不为负
        if (current.endTime <= current.startTime) {
          current.endTime = current.startTime + this.config.minSubtitleDuration;
        }
      }

      result.push(current);
    }

    return result;
  }

  /**
   * 重新生成字幕ID
   */
  private regenerateIds(subtitles: Subtitle[]): Subtitle[] {
    return subtitles.map((sub, index) => ({
      ...sub,
      id: `sub_optimized_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));
  }

  /**
   * 获取字幕统计信息
   */
  getStats(subtitles: Subtitle[]): {
    total: number;
    totalDuration: number;
    averageDuration: number;
    averageTextLength: number;
    emptyCount: number;
  } {
    const validSubtitles = subtitles.filter(sub => sub.text.trim().length > 0);
    const totalDuration = validSubtitles.reduce((sum, sub) => sum + (sub.endTime - sub.startTime), 0);
    const totalTextLength = validSubtitles.reduce((sum, sub) => sum + sub.text.length, 0);
    const emptyCount = subtitles.length - validSubtitles.length;

    return {
      total: subtitles.length,
      totalDuration,
      averageDuration: validSubtitles.length > 0 ? totalDuration / validSubtitles.length : 0,
      averageTextLength: validSubtitles.length > 0 ? totalTextLength / validSubtitles.length : 0,
      emptyCount
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<SubtitleOptimizerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 合并merging配置
    if (newConfig.merging) {
      this.config.merging = { ...this.config.merging, ...newConfig.merging };
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): SubtitleOptimizerConfig {
    return { ...this.config };
  }

  /**
   * 创建默认的单例实例
   */
  static createDefault(): SubtitleOptimizer {
    return new SubtitleOptimizer();
  }
}