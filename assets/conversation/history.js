// Conversations and attachments stay on this browser, independently of server usage logs.
window.ChatArchive = (() => {
    let database;
    function open() {
        if (!database) database = new Promise((resolve, reject) => {
            const request = indexedDB.open('koa-chat-history', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('conversations', { keyPath: 'id' });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error('历史记录被其他标签页占用'));
        });
        return database;
    }
    async function transact(mode, action) {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('conversations', mode);
            const request = action(tx.objectStore('conversations'));
            tx.oncomplete = () => resolve(request.result);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('保存中断'));
        });
    }
    return {
        list: () => transact('readonly', store => store.getAll()),
        save: value => transact('readwrite', store => store.put(value)),
        remove: id => transact('readwrite', store => store.delete(id))
    };
})();
