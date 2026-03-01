import { OcrConfig, UmiOcrResponse, UmiOcrDataItem, UmiOcrOptions } from '../types';

// 各OCR后端默认配置
const BACKEND_CONFIGS = {
  'umi-ocr': {
    defaultEndpoint: 'http://localhost:1224',
    healthCheckPath: '/api/ocr/get_options',
    name: 'Umi-OCR服务'
  },
  'ollama': {
    defaultEndpoint: 'http://localhost:11434',
    healthCheckPath: '/api/tags',
    name: 'Ollama服务'
  },
  'tesseract': {
    defaultEndpoint: 'local',
    healthCheckPath: '',
    name: 'Tesseract本地OCR'
  }
};

// 通用健康检查 - 根据后端类型检查服务状态
export async function checkOcrHealth(config: OcrConfig): Promise<boolean> {
  const { ocrBackend, apiEndpoint } = config;
  
  console.log(`[OCR Health] Checking ${ocrBackend} at ${apiEndpoint}`);
  
  switch (ocrBackend) {
    case 'umi-ocr':
      return checkUmiOcrHealth(apiEndpoint);
    case 'ollama':
      return checkOllamaHealth(apiEndpoint);
    case 'tesseract':
      // Tesseract始终可用（本地库）
      return true;
    default:
      console.error(`[OCR Health] Unknown backend: ${ocrBackend}`);
      return false;
  }
}

// Umi-OCR 健康检查
export async function checkUmiOcrHealth(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}/api/ocr/get_options`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.ok;
  } catch (e) {
    console.error("Umi-OCR health check failed:", e);
    return false;
  }
}

// Ollama健康检查
export async function checkOllamaHealth(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.ok;
  } catch (e) {
    console.error("Ollama health check failed:", e);
    return false;
  }
}

// 获取Umi-OCR参数选项
export async function fetchUmiOcrOptions(endpoint: string): Promise<UmiOcrOptions> {
  try {
    const res = await fetch(`${endpoint}/api/ocr/get_options`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) {
      throw new Error(`Umi-OCR options fetch failed: ${res.statusText}`);
    }
    
    const data = await res.json();
    return data as UmiOcrOptions;
  } catch (e) {
    console.error("Failed to fetch Umi-OCR options:", e);
    return {};
  }
}


// 获取可用模型列表（根据后端类型）
export async function fetchAvailableModels(config: OcrConfig): Promise<string[]> {
  const { ocrBackend, apiEndpoint } = config;
  
  switch (ocrBackend) {
    case 'umi-ocr':
      return fetchUmiOcrModels(apiEndpoint);
    case 'ollama':
      return fetchOllamaModels(apiEndpoint);
    case 'tesseract':
      return ['Tesseract: 简体中文', 'Tesseract: English', 'Tesseract: 日本語'];
    default:
      console.error(`[OCR Models] Unknown backend: ${ocrBackend}`);
      return ['默认模型'];
  }
}

// 获取Umi-OCR模型列表
export async function fetchUmiOcrModels(endpoint: string): Promise<string[]> {
  try {
    const options = await fetchUmiOcrOptions(endpoint);
    const models: string[] = [];
    
    if (options['ocr.language'] && options['ocr.language'].optionsList) {
      options['ocr.language'].optionsList.forEach(([value, label]) => {
        models.push(`Umi-OCR: ${label}`);
      });
    }
    
    // 如果没有找到语言选项，返回默认模型
    if (models.length === 0) {
      models.push('Umi-OCR: PaddleOCR (默认)');
    }
    
    return models;
  } catch (e) {
    console.error("Failed to fetch Umi-OCR models:", e);
    return ['Umi-OCR: PaddleOCR (默认)'];
  }
}

// 向后兼容的模型获取（模拟实现）
export async function fetchOllamaModels(endpoint: string): Promise<string[]> {
  console.warn("fetchOllamaModels is deprecated, using Umi-OCR instead");
  try {
    const options = await fetchUmiOcrOptions(endpoint);
    const models: string[] = [];
    
    if (options['ocr.language'] && options['ocr.language'].optionsList) {
      options['ocr.language'].optionsList.forEach(([value, label]) => {
        models.push(`Umi-OCR: ${label}`);
      });
    }
    
    // 如果没有找到语言选项，返回默认模型
    if (models.length === 0) {
      models.push('Umi-OCR: PaddleOCR (默认)');
    }
    
    return models;
  } catch (e) {
    return ['Umi-OCR: PaddleOCR (默认)'];
  }
}

// 处理Umi-OCR响应并转换为纯文本
function processUmiOcrResponse(response: UmiOcrResponse): string {
  console.log(`[Umi-OCR] Response code: ${response.code}, time: ${response.time}s`);
  
  // 处理无文本情况
  if (response.code === 101) {
    console.log(`[Umi-OCR] No text detected (code 101)`);
    return '';
  }
  
  // 处理识别失败
  if (response.code !== 100) {
    const errorMsg = typeof response.data === 'string' ? response.data : 'Unknown error';
    console.error(`[Umi-OCR] Recognition failed with code ${response.code}: ${errorMsg}`);
    
    // 根据错误代码提供更友好的错误信息
    let userFriendlyError = `Umi-OCR识别失败 (代码: ${response.code})`;
    if (typeof response.data === 'string') {
      userFriendlyError += `: ${response.data}`;
    }
    
    throw new Error(userFriendlyError);
  }
  
  // 识别成功 - 处理数据
  if (typeof response.data === 'string') {
    // 已经是纯文本格式
    const text = response.data.trim();
    console.log(`[Umi-OCR] Text result (${text.length} chars): "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    return text;
  }
  
  // 字典格式，需要拼接文本
  const textItems = response.data as UmiOcrDataItem[];
  
  if (!Array.isArray(textItems) || textItems.length === 0) {
    console.log(`[Umi-OCR] Empty result array`);
    return '';
  }
  
  let fullText = '';
  let totalScore = 0;
  let hasLowConfidence = false;
  
  for (const item of textItems) {
    // 验证数据格式
    if (!item.text || typeof item.text !== 'string') {
      console.warn(`[Umi-OCR] Invalid text item:`, item);
      continue;
    }
    
    // 拼接文本
    fullText += item.text + (item.end || '');
    
    // 统计置信度
    if (typeof item.score === 'number') {
      totalScore += item.score;
      if (item.score < 0.5) {
        hasLowConfidence = true;
        console.warn(`[Umi-OCR] Low confidence item: "${item.text}" (score: ${item.score.toFixed(4)})`);
      }
    }
    
    console.log(`[Umi-OCR] Item: "${item.text}" (score: ${item.score?.toFixed(4) || 'N/A'})`);
  }
  
  // 计算平均置信度
  const avgScore = textItems.length > 0 ? totalScore / textItems.length : 0;
  
  const result = fullText.trim();
  console.log(`[Umi-OCR] Combined text (${result.length} chars, avg score: ${avgScore.toFixed(4)}): "${result.substring(0, 100)}${result.length > 100 ? '...' : ''}"`);
  
  if (hasLowConfidence) {
    console.warn(`[Umi-OCR] Warning: Some text items have low confidence (< 0.5)`);
  }
  
  return result;
}

