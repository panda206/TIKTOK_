const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
const usernameInput = document.getElementById('username') as HTMLInputElement;
const statusText = document.getElementById('status') as HTMLDivElement;
const logBox = document.getElementById('log') as HTMLDivElement;
const viewerCount = document.getElementById('viewer') as HTMLDivElement;
const levelBox = document.getElementById('levelBox') as HTMLDivElement;
console.log('renderer loaded');
// ==========================================
// 🔍 阶段一：验证 renderer.ts 是否被成功加载运行
// ==========================================
console.log("%c▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓", "color: #00f0ff; font-weight: bold;");
console.log("%c🚀 [TEST LOG] 恭喜！renderer.ts 已经成功被浏览器内核加载并运行了！", "color: #00ffaa; font-size: 14px; font-weight: bold;");
console.log(`⏱️  当前装载时间: ${new Date().toLocaleString()}`);
console.log("🔍 DOM 元素探测状态:", {
    connectBtn: connectBtn ? "✅ 成功获取" : "❌ 未找到(检查ID)",
    usernameInput: usernameInput ? "✅ 成功获取" : "❌ 未找到(检查ID)",
    statusText: statusText ? "✅ 成功获取" : "❌ 未找到(检查ID)"
});
console.log("%c▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓", "color: #00f0ff; font-weight: bold;");


let isConnecting = false;

//  修改后：改用 var。哪怕被重复加载，也只是覆盖赋值，绝对不会抛出 SyntaxError 卡死程序！
const electronAPI = (window as any).electronAPI;

// 或者更彻底一点，把后面所有用到 electronAPI 的地方，直接改成 (window as any).electronAPI

if (!electronAPI) {
    console.error('❌ [CRITICAL] electronAPI 未能注入，请检查 preload.js 是否配置正确！');
    if (statusText) statusText.innerText = '❌ SYSTEM CRITICAL: PRELOAD LAYER MISSING';
}


connectBtn.addEventListener('click', () => {
    console.log('🟡 [DEBUG] Connect trigger sequence engaged.');
});


if (connectBtn && usernameInput) {
    connectBtn.addEventListener('click', async () => {
        console.log('🟡 [DEBUG] Connect trigger sequence engaged.');
        const username = usernameInput.value.trim();

        if (!username) {
            if (statusText) statusText.innerText = '⚠️ INPUT REQUIRED: SUBMIT VALID USERNAME';
            return;
        }

        if (isConnecting) return;

        isConnecting = true;
        connectBtn.disabled = true;
        
        if (statusText) statusText.innerText = `🔄 正在连接： @${username.toUpperCase()}...`;

        try {
            // 安全阻断探测，确保不引起内核死锁
            if (electronAPI && typeof electronAPI.connect === 'function') {
                await electronAPI.connect(username);
                if (statusText) statusText.innerText = `🚀 已连接 @${username} 直播间！`;
            } else {
                throw new Error('connect method not exposed on electronAPI');
            }
        } catch (err: any) {
            console.error('❌ Connection Pipeline Failed:', err);
            if (statusText) statusText.innerText = `❌ LINK REJECTED: ${err.message || 'UNKNOWN INTERFACES'}`;
        } finally {
            isConnecting = false;
            connectBtn.disabled = false;
        }
    });
}

/**
 * 🛰️ 建立动态事件集中挂载器
 */
if (electronAPI && typeof electronAPI.onLog === 'function') {
    electronAPI.onLog((msg: any) => {

    console.log("onLog triggered", msg);

    if (!logBox) return;

    // =========================
    // 1️⃣ rank 类型（核心修复）
    // =========================
    if (msg?.type === 'rank') {

        levelBox.innerHTML = '';

        msg.list.forEach((item: any) => {

            const row = document.createElement('div');
            row.style.marginBottom = '4px';
            row.style.borderBottom = '1px solid #1a1126';

            row.innerText =
                `#${item.rank} LV.${item.level} ${item.user} ${item.coin}`;

            levelBox.appendChild(row);
        });

        return;
    }

    // =========================
    // 2️⃣ 在线人数（string）
    // =========================
      // 在线人数
    if (msg?.type === 'viewer') {

        viewerCount.innerText =
            Number(msg.value || 0).toLocaleString();

        return;
    }

    // =========================
    // 3️⃣ 重置
    // =========================
    if (msg.includes('🛸 ============') || msg.includes('🔥 当前已捕获到的')) {
        levelBox.innerHTML = '';
        return;
    }

    // =========================
    // 4️⃣ 普通日志
    // =========================
    const row = document.createElement('div');
    row.className = 'log-row';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.innerText = `[${new Date().toLocaleTimeString()}]`;

    const textSpan = document.createElement('span');
    textSpan.innerText = msg;

    row.appendChild(timeSpan);
    row.appendChild(textSpan);

    logBox.appendChild(row);
    logBox.scrollTop = logBox.scrollHeight;
});
}