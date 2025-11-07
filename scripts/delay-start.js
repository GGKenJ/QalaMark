// Скрипт для задержки запуска frontend на 3 секунды
const { spawn } = require('child_process');
const path = require('path');

const delay = 3000; // 3 секунды

console.log(`⏳ Ожидание ${delay / 1000} секунд перед запуском frontend...`);

setTimeout(() => {
  console.log('🚀 Запуск frontend...');
  const frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..', 'frontend'),
    stdio: 'inherit',
    shell: true
  });

  frontendProcess.on('error', (error) => {
    console.error('❌ Ошибка при запуске frontend:', error);
    process.exit(1);
  });

  frontendProcess.on('exit', (code) => {
    process.exit(code);
  });
}, delay);

