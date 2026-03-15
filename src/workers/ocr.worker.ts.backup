/// <reference lib="webworker" />

import { OcrConfig } from '../types';

export type OcrWorkerMessage = 
  | { type: 'OCR_REQUEST'; payload: OcrRequestPayload; id: string }
  | { type: 'BATCH_OCR_REQUEST'; payload: BatchOcrRequestPayload; id: string }
  | { type: 'CANCEL_REQUEST'; id: string };

export type OcrRequestPayload = {
  imageData: string; // base64 encoded image
  config: OcrConfig;
  timestamp: number;
  requestId: string;
};

export type BatchOcrRequestPayload = {
  images: Array<{
    imageData: string;
    timestamp: number;
    requestId: string;
  }>;
  config: OcrConfig;
};

export type OcrWorkerResult = 
  | { type: 'OCR_RESULT'; id: string; result: OcrResult; requestId: string }
  | { type: 'BATCH_RESULT'; id: string; results: Array<OcrResult> }
  | { type: 'ERROR'; id: string; error: string; requestId?: string }
  | { type: 'PROGRESS'; id: string; progress: number; requestId?: string };

export interface OcrResult {
  text: string;
  timestamp: number;
  requestId: string;
  processingTime: number;
  confidence?: number;
}

// OCR处理函数（模拟或实际调用API）
async function processOcrRequest(
  imageData: string,
  config: OcrConfig,
  timestamp: number,
  requestId: string
): Promise<OcrResult> {
  const startTime = performance.now();
  
  try {
    console.log(`[OCR Worker] Starting OCR request ${requestId}, timestamp: ${timestamp}, endpoint: ${config.apiEndpoint}`);
    
    // 移除data URL前缀（如果存在）
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    
    // 构建Umi-OCR请求参数
    const requestBody = {
      base64: base64Data,
      options: {
        "data.format": "text", // 返回纯文本格式
        "ocr.language": "models/config_chinese.txt", // 默认使用中文
      }
    };
    
    console.log(`[OCR Worker] Sending request to Umi-OCR at ${config.apiEndpoint}/api/ocr`);
    
    // 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
    
    const response = await fetch(`${config.apiEndpoint}/api/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error(`[OCR Worker] API error: ${response.status} ${response.statusText}`);
      throw new Error(`OCR API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const processingTime = performance.now() - startTime;
    
    console.log(`[OCR Worker] Received response for ${requestId}, code: ${data.code}, processing time: ${processingTime.toFixed(2)}ms`);
    
    // 处理Umi-OCR响应
    let text = '';
    let confidence = 0;
    
    if (data.code === 100) {
      // 识别成功
      if (typeof data.data === 'string') {
        text = data.data.trim();
        console.log(`[OCR Worker] Text result (string): ${text.substring(0, 50)}...`);
      } else if (Array.isArray(data.data)) {
        // 字典格式，拼接文本
        text = data.data
          .map((item: any) => item.text || '')
          .join('')
          .trim();
        
        console.log(`[OCR Worker] Text result (array): ${text.substring(0, 50)}...`);
        
        // 计算平均置信度
        const scores = data.data
          .filter((item: any) => typeof item.score === 'number')
          .map((item: any) => item.score);
        
        if (scores.length > 0) {
          confidence = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        }
      }
    } else if (data.code === 101) {
      // 无文本
      text = '';
    } else {
      // 识别失败
      const errorMsg = typeof data.data === 'string' ? data.data : 'Unknown error';
      throw new Error(`OCR recognition failed with code ${data.code}: ${errorMsg}`);
    }
    
    // 验证结果完整性
    if (typeof text !== 'string') {
      console.warn(`[OCR Worker] Invalid text type: ${typeof text}, converting to string`);
      text = String(text || '');
    }
    
    // 清理文本：移除多余空格和换行符
    text = text.trim().replace(/\s+/g, ' ');
    
    // 验证必要字段
    if (typeof timestamp !== 'number' || isNaN(timestamp)) {
      console.warn(`[OCR Worker] Invalid timestamp: ${timestamp}, using default`);
      timestamp = 0;
    }
    
    if (typeof requestId !== 'string' || !requestId) {
      console.warn(`[OCR Worker] Invalid requestId: ${requestId}, generating new one`);
      requestId = `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    const result = {
      text,
      timestamp,
      requestId,
      processingTime,
      confidence
    };
    
    console.log(`[OCR Worker] Validated result for ${requestId}: text length=${text.length}, timestamp=${timestamp}`);
    
    return result;
    
  } catch (error) {
    const processingTime = performance.now() - startTime;
    
    // 重试逻辑（简化版）
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OCR request timeout after 30s`);
    }
    
    throw error;
  }
}

