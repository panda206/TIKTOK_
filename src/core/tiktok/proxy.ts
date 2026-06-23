import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';
import { execSync } from 'child_process';

const COMMON_PORTS = [
    7890, 7891, 7893, 7897, // Clash 系列
    10808, 10809, 10810,    // v2rayN 系列
    1080, 8888, 8889, 41091
];

// 默认的基础 IP 列表
const CUSTOM_PROXY_IPS = [
    '127.0.0.1'
];

let globalAgent: any = null;

/**
 * 自动从 Windows 注册表获取系统代理的 IP
 */
function getWindowsSystemProxyIp(): string | null {
    if (process.platform !== 'win32') return null;
    
    try {
        const result = execSync(
            `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer`,
            { stdio: ['pipe', 'pipe', 'ignore'] }
        ).toString();

        // 正则提取出其中的 IP 地址 (例如 192.168.0.23)
        const match = result.match(/REG_SZ\s+(?:https?:\/\/)?([\d\.]+):/);
        if (match && match[1]) {
            return match[1];
        }
    } catch (e) {
        // 未设置代理或读取失败时，直接忽略
    }
    return null;
}

export async function autoDetectAndInjectProxy() {
    console.log(`🤖 [Proxy] 开始智能网络环境检测...`);

    // ---------------------------------------------
    // 阶段 1: 检测是否可以直接连接（适用于软路由/透明代理/全局VPN）
    // ---------------------------------------------
    try {
        await axios.get('https://www.tiktok.com', { timeout: 2500 });
        console.log(`✅ [Proxy] 当前网络可直连 TikTok（可能是软路由/全局VPN），无需注入代理。`);
        return; 
    } catch (e) {
        console.log(`ℹ️ [Proxy] 直连失败，开始构建局域网嗅探目标...`);
    }

    // ---------------------------------------------
    // 阶段 2: 动态将系统代理 IP 合并到 CUSTOM_PROXY_IPS
    // ---------------------------------------------
    const targets = [...CUSTOM_PROXY_IPS];
    
    const sysProxyIp = getWindowsSystemProxyIp();
    if (sysProxyIp && !targets.includes(sysProxyIp)) {
        targets.push(sysProxyIp);
        console.log(`🔍 [Proxy] 从注册表发现系统代理 IP: ${sysProxyIp}，已加入扫描队列。`);
    }

    // ---------------------------------------------
    // 阶段 3: 多IP + 多端口并发嗅探
    // ---------------------------------------------
    console.log(`⚡ [Proxy] 正在对目标 ${JSON.stringify(targets)} 进行多端口并发嗅探...`);
    const sniffTasks: Promise<{ agent: any; url: string }>[] = [];

    for (const ip of targets) {
        for (const port of COMMON_PORTS) {
            const proxyUrl = `http://${ip}:${port}`;
            
            const task = (async () => {
                const agent = new HttpsProxyAgent(proxyUrl);
                try {
                    await axios.get('https://www.tiktok.com', {
                        httpsAgent: agent,
                        timeout: 2000
                    });
                    return { agent, url: proxyUrl };
                } catch {
                    throw new Error('fail');
                }
            })();
            
            sniffTasks.push(task);
        }
    }

    try {
        // 使用 Promise.any 哪个最快连通就用哪个
        const winner = await Promise.any(sniffTasks);
        console.log(`✅ [Proxy] 嗅探成功！已锁定有效代理: ${winner.url}`);
        injectGlobalAgent(winner.agent);
    } catch {
        console.log(`❌ [Proxy] 未发现任何有效的本地或局域网代理。`);
    }
}

/**
 * 全局 HTTP/HTTPS 请求劫持注入
 */
function injectGlobalAgent(agent: any) {
    globalAgent = agent;
    const originHttp = http.request;
    const originHttps = https.request;

    (http as any).request = function (...args: any[]) {
        const opt = args[0];
        if (opt && !opt.agent) opt.agent = agent;
        return originHttp.apply(this, args as any);
    };

    (https as any).request = function (...args: any[]) {
        const opt = args[0];
        if (opt && !opt.agent) opt.agent = agent;
        return originHttps.apply(this, args as any);
    };
}