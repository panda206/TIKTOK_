import { chromium } from 'playwright';

async function run() {
    const scannedHosts = new Set<string>();

    const browser = await chromium.launch({
        headless: true, // 需要后台静默运行可以改为 true
        args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    console.log('🚀 正在打开 TikTok 直播大厅...');
    page.setDefaultTimeout(60000);
    await page.goto('https://www.tiktok.com/live', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);

    console.log('开始向下滚动页面并进行【精准图标定位】抓取...');
    
    for (let i = 0; i < 60000; i++) {
        // 向下滚动
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 1.5);
        });

        // 每滚动一次，进行一次精准的 DOM 关系扫描
        try {
            const domLiveItems = await page.evaluate(() => {
    const results: { uniqueId: string; viewerCount: string }[] = [];

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

        let viewerCount = '未知';

        // ================================
        // 🔥 核心修复：不用 SVG，直接做“文本密度筛选”
        // ================================

        const textNodes: string[] = [];

        card.querySelectorAll('div, span, p').forEach(n => {
            const t = (n.textContent || '').trim();

            if (!t) return;

            // 过滤账号
            if (t.includes('@')) return;

            // 过滤太长文本（标题/描述）
            if (t.length > 10) return;

            textNodes.push(t);
        });

        // ================================
        // 🎯 找“最像人数”的字段
        // ================================
        const candidates = textNodes.filter(t =>
            /^\d+(\.\d+)?[KkMm]?$/.test(t)
        );

        if (candidates.length > 0) {
            viewerCount = candidates[0];
        }

        // ================================
        // 🔥 第二层：找带 watching/viewers 的标签
        // ================================
        if (viewerCount === '未知') {
            const fullText = card.textContent || '';

            const match =
                fullText.match(/(\d+(\.\d+)?[KkMm]?)\s*(watching|viewers|人在线|观看)/i);

            if (match) {
                viewerCount = match[1];
            }
        }

        // ================================
        // 🔥 第三层：兜底（抓最大概率数字）
        // ================================
        if (viewerCount === '未知') {
            const numbers = textNodes
                .filter(t => /^\d+(\.\d+)?[KkMm]?$/.test(t))
                .sort((a, b) => b.length - a.length);

            if (numbers.length > 0) {
                viewerCount = numbers[0];
            }
        }

        results.push({ uniqueId, viewerCount });
    });

    return results;
});

            // 打印本次扫描到的全新主播
            domLiveItems.forEach(item => {
                if (!scannedHosts.has(item.uniqueId)) {
                    scannedHosts.add(item.uniqueId);
                    // 彻底过滤掉误抓等于账号名、或者拿到空数据的脏数据
                    if (item.viewerCount !== '未知' && item.viewerCount !== item.uniqueId) {
                        console.log(`🎯 [🎯 核心精准定位] 账号(@): ${item.uniqueId.padEnd(20)} | 🔥 在线人数: ${item.viewerCount}`);
                    }
                }
            });

        } catch (e) {
            // 忽略单次解析错误
        }

        // 随机等待，防止滚动过快
        await page.waitForTimeout(2500 + Math.random() * 1500);

        if (i % 5 === 0) {
            console.log(`📊 累计捕获唯一主播总数: ${scannedHosts.size} 个`);
        }
    }

    console.log(`🏁 任务结束，共计获取 ${scannedHosts.size} 个真实直播数据。`);
    await browser.close();
}

run().catch(console.error);