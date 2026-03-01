import { OcrConfig } from '../types';
import { workerManager } from '../workers/worker-manager';

// 请求队列类型定义
export interface QueueItem {
  id: string;
  type: 'screenshot' | 'ocr';
  timestamp: number;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  data: any;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageProcessingTime: number;
  successRate: number;
}

export interface DeduplicationConfig {
  enabled: boolean;
  windowMs: number; // 去重时间窗口（毫秒）
  hashThreshold: number; // 图像哈希相似度阈值（0-1）
}

export interface QueueConfig {
  maxConcurrent: number;
  deduplication: DeduplicationConfig;
  retryAttempts: number;
  retryDelay: number;
  timeout: number;
}

// 默认配置
const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 4,
  deduplication: {
    enabled: true,
    windowMs: 1000, // 1秒内去重
    hashThreshold: 0.95 // 95%相似度视为重复
  },
  retryAttempts: 2,
  retryDelay: 1000,
  timeout: 30000 // 30秒超时
};

// 简单的图像哈希计算（用于去重）
function calculateSimpleHash(imageData: string): string {
  // 对于base64图像数据，我们可以使用前100个字符作为简单哈希
  // 实际应用中应该使用更复杂的图像哈希算法
  return imageData.substring(0, 100) + '_' + imageData.length;
}

