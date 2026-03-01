// 测试字幕数据流
console.log('=== 测试字幕数据流 ===\n');

// 模拟数据流测试
console.log('1. 测试数据流路径:');
console.log('   OCR Worker完成识别 → Worker管理器收到结果 → 请求队列处理完成 → 触发itemCompleted事件 → VideoPlayer监听事件并调用addSubtitle');

console.log('\n2. 关键修复点:');
console.log('   ✅ 修复了worker-manager.ts中的handleWorkerMessage方法');
console.log('      - 现在正确提取data.result而不是传递整个消息对象');
console.log('      - OCR结果格式: { text, timestamp, requestId, processingTime, confidence }');

console.log('\n3. 调试日志添加位置:');
console.log('   ✅ request-queue.ts: processItem方法添加详细日志');
console.log('   ✅ VideoPlayer.tsx: 事件监听器添加详细日志');
console.log('   ✅ useSubtitleStore.ts: addSubtitle方法添加日志');
console.log('   ✅ worker-manager.ts: handleWorkerMessage方法添加日志');

console.log('\n4. 预期数据流:');
console.log('   1. OCR Worker发送: { type: "OCR_RESULT", id: "...", result: { text: "...", timestamp: 0, requestId: "..." } }');
console.log('   2. Worker Manager接收并提取: data.result');
console.log('   3. Request Queue接收: workerManager.submitOcrRequest()返回OcrResult');
console.log('   4. Queue触发: emit("itemCompleted", item)其中item.result = OcrResult');
console.log('   5. VideoPlayer监听: handleQueueItemCompleted(event)提取event.result');
console.log('   6. 调用: addSubtitle({ id: "...", startTime: timestamp, endTime: timestamp + interval, text })');
console.log('   7. Subtitle Store: 存储字幕并排序');

console.log('\n5. 验证步骤:');
console.log('   a. 启动应用 (npm run dev)');
console.log('   b. 上传视频文件');
console.log('   c. 设置OCR区域');
console.log('   d. 点击开始OCR处理');
console.log('   e. 检查浏览器控制台日志:');
console.log('      - [WorkerManager] Received message from ocr worker');
console.log('      - [Queue] Item ... completed successfully');
console.log('      - [VideoPlayer] Received itemCompleted event');
console.log('      - [SubtitleStore] Adding subtitle');
console.log('   f. 检查时间线中是否显示字幕');

console.log('\n6. 常见问题排查:');
console.log('   ❌ 问题: 事件没有被正确触发');
console.log('       检查: request-queue.ts中的emit调用，确保item.result存在');
console.log('   ❌ 问题: 事件数据格式不正确');
console.log('       检查: worker-manager.ts中的completeTask方法，确保传递正确的result');
console.log('   ❌ 问题: addSubtitle调用失败');
console.log('       检查: VideoPlayer.tsx中的事件处理函数，确保正确提取text和timestamp');
console.log('   ❌ 问题: 字幕存储有问题');
console.log('       检查: useSubtitleStore.ts中的addSubtitle函数，确保正确排序');

console.log('\n=== 测试完成 ===');
console.log('请按照上述步骤验证字幕数据流是否正常工作。');
console.log('如果问题仍然存在，请检查浏览器控制台的具体错误信息。');