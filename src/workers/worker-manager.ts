import { OcrConfig } from '../types';

// Worker管理器类型定义
export interface WorkerTask<T = any> {
  id: string;
  type: 'screenshot' | 'ocr';
  payload: any;
  priority: number; // 0-10，越高优先级越高
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed'; // 任务状态
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
  completedAt?: number; // 任务完成时间
}

export interface WorkerPoolStats {
  screenshotWorkers: number;
  ocrWorkers: number;
  activeScreenshotTasks: number;
  activeOcrTasks: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
}

export class WorkerManager {
  private screenshotWorkerPool: Worker[] = [];
  private ocrWorkerPool: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private activeTasks = new Map<string, WorkerTask>();
  private processingTasks = new Set<string>(); // 正在处理的任务，用于防止竞态条件
  private maxScreenshotWorkers: number;
  private maxOcrWorkers: number;
  private stats: WorkerPoolStats;
  
  // 事件监听器
  private eventListeners = new Map<string, Set<Function>>();

  constructor(
    maxScreenshotWorkers: number = 2,
    maxOcrWorkers: number = 4
  ) {
    this.maxScreenshotWorkers = maxScreenshotWorkers;
    this.maxOcrWorkers = maxOcrWorkers;
    
    this.stats = {
      screenshotWorkers: 0,
      ocrWorkers: 0,
      activeScreenshotTasks: 0,
      activeOcrTasks: 0,
      queuedTasks: 0,
      completedTasks: 0,
      failedTasks: 0
    };
    
    this.initializeWorkers();
  }

  // 初始化Worker池
  private initializeWorkers() {
    // 预创建截图Worker
    for (let i = 0; i < this.maxScreenshotWorkers; i++) {
      this.createScreenshotWorker();
    }
    
    // 预创建OCR Worker
    for (let i = 0; i < this.maxOcrWorkers; i++) {
      this.createOcrWorker();
    }
    
    this.updateStats();
  }

  // 创建截图Worker
  private createScreenshotWorker(): Worker {
    const worker = new Worker(new URL('./screenshot.worker.ts', import.meta.url), {
      type: 'module'
    });
    
    worker.onmessage = (event) => {
      this.handleWorkerMessage('screenshot', worker, event);
    };
    
    worker.onerror = (error) => {
      console.error('Screenshot worker error:', error);
      this.handleWorkerError('screenshot', worker, error);
    };
    
    this.screenshotWorkerPool.push(worker);
    this.stats.screenshotWorkers++;
    this.updateStats();
    
    return worker;
  }

  // 创建OCR Worker
  private createOcrWorker(): Worker {
    const worker = new Worker(new URL('./ocr.worker.ts', import.meta.url), {
      type: 'module'
    });
    
    worker.onmessage = (event) => {
      this.handleWorkerMessage('ocr', worker, event);
    };
    
    worker.onerror = (error) => {
      console.error('OCR worker error:', error);
      this.handleWorkerError('ocr', worker, error);
    };
    
    this.ocrWorkerPool.push(worker);
    this.stats.ocrWorkers++;
    this.updateStats();
    
    return worker;
  }

  // 标记任务为正在处理（原子操作）
  private markTaskAsProcessing(taskId: string): boolean {
    if (this.processingTasks.has(taskId)) {
      return false; // 已经在处理中
    }
    this.processingTasks.add(taskId);
    return true;
  }

  // 清除任务处理标记
  private clearTaskProcessing(taskId: string) {
    this.processingTasks.delete(taskId);
  }

