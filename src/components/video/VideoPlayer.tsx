import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { useVideoStore } from '../../stores/useVideoStore';
import { useOcrStore } from '../../stores/useOcrStore';
import { useSubtitleStore } from '../../stores/useSubtitleStore';
import { requestQueue } from '../../lib/request-queue';
import { workerManager } from '../../workers/worker-manager';
import { toast } from 'sonner';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Upload } from 'lucide-react';
import { cn, formatTime } from '../../lib/utils';

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    videoUrl,
    cropRect,
    setCropRect,
    setDuration,
    setCurrentTime,
    currentTime,
    videoDimensions,
    setVideoDimensions,
    reset,
    switchVideo
  } = useVideoStore();

  const { 
    config, 
    stats, 
    setStats, 
    addLog, 
    isHealthy 
  } = useOcrStore();

  const { addSubtitle } = useSubtitleStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 处理队列事件 - 使用 useCallback 避免重复创建函数
  const handleQueueItemCompleted = useCallback((event: any) => {
    console.log(`[VideoPlayer] Received itemCompleted event:`, event);
    const item = event;
    
    console.log(`[VideoPlayer] Item type: ${item.type}, has result: ${!!item.result}, result structure:`, item.result);
    
    if (item.type === 'ocr' && item.result) {
      console.log(`[VideoPlayer] Processing OCR result for timestamp ${item.timestamp}`);
      
      // 检查结果数据结构
      const result = item.result;
      console.log(`[VideoPlayer] Result keys:`, Object.keys(result));
      console.log(`[VideoPlayer] Result text:`, result.text);
      console.log(`[VideoPlayer] Result timestamp:`, result.timestamp);
      console.log(`[VideoPlayer] Result requestId:`, result.requestId);
      
      const { text, timestamp, requestId } = result;
      
      if (text && text.trim().length > 0) {
        console.log(`[VideoPlayer] Adding subtitle: "${text.trim()}" at ${timestamp}s`);
        
        const subtitleId = crypto.randomUUID();
        const subtitle = {
          id: subtitleId,
          startTime: timestamp,
          endTime: timestamp + config.interval,
          text: text.trim()
        };
        
        console.log(`[VideoPlayer] Subtitle object:`, subtitle);
        
        addSubtitle(subtitle);
        
        addLog('success', `[${formatTime(timestamp)}] ${text.trim()}`, timestamp);
        
        // 使用当前状态更新统计信息
        const currentStats = useOcrStore.getState().stats;
        setStats({ success: currentStats.success + 1 });
        
        // 验证字幕是否已添加
        setTimeout(() => {
          const currentSubtitles = useSubtitleStore.getState().subtitles;
          const addedSubtitle = currentSubtitles.find(s => s.id === subtitleId);
          console.log(`[VideoPlayer] Subtitle verification: added=${!!addedSubtitle}, total subtitles=${currentSubtitles.length}`);
        }, 100);
      } else {
        console.log(`[VideoPlayer] No text found in OCR result or text is empty`);
      }
      
      // 更新处理帧数
      const currentStats = useOcrStore.getState().stats;
      setStats({ processedFrames: currentStats.processedFrames + 1 });
    } else {
      console.log(`[VideoPlayer] Ignoring itemCompleted event: type=${item.type}, hasResult=${!!item.result}`);
    }
  }, [config.interval, addSubtitle, addLog, setStats]);

  const handleQueueItemFailed = useCallback((event: any) => {
    console.log(`[VideoPlayer] Received itemFailed event:`, event);
    const item = event;
    if (item.type === 'ocr') {
      addLog('error', `OCR Error at ${formatTime(item.timestamp)}: ${item.error}`, item.timestamp);
      
      // 使用当前状态更新失败计数
      const currentStats = useOcrStore.getState().stats;
      setStats({ failed: currentStats.failed + 1 });
    }
  }, [addLog, setStats]);

  const handleQueueStatsUpdate = useCallback((queueStats: any) => {
    console.log(`[VideoPlayer] Queue stats update: pending=${queueStats.pending}, processing=${queueStats.processing}`);
    setStats({ queued: queueStats.pending + queueStats.processing });
  }, [setStats]);

  // 注册事件监听器 - 独立的 useEffect，无依赖
  useEffect(() => {
    console.log(`[VideoPlayer] Registering event listeners for requestQueue`);
    requestQueue.on('itemCompleted', handleQueueItemCompleted);
    requestQueue.on('itemFailed', handleQueueItemFailed);
    requestQueue.on('statsUpdate', handleQueueStatsUpdate);

    return () => {
      console.log(`[VideoPlayer] Unregistering event listeners`);
      requestQueue.off('itemCompleted', handleQueueItemCompleted);
      requestQueue.off('itemFailed', handleQueueItemFailed);
      requestQueue.off('statsUpdate', handleQueueStatsUpdate);
    };
  }, [handleQueueItemCompleted, handleQueueItemFailed, handleQueueStatsUpdate]);

  // Handle Resize of the wrapper to update Rnd bounds
  useEffect(() => {
    if (!wrapperRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setWrapperSize({ width, height });
      }
    });
    resizeObserver.observe(wrapperRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Video Metadata
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoDimensions(videoRef.current.videoWidth, videoRef.current.videoHeight);
    }
  };

  // Time Update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  // Play/Pause Control
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Sync isPlaying with video events (e.g. if paused by other means)
  const onPlay = () => setIsPlaying(true);
  const onPause = () => setIsPlaying(false);

  // Seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // 使用Worker和队列的OCR处理逻辑
  const isProcessingRef = useRef(false);
  const pendingRequestsRef = useRef<Set<string>>(new Set());

  // 处理单个帧的OCR
  const processFrameWithQueue = async (timestamp: number) => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const requestId = `ocr_${timestamp}_${Date.now()}`;

    try {
      // 1. 使用Worker捕获截图
      const screenshotItemId = await requestQueue.enqueueScreenshot(
        video,
        cropRect,
        timestamp,
        {
          priority: 7,
          deduplicate: true
        }
      );

      // 等待截图完成
      const checkScreenshotStatus = () => {
        return new Promise<string>((resolve, reject) => {
          const checkInterval = setInterval(() => {
            const item = requestQueue.getItemStatus(screenshotItemId);
            if (!item) {
              clearInterval(checkInterval);
              reject(new Error('Screenshot item not found'));
              return;
            }

            if (item.status === 'completed') {
              clearInterval(checkInterval);
              resolve(item.result.imageData);
            } else if (item.status === 'failed') {
              clearInterval(checkInterval);
              reject(new Error(item.error || 'Screenshot failed'));
            }
          }, 100);
        });
      };

      const imageData = await checkScreenshotStatus();

      // 2. 提交OCR请求到队列
      const ocrItemId = await requestQueue.enqueueOcr(
        imageData,
        config,
        timestamp,
        requestId,
        {
          priority: 5,
          deduplicate: true
        }
      );

      pendingRequestsRef.current.add(ocrItemId);

    } catch (error) {
      console.error(`Failed to process frame at ${timestamp}s:`, error);
      addLog('error', `Frame processing failed at ${formatTime(timestamp)}: ${error instanceof Error ? error.message : String(error)}`, timestamp);
    }
  };

  // 主要的OCR处理循环
  const startOcrLoop = async () => {
    if (!videoRef.current) return;
    
    setStats({ status: 'running', startTime: Date.now(), processedFrames: 0, success: 0, failed: 0 });
    addLog('info', 'Started OCR processing with Worker queue system');
    
    const video = videoRef.current;
    const wasPlaying = !video.paused;
    video.pause();

    let currentTimeCursor = 0;
    const duration = video.duration;
    
    // 清空之前的请求
    pendingRequestsRef.current.clear();
    
    // 批量处理：将时间点分成批次，减少频繁的seek
    const batchSize = 10;
    const timestamps: number[] = [];
    
    while (currentTimeCursor < duration) {
      timestamps.push(currentTimeCursor);
      currentTimeCursor += config.interval;
    }
    
    // 按批次处理
    for (let i = 0; i < timestamps.length; i += batchSize) {
      if (useOcrStore.getState().stats.status !== 'running') break;
      
      const batch = timestamps.slice(i, i + batchSize);
      
      // 处理批次中的每个时间点
      for (const timestamp of batch) {
        if (useOcrStore.getState().stats.status !== 'running') break;
        
        // 定位到正确的时间点
        video.currentTime = timestamp;
        await new Promise<void>((resolve) => {
          const onSeek = () => {
            video.removeEventListener('seeked', onSeek);
            resolve();
          };
          video.addEventListener('seeked', onSeek);
        });
        
        // 提交处理请求
        await processFrameWithQueue(timestamp);
        
        // 更新进度
        const progress = ((i + batch.indexOf(timestamp) + 1) / timestamps.length) * 100;
        setStats({ processedFrames: Math.floor((i + batch.indexOf(timestamp) + 1)) });
        
        // 添加延迟以避免UI阻塞
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // 批次间添加小延迟
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 等待所有OCR请求完成
    let waitAttempts = 0;
    const maxWaitAttempts = 600; // 60秒超时（增加超时时间）
    
    console.log(`[VideoPlayer] Waiting for ${pendingRequestsRef.current.size} OCR requests to complete...`);
    
    while (pendingRequestsRef.current.size > 0 && waitAttempts < maxWaitAttempts) {
      if (useOcrStore.getState().stats.status !== 'running') break;
      
      // 清理已完成的请求
      const pendingCountBefore = pendingRequestsRef.current.size;
      for (const itemId of Array.from(pendingRequestsRef.current)) {
        const item = requestQueue.getItemStatus(itemId as string);
        if (item && (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled')) {
          pendingRequestsRef.current.delete(itemId);
          console.log(`[VideoPlayer] Request ${itemId} completed with status: ${item.status}`);
        }
      }
      
      // 如果还有未完成的请求，等待
      if (pendingRequestsRef.current.size > 0) {
        if (waitAttempts % 10 === 0) { // 每10次尝试（1秒）记录一次
          console.log(`[VideoPlayer] Still waiting for ${pendingRequestsRef.current.size} requests, attempt ${waitAttempts}/${maxWaitAttempts}`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        waitAttempts++;
      } else {
        console.log(`[VideoPlayer] All requests completed after ${waitAttempts} attempts`);
        break;
      }
    }
    
    // 如果还有未完成的请求，记录警告并强制清理
    if (pendingRequestsRef.current.size > 0) {
      console.warn(`[VideoPlayer] Timed out waiting for ${pendingRequestsRef.current.size} OCR requests after ${maxWaitAttempts * 100}ms`);
      addLog('warning', `OCR processing timed out with ${pendingRequestsRef.current.size} pending requests`);
      
      // 强制清理未完成的请求
      for (const itemId of Array.from(pendingRequestsRef.current)) {
        console.log(`[VideoPlayer] Force cancelling request ${itemId}`);
        requestQueue.cancelItem(itemId as string);
      }
      pendingRequestsRef.current.clear();
    }
    
    setStats({ status: 'completed', endTime: Date.now() });
    addLog('info', 'OCR processing completed');
    
    if (wasPlaying) video.play();
  };

  // 停止OCR处理
  const stopOcrProcessing = () => {
    // 取消所有待处理的请求
    for (const itemId of Array.from(pendingRequestsRef.current)) {
      requestQueue.cancelItem(itemId as string);
    }
    pendingRequestsRef.current.clear();
    
    setStats({ status: 'idle' });
    addLog('info', 'OCR processing stopped');
  };

  // 监听OCR状态变化
  useEffect(() => {
    if (stats.status === 'running' && !isProcessingRef.current) {
      isProcessingRef.current = true;
      startOcrLoop().then(() => {
        isProcessingRef.current = false;
      }).catch(error => {
        console.error('OCR loop error:', error);
        addLog('error', `OCR processing error: ${error.message}`);
        setStats({ status: 'error' });
        isProcessingRef.current = false;
      });
    } else if (stats.status === 'idle' || stats.status === 'paused') {
      // 停止处理
      isProcessingRef.current = false;
    } else if (stats.status === 'completed' || stats.status === 'error') {
      isProcessingRef.current = false;
    }
  }, [stats.status]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (isProcessingRef.current) {
        stopOcrProcessing();
      }
    };
  }, []);

  if (!videoUrl) return null;

  const aspectRatio = videoDimensions.width > 0 && videoDimensions.height > 0 
    ? videoDimensions.width / videoDimensions.height 
    : 16/9;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Video Container */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-xl overflow-hidden shadow-2xl flex-1 min-h-[400px] flex items-center justify-center group"
      >
        {/* Video Control Buttons */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          {/* Close Button */}
          <button
            onClick={() => {
              if (window.confirm('确定要关闭当前视频吗？')) {
                reset();
              }
            }}
            className="p-2 bg-black/70 hover:bg-black/90 backdrop-blur-sm rounded-lg transition-all hover:scale-105 active:scale-95 border border-zinc-700 hover:border-zinc-500"
            title="关闭视频"
          >
            <X className="w-5 h-5 text-zinc-300" />
          </button>

          {/* Switch Video Button */}
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'video/*';
              input.multiple = false;
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  switchVideo(file);
                }
              };
              input.click();
            }}
            className="p-2 bg-black/70 hover:bg-black/90 backdrop-blur-sm rounded-lg transition-all hover:scale-105 active:scale-95 border border-zinc-700 hover:border-zinc-500"
            title="切换视频"
          >
            <Upload className="w-5 h-5 text-zinc-300" />
          </button>
        </div>
        {/* Aspect Ratio Wrapper */}
        <div 
          ref={wrapperRef}
          className="relative max-w-full max-h-full w-full"
          style={{ aspectRatio: `${aspectRatio}` }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={onPlay}
            onPause={onPause}
            muted={isMuted}
          />

          {/* Crop Overlay */}
          {wrapperSize.width > 0 && (
            <Rnd
              size={{
                width: `${cropRect.width}%`,
                height: `${cropRect.height}%`,
              }}
              position={{
                x: (cropRect.x / 100) * wrapperSize.width,
                y: (cropRect.y / 100) * wrapperSize.height,
              }}
              onDragStop={(e, d) => {
                setCropRect({
                  ...cropRect,
                  x: (d.x / wrapperSize.width) * 100,
                  y: (d.y / wrapperSize.height) * 100,
                });
              }}
              onResizeStop={(e, direction, ref, delta, position) => {
                setCropRect({
                  width: parseFloat(ref.style.width),
                  height: parseFloat(ref.style.height),
                  x: (position.x / wrapperSize.width) * 100,
                  y: (position.y / wrapperSize.height) * 100,
                });
              }}
              bounds="parent"
              className="border-2 border-green-500 bg-green-500/20 z-10 group-hover:opacity-100 transition-opacity"
              dragHandleClassName="drag-handle"
            >
              <div className="drag-handle w-full h-full cursor-move absolute top-0 left-0 flex items-center justify-center">
                 <span className="bg-black/50 text-white text-[10px] px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                   Subtitle Area
                 </span>
              </div>
            </Rnd>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 p-4 rounded-xl flex items-center gap-4">
        <button 
          onClick={togglePlay}
          className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={useVideoStore.getState().duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-zinc-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(useVideoStore.getState().duration)}</span>
          </div>
        </div>

        <button 
          onClick={() => {
            if (videoRef.current) {
               videoRef.current.muted = !isMuted;
               setIsMuted(!isMuted);
            }
          }}
          className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
