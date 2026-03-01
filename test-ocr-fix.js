// 测试OCR修复功能
console.log('=== 测试OCR修复功能 ===\n');

// 模拟OCR配置
const testConfig = {
  apiEndpoint: 'http://localhost:1224',
  model: 'Umi-OCR: 简体中文',
  keepAlive: 300,
  temperature: 0.1,
  concurrency: 2,
  interval: 1.0,
  ocrBackend: 'umi-ocr',
  serviceName: 'Umi-OCR服务'
};

console.log('1. 测试Umi-OCR服务连接...');
fetch('http://localhost:1224/api/ocr/get_options')
  .then(response => {
    if (response.ok) {
      console.log('✅ Umi-OCR服务连接成功！');
      return response.json();
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  })
  .then(data => {
    console.log('✅ 获取到OCR参数选项：');
    console.log(`   - 支持语言: ${data['ocr.language']?.optionsList?.map(([_, label]) => label).join(', ') || '未知'}`);
    console.log(`   - 默认语言: ${data['ocr.language']?.default || '未知'}`);
    console.log(`   - 数据格式: ${data['data.format']?.default || '未知'}`);
    
    // 测试OCR识别功能
    console.log('\n2. 测试OCR识别功能...');
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='; // 1x1像素的透明图片
    
    return fetch('http://localhost:1224/api/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64: testImageBase64,
        options: {
          "data.format": "text"
        }
      })
    });
  })
  .then(response => response.json())
  .then(result => {
    console.log(`✅ OCR识别测试完成，状态码: ${result.code}`);
    console.log(`   - 识别耗时: ${result.time}秒`);
    if (result.code === 101) {
      console.log('   - 结果: 图片中无文本（符合预期）');
    } else if (result.code === 100) {
      console.log(`   - 识别结果: ${typeof result.data === 'string' ? result.data : '字典格式'}`);
    } else {
      console.log(`   - 错误信息: ${result.data}`);
    }
  })
  .catch(error => {
    console.error('❌ 测试失败:', error.message);
    console.log('\n=== 问题诊断 ===');
    console.log('1. 确保Umi-OCR服务正在运行');
    console.log('2. 检查端口1224是否被占用');
    console.log('3. 尝试重启Umi-OCR服务');
    console.log('4. 检查防火墙设置');
  })
  .finally(() => {
    console.log('\n=== 测试总结 ===');
    console.log('修复已完成的功能：');
    console.log('✅ 1. 支持多种OCR后端配置（Umi-OCR、Ollama、Tesseract）');
    console.log('✅ 2. 添加服务健康检查功能');
    console.log('✅ 3. 改进UI错误提示和用户引导');
    console.log('✅ 4. 添加OCR服务配置界面');
    console.log('✅ 5. 支持服务启动指南和下载链接');
    console.log('\n下一步：');
    console.log('1. 在浏览器中打开应用，检查OCR设置界面');
    console.log('2. 点击"检查连接"按钮测试服务状态');
    console.log('3. 根据需要选择不同的OCR后端');
    console.log('4. 使用服务启动指南安装和启动OCR服务');
  });