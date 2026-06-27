import https from "https";

const cache = new Map<string, string>();

export function translate(text: string): Promise<string> {
    const key = text.trim().toLowerCase();

    if (cache.has(key)) {
        return Promise.resolve(cache.get(key)!);
    }

    // 修改这里的 langpair 变更为 autodetect|en
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|zh`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                try {
                    const json = JSON.parse(data);
                    const result = json.responseData.translatedText || text;

                    cache.set(key, result);

                    resolve(result);
                } catch (err) {
                    resolve(text); // 失败就返回原文
                }
            });

        }).on("error", () => {
            resolve(text);
        });
    });
}