// Worker消息处理
self.onmessage = async (event: MessageEvent<OcrWorkerMessage>) => {
  const message = event.data;
  
  console.log(`[OCR Worker] Received message: ${message.type}, id: ${message.id}`);
  
  try {
    switch (message.type) {
      case 'OCR_REQUEST': {
        const { imageData, config, timestamp, requestId } = message.payload;
        
        console.log(`[OCR Worker] Processing OCR request ${requestId}, timestamp: ${timestamp}`);
        
        // 发送进度更新
        self.postMessage({
          type: 'PROGRESS',
          id: message.id,
          progress: 0.5,
          requestId
        } as OcrWorkerResult);
        
        const result = await processOcrRequest(imageData, config, timestamp, requestId);
        
        console.log(`[OCR Worker] OCR request ${requestId} completed, text length: ${result.text.length}`);
        
        const response: OcrWorkerResult = {
          type: 'OCR_RESULT',
          id: message.id,
          result,
          requestId
        };
        
        self.postMessage(response);
        console.log(`[OCR Worker] Sent OCR_RESULT for id: ${message.id}, requestId: ${requestId}`);
        break;
      }
      
      case 'BATCH_OCR_REQUEST': {
        const { images, config } = message.payload;
        
        console.log(`[OCR Worker] Processing batch OCR request with ${images.length} images, id: ${message.id}`);
        
        const results: OcrResult[] = [];
        const total = images.length;
        
        for (let i = 0; i < images.length; i++) {
          const { imageData, timestamp, requestId } = images[i];
          
          try {
            console.log(`[OCR Worker] Processing batch item ${i+1}/${total}, requestId: ${requestId}`);
            
            // 发送进度更新
            self.postMessage({
              type: 'PROGRESS',
              id: message.id,
              progress: (i + 0.5) / total,
              requestId
            } as OcrWorkerResult);
            
            const result = await processOcrRequest(imageData, config, timestamp, requestId);
            results.push(result);
            
            console.log(`[OCR Worker] Batch item ${i+1} completed, text: ${result.text.substring(0, 30)}...`);
            
            // 发送单个结果（用于实时更新）
            self.postMessage({
              type: 'OCR_RESULT',
              id: message.id,
              result,
              requestId
            } as OcrWorkerResult);
            
          } catch (error) {
            console.warn(`[OCR Worker] Failed to process OCR request ${requestId}:`, error);
            
            // 发送错误结果
            self.postMessage({
              type: 'ERROR',
              id: message.id,
              error: error instanceof Error ? error.message : String(error),
              requestId
            } as OcrWorkerResult);
          }
        }
        
        console.log(`[OCR Worker] Batch request ${message.id} completed, total results: ${results.length}`);
        
        // 发送批量完成通知
        self.postMessage({
          type: 'BATCH_RESULT',
          id: message.id,
          results
        } as OcrWorkerResult);
        
        break;
      }
      
      case 'CANCEL_REQUEST': {
        // 目前不支持取消，但可以记录日志
        console.log(`[OCR Worker] OCR request ${message.id} cancelled`);
        break;
      }
      
      default:
        console.error(`[OCR Worker] Unknown message type: ${(message as any).type}`);
        throw new Error(`Unknown message type: ${(message as any).type}`);
    }
  } catch (error) {
    console.error(`[OCR Worker] Error processing message ${message.id}:`, error);
    
    const errorResponse: OcrWorkerResult = {
      type: 'ERROR',
      id: message.id,
      error: error instanceof Error ? error.message : String(error)
    };
    
    self.postMessage(errorResponse);
  }
};

// 导出类型供主线程使用（避免重复导出）
// 类型已经在顶部导出