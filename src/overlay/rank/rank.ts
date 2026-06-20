console.log("🔥 Rank Overlay 已启动");

import { wsClient } from "../common/websocket.js";

interface RankItem {
    rank: number;
    user: string;
    avatar: string;
    name: string;
    level: number;
    coin: number;
}

const rankLayer = document.getElementById("rankList") as HTMLDivElement;

/**
 * DOM池（使用 user 作为唯一 Key）
 */
const domMap = new Map<string, HTMLDivElement>();

let rankList: RankItem[] = [];

// ======================
// WebSocket
// ======================
wsClient.on((data: any) => {
    if (data.type === "rank") {
        console.log("🏆 rank数据：", data.list);

        // 强制截取前 5 名
        rankList = [...data.list].slice(0, 5);

        renderRankFLIP();
    }
});

/**
 * 使用 FLIP 机制的渲染函数
 */
function renderRankFLIP() {
    // ---- 1. FIRST: 记录当前所有已存在节点的位置 ----
    const firstPositions = new Map<string, DOMRect>();
    domMap.forEach((el, user) => {
        if (el.parentElement) {
            firstPositions.set(user, el.getBoundingClientRect());
        }
    });

    // ---- 2. UPDATE: 更新 DOM 结构与顺序 ----
    const currentKeys = new Set<string>();

    rankList.forEach((item) => {
        currentKeys.add(item.user);
        let el = domMap.get(item.user);

        if (!el) {
            el = createItem(item);
            domMap.set(item.user, el);
            el.classList.add("is-new");
        } else {
            updateItem(el, item);
            el.classList.remove("is-new");
        }

        // appendChild 调整 DOM 顺序
        rankLayer.appendChild(el);
    });

    // 移除掉榜 DOM
    domMap.forEach((el, user) => {
        if (!currentKeys.has(user)) {
            el.remove();
            domMap.delete(user);
        }
    });

    // ---- 3. INVERT: 计算位移差，强行“逆转时间”拉回老位置 ----
    domMap.forEach((el, user) => {
        if (el.classList.contains("is-new")) return;

        const firstRect = firstPositions.get(user);
        if (!firstRect) return;

        const lastRect = el.getBoundingClientRect();
        
        const invertX = firstRect.left - lastRect.left;
        const invertY = firstRect.top - lastRect.top;

        if (invertX !== 0 || invertY !== 0) {
            // 瞬间关掉过渡，并固定在老位置
            el.style.transition = "none";
            el.style.transform = `translate3d(${invertX}px, ${invertY}px, 0px)`;
        }
    });

    // ---- 4. PLAY: 终极解法 —— 强迫浏览器在下一帧渲染后再开动画 ----
    // 读取一次属性强刷当前帧布局
    document.body.offsetHeight;

    // 使用 setTimeout(..., 20) 或者双重 rAF，确保给浏览器留出足够的时间去渲染“老位置”
    setTimeout(() => {
        domMap.forEach((el) => {
            if (el.classList.contains("is-new")) return;
            
            // 恢复 CSS 里的 transition 过渡
            el.style.transition = "";
            el.style.transform = ""; 
        });
    }, 20); // 20ms 的延迟足以避开所有现代浏览器和 OBS 内核的合并优化
}

// ======================
// 创建 DOM
// ======================
function createItem(item: RankItem) {
    const div = document.createElement("div");
    div.className = "rank-item";

    div.innerHTML = `
        <div class="rank-number">#${item.rank}</div>
        <img class="avatar" src="${item.avatar}" />
        <div class="rank-info">
            <div class="name">${item.name}</div>
            <div class="detail">Lv.${item.level} · ${item.coin}</div>
        </div>
    `;

    return div;
}

// ======================
// 更新 DOM 局部属性
// ======================
function updateItem(el: HTMLDivElement, item: RankItem) {
    el.querySelector(".rank-number")!.textContent = `#${item.rank}`;
    el.querySelector(".name")!.textContent = item.name;
    el.querySelector(".detail")!.textContent = `Lv.${item.level} · ${item.coin}`;

    const img = el.querySelector("img") as HTMLImageElement;
    if (img.src !== item.avatar) {
        img.src = item.avatar;
    }
}