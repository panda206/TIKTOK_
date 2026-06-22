console.log("🔥 Canvas Overlay 已启动");

import { wsClient } from "../common/websocket.js";

interface MessageItem {
    id: string;
    user: string;
    text: string;
    avatar?: string;
}

const messages: MessageItem[] = [];
const MAX_MESSAGE = 10;

// 获取内部的消息滚动子区域
const messageScrollArea = document.getElementById("messageScrollArea") as HTMLDivElement;
const messageElements: HTMLDivElement[] = [];

wsClient.on((data: any) => {
    handleMessage(data);
});

function addMessage(user: string, text: string, avatar: string = "") {
    const msgId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMsg: MessageItem = { id: msgId, user, text, avatar };
    
    messages.push(newMsg);

    // 1. 创建新弹幕的 DOM 节点
    const div = document.createElement("div");
    // 💡 初始状态只给基础类名，不加激活动画的类名
    div.className = "message"; 

    div.innerHTML = `
        <div class="message-wrapper">
            <div class="message-row">
                <img class="avatar"
                     src="${newMsg.avatar || 'https://dummyimage.com/50x50/444/fff.png&text=?'}"
                     onerror="this.src='https://dummyimage.com/50x50/444/fff.png&text=?'"
                />
                <span class="user">${newMsg.user}</span>
            </div>
            <span class="content">${newMsg.text}</span>
        </div>
    `;

    // 2. 将新 DOM 追加到内部的滚动区域
    messageScrollArea.appendChild(div);
    messageElements.push(div);

    // 💡【核心修复：垂直滚动的缓动秘诀】
    // 强制刷新一次布局后，在下一帧赋予进入状态，迫使浏览器执行 height 和 margin 的缓动过渡
    document.body.offsetHeight; 
    
    requestAnimationFrame(() => {
        div.classList.add("is-entered");
    });

    // 3. 如果超过最大数量，移除最老的那一条
    if (messages.length > MAX_MESSAGE) {
        messages.shift();
        
        const oldEl = messageElements.shift();
        if (oldEl) {
            oldEl.classList.remove("is-entered"); // 移除进入状态，触发回缩动画
            oldEl.classList.add("is-exit");
            
            setTimeout(() => {
                oldEl.remove();
            }, 350); 
        }
    }
}

function handleMessage(data: any) {
    switch (data.type) {
        case "chat": addMessage(data.name, data.message, data.avatar || ""); break;
        case "like": addMessage(data.name, `点赞 x${data.count}`, data.avatar || ""); break;
        case "member": addMessage(data.name, "进入直播间", data.avatar || ""); break;
        default: console.log("❓ 其他类型:", data.type);
    }
}