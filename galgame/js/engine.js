/**
 * Galgame 视觉小说引擎
 * 处理对话显示、选项、场景切换等核心功能
 */

class VisualNovelEngine {
    constructor() {
        // DOM 元素
        this.titleScreen = document.getElementById('title-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.endingScreen = document.getElementById('ending-screen');
        this.loadingScreen = document.getElementById('loading-screen');
        this.loadingProgress = document.getElementById('loading-progress');
        this.loadingText = document.getElementById('loading-text');

        this.background = document.getElementById('background');
        this.characterImg = document.getElementById('character');
        this.characterContainer = document.getElementById('character-container');
        this.dialogBox = document.getElementById('dialog-box');
        this.speakerName = document.getElementById('speaker-name');
        this.dialogText = document.getElementById('dialog-text');
        this.choicesContainer = document.getElementById('choices-container');
        this.sceneLabel = document.getElementById('scene-label');

        this.endingTitle = document.getElementById('ending-title');
        this.endingText = document.getElementById('ending-text');

        // 状态变量
        this.currentChapter = null;
        this.currentIndex = 0;
        this.isTyping = false;
        this.typewriterTimeout = null;
        this.currentText = '';

        // 打字机速度 (毫秒/字符)
        this.typeSpeed = 50;

        // 绑定事件
        this.bindEvents();
        this.preloadAssets();
    }

    /**
     * 绑定所有事件监听器
     */
    bindEvents() {
        // 开始按钮
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });

