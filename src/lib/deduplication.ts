/**
 * 高级去重机制
 * 支持基于时间戳、图像哈希和内容相似度的去重
 */

import { DeduplicationConfig, Subtitle } from '../types';

export interface CacheEntry {
  id: string;
  timestamp: number;
  imageHash: string;
  contentHash?: string;
  text?: string;
  metadata: Record<string, any>;
}

export class DeduplicationManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: DeduplicationConfig;
  private lruQueue: string[] = []; // LRU队列

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = {
      enabled: true,
      timeWindowMs: 500, // 0.5秒
      hashSimilarityThreshold: 0.95, // 95%相似度
      contentSimilarityThreshold: 0.95, // 95%相似度
      exactMatchRequired: false, // 是否要求完全匹配
      maxCacheSize: 1000,
      mergeTimeWindows: false, // 默认不合并时间窗口
      mergeStrategy: 'union', // 默认并集策略
      ...config
    };
  }

  /**
   * 计算图像的简单哈希（基于像素平均值）
   */
  static async calculateImageHash(imageData: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve('');
          return;
        }
        
        // 缩小图像到8x8
        ctx.drawImage(img, 0, 0, 8, 8);
        const imageData = ctx.getImageData(0, 0, 8, 8);
        const data = imageData.data;
        
        // 计算平均灰度值
        let totalGray = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          totalGray += gray;
        }
        
        const avgGray = totalGray / (data.length / 4);
        
        // 生成二进制哈希
        let hash = '';
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          hash += gray > avgGray ? '1' : '0';
        }
        
        resolve(hash);
      };
      
      img.onerror = () => resolve('');
      img.src = imageData;
    });
  }

  /**
   * 计算文本的内容哈希
   */
  static calculateContentHash(text: string): string {
    // 简单的内容哈希：移除空格和标点，转换为小写
    const normalized = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff]/g, '') // 保留字母、数字、中文
      .trim();
    
    // 使用简单的哈希函数
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return hash.toString(36);
  }

  /**
   * 计算两个哈希的相似度（汉明距离）
   */
  static calculateHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length || hash1.length === 0) {
      return 0;
    }
    
    let sameBits = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] === hash2[i]) {
        sameBits++;
      }
    }
    
    return sameBits / hash1.length;
  }

  /**
   * 计算文本相似度（基于编辑距离的简化版本）
   */
  static calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) {
      return 0;
    }

    const normalized1 = text1.toLowerCase().trim();
    const normalized2 = text2.toLowerCase().trim();

    if (normalized1 === normalized2) {
      return 1;
    }

    // 简单相似度计算：共同字符比例
    const set1 = new Set(normalized1);
    const set2 = new Set(normalized2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * 计算文本相似度（增强版） - 结合编辑距离和Jaccard相似度
   */
  private calculateTextSimilarityEnhanced(text1: string, text2: string): number {
    // 预处理
    const normalize = (text: string) =>
      text.toLowerCase().replace(/[^\w\s]/g, '').trim();

    const norm1 = normalize(text1);
    const norm2 = normalize(text2);

    // 完全相同
    if (norm1 === norm2) return 1.0;

    // 编辑距离相似度
    const levenshteinDistance = this.computeLevenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);
    const editSimilarity = maxLength > 0 ? 1 - levenshteinDistance / maxLength : 0;

    // Jaccard相似度（词集）
    const words1 = new Set(norm1.split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(norm2.split(/\s+/).filter(w => w.length > 0));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0;

    // 组合相似度（编辑距离权重更高）
    return editSimilarity * 0.7 + jaccardSimilarity * 0.3;
  }

  /**
   * 计算Levenshtein编辑距离
   */
  private computeLevenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // 创建二维数组
    const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    // 初始化第一行和第一列
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    // 填充矩阵
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // 删除
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j - 1] + cost // 替换
        );
      }
    }

    return matrix[len1][len2];
  }

  /**
   * 检查是否重复
   */
  async checkDuplicate(
    timestamp: number,
    imageData?: string,
    text?: string
  ): Promise<{ isDuplicate: boolean; duplicateId?: string; similarity?: number }> {
    if (!this.config.enabled) {
      return { isDuplicate: false };
    }
    
    // 清理过期缓存
    this.cleanupExpiredCache();
    
    let imageHash = '';
    let contentHash = '';
    
    // 计算图像哈希
    if (imageData) {
      imageHash = await DeduplicationManager.calculateImageHash(imageData);
    }
    
    // 计算内容哈希
    if (text) {
      contentHash = DeduplicationManager.calculateContentHash(text);
    }
    
    // 查找可能的重复项
    for (const [id, entry] of this.cache.entries()) {
      // 检查时间窗口
      const timeDiff = Math.abs(timestamp - entry.timestamp);
      if (timeDiff > this.config.timeWindowMs / 1000) { // 转换为秒
        continue;
      }
      
      let similarity = 0;
      
      // 检查图像相似度
      if (imageHash && entry.imageHash) {
        const hashSimilarity = DeduplicationManager.calculateHashSimilarity(imageHash, entry.imageHash);
        if (hashSimilarity >= this.config.hashSimilarityThreshold) {
          similarity = Math.max(similarity, hashSimilarity);
        }
      }
      
      // 检查内容相似度
      if (text && entry.text) {
        const textSimilarity = DeduplicationManager.calculateTextSimilarity(text, entry.text);
        const meetsThreshold = textSimilarity >= this.config.contentSimilarityThreshold;
        const meetsExactMatch = !this.config.exactMatchRequired || textSimilarity === 1;

        if (meetsThreshold && meetsExactMatch) {
          similarity = Math.max(similarity, textSimilarity);
        }
      }
      
      // 如果找到重复项
      if (similarity > 0) {
        // 更新LRU队列
        this.updateLru(id);
        return { 
          isDuplicate: true, 
          duplicateId: id,
          similarity 
        };
      }
    }
    
    return { isDuplicate: false };
  }

  /**
   * 添加条目到缓存
   */
  addToCache(
    id: string,
    timestamp: number,
    imageData?: string,
    text?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    return new Promise(async (resolve) => {
      if (!this.config.enabled) {
        resolve();
        return;
      }
      
      // 清理过期缓存
      this.cleanupExpiredCache();
      
      let imageHash = '';
      let contentHash = '';
      
      // 计算图像哈希
      if (imageData) {
        imageHash = await DeduplicationManager.calculateImageHash(imageData);
      }
      
      // 计算内容哈希
      if (text) {
        contentHash = DeduplicationManager.calculateContentHash(text);
      }
      
      const entry: CacheEntry = {
        id,
        timestamp,
        imageHash,
        contentHash,
        text,
        metadata
      };
      
      // 添加到缓存
      this.cache.set(id, entry);
      this.updateLru(id);
      
      // 如果缓存超过最大大小，移除最旧的条目
      if (this.cache.size > this.config.maxCacheSize) {
        this.removeOldestEntry();
      }
      
      resolve();
    });
  }

  /**
   * 从缓存中移除条目
   */
  removeFromCache(id: string): void {
    this.cache.delete(id);
    const index = this.lruQueue.indexOf(id);
    if (index > -1) {
      this.lruQueue.splice(index, 1);
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now() / 1000; // 转换为秒
    const expirationTime = this.config.timeWindowMs / 1000;
    
    for (const [id, entry] of this.cache.entries()) {
      if (now - entry.timestamp > expirationTime) {
        this.cache.delete(id);
        const index = this.lruQueue.indexOf(id);
        if (index > -1) {
          this.lruQueue.splice(index, 1);
        }
      }
    }
  }

  /**
   * 更新LRU队列
   */
  private updateLru(id: string): void {
    // 移除现有条目
    const index = this.lruQueue.indexOf(id);
    if (index > -1) {
      this.lruQueue.splice(index, 1);
    }
    
    // 添加到队列开头（最新）
    this.lruQueue.unshift(id);
  }

  /**
   * 移除最旧的条目
   */
  private removeOldestEntry(): void {
    if (this.lruQueue.length === 0) return;
    
    const oldestId = this.lruQueue.pop();
    if (oldestId) {
      this.cache.delete(oldestId);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    totalEntries: number;
    cacheSize: number;
    hitRate: number;
    averageAge: number;
  } {
    const now = Date.now() / 1000;
    let totalAge = 0;
    
    for (const entry of this.cache.values()) {
      totalAge += now - entry.timestamp;
    }
    
    const averageAge = this.cache.size > 0 ? totalAge / this.cache.size : 0;
    
    return {
      totalEntries: this.cache.size,
      cacheSize: this.config.maxCacheSize,
      hitRate: 0, // 需要跟踪命中率
      averageAge
    };
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.lruQueue = [];
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 如果最大缓存大小减小，移除多余的条目
    if (this.cache.size > this.config.maxCacheSize) {
      while (this.cache.size > this.config.maxCacheSize) {
        this.removeOldestEntry();
      }
    }
  }

  /**
   * 批量去重字幕数组
   * @param subtitles 字幕数组
   * @returns 去重后的字幕数组
   */
  deduplicateSubtitles(subtitles: Subtitle[]): Subtitle[] {
    if (!this.config.enabled || subtitles.length <= 1) {
      return [...subtitles];
    }

    // 1. 按开始时间排序
    const sorted = [...subtitles].sort((a, b) => a.startTime - b.startTime);
    const toKeep: Subtitle[] = [];
    const duplicateGroups: Subtitle[][] = [];

    // 2. 检测重复项
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      let isDuplicate = false;

      // 检查是否与已保留的字幕重复
      for (const kept of toKeep) {
        if (this.isDuplicateSubtitle(current, kept)) {
          isDuplicate = true;
          // 找到对应的重复组
          let groupFound = false;
          for (const group of duplicateGroups) {
            if (group[0] === kept) {
              group.push(current);
              groupFound = true;
              break;
            }
          }
          if (!groupFound) {
            duplicateGroups.push([kept, current]);
          }
          break;
        }
      }

      if (!isDuplicate) {
        toKeep.push(current);
      }
    }

    // 3. 智能合并时间窗口（如启用）
    const mergeTimeWindows = this.config.mergeTimeWindows ?? false;
    const mergeStrategy = this.config.mergeStrategy ?? 'union';

    if (mergeTimeWindows && duplicateGroups.length > 0) {
      return this.mergeDuplicateTimeWindows(toKeep, duplicateGroups, mergeStrategy);
    }

    return toKeep;
  }

  /**
   * 判断两个字幕是否重复
   */
  private isDuplicateSubtitle(a: Subtitle, b: Subtitle): boolean {
    // 1. 时间窗口检查
    const timeDiff = Math.abs(a.startTime - b.startTime);
    const timeWindowSec = this.config.timeWindowMs / 1000;
    if (timeDiff > timeWindowSec) {
      return false;
    }

    // 2. 完全匹配检查
    if (a.text === b.text) {
      return true;
    }

    // 3. 相似度检查（如果不要求完全匹配）
    if (!this.config.exactMatchRequired) {
      const similarity = this.calculateTextSimilarityEnhanced(a.text, b.text);
      return similarity >= this.config.contentSimilarityThreshold;
    }

    return false;
  }

  /**
   * 智能合并时间窗口
   */
  private mergeDuplicateTimeWindows(
    keptSubtitles: Subtitle[],
    duplicateGroups: Subtitle[][],
    strategy: 'union' | 'weighted' | 'best'
  ): Subtitle[] {
    const merged: Subtitle[] = [...keptSubtitles];

    for (const group of duplicateGroups) {
      const primary = group[0]; // 第一个（已保留的）字幕
      const duplicates = group.slice(1);
      const allSubtitles = [primary, ...duplicates];

      let mergedStartTime = primary.startTime;
      let mergedEndTime = primary.endTime;
      let mergedText = primary.text;

      switch (strategy) {
        case 'union':
          // 取所有时间范围的并集
          mergedStartTime = Math.min(...allSubtitles.map(s => s.startTime));
          mergedEndTime = Math.max(...allSubtitles.map(s => s.endTime));
          break;

        case 'weighted':
          // 基于文本长度加权平均（假设较长文本质量更高）
          const totalLength = allSubtitles.reduce((sum, s) => sum + s.text.length, 0);
          if (totalLength > 0) {
            mergedStartTime = allSubtitles.reduce((sum, s) =>
              sum + s.startTime * s.text.length, 0) / totalLength;
            mergedEndTime = allSubtitles.reduce((sum, s) =>
              sum + s.endTime * s.text.length, 0) / totalLength;
          }
          break;

        case 'best':
          // 选择文本最完整的字幕
          const bestSubtitle = allSubtitles.reduce((best, current) =>
            current.text.length > best.text.length ? current : best
          );
          mergedStartTime = bestSubtitle.startTime;
          mergedEndTime = bestSubtitle.endTime;
          mergedText = bestSubtitle.text;
          break;
      }

      // 更新已保留的字幕
      const index = merged.findIndex(s => s.id === primary.id);
      if (index !== -1) {
        merged[index] = {
          ...primary,
          startTime: mergedStartTime,
          endTime: mergedEndTime,
          text: mergedText
        };
      }
    }

    return merged;
  }

  /**
   * 同步版本的批量去重（供同步函数调用）
   */
  deduplicateSubtitlesSync(subtitles: Subtitle[]): Subtitle[] {
    return this.deduplicateSubtitles(subtitles);
  }
}

// 导出单例实例
export const deduplicationManager = new DeduplicationManager();