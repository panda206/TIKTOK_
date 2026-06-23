import { chromium } from 'playwright';
import { bus } from './bus';
import { startBigBro } from './getBigBro';
import { execSync } from 'child_process';

/**
 * 独立从注册表提取 Proxy 给 Playwright 使用
 */
function getPlaywrightProxy(): { server: string } | undefined {
    if (process.platform !== 'win32') return undefined;
    try {
        const result = execSync(
            `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer`,
            { stdio: ['pipe', 'pipe', 'ignore'] }
        ).toString();
        const match = result.match(/REG_SZ\s+(?:https?:\/\/)?([\d\.]+:\d+)/);
        if (match && match[1]) {
            return { server: `http://${match[1]}` };
        }
    } catch (e) {}
    return undefined;
}

/**
 * 🌟 格式化换算：将 '1.2K', '450', '1M' 转换为真实数字
 */
function parseViewerStringToNumber(text: string): number {
    if (!text || text === '未知') return 0;
    const cleanText = text.toUpperCase().trim();
    const numMatch = cleanText.match(/[\d\.]+/);
    if (!numMatch) return 0;
    
    const num = parseFloat(numMatch[0]);
    if (cleanText.includes('K')) return num * 1000;
    if (cleanText.includes('M')) return num * 1000000;
    return Math.floor(num) || 0;
}

async function run() {
    console.log('1️⃣ [Scraper] 启动 BigBro 消费者端监听...');
    await startBigBro();

    const scannedHosts = new Set<string>();
    const browserProxy = getPlaywrightProxy();

    if (browserProxy) {
        console.log(`🌐 [Scraper] 识别到专属局域网代理，应用于浏览器: ${browserProxy.server}`);
    } else {
        console.log(`ℹ️ [Scraper] 未检测到局域网代理，浏览器将尝试直连（软路由环境）。`);
    }

    console.log('2️⃣ [Scraper] 正在拉起无头浏览器...');
    const browser = await chromium.launch({
        headless: true,
        proxy: browserProxy,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security'
        ]
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    console.log('3️⃣ [Scraper] 正在加载 TikTok 直播大厅页...');
    try {
        await page.goto('https://www.tiktok.com/live', {
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
    } catch (err) {
        console.error('❌ [Scraper] 页面加载超时，请确保代理端开启了“允许局域网连接”。');
        await browser.close();
        return;
    }

    await page.waitForTimeout(5000);
    console.log('🚀 [Scraper] 成功进入大厅，开始疯狂向下滚动并扫描...');

    for (let i = 0; i < 60000; i++) {
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 1.5);
        });

        try {
            // ⭐ 核心复刻：采用你原有已被证实的 100% 准确人数提取逻辑
            const domLiveItems: { uniqueId: string; viewerCountStr: string }[] = await page.evaluate(() => {
                const results: { uniqueId: string; viewerCountStr: string }[] = [];
                const links = document.querySelectorAll('a[href*="/@"]');

                links.forEach(el => {
                    const href = el.getAttribute('href');
                    const match = href?.match(/\/@([^/?#]+)/);
                    if (!match || match[1] === 'live') return;

                    const uniqueId = match[1];
                    if (results.some(r => r.uniqueId === uniqueId)) return;

                    const card =
                        el.closest('[data-e2e="live-card"]') ||
                        el.closest('div[class*="DivLiveCard"]') ||
                        el.closest('div');

                    if (!card) return;

                    let viewerCountStr = '未知';
                    const textNodes: string[] = [];

                    card.querySelectorAll('div, span, p').forEach(n => {
                        const t = (n.textContent || '').trim();
                        if (!t) return;
                        if (t.includes('@')) return;
                        if (t.length > 10) return;
                        textNodes.push(t);
                    });

                    // 检索纯数字或带有 K/M 尾缀的有效字符串
                    const candidates = textNodes.filter(t =>
                        /^\d+(\.\d+)?[KkMm]?$/.test(t)
                    );

                    if (candidates.length > 0) {
                        viewerCountStr = candidates[0];
                    }

                    const fullText = card.textContent || '';
                    const match2 = fullText.match(/(\d+(\.\d+)?[KkMm]?)\s*(watching|viewers|人在线|观看)/i);

                    if (viewerCountStr === '未知' && match2) {
                        viewerCountStr = match2[1];
                    }

                    results.push({ uniqueId, viewerCountStr });
                });

                return results;
            });

            // ============================================
            // 🚀 核心过滤与发送区
            // ============================================
            for (const item of domLiveItems) {
                if (scannedHosts.has(item.uniqueId)) continue;

                // 1. 转换文本数字
                const numericCount = parseViewerStringToNumber(item.viewerCountStr);

                // 2. 🌟 严格筛选过滤：只有人数大于等于 10 人的才放行
                if (numericCount < 10) {
                    // console.log(`⏭️ [Scraper] 过滤低人气/未识别主播: @${item.uniqueId} (捕捉到人数: ${item.viewerCountStr})`);
                    continue;
                }

                // 满足通过条件，录入集合，防止重复推流
                scannedHosts.add(item.uniqueId);
                console.log(`🎯 [Scraper] 发现新主播: @${item.uniqueId.padEnd(20)} | 🔥 在线人数: ${item.viewerCountStr.padEnd(6)} -> 正在派发任务...`);
                
                // 📡 满足条件后，实时推送给 getBigBro 进行采集
                bus.emit('hosts', [item.uniqueId]);
            }

        } catch (e) {
            // ignore
        }

        await page.waitForTimeout(2500 + Math.random() * 1500);
    }

    await browser.close();
}

// 启动入口
console.log("🎬 正在初始化启动 Scanner 独立模块...");
run().catch(err => {
    console.error("🔥 运行时发生异常:", err);
});