        // 重新开始按钮
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.returnToTitle();
        });

        document.getElementById('home-btn').addEventListener('click', () => {
            this.returnToTitle();
        });

        document.getElementById('skip-btn').addEventListener('click', () => {
            this.handleDialogClick();
        });

        // 对话框点击
        this.dialogBox.addEventListener('click', () => {
            this.handleDialogClick();
        });

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                if (this.gameScreen.classList.contains('active') &&
                    this.dialogBox.classList.contains('active')) {
                    this.handleDialogClick();
                }
            }
        });
    }

    /**
     * 切换屏幕显示
     */
    showScreen(screen) {
        this.titleScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
        this.endingScreen.classList.remove('active');
        screen.classList.add('active');
    }

    /**
     * 预加载剧情中使用的图片，避免角色或背景首次出现时闪入。
     */
    preloadAssets() {
        const assets = new Set();

        Object.values(storyData.chapters).forEach((chapter) => {
            chapter.forEach((node) => {
                if ((node.type === 'background' || node.type === 'character') && node.image) {
                    assets.add(node.image);
                }
            });
        });

        const assetList = Array.from(assets);

        if (assetList.length === 0) {
            this.finishLoading();
            return;
        }

        let loaded = 0;
        const update = () => {
            loaded++;
            const percent = Math.round((loaded / assetList.length) * 100);
            this.loadingProgress.style.width = `${percent}%`;
            this.loadingText.textContent = percent >= 100 ? '书页已经归位。' : `正在整理遗失的书页... ${percent}%`;
            if (loaded >= assetList.length) {
                window.setTimeout(() => this.finishLoading(), 260);
            }
        };

        assetList.forEach((src) => {
            const img = new window.Image();
            img.onload = update;
            img.onerror = update;
            img.src = src;
        });
    }

    /**
     * 结束加载并显示标题。
     */
    finishLoading() {
        this.loadingScreen.classList.remove('active');
        this.showScreen(this.titleScreen);
    }

    /**
     * 开始游戏
     */
    startGame() {
        this.showScreen(this.gameScreen);
        this.loadChapter(storyData.startChapter);
    }

    /**
     * 返回标题
     */
    returnToTitle() {
        this.showScreen(this.titleScreen);
        this.resetGame();
    }

    /**
     * 重置游戏状态
     */
    resetGame() {
        this.currentChapter = null;
        this.currentIndex = 0;
        this.isTyping = false;
        this.characterImg.src = '';
        this.characterImg.classList.add('hidden');
        this.dialogBox.classList.remove('active');
        this.choicesContainer.classList.remove('active');
    }

    /**
     * 加载章节
     */
    loadChapter(chapterName) {
        const chapter = storyData.chapters[chapterName];
        if (!chapter) {
            console.error(`Chapter not found: ${chapterName}`);
            return;
        }

        this.currentChapter = chapter;
        this.currentIndex = 0;
        this.processCurrentNode();
    }

    /**
     * 处理当前节点
     */
    processCurrentNode() {
        if (this.currentIndex >= this.currentChapter.length) {
            return;
        }

        const node = this.currentChapter[this.currentIndex];

        switch (node.type) {
            case 'background':
                this.setBackground(node.image);
                this.currentIndex++;
                this.processCurrentNode();
                break;

            case 'character':
                this.setCharacter(node.image);
                this.currentIndex++;
                this.processCurrentNode();
                break;

            case 'dialog':
                this.showDialog(node.speaker, node.text);
                break;

            case 'choice':
                this.showChoices(node.question, node.choices);
                break;

            case 'goto':
                this.loadChapter(node.next);
                break;

            case 'ending':
                this.showEnding(node.title, node.text);
                break;

            default:
                console.warn(`Unknown node type: ${node.type}`);
                this.currentIndex++;
                this.processCurrentNode();
        }
    }

    /**
     * 设置背景图片
     */
    setBackground(imagePath) {
        this.background.style.opacity = '0';
        this.sceneLabel.textContent = imagePath.includes('park') ? '黄昏公园' : '无名薄册';

        setTimeout(() => {
            this.background.style.backgroundImage = `url('${imagePath}')`;
            this.background.style.opacity = '1';
        }, 400);
    }

    /**
     * 设置角色立绘
     */
    setCharacter(imagePath) {
        if (!imagePath) {
            this.characterImg.classList.add('hidden');
            setTimeout(() => {
                this.characterImg.src = '';
            }, 500);
        } else {
            this.characterImg.src = imagePath;
            this.characterImg.classList.remove('hidden');
        }
    }

    /**
     * 显示对话
     */
    showDialog(speaker, text) {
        this.dialogBox.classList.add('active');
        this.choicesContainer.classList.remove('active');

        this.speakerName.textContent = speaker;
        this.currentText = text;
        this.dialogText.textContent = '';

        this.typewriterEffect(text);
    }

    /**
     * 打字机效果
     */
    typewriterEffect(text) {
        this.isTyping = true;
        let charIndex = 0;

        const type = () => {
            if (charIndex < text.length) {
                this.dialogText.textContent += text.charAt(charIndex);
                charIndex++;
                this.typewriterTimeout = setTimeout(type, this.typeSpeed);
            } else {
                this.isTyping = false;
            }
        };

        type();
    }

    /**
     * 跳过打字效果
     */
    skipTypewriter() {
        if (this.typewriterTimeout) {
            clearTimeout(this.typewriterTimeout);
        }
        this.dialogText.textContent = this.currentText;
        this.isTyping = false;
    }

    /**
     * 处理对话框点击
     */
    handleDialogClick() {
        if (this.isTyping) {
            this.skipTypewriter();
        } else {
            this.currentIndex++;
            this.processCurrentNode();
        }
    }

    /**
     * 显示选项
     */
    showChoices(question, choices) {
        this.dialogBox.classList.remove('active');
        this.choicesContainer.innerHTML = '';
        this.choicesContainer.classList.add('active');

        choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = 'choice-btn';
            button.textContent = choice.text;
            button.addEventListener('click', () => {
                this.selectChoice(choice.next);
            });
            this.choicesContainer.appendChild(button);
        });
    }

    /**
     * 选择选项
     */
    selectChoice(nextChapter) {
        this.choicesContainer.classList.remove('active');
        this.loadChapter(nextChapter);
    }

    /**
     * 显示结局
     */
    showEnding(title, text) {
        this.dialogBox.classList.remove('active');
        this.endingTitle.textContent = title;
        this.endingText.textContent = text;
        this.showScreen(this.endingScreen);
    }
}

// 初始化引擎
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (!window.storyData) {
            console.error('Critical Error: storyData is not defined. Check if story.js is loaded correctly.');
            alert('游戏加载失败：无法加载剧情数据 (story.js)。请检查控制台获取详细信息。');
            return;
        }
        window.gameEngine = new VisualNovelEngine();
        console.log('VisualNovelEngine initialized successfully.');
    } catch (e) {
        console.error('Failed to initialize game engine:', e);
        alert('游戏初始化发生错误: ' + e.message);
    }
});
