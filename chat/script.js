// API 配置
const API_URL = '/api/chat';

// 对话历史
let conversationHistory = [];

// DOM 元素
const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 自动调整输入框高度
    messageInput.addEventListener('input', autoResizeTextarea);

    // 表单提交
    chatForm.addEventListener('submit', handleSubmit);

    // Enter 发送，Shift+Enter 换行
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
});

/**
 * 自动调整输入框高度
 */
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
}

/**
 * 处理表单提交
 */
async function handleSubmit(e) {
    e.preventDefault();

    const message = messageInput.value.trim();
    if (!message) return;

    // 添加用户消息
    addMessage(message, 'user');
    conversationHistory.push({ role: 'user', content: message });

    // 清空输入框
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // 禁用输入
    setInputEnabled(false);

    // 显示输入指示器
    const typingIndicator = showTypingIndicator();

    try {
        // 发送请求
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: conversationHistory,
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 4096
            })
        });

        // 移除输入指示器
        typingIndicator.remove();

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '请求失败');
        }

        const data = await response.json();

        // 提取助手回复
        const assistantMessage = data.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');

        // 添加助手消息
        addMessage(assistantMessage, 'assistant');
        conversationHistory.push({ role: 'assistant', content: assistantMessage });

    } catch (error) {
        console.error('Error:', error);
        typingIndicator.remove();
        addMessage('抱歉，发生了错误：' + error.message, 'error');
    } finally {
        setInputEnabled(true);
        messageInput.focus();
    }
}

/**
 * 添加消息到界面
 */
function addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    // 滚动到底部
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * 显示输入指示器
 */
function showTypingIndicator() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';

    messageDiv.appendChild(indicator);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageDiv;
}

/**
 * 设置输入状态
 */
function setInputEnabled(enabled) {
    messageInput.disabled = !enabled;
    sendButton.disabled = !enabled;
}
