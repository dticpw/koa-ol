// Public artwork metadata only; never used to infer an unrevealed card.
export const NUMBER_STORIES = [
  {
    "value": 1,
    "slug": "invitation",
    "title": "邀请",
    "story": "信封里没有地址，只有你的名字。"
  },
  {
    "value": 2,
    "slug": "threshold",
    "title": "门扉",
    "story": "门后传来洗牌声，仿佛已经等了你很久。"
  },
  {
    "value": 3,
    "slug": "guide",
    "title": "引路人",
    "story": "乌鸦从不回答问题，它只把钥匙带向更深处。"
  },
  {
    "value": 4,
    "slug": "masquerade",
    "title": "假面宴",
    "story": "所有宾客都戴着面具，只有那个空位认得你。"
  },
  {
    "value": 5,
    "slug": "contract",
    "title": "契约",
    "story": "签下名字时，墨迹悄悄收紧成了锁链。"
  },
  {
    "value": 6,
    "slug": "mirror",
    "title": "双面镜",
    "story": "镜中的你先笑了，手里却多出一张牌。"
  },
  {
    "value": 7,
    "slug": "gambler",
    "title": "赌徒",
    "story": "你将最后一张牌压在桌上，第一次抬头看向庄家。"
  },
  {
    "value": 8,
    "slug": "puppet",
    "title": "断线木偶",
    "story": "第一根线断开时，所有观众同时屏住了呼吸。"
  },
  {
    "value": 9,
    "slug": "tower",
    "title": "雷塔",
    "story": "雷光撕开夜幕，照出了牌桌之外的牢笼。"
  },
  {
    "value": 10,
    "slug": "judgement",
    "title": "审判",
    "story": "天平一端是心跳，另一端是你赢下的筹码。"
  },
  {
    "value": 11,
    "slug": "dawn",
    "title": "破晓",
    "story": "你带走了钥匙，把契约留给身后的最后一缕火。"
  }
];
export const numberStory = value => NUMBER_STORIES.find(card => card.value === value);
export const numberImage = (card, large = false) => `./assets/numbers/${String(card.value).padStart(2, '0')}-${card.slug}${large ? '' : '-thumb'}.webp`;