export class RequestQueue {
  private queue: QueueItem[] = [];
  private processing: Set<string> = new Set();
  private completed: Map<string, QueueItem> = new Map();
  private config: QueueConfig;
  private stats: QueueStats;
  private eventListeners = new Map<string, Set<Function>>();
  private deduplicationCache = new Map<string, { timestamp: number; itemId: string }>();

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      averageProcessingTime: 0,
      successRate: 1
    };
    
    // 监听Worker管理器事件
    workerManager.on('taskComplete', this.handleWorkerTaskComplete.bind(this));
    workerManager.on('taskError', this.handleWorkerTaskError.bind(this));
    workerManager.on('statsUpdate', this.handleWorkerStatsUpdate.bind(this));
    
    // 启动队列处理器
    this.startProcessor();
  }

  // 添加截图请求到队列
  async enqueueScreenshot(
    videoElement: HTMLVideoElement,
    cropRect: { x: number; y: number; width: number; height: number },
    timestamp: number,
    options: { priority?: number; deduplicate?: boolean } = {}
  ): Promise<string> {
    const itemId = `screenshot_${timestamp}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 检查去重
    if (options.deduplicate !== false && this.config.deduplication.enabled) {
      const duplicateId = this.checkDuplicate('screenshot', timestamp, null);
      if (duplicateId) {
        console.log(`[Queue] Duplicate screenshot detected at ${timestamp}s, reusing result`);
        return duplicateId;
      }
    }
    
    const item: QueueItem = {
      id: itemId,
      type: 'screenshot',
      timestamp,
      priority: options.priority || 5,
      status: 'pending',
      data: { videoElement, cropRect },
      createdAt: Date.now()
    };
    
    this.addToQueue(item);
    return itemId;
  }

  // 添加OCR请求到队列
  async enqueueOcr(
    imageData: string,
    config: OcrConfig,
    timestamp: number,
    requestId: string,
    options: { priority?: number; deduplicate?: boolean } = {}
  ): Promise<string> {
    const itemId = `ocr_${timestamp}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 检查去重
    if (options.deduplicate !== false && this.config.deduplication.enabled) {
      const duplicateId = this.checkDuplicate('ocr', timestamp, imageData);
      if (duplicateId) {
        console.log(`[Queue] Duplicate OCR detected at ${timestamp}s, reusing result`);
        return duplicateId;
      }
    }
    
    const item: QueueItem = {
      id: itemId,
      type: 'ocr',
      timestamp,
      priority: options.priority || 5,
      status: 'pending',
      data: { imageData, config, requestId },
      createdAt: Date.now()
    };
    
    this.addToQueue(item);
    return itemId;
  }

  // 添加项目到队列
  private addToQueue(item: QueueItem) {
    // 按优先级插入队列
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (item.priority > this.queue[i].priority) {
        this.queue.splice(i, 0, item);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.queue.push(item);
    }
    
    // 更新去重缓存
    if (this.config.deduplication.enabled) {
      const hash = item.type === 'ocr' ? calculateSimpleHash(item.data.imageData) : `screenshot_${item.timestamp}`;
      this.deduplicationCache.set(hash, {
        timestamp: Date.now(),
        itemId: item.id
      });
    }
    
    this.updateStats();
    this.emit('itemEnqueued', item);
    
    // 触发队列处理
    this.processQueue();
  }

  // 检查重复项
  private checkDuplicate(type: 'screenshot' | 'ocr', timestamp: number, imageData: string | null): string | null {
    const now = Date.now();
    const windowMs = this.config.deduplication.windowMs;
    
    // 清理过期缓存
    for (const [hash, entry] of this.deduplicationCache.entries()) {
      if (now - entry.timestamp > windowMs) {
        this.deduplicationCache.delete(hash);
      }
    }
    
    // 检查时间戳相近的项
    if (type === 'screenshot') {
      const hash = `screenshot_${Math.floor(timestamp)}`;
      const entry = this.deduplicationCache.get(hash);
      if (entry && now - entry.timestamp <= windowMs) {
        return entry.itemId;
      }
    } else if (type === 'ocr' && imageData) {
      const hash = calculateSimpleHash(imageData);
      const entry = this.deduplicationCache.get(hash);
      if (entry && now - entry.timestamp <= windowMs) {
        return entry.itemId;
      }
    }
    
    return null;
  }

  // 启动队列处理器
  private startProcessor() {
    // 使用setInterval定期处理队列
    setInterval(() => {
      this.processQueue();
    }, 100); // 每100毫秒检查一次
  }

  // 处理队列
  private processQueue() {
    // 检查并发限制
    if (this.processing.size >= this.config.maxConcurrent) {
      return;
    }
    
    // 获取待处理的项目
    const pendingItems = this.queue.filter(item => item.status === 'pending');
    if (pendingItems.length === 0) {
      return;
    }
    
    // 按优先级排序并处理
    const itemsToProcess = pendingItems
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.config.maxConcurrent - this.processing.size);
    
    for (const item of itemsToProcess) {
      this.processItem(item);
    }
  }

  // 处理单个项目
  private async processItem(item: QueueItem) {
    // 更新状态
    item.status = 'processing';
    item.startedAt = Date.now();
    this.processing.add(item.id);
    
    console.log(`[Queue] Processing item ${item.id} (${item.type}) at timestamp ${item.timestamp}`);
    
    this.updateStats();
    this.emit('itemStarted', item);
    
    try {
      let result: any;
      
      if (item.type === 'screenshot') {
        // 处理截图请求
        const { videoElement, cropRect } = item.data;
        console.log(`[Queue] Capturing screenshot for item ${item.id}`);
        result = await workerManager.captureScreenshot(
          videoElement,
          cropRect,
          item.timestamp,
          {
            priority: item.priority,
            timeout: this.config.timeout
          }
        );
        console.log(`[Queue] Screenshot captured for item ${item.id}, result type: ${typeof result}`);
      } else {
        // 处理OCR请求
        const { imageData, config, requestId } = item.data;
        console.log(`[Queue] Submitting OCR request for item ${item.id}, requestId: ${requestId}`);
        result = await workerManager.submitOcrRequest(
          imageData,
          config,
          item.timestamp,
          requestId,
          {
            priority: item.priority,
            timeout: this.config.timeout
          }
        );
        console.log(`[Queue] OCR request completed for item ${item.id}, result:`, result);
      }
      
      // 处理成功
      item.status = 'completed';
      item.completedAt = Date.now();
      item.result = result;
      
      console.log(`[Queue] Item ${item.id} completed successfully, emitting itemCompleted event`);
      console.log(`[Queue] Item result structure:`, JSON.stringify(result, null, 2));
      
      this.processing.delete(item.id);
      this.completed.set(item.id, item);
      
      this.updateStats();
      this.emit('itemCompleted', item);
      
    } catch (error) {
      // 处理失败
      item.status = 'failed';
      item.completedAt = Date.now();
      item.error = error instanceof Error ? error.message : String(error);
      
      console.error(`[Queue] Item ${item.id} failed:`, error);
      
      this.processing.delete(item.id);
      
      this.updateStats();
      this.emit('itemFailed', item);
      
      // 重试逻辑
      if (this.config.retryAttempts > 0) {
        const retryCount = (item.data.retryCount || 0) + 1;
        if (retryCount <= this.config.retryAttempts) {
          console.log(`[Queue] Retrying item ${item.id} (attempt ${retryCount}/${this.config.retryAttempts})`);
          
          setTimeout(() => {
            item.data.retryCount = retryCount;
            item.status = 'pending';
            this.addToQueue(item);
          }, this.config.retryDelay);
        }
      }
    }
  }

  // 处理Worker任务完成
  private handleWorkerTaskComplete(event: any) {
    // 这里可以添加额外的处理逻辑
    console.log(`[Queue] Worker task completed: ${event.taskId}`);
  }

  // 处理Worker任务错误
  private handleWorkerTaskError(event: any) {
    console.error(`[Queue] Worker task error: ${event.taskId}`, event.error);
  }

  // 处理Worker统计更新
  private handleWorkerStatsUpdate(stats: any) {
    // 这里可以同步Worker统计信息
  }

  // 获取项目状态
  getItemStatus(itemId: string): QueueItem | null {
    // 检查处理中的项目
    for (const item of this.queue) {
      if (item.id === itemId) {
        return { ...item };
      }
    }
    
    // 检查已完成的项目
    const completedItem = this.completed.get(itemId);
    if (completedItem) {
      return { ...completedItem };
    }
    
    return null;
  }

  // 获取队列统计信息
  getStats(): QueueStats {
    return { ...this.stats };
  }

  // 获取队列内容
  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  // 获取处理中的项目
  getProcessingItems(): QueueItem[] {
    return this.queue.filter(item => item.status === 'processing');
  }

  // 获取已完成的项目
  getCompletedItems(): QueueItem[] {
    return Array.from(this.completed.values());
  }

  // 取消项目
  cancelItem(itemId: string): boolean {
    const itemIndex = this.queue.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      return false;
    }
    
    const item = this.queue[itemIndex];
    item.status = 'cancelled';
    item.completedAt = Date.now();
    
    // 从处理中移除
    this.processing.delete(itemId);
    
    // 移动到已完成
    this.completed.set(itemId, item);
    this.queue.splice(itemIndex, 1);
    
    this.updateStats();
    this.emit('itemCancelled', item);
    
    return true;
  }

  // 清空队列
  clearQueue(): void {
    // 取消所有待处理项目
    for (const item of this.queue) {
      if (item.status === 'pending') {
        item.status = 'cancelled';
        item.completedAt = Date.now();
        this.completed.set(item.id, item);
      }
    }
    
    this.queue = [];
    this.processing.clear();
    
    this.updateStats();
    this.emit('queueCleared', null);
  }

  // 更新统计信息
  private updateStats() {
    const total = this.queue.length + this.completed.size;
    const pending = this.queue.filter(item => item.status === 'pending').length;
    const processing = this.processing.size;
    const completed = Array.from(this.completed.values()).filter(item => item.status === 'completed').length;
    const failed = Array.from(this.completed.values()).filter(item => item.status === 'failed').length;
    const cancelled = Array.from(this.completed.values()).filter(item => item.status === 'cancelled').length;
    
    // 计算平均处理时间
    const completedItems = Array.from(this.completed.values()).filter(item => 
      item.status === 'completed' && item.startedAt && item.completedAt
    );
    
    const totalProcessingTime = completedItems.reduce((sum, item) => {
      return sum + (item.completedAt! - item.startedAt!);
    }, 0);
    
    const averageProcessingTime = completedItems.length > 0 
      ? totalProcessingTime / completedItems.length 
      : 0;
    
    // 计算成功率
    const successRate = completed + failed + cancelled > 0 
      ? completed / (completed + failed + cancelled) 
      : 1;
    
    this.stats = {
      total,
      pending,
      processing,
      completed,
      failed,
      cancelled,
      averageProcessingTime,
      successRate
    };
    
    this.emit('statsUpdate', this.stats);
  }

  // 事件系统
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // 销毁队列
  destroy() {
    this.clearQueue();
    this.completed.clear();
    this.deduplicationCache.clear();
    this.eventListeners.clear();
    
    console.log('Request queue destroyed');
  }
}

// 导出单例实例
export const requestQueue = new RequestQueue();