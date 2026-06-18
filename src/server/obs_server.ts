console.log("🔥 obs_server.ts 已加载");
import express from "express";
import path from "path";

const app: express.Express = express();

const overlayPath = path.join(__dirname, "../../dist/overlay");

// 挂载到 /overlay
app.use("/overlay", express.static(overlayPath));


const PORT = 3000;

app.listen(PORT, () => {
    console.log("\n🚀 OBS Server 已启动");
    console.log(`消息框： http://localhost:${PORT}/overlay/message`);
    console.log(`排行榜： http://localhost:${PORT}/overlay/rank`);
    console.log(`礼物榜： http://localhost:${PORT}/overlay/gift`);
});