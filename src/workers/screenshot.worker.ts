/// <reference lib="webworker" />

export type ScreenshotWorkerMessage = 
  | { type: 'CAPTURE'; payload: CapturePayload; id: string }
  | { type: 'BATCH_CAPTURE'; payload: BatchCapturePayload; id: string };

export type CapturePayload = {
  imageData: string; // Base64图像数据
  cropRect: {
    x: number; // percentage (0-100)
    y: number;
    width: number;
    height: number;
  };
  timestamp: number;
  videoWidth: number;
  videoHeight: number;
};

export type BatchCapturePayload = {
  imageData: string; // Base64图像数据
  cropRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  timestamps: number[];
  videoWidth: number;
  videoHeight: number;
};

export type ScreenshotWorkerResult = 
  | { type: 'CAPTURE_RESULT'; id: string; imageData: string; timestamp: number }
  | { type: 'BATCH_RESULT'; id: string; results: Array<{ timestamp: number; imageData: string }> }
  | { type: 'ERROR'; id: string; error: string };

// 图像哈希计算函数（用于去重）
function calculateImageHash(imageData: ImageData): string {
  // 简化版哈希：将图像缩小到8x8，计算灰度值，生成64位哈希
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // 如果图像太小，直接返回空哈希
  if (width < 8 || height < 8) {
    return '';
  }
  
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
  
  // 生成简单哈希：基于平均灰度和图像尺寸
  return `${width}x${height}-${avgGray.toFixed(2)}`;
}


// Worker消息处理
self.onmessage = async (event: MessageEvent<ScreenshotWorkerMessage>) => {
  const message = event.data;
  
  try {
    switch (message.type) {
      case 'CAPTURE': {
        const { imageData, cropRect, timestamp, videoWidth, videoHeight } = message.payload;
        
        // 由于图像已经在主线程中完成截图和裁剪，这里直接返回接收到的图像数据
        // 可以在这里添加额外的处理，如图像哈希计算、去重检查等
        
        const response: ScreenshotWorkerResult = {
          type: 'CAPTURE_RESULT',
          id: message.id,
          imageData,
          timestamp
        };
        
        self.postMessage(response);
        break;
      }
      
      case 'BATCH_CAPTURE': {
        const { imageData, cropRect, timestamps, videoWidth, videoHeight } = message.payload;
        
        // 批量处理：由于所有时间戳使用相同的图像数据，直接返回多个结果
        const results = [];
        for (const timestamp of timestamps) {
          results.push({ timestamp, imageData });
        }
        
        const response: ScreenshotWorkerResult = {
          type: 'BATCH_RESULT',
          id: message.id,
          results
        };
        
        self.postMessage(response);
        break;
      }
      
      default:
        throw new Error(`Unknown message type: ${(message as any).type}`);
    }
  } catch (error) {
    const errorResponse: ScreenshotWorkerResult = {
      type: 'ERROR',
      id: message.id,
      error: error instanceof Error ? error.message : String(error)
    };
    
    self.postMessage(errorResponse);
  }
};

// 导出类型供主线程使用（避免重复导出）
// 类型已经在顶部导出，这里不需要重复导出