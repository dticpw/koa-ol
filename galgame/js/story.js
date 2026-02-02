/**
 * Galgame 剧情脚本数据
 * 包含所有章节的对话、选项和分支
 */

window.storyData = {
    // 章节定义
    chapters: {
        // ========== 第一章：邂逅 ==========
        chapter1_start: [
            {
                type: 'background',
                image: 'assets/backgrounds/bg_library.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '午后的阳光透过窗户洒进图书馆，空气中弥漫着书籍的淡淡香气。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '这是我第一次来到这所学校的图书馆。作为转学生，我对这里的一切都充满好奇。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '正当我在书架间徘徊时，两道身影同时吸引了我的注意...'
            },
            {
                type: 'character',
                image: 'assets/characters/yukine.png'
            },
            {
                type: 'dialog',
                speaker: '???',
                text: '请问...你是在找什么书吗？'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '一位长发飘飘的女生轻声问道，她手中抱着一本古典文学集，紫色的眼眸中透着温柔的光芒。'
            },
            {
                type: 'character',
                image: 'assets/characters/haru.png'
            },
            {
                type: 'dialog',
                speaker: '???',
                text: '哇！你是新来的转学生吧！我叫天野晴，叫我小晴就好！'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '一位充满活力的短发女生突然出现在我面前，金色的眼睛闪烁着兴奋的光芒。'
            },
            {
                type: 'character',
                image: ''
            },
            {
                type: 'dialog',
                speaker: '',
                text: '两位女生风格截然不同，却都让我感到一种莫名的亲切。'
            },
            {
                type: 'choice',
                question: '我应该先和谁交谈呢？',
                choices: [
                    { text: '和温柔的长发女生说话', next: 'chapter1_yukine' },
                    { text: '和活泼的短发女生说话', next: 'chapter1_haru' }
                ]
            }
        ],

        // 第一章 - 雪音线
        chapter1_yukine: [
            {
                type: 'character',
                image: 'assets/characters/yukine.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我走向那位温柔的长发女生，她的气质让我感到很平静。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '你好，我确实是新来的转学生。请问你是图书馆的管理员吗？'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '嗯，我是樱井雪音，负责图书馆的日常管理工作。很高兴认识你。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '如果你有什么想找的书，可以告诉我。我对这里的每一本书都很熟悉。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她的声音如同潺潺流水，让人不自觉地放松下来。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '那太好了。其实我想找一些诗集...'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '诗集？你也喜欢诗歌吗？'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她的眼中闪过一丝惊喜，嘴角微微上扬。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '请跟我来，我知道有一个角落收藏了很多珍贵的诗集。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '那个午后，我们在诗集的海洋中度过了美好的时光。不知不觉间，我对雪音产生了淡淡的好感...'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '— 第一章 完 —'
            },
            {
                type: 'goto',
                next: 'chapter2_yukine'
            }
        ],

        // 第一章 - 小晴线
        chapter1_haru: [
            {
                type: 'character',
                image: 'assets/characters/haru.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '那位活泼女生的热情感染了我，我决定先和她聊聊。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '你好，我是刚转来的。你怎么知道我是新生？'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '因为我认识学校里所有人呀！毕竟我是田径队队长嘛！'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '对了对了，你有没有加入什么社团的打算？我们田径队正在招新哦！'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她说话时手舞足蹈，充满了感染力。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '田径队吗？我运动细胞不太好...'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '没关系没关系！运动最重要的是开心！我可以教你的！'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '不如这样，明天放学后来操场找我，让我看看你的潜力！'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她的笑容像阳光一样灿烂，让人无法拒绝。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '那天，小晴拉着我逛遍了整个学校。她的活力和热情让原本有些紧张的我完全放松了下来...'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '— 第一章 完 —'
            },
            {
                type: 'goto',
                next: 'chapter2_haru'
            }
        ],

        // ========== 第二章：心动 - 雪音线 ==========
        chapter2_yukine: [
            {
                type: 'background',
                image: 'assets/backgrounds/bg_park.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '几周后的一个傍晚，雪音邀请我一起去公园散步。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '樱花正值盛开的季节，粉色的花瓣在微风中轻轻飘落。'
            },
            {
                type: 'character',
                image: 'assets/characters/yukine.png'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '这里是我最喜欢的地方。每年春天，我都会来这里读书。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '确实很美。谢谢你愿意和我分享这个地方。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '......'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她低下头，脸颊微微泛红。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '其实...自从遇见你之后，我一直在想一件事。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '以前，我总觉得书本就是我的一切。但是现在...'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她抬起头，紫色的眼眸注视着我。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '现在，我发现...有些故事，必须要和特别的人一起书写。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '一片樱花瓣轻轻落在她的发丝上，美得令人心醉。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '雪音...'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我轻轻握住她的手。在这个樱花飘落的傍晚，我们的故事才刚刚开始...'
            },
            {
                type: 'ending',
                title: 'Ending A：诗与远方',
                text: '与雪音相伴的日子，像一首优美的长诗，\n细腻而深情。在书香与花香中，\n我们找到了彼此的归宿。'
            }
        ],

        // ========== 第二章：心动 - 小晴线 ==========
        chapter2_haru: [
            {
                type: 'background',
                image: 'assets/backgrounds/bg_park.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '运动会结束后的傍晚，小晴拉着我来到公园。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '夕阳将天空染成橙红色，樱花在微风中轻轻摇曳。'
            },
            {
                type: 'character',
                image: 'assets/characters/haru.png'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '呼——今天真的太累了！但是拿到冠军好开心！'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '恭喜你啊，小晴。你在赛场上真的很耀眼。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '嘿嘿，当然啦！不过...'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她突然安静下来，这对她来说很不寻常。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '其实，今天我能跑这么快，是因为知道你在看着我。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '诶？'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '我一直都是独自奔跑...但是自从认识你之后，我发现...'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她的脸变得和夕阳一样红。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '有一个人在终点等着我，感觉真的很好！'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她抬起头，金色的眼眸在夕阳下闪闪发光。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '所以...以后也请继续在终点等我，好吗？'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我微笑着点头。在这个夕阳西下的公园里，一段新的旅程开始了...'
            },
            {
                type: 'ending',
                title: 'Ending B：阳光与奔跑',
                text: '与小晴相伴的日子，充满活力与欢笑。\n她教会我，人生就像一场马拉松，\n最重要的不是速度，而是身边的人。'
            }
        ]
    },

    // 起始章节
    startChapter: 'chapter1_start'
};
