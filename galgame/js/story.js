/**
 * Galgame 剧情脚本数据
 * 主题：一个人把无法说出口的心意，借给了黄昏、书页和奔跑的风。
 */

window.storyData = {
    chapters: {
        prologue: [
            {
                type: 'background',
                image: 'assets/backgrounds/bg_library.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '转学的第一天，我在图书馆最里面的书架后方，发现了一本没有书名的薄册。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '它被夹在《古典文学》和《校史年鉴》之间，封面干净得像从来没有被任何人触碰过。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我翻开第一页。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '纸上只有一句话：\n“请在今天黄昏之前，替我记住一个人。”'
            },
            {
                type: 'character',
                image: 'assets/characters/yukine_v2.png'
            },
            {
                type: 'dialog',
                speaker: '???',
                text: '那本书，最好不要一个人读完。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '说话的女生站在光里，怀里抱着一本旧诗集。她的声音很轻，却像把整间图书馆的尘埃都叫醒了。'
            },
            {
                type: 'dialog',
                speaker: '???',
                text: '我是樱井雪音。这里的书，我大概都认识。包括一些本来不该存在的书。'
            },
            {
                type: 'character',
                image: 'assets/characters/haru_v2.png'
            },
            {
                type: 'dialog',
                speaker: '???',
                text: '雪音！你又在吓唬新同学了！'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '另一个女生从书架尽头探出头来，笑得像把窗外的太阳直接带进了室内。'
            },
            {
                type: 'dialog',
                speaker: '???',
                text: '我叫天野晴。你可以叫我小晴。以及，先声明，我不是幽灵。至少今天不是。'
            },
            {
                type: 'character',
                image: ''
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我低头看那本薄册。刚才空白的第二页，已经浮现出新的字迹。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '“一个会把明天写成诗的人。一个会把昨天跑成风的人。请选择你愿意靠近的奇迹。”'
            },
            {
                type: 'choice',
                question: '我应该先把这份不可思议交给谁？',
                choices: [
                    { text: '交给安静读诗的雪音', next: 'yukine_library' },
                    { text: '追上像风一样的小晴', next: 'haru_library' },
                    { text: '把书合上，问她们到底发生了什么', next: 'truth_library' }
                ]
            }
        ],

        yukine_library: [
            {
                type: 'character',
                image: 'assets/characters/yukine_v2.png'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '雪音，这本书说它想让我记住一个人。你知道是什么意思吗？'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '知道一点。每年樱花落下前，图书馆都会多出一本没有书名的书。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '它会找一个刚来到这里、还没有被任何回忆固定住的人。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '然后呢？'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '然后，把某个人最珍贵、也最害怕遗失的一天，托付给他。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她把诗集放在桌上。书页自动翻动，停在一首没有作者的短诗。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '“若你曾在黄昏握住我的名字，明天醒来，请不要假装那只是梦。”'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我忽然觉得这句话不像诗，更像一封很久以前就写给我的信。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '放学后，陪我去公园吧。那里有一棵树，会在黄昏回答所有迟到的问题。'
            },
            {
                type: 'choice',
                question: '我该怎样回应雪音？',
                choices: [
                    { text: '答应她，并把薄册交给她保管', next: 'yukine_park_book' },
                    { text: '答应她，但把薄册留在自己手中', next: 'yukine_park_self' }
                ]
            }
        ],

        haru_library: [
            {
                type: 'character',
                image: 'assets/characters/haru_v2.png'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '你别听雪音说得那么玄。简单讲，就是这本书有点任性。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '任性？'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '它总是在别人快要忘记重要事情的时候出现。然后装作自己很伟大。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '小晴笑着把手背到身后，语气很轻松，眼神却不知为何避开了我。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '我以前也被它选中过。结果第二天醒来，只有我记得那一天。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '那不是很寂寞吗？'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '所以我才跑得很快啊。只要跑得够快，寂寞就追不上来。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她说完，像害怕我看见她真正的表情一样，立刻举起手。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '放学后来公园。我要带你看一个只有黄昏才能抵达的终点。'
            },
            {
                type: 'choice',
                question: '我该怎样回应小晴？',
                choices: [
                    { text: '答应她，和她一起跑到终点', next: 'haru_park_run' },
                    { text: '答应她，但问她是否也想停下来', next: 'haru_park_stay' }
                ]
            }
        ],

        truth_library: [
            {
                type: 'character',
                image: ''
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '在选择之前，我想知道真相。你们两个都认识这本书，对吧？'
            },
            {
                type: 'character',
                image: 'assets/characters/yukine_v2.png'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '认识。只是我习惯把真相慢慢说。'
            },
            {
                type: 'character',
                image: 'assets/characters/haru_v2.png'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '而我习惯把真相先跑赢，再回头解释。'
            },
            {
                type: 'character',
                image: ''
            },
            {
                type: 'dialog',
                speaker: '',
                text: '薄册的书页忽然被风翻开。上面浮出一张很淡的合照。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '照片里，雪音和小晴坐在樱花树下。中间的位置空着，像是在等一个迟到的人。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '照片背面写着：\n“如果第三个人没有来，我们就会忘记彼此曾经等待过。”'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我胸口一紧。原来这不是一场关于谁被选择的故事。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '这是两个人在被世界轻轻擦掉之前，最后一次向陌生人求救。'
            },
            {
                type: 'choice',
                question: '我想成为怎样的第三个人？',
                choices: [
                    { text: '记住雪音没有说完的诗', next: 'yukine_park_self' },
                    { text: '追上小晴没有跑完的路', next: 'haru_park_stay' },
                    { text: '把她们都带去那棵黄昏的树下', next: 'shared_park' }
                ]
            }
        ],

        yukine_park_book: [
            {
                type: 'background',
                image: 'assets/backgrounds/bg_park.png'
            },
            {
                type: 'character',
                image: 'assets/characters/yukine_v2.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '黄昏的公园像被温柔地浸在蜂蜜里。雪音抱着那本薄册，站在樱花树下等我。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '你把书交给我时，我很高兴，也有点害怕。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '为什么？'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '因为被信任的人，最容易变得贪心。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她翻开薄册。书页上不是文字，而是一片片正在变透明的樱花。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '如果我在这里写下你的名字，明天你会忘记今天发生过什么。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '但我可以记得。记很久，久到你某天再次路过图书馆，会忽然觉得某本书很熟悉。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '那样你会不会太孤单？'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '雪音沉默了一会儿，把笔递给我。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '所以我希望你来写。不是写我的名字，是写你想留下的那一句。'
            },
            {
                type: 'ending',
                title: 'Ending A：写在明天背面的诗',
                text: '我写下：“如果明天忘记了你，\n请让风替我翻到这一页。”\n第二天，我在图书馆醒来，什么都想不起来。\n可每当黄昏靠近，我总会无端想念一个温柔的名字。'
            }
        ],

        yukine_park_self: [
            {
                type: 'background',
                image: 'assets/backgrounds/bg_park.png'
            },
            {
                type: 'character',
                image: 'assets/characters/yukine_v2.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我把薄册带到公园。雪音看见它还在我手里，像是松了一口气。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '你选择自己保管它。这样很好。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '因为我不想让任何一个人独自承担记忆。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '树影摇晃。薄册里飘出细小的光点，像有无数无人寄出的信终于找到了地址。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '我一直以为，喜欢一个人，就是替他保存所有他会遗忘的东西。'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '现在我好像明白了。喜欢也可以是把书递出去，然后相信对方会和你一起读下去。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她伸出手。我没有握住她的指尖，而是把薄册放在我们掌心之间。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '那一刻，纸页轻轻发热。我的心跳、她的呼吸、远处小晴练跑的脚步声，都被写进同一行字里。'
            },
            {
                type: 'ending',
                title: 'Ending B：共读者',
                text: '薄册没有消失，而是变成了一张借书卡。\n借阅人一栏写着两个名字。\n从那以后，我和雪音每周都会在黄昏读一页。\n我们没有急着说喜欢，因为有些感情，会自己长成一本书。'
            }
        ],

        haru_park_run: [
            {
                type: 'background',
                image: 'assets/backgrounds/bg_park.png'
            },
            {
                type: 'character',
                image: 'assets/characters/haru_v2.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '小晴拉着我穿过樱花树下的石板路。她跑得很快，却始终没有松开我的手。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '看见前面那张长椅了吗？如果在夕阳完全落下前跑到那里，就可以听见昨天的声音。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '昨天会说什么？'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '通常是一些很没用的话。比如“别逞强”，比如“其实你可以哭”。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她笑着说，眼角却被风吹得发亮。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我们抵达长椅时，夕阳刚好落在她肩上。薄册自己翻开，里面夹着一张旧号码布。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '那是我第一次输掉比赛的号码。也是第一次有人对我说，跑慢一点也没关系。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '那个人是谁？'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '小晴看着我，像看着一个她等了很久、却刚刚才认识的人。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '也许是你。也许是我希望能遇见的你。'
            },
            {
                type: 'ending',
                title: 'Ending C：昨天终点线',
                text: '我们坐在长椅上，听见昨天的风从耳边跑过。\n它说：“你终于等到了。”\n后来小晴还是跑得很快。\n只是每次经过终点，她都会回头，确认我还在那里。'
            }
        ],

        haru_park_stay: [
            {
                type: 'background',
                image: 'assets/backgrounds/bg_park.png'
            },
            {
                type: 'character',
                image: 'assets/characters/haru_v2.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我没有立刻跟她跑。小晴已经迈出去的脚步，在听见我的问题后停了下来。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '小晴，你有没有想过，不用一直跑也可以？'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '不跑的话，很多东西就会追上来。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '那我陪你一起被追上。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '她愣住了。樱花落在她头发上，她没有像平时那样立刻甩开。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '你这个人，很奇怪。'
            },
            {
                type: 'dialog',
                speaker: '我',
                text: '这不是你们一开始就告诉我的吗？今天本来就是奇怪的一天。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '小晴低下头，笑了一声。那不是平时灿烂的笑，而是终于不用假装没事的笑。'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '那你不准先走。至少等我把害怕的事情说完。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我们在黄昏里坐了很久。薄册没有翻页，只是在她每次停顿时，替她把沉默保存下来。'
            },
            {
                type: 'ending',
                title: 'Ending D：停下来的风',
                text: '那天以后，小晴偶尔会在跑步前来找我。\n她说：“今天我可能跑不快。”\n我说：“那我就慢慢等。”\n有些风不是为了抵达远方，而是为了终于能在某个人身边停下。'
            }
        ],

        shared_park: [
            {
                type: 'background',
                image: 'assets/backgrounds/bg_park.png'
            },
            {
                type: 'character',
                image: 'assets/characters/yukine_v2.png'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我把雪音带到樱花树下。她看着远处跑来的小晴，眼神像翻到最后一页的书。'
            },
            {
                type: 'character',
                image: 'assets/characters/haru_v2.png'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '我没有迟到吧？'
            },
            {
                type: 'character',
                image: 'assets/characters/yukine_v2.png'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '没有。只是我等得有点久。'
            },
            {
                type: 'character',
                image: ''
            },
            {
                type: 'dialog',
                speaker: '',
                text: '薄册从我手中升起，停在三个人之间。书页哗啦啦地翻动，像一群急着回家的鸟。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '里面不是我的故事，也不只是她们的故事。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '那是许多曾经差一点错过的人，在某个黄昏终于被谁记住的瞬间。'
            },
            {
                type: 'character',
                image: 'assets/characters/haru_v2.png'
            },
            {
                type: 'dialog',
                speaker: '天野晴',
                text: '如果明天大家都忘了怎么办？'
            },
            {
                type: 'character',
                image: 'assets/characters/yukine_v2.png'
            },
            {
                type: 'dialog',
                speaker: '樱井雪音',
                text: '那就从后天开始，再认识一次。'
            },
            {
                type: 'character',
                image: ''
            },
            {
                type: 'dialog',
                speaker: '',
                text: '我忽然明白，难忘并不意味着永远不会遗忘。'
            },
            {
                type: 'dialog',
                speaker: '',
                text: '难忘是即使世界替你擦掉证据，心里仍会留下一个温热的空位，等待某个人再次坐下。'
            },
            {
                type: 'ending',
                title: 'True Ending：第三张借书卡',
                text: '第二天，图书馆的无名薄册消失了。\n取而代之的是三张借书卡：雪音、小晴，以及我。\n我们没有讨论昨天是否真实。\n因为当三个人同时想念同一个黄昏时，\n它就已经足够真实。'
            }
        ]
    },

    startChapter: 'prologue'
};

