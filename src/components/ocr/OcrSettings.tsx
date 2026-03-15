import React, { useEffect, useState } from 'react';
import { useOcrStore } from '../../stores/useOcrStore';
import { checkOcrHealth, fetchAvailableModels } from '../../lib/ocrApi';
import { Settings, Activity, Cpu, Clock, AlertCircle, CheckCircle2, HelpCircle, Download, Play, Server } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

export function OcrSettings() {
  const {
    config,
    setConfig,
    isHealthy,
    setIsHealthy,
    availableModels,
    setAvailableModels,
    stats,
    setStats
  } = useOcrStore();

  const [isLoading, setIsLoading] = useState(false);
  const [showServiceGuide, setShowServiceGuide] = useState(false);

  const checkHealth = async () => {
    setIsLoading(true);
    try {
      const healthy = await checkOcrHealth(config);
      setIsHealthy(healthy);
      
      if (healthy) {
        const models = await fetchAvailableModels(config);
        setAvailableModels(models);
        if (models.length > 0 && !models.includes(config.model)) {
          setConfig({ model: models[0] });
        }
        toast.success(`${config.serviceName} 连接成功`);
      } else {
        toast.error(`${config.serviceName} 连接失败，请检查服务是否运行`);
        setShowServiceGuide(true);
      }
    } catch (error) {
      console.error("Health check error:", error);
      setIsHealthy(false);
      toast.error("服务检查失败，请检查网络连接");
      setShowServiceGuide(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleStart = () => {
    if (!isHealthy) {
      toast.error(`${config.serviceName} 未连接，请先启动服务`);
      setShowServiceGuide(true);
      return;
    }
    setStats({ status: 'running' });
    toast.success("OCR识别已开始");
  };

  const handleStop = () => {
    setStats({ status: 'idle' });
    toast.info("OCR识别已停止");
  };

  const getServiceGuide = () => {
    switch (config.ocrBackend) {
      case 'umi-ocr':
        return {
          title: 'Umi-OCR 服务启动指南',
          steps: [
            '1. 下载 Umi-OCR 软件（推荐从 GitHub 发布页下载）',
            '2. 解压并运行 Umi-OCR.exe',
            '3. 确保服务运行在端口 1224（默认端口）',
            '4. 保持 Umi-OCR 窗口打开，不要关闭'
          ],
          downloadUrl: 'https://github.com/hiroi-sora/Umi-OCR/releases'
        };
      case 'lmstudio':
        return {
          title: 'LM Studio 服务启动指南',
          steps: [
            '1. 安装 LM Studio（从官网下载安装）',
            '2. 启动 LM Studio 应用程序',
            '3. 在 LM Studio 中加载 glm-ocr 模型',
            '4. 启动本地服务器并确保运行在端口 1234'
          ],
          downloadUrl: 'https://lmstudio.ai/'
        };
      case 'tesseract':
        return {
          title: 'Tesseract 本地OCR',
          steps: [
            '1. Tesseract 已集成在应用中',
            '2. 无需额外服务启动',
            '3. 支持离线识别，但准确率可能较低'
          ],
          downloadUrl: null
        };
      default:
        return {
          title: 'OCR 服务配置',
          steps: ['请选择有效的OCR后端'],
          downloadUrl: null
        };
    }
  };

  const serviceGuide = getServiceGuide();

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          OCR 设置
        </h2>
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
          isHealthy
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        )}>
          {isHealthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {isHealthy ? `${config.serviceName} 在线` : `${config.serviceName} 离线`}
        </div>
      </div>

      {/* OCR后端选择 */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-400 flex items-center gap-1">
          <Server className="w-3.5 h-3.5" /> OCR 后端
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setConfig({
              ocrBackend: 'umi-ocr',
              apiEndpoint: 'http://localhost:1224',
              serviceName: 'Umi-OCR服务'
            })}
            className={cn(
              "p-3 rounded-lg border text-sm font-medium transition-all",
              config.ocrBackend === 'umi-ocr'
                ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
            )}
          >
            Umi-OCR
          </button>
          <button
            onClick={() => setConfig({
              ocrBackend: 'lmstudio',
              apiEndpoint: 'http://localhost:1234',
              serviceName: 'LM Studio服务'
            })}
            className={cn(
              "p-3 rounded-lg border text-sm font-medium transition-all",
              config.ocrBackend === 'lmstudio'
                ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
            )}
          >
            LM Studio
          </button>
          <button
            onClick={() => setConfig({
              ocrBackend: 'tesseract',
              apiEndpoint: 'local',
              serviceName: 'Tesseract本地OCR'
            })}
            className={cn(
              "p-3 rounded-lg border text-sm font-medium transition-all",
              config.ocrBackend === 'tesseract'
                ? "bg-green-500/10 text-green-400 border-green-500/30"
                : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
            )}
          >
            Tesseract
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          推荐使用 <span className="text-blue-400">Umi-OCR</span>（中文识别准确率高）
        </p>
      </div>

      {/* Connection */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-zinc-400">API 端点</label>
          <button
            onClick={() => setShowServiceGuide(!showServiceGuide)}
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            {showServiceGuide ? '隐藏指南' : '服务启动指南'}
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={config.apiEndpoint}
            onChange={(e) => setConfig({ apiEndpoint: e.target.value })}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={config.ocrBackend === 'umi-ocr' ? "http://localhost:1224" : "http://localhost:1234"}
          />
          <button
            onClick={checkHealth}
            disabled={isLoading}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {isLoading ? "..." : "检查连接"}
          </button>
        </div>
      </div>

      {/* 服务启动指南 */}
      {showServiceGuide && !isHealthy && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-zinc-300 flex items-center gap-2">
              <Play className="w-4 h-4" />
              {serviceGuide.title}
            </h3>
            {serviceGuide.downloadUrl && (
              <a
                href={serviceGuide.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                下载软件
              </a>
            )}
          </div>
          <div className="space-y-2">
            {serviceGuide.steps.map((step, index) => (
              <div key={index} className="text-sm text-zinc-400 flex items-start gap-2">
                <span className="text-zinc-500">{index + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              启动服务后，点击上方的 <span className="text-blue-400">"检查连接"</span> 按钮测试连接状态。
            </p>
          </div>
        </div>
      )}

      {/* Model Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-400">识别模型</label>
        <select
          value={config.model}
          onChange={(e) => setConfig({ model: e.target.value })}
          disabled={!isHealthy}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
        >
          {availableModels.length === 0 && <option value="Umi-OCR: PaddleOCR (默认)">Umi-OCR: PaddleOCR (默认)</option>}
          {availableModels.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <p className="text-xs text-zinc-500">
          推荐: <code className="bg-zinc-800 px-1 rounded">Umi-OCR: 简体中文</code>（中文识别准确率高）
        </p>
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> 采样间隔 (秒)
          </label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={isNaN(config.interval) ? 1.0 : config.interval}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              setConfig({ interval: isNaN(value) ? 1.0 : Math.max(0.1, value) });
            }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 flex items-center gap-1">
            <Cpu className="w-3 h-3" /> 并发数
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={isNaN(config.concurrency) ? 1 : config.concurrency}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setConfig({ concurrency: isNaN(value) ? 1 : Math.max(1, Math.min(10, value)) });
            }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-zinc-800">
        {stats.status === 'running' ? (
          <button
            onClick={handleStop}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
          >
            <Activity className="w-5 h-5 animate-pulse" />
            停止识别
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={!isHealthy}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Activity className="w-5 h-5" />
            开始识别
          </button>
        )}
      </div>

      {/* Stats Mini View */}
      {stats.status !== 'idle' && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-zinc-900 p-2 rounded-lg">
            <div className="text-xs text-zinc-500">已处理</div>
            <div className="font-mono font-bold">{stats.processedFrames}</div>
          </div>
          <div className="bg-zinc-900 p-2 rounded-lg">
            <div className="text-xs text-green-500">识别成功</div>
            <div className="font-mono font-bold text-green-400">{stats.success}</div>
          </div>
          <div className="bg-zinc-900 p-2 rounded-lg">
            <div className="text-xs text-blue-500">队列中</div>
            <div className="font-mono font-bold text-blue-400">{stats.queued}</div>
          </div>
        </div>
      )}
    </div>
  );
}
