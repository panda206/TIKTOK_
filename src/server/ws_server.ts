console.log("🔥 ws_server.ts 已加载");
import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({
    port: 3001
});

console.log("🚀 WS Server 已启动");
console.log("👉 ws://localhost:3001");

export function broadcast(data: any) {

    console.log("📤 广播数据___:", data, "\n");

    const json = JSON.stringify(data);

    console.log("当前连接数:", wss.clients.size);

    wss.clients.forEach((client: WebSocket) => {

        if (client.readyState === WebSocket.OPEN) {

            console.log("发送给客户端");

            client.send(json);

        }

    });

}