// src/overlay/common/websocket.ts
console.log("🔥 websocket.ts 已加载");
export type WSDataHandler = (data: any) => void;

class WSClient {
    private ws: WebSocket;
    private listeners: WSDataHandler[] = [];

    constructor() {
        this.ws = new WebSocket("ws://localhost:3001");

        this.ws.onopen = () => {
            console.log("✅ WebSocket连接成功");
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit(data);
            } catch (err) {
                console.error("❌ WS数据解析失败:", err);
            }
        };

        this.ws.onclose = () => {
            console.log("⚠️ WebSocket已断开");
        };
    }

    // 订阅数据（🌟 显式加上 public 确保外部可见） start
    public on(handler: WSDataHandler) {
        this.listeners.push(handler);
    }

    // 广播数据
    private emit(data: any) {
        this.listeners.forEach(fn => fn(data));
    }
}

export const wsClient = new WSClient();