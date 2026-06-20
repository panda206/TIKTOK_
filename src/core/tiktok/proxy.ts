import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';

const COMMON_PORTS = [
    10808,10809,10810,
    7890,7891,7893,7897,
    1080,8888,8889,41091
];

let globalAgent: any = null;

export async function autoDetectAndInjectProxy() {

    console.log(`🤖 [Proxy] 检测VPN...`);

    const sniffTasks = COMMON_PORTS.map(async (port) => {

        const agent = new HttpsProxyAgent(`http://127.0.0.1:${port}`);

        try {
            await axios.get('https://www.tiktok.com', {
                httpsAgent: agent,
                timeout: 2000
            });

            return { agent, port };

        } catch {
            throw new Error('fail');
        }
    });

    try {
        const winner = await Promise.any(sniffTasks);
        globalAgent = winner.agent;

        console.log(`✅ VPN端口: ${winner.port}`);

        const originHttp = http.request;
        const originHttps = https.request;

        (http as any).request = function (...args: any[]) {
            const opt = args[0];
            if (opt && !opt.agent) opt.agent = winner.agent;
            return originHttp.apply(this, args as any);
        };

        (https as any).request = function (...args: any[]) {
            const opt = args[0];
            if (opt && !opt.agent) opt.agent = winner.agent;
            return originHttps.apply(this, args as any);
        };

    } catch {
        console.log(`⚠️ 未发现VPN`);
    }
}