  // 验证OCR结果完整性
  private validateOcrResult(result: any, taskId: string): void {
    if (!result) {
      console.warn(`[WorkerManager] OCR result is null or undefined for task ${taskId}`);
      return;
    }
    
    // 检查必要字段
    const requiredFields = ['text', 'timestamp', 'requestId'];
    const missingFields = requiredFields.filter(field => !(field in result));
    
    if (missingFields.length > 0) {
      console.warn(`[WorkerManager] OCR result missing fields for task ${taskId}: ${missingFields.join(', ')}`);
    }
    
    // 验证字段类型
    if (typeof result.text !== 'string') {
      console.warn(`[WorkerManager] OCR result text is not a string for task ${taskId}: ${typeof result.text}`);
      result.text = String(result.text || '');
    }
    
    if (typeof result.timestamp !== 'number' || isNaN(result.timestamp)) {
      console.warn(`[WorkerManager] OCR result timestamp is invalid for task ${taskId}: ${result.timestamp}`);
      result.timestamp = 0;
    }
    
    if (typeof result.requestId !== 'string' || !result.requestId) {
      console.warn(`[WorkerManager] OCR result requestId is invalid for task ${taskId}: ${result.requestId}`);
      result.requestId = `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // 清理文本
    if (result.text) {
      result.text = result.text.trim().replace(/\s+/g, ' ');
    }
    
    console.log(`[WorkerManager] Validated OCR result for task ${taskId}: text length=${result.text?.length || 0}, timestamp=${result.timestamp}`);
  }

  // 验证截图结果完整性
  private validateScreenshotResult(result: any, taskId: string): void {
    if (!result) {
      console.warn(`[WorkerManager] Screenshot result is null or undefined for task ${taskId}`);
      return;
    }
    
    // 检查必要字段
    const requiredFields = ['imageData', 'timestamp'];
    const missingFields = requiredFields.filter(field => !(field in result));
    
    if (missingFields.length > 0) {
      console.warn(`[WorkerManager] Screenshot result missing fields for task ${taskId}: ${missingFields.join(', ')}`);
    }
    
    // 验证字段类型
    if (typeof result.imageData !== 'string' || !result.imageData.startsWith('data:image/')) {
      console.warn(`[WorkerManager] Screenshot result imageData is invalid for task ${taskId}`);
    }
    
    if (typeof result.timestamp !== 'number' || isNaN(result.timestamp)) {
      console.warn(`[WorkerManager] Screenshot result timestamp is invalid for task ${taskId}: ${result.timestamp}`);
      result.timestamp = 0;
    }
    
    console.log(`[WorkerManager] Validated screenshot result for task ${taskId}: timestamp=${result.timestamp}`);
  }

  // 处理Worker消息
  private handleWorkerMessage(type: 'screenshot' | 'ocr', worker: Worker, event: MessageEvent) {
    const data = event.data;
    const taskId = data.id;

    console.log(`[WorkerManager] Received message from ${type} worker, taskId: ${taskId}, type: ${data.type}`);

    const task = this.activeTasks.get(taskId);
    if (!task) {
      // 检查任务是否已经完成或失败
      console.log(`[WorkerManager] Received message for completed or unknown task: ${taskId}, type: ${data.type}`);
      console.log(`[WorkerManager] Active tasks count: ${this.activeTasks.size}, task queue length: ${this.taskQueue.length}`);

      // 如果是结果消息，记录详细信息
      if (data.type === 'OCR_RESULT' || data.type === 'SCREENSHOT_RESULT' || data.type === 'CAPTURE_RESULT') {
        console.log(`[WorkerManager] Late result received for task ${taskId}, result:`, data.result || data);
      }
      return;
    }

    // 检查任务状态
    if (task.status === 'completed' || task.status === 'failed') {
      console.log(`[WorkerManager] Task ${task.id} already ${task.status}, ignoring late message`);
      return;
    }

    // 原子操作：先标记任务为正在处理，防止超时竞争
    const taskMarked = this.markTaskAsProcessing(taskId);
    if (!taskMarked) {
      console.log(`[WorkerManager] Task ${taskId} is already being processed, ignoring duplicate message`);
      return;
    }

    try {
      // 清除超时定时器
      if (task.timeout) {
        clearTimeout(task.timeout);
        task.timeout = undefined; // 清除引用，避免内存泄漏
        console.log(`[WorkerManager] Cleared timeout for task ${taskId}`);
      }

      // 根据消息类型处理
      if (data.type === 'ERROR') {
        console.log(`[WorkerManager] Task ${taskId} failed with error: ${data.error}`);
        task.status = 'processing'; // 确保任务状态正确
        this.handleTaskError(task, new Error(data.error));
      } else if (data.type === 'PROGRESS') {
        // 处理进度更新，不标记任务为完成
        console.log(`[WorkerManager] Task ${taskId} progress update: ${data.progress}`);
        task.status = 'processing'; // 更新状态为processing
        this.emit('taskProgress', { taskId: task.id, progress: data.progress, type });
      } else if (data.type === 'OCR_RESULT' || data.type === 'SCREENSHOT_RESULT' || data.type === 'BATCH_RESULT' || data.type === 'CAPTURE_RESULT') {
        // 任务完成
        console.log(`[WorkerManager] Task ${taskId} completed successfully, message type: ${data.type}`);

        // 提取实际的结果数据
        let resultData = data;
        if (type === 'ocr' && data.type === 'OCR_RESULT' && data.result) {
          console.log(`[WorkerManager] Extracting OCR result from message, result keys:`, Object.keys(data.result));
          resultData = data.result; // 提取实际的OCR结果

          // 验证OCR结果完整性
          this.validateOcrResult(resultData, taskId);
        } else if (type === 'screenshot' && (data.type === 'SCREENSHOT_RESULT' || data.type === 'CAPTURE_RESULT')) {
          console.log(`[WorkerManager] Extracting screenshot result from ${data.type} message`);
          // CAPTURE_RESULT和SCREENSHOT_RESULT有相同的结构
          resultData = data.type === 'CAPTURE_RESULT' ? {
            imageData: data.imageData,
            timestamp: data.timestamp
          } : data.result;

          // 验证截图结果完整性
          this.validateScreenshotResult(resultData, taskId);
        }

        task.status = 'processing'; // 确保任务状态正确
        this.completeTask(task, resultData);
      } else {
        // 未知消息类型，记录警告但不标记为完成
        console.warn(`[WorkerManager] Unknown message type for task ${taskId}: ${data.type}`);
      }
    } finally {
      // 清除处理标记（对于所有消息类型都需要清除）
      this.clearTaskProcessing(taskId);
    }

    // 对于完成消息，释放Worker并处理下一个任务
    if (data.type === 'OCR_RESULT' || data.type === 'SCREENSHOT_RESULT' || data.type === 'BATCH_RESULT' || data.type === 'CAPTURE_RESULT') {
      this.releaseWorker(type, worker);
      this.processQueue();
    }
  }

  // 处理Worker错误
  private handleWorkerError(type: 'screenshot' | 'ocr', worker: Worker, error: ErrorEvent) {
    console.error(`${type} worker fatal error:`, error);
    
    // 从池中移除损坏的Worker
    const pool = type === 'screenshot' ? this.screenshotWorkerPool : this.ocrWorkerPool;
    const index = pool.indexOf(worker);
    if (index > -1) {
      pool.splice(index, 1);
      this.stats[type === 'screenshot' ? 'screenshotWorkers' : 'ocrWorkers']--;
      
      // 尝试创建新的Worker替换
      try {
        if (type === 'screenshot') {
          this.createScreenshotWorker();
        } else {
          this.createOcrWorker();
        }
      } catch (e) {
        console.error(`Failed to recreate ${type} worker:`, e);
      }
    }
    
    this.updateStats();
  }

  // 处理任务错误
  private handleTaskError(task: WorkerTask, error: Error) {
    // 原子操作：检查任务状态
    if (task.status === 'completed' || task.status === 'failed') {
      console.log(`[WorkerManager] Task ${task.id} already ${task.status}, ignoring duplicate error`);
      return;
    }

    task.status = 'failed';

    console.log(`[WorkerManager] Handling task error for ${task.id}: ${error.message}`);

    // 从活动任务中移除
    this.activeTasks.delete(task.id);

    // 确保从处理任务集合中移除
    this.clearTaskProcessing(task.id);

    // 更新统计信息
    if (task.type === 'screenshot') {
      this.stats.activeScreenshotTasks--;
    } else {
      this.stats.activeOcrTasks--;
    }

    this.stats.failedTasks++;
    this.updateStats();

    // 清除超时定时器（如果存在）
    if (task.timeout) {
      clearTimeout(task.timeout);
      task.timeout = undefined;
    }

    // 拒绝Promise
    task.reject(error);
    this.emit('taskError', { taskId: task.id, error });
  }

  // 完成任务
  private completeTask(task: WorkerTask, result: any) {
    // 原子操作：检查任务状态
    if (task.status === 'completed' || task.status === 'failed') {
      console.log(`[WorkerManager] Task ${task.id} already ${task.status}, ignoring duplicate completion`);
      return;
    }

    task.status = 'completed';
    task.completedAt = Date.now();
    this.activeTasks.delete(task.id);

    // 确保从处理任务集合中移除
    this.clearTaskProcessing(task.id);

    if (task.type === 'screenshot') {
      this.stats.activeScreenshotTasks--;
    } else {
      this.stats.activeOcrTasks--;
    }

    this.stats.completedTasks++;
    this.updateStats();

    task.resolve(result);
    this.emit('taskComplete', { taskId: task.id, result });
  }

  // 释放Worker
  private releaseWorker(type: 'screenshot' | 'ocr', worker: Worker) {
    // Worker已经回到池中，无需额外操作
    // 这里可以添加Worker健康检查或重置逻辑
  }

  // 在主线程中捕获图像并转换为Base64
  private async captureImageToBase64(
    videoElement: HTMLVideoElement,
    cropRect: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    // 创建canvas用于截图
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // 绘制视频帧到canvas
    ctx.drawImage(videoElement, 0, 0);
    
    // 计算实际裁剪坐标（cropRect使用百分比）
    const cropX = (cropRect.x / 100) * videoElement.videoWidth;
    const cropY = (cropRect.y / 100) * videoElement.videoHeight;
    const cropW = (cropRect.width / 100) * videoElement.videoWidth;
    const cropH = (cropRect.height / 100) * videoElement.videoHeight;
    
    // 创建裁剪后的canvas
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropW;
    croppedCanvas.height = cropH;
    const croppedCtx = croppedCanvas.getContext('2d');
    
    if (!croppedCtx) {
      throw new Error('Failed to get cropped canvas context');
    }
    
    // 绘制裁剪区域
    croppedCtx.drawImage(
      canvas,
      cropX, cropY, cropW, cropH, // 源图像裁剪区域
      0, 0, cropW, cropH           // 目标画布
    );
    
    // 转换为JPEG格式的Data URL (base64)
    return croppedCanvas.toDataURL('image/jpeg', 0.85);
  }

  // 提交截图任务
  async captureScreenshot(
    videoElement: HTMLVideoElement,
    cropRect: { x: number; y: number; width: number; height: number },
    timestamp: number,
    options: { priority?: number; timeout?: number } = {}
  ): Promise<string> {
    // 在主线程中完成截图和裁剪，生成Base64图像数据
    const imageData = await this.captureImageToBase64(videoElement, cropRect);
    
    return this.submitTask('screenshot', {
      type: 'CAPTURE',
      payload: {
        imageData, // 传递Base64图像数据而不是OffscreenCanvas
        cropRect,
        timestamp,
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight
      }
    }, options);
  }

  // 提交OCR任务
  async submitOcrRequest(
    imageData: string,
    config: OcrConfig,
    timestamp: number,
    requestId: string,
    options: { priority?: number; timeout?: number } = {}
  ): Promise<any> {
    return this.submitTask('ocr', {
      type: 'OCR_REQUEST',
      payload: {
        imageData,
        config,
        timestamp,
        requestId
      }
    }, options);
  }

  // 提交通用任务
  private submitTask<T>(
    type: 'screenshot' | 'ocr',
    message: any,
    options: { priority?: number; timeout?: number } = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const task: WorkerTask<T> = {
        id: taskId,
        type,
        payload: { ...message, id: taskId },
        priority: options.priority || 5,
        timestamp: Date.now(),
        status: 'pending', // 初始状态为pending
        resolve,
        reject
      };
      
      // 设置超时
      if (options.timeout) {
        task.timeout = setTimeout(() => {
          // 直接检查任务状态，避免竞态条件
          const currentTask = this.activeTasks.get(taskId);
          if (!currentTask) {
            console.log(`[WorkerManager] Task ${taskId} already removed, ignoring timeout`);
            return;
          }

          // 检查任务状态
          if (currentTask.status === 'processing') {
            console.log(`[WorkerManager] Task ${taskId} is still processing, ignoring timeout (task is actively being processed)`);
            return;
          } else if (currentTask.status === 'pending') {
            console.log(`[WorkerManager] Task ${taskId} timeout after ${options.timeout}ms, status: ${currentTask.status}`);
            this.handleTaskError(currentTask, new Error(`Task timeout after ${options.timeout}ms`));
          } else {
            console.log(`[WorkerManager] Task ${taskId} already ${currentTask.status}, ignoring timeout`);
          }
        }, options.timeout);
      }
      
      // 添加到队列
      this.addToQueue(task);
      this.processQueue();
    });
  }

  // 添加任务到队列
  private addToQueue(task: WorkerTask) {
    // 按优先级插入队列（优先级高的在前面）
    let inserted = false;
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (task.priority > this.taskQueue[i].priority) {
        this.taskQueue.splice(i, 0, task);
        inserted = true;
        break;
      }
    }
    
    if (!inserted) {
      this.taskQueue.push(task);
    }
    
    this.stats.queuedTasks = this.taskQueue.length;
    this.updateStats();
  }

  // 处理队列
  private processQueue() {
    // 处理截图任务
    this.processTaskType('screenshot');
    
    // 处理OCR任务
    this.processTaskType('ocr');
  }

  // 处理特定类型的任务
  private processTaskType(type: 'screenshot' | 'ocr') {
    const pool = type === 'screenshot' ? this.screenshotWorkerPool : this.ocrWorkerPool;
    const maxWorkers = type === 'screenshot' ? this.maxScreenshotWorkers : this.maxOcrWorkers;
    const activeKey = type === 'screenshot' ? 'activeScreenshotTasks' : 'activeOcrTasks';
    
    // 查找可用的Worker和待处理的任务
    while (this.stats[activeKey] < maxWorkers) {
      const taskIndex = this.taskQueue.findIndex(task => task.type === type);
      if (taskIndex === -1) break;
      
      const task = this.taskQueue.splice(taskIndex, 1)[0];
      const worker = pool[this.stats[activeKey] % pool.length];
      
      if (worker) {
        task.status = 'processing'; // 更新任务状态为处理中
        this.activeTasks.set(task.id, task);
        this.stats[activeKey]++;
        this.stats.queuedTasks = this.taskQueue.length;

        // 发送任务到Worker
        worker.postMessage(task.payload);

        this.emit('taskStarted', { taskId: task.id, type });
      }
    }
    
    this.updateStats();
  }

  // 获取统计信息
  getStats(): WorkerPoolStats {
    return { ...this.stats };
  }

  // 更新统计信息并触发事件
  private updateStats() {
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

  // 获取任务信息（用于调试）
  getTaskInfo(taskId: string): { status: string; type: string; timestamp: number; age: number } | null {
    const task = this.activeTasks.get(taskId);
    if (task) {
      return {
        status: task.status,
        type: task.type,
        timestamp: task.timestamp,
        age: Date.now() - task.timestamp
      };
    }
    return null;
  }

  // 记录任务状态（用于调试）
  logTaskState(): void {
    console.log(`[WorkerManager] Task state summary:`);
    console.log(`[WorkerManager] Active tasks: ${this.activeTasks.size}`);
    console.log(`[WorkerManager] Processing tasks: ${this.processingTasks.size}`);
    console.log(`[WorkerManager] Queue length: ${this.taskQueue.length}`);

    this.activeTasks.forEach((task, taskId) => {
      console.log(`[WorkerManager] Task ${taskId}: type=${task.type}, status=${task.status}, age=${Date.now() - task.timestamp}ms`);
    });
  }

  // 清理资源
  destroy() {
    // 终止所有Worker
    this.screenshotWorkerPool.forEach(worker => worker.terminate());
    this.ocrWorkerPool.forEach(worker => worker.terminate());
    
    // 清理队列中的任务
    this.taskQueue.forEach(task => {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      task.reject(new Error('Worker manager destroyed'));
    });
    
    // 清理活动任务
    this.activeTasks.forEach(task => {
      if (task.timeout) {
        clearTimeout(task.timeout);
      }
      task.reject(new Error('Worker manager destroyed'));
    });
    
    // 重置状态
    this.screenshotWorkerPool = [];
    this.ocrWorkerPool = [];
    this.taskQueue = [];
    this.activeTasks.clear();
    this.eventListeners.clear();
    
    console.log('Worker manager destroyed');
  }
}

// 导出单例实例
export const workerManager = new WorkerManager();