// 增强的OCR识别函数，支持超时和重试
export async function performOcrWithRetry(
  imageDataBase64: string,
  config: OcrConfig,
  timeoutMs: number = 30000,
  maxRetries: number = 2
): Promise<string> {
  // 移除data URL前缀（如果存在）
  const base64Data = imageDataBase64.replace(/^data:image\/\w+;base64,/, "");
  
  console.log(`[Umi-OCR] Sending request to endpoint: ${config.apiEndpoint}, timeout: ${timeoutMs}ms`);
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // 构建Umi-OCR请求参数
      const requestBody = {
        base64: base64Data,
        options: {
          "data.format": "text", // 返回纯文本格式，简化处理
          "ocr.language": "models/config_chinese.txt", // 默认使用中文
        }
      };
      
      // 创建AbortController用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      try {
        const res = await fetch(`${config.apiEndpoint}/api/ocr`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Umi-OCR API error: ${res.status} ${res.statusText}`);
        }

        const data: UmiOcrResponse = await res.json();
        
        // 处理Umi-OCR响应
        return processUmiOcrResponse(data);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          throw new Error(`Umi-OCR request timeout after ${timeoutMs}ms`);
        }
        throw fetchError;
      }
    } catch (e: any) {
      lastError = e;
      
      if (attempt <= maxRetries) {
        const retryDelay = 1000 * attempt; // 指数退避
        console.warn(`[Umi-OCR] Attempt ${attempt} failed: ${e.message}. Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  // 所有重试都失败
  console.error(`[Umi-OCR] All ${maxRetries + 1} attempts failed`);
  throw lastError || new Error('Umi-OCR recognition failed after all retries');
}

// 向后兼容：保持原有函数签名，内部使用增强版本
export async function performOcr(
  imageDataBase64: string,
  config: OcrConfig
): Promise<string> {
  return performOcrWithRetry(imageDataBase64, config, 30000, 1);
}
