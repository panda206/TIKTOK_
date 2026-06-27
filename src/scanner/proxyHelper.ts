import { execSync } from 'child_process';
import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * 从 Windows 注册表检测并注入全局局域网代理
 * 保持原有逻辑不变，只做模块化抽离
 */
export function injectProxyFromRegistry(): void {
    if (process.platform !== 'win32') return;

    try {
        const result = execSync(
            `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer`,
            { stdio: ['pipe', 'pipe', 'ignore'] }
        ).toString();

        const match = result.match(/REG_SZ\s+(?:https?:\/\/)?([\d\.]+:\d+)/);
        if (match && match[1]) {
            const proxyUrl = `http://${match[1]}`;
            console.log(`🌐 [BigBro Proxy] 检测到系统局域网代理: ${proxyUrl}，正在注入底层...`);
            
            const agent = new HttpsProxyAgent(proxyUrl);
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
    } catch (e) {
        console.log(`ℹ️ [BigBro Proxy] 未发现系统注册表代理，将尝试直连。`);
    }
}