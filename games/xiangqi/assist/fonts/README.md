# 棋子楷体子集

本目录随自战页面一起发布。字体原作者为文鼎科技（Arphic Technology Co., Ltd.），UKai 扩展由 Arne Goetje 制作；来源是系统 `fonts-arphic-ukai` 包的 `ukai.ttc`，face 0：**AR PL UKai CN / Book / Version 0.2.20080216**。

**修改说明（ChineseChessGuide，2026-10-25）**：仅保留“帅仕相馬車炮兵将士象卒”11个字符及必需的 `.notdef`；删除字体 hinting，重命名为 **Xiangqi Piece Kai**，转为 WOFF2。使用CN face原有的繁体車／馬，移除闲置简体车／马。不修改逐字轮廓、字宽／左侧承距或垂直排版度量；子集工具按所留字形重算head包围极值和hhea横向极值，未用这些度量来做加粗或上移。主盘通过文字内层的CSS同色描边（0.022em）加粗、上移0.045em；比较小盘用SVG描边（0.022em）、dy=-0.035em，均仅影响文字渲染。字重仍为400且禁止浏览器伪粗体，圆盘、内圈与触控位置保持。修改方式与日期也写入字体内部的 name 表（ID 10）。原有版权、设计者和许可记录保留。

修改后的字体整体继续遵循 [ARPHIC PUBLIC LICENSE](ARPHICPL.TXT)，不附加限制，没有担保。可直接取得、复制、修改和再分发 [完整的修改版字体 piece-kai.woff2](piece-kai.woff2)，再分发时须保留未改动的 `ARPHICPL.TXT` 及修改说明。这里的许可文本是系统包 `license/english/ARPHICPL.TXT.gz` 原文解压后的逐字节副本；没有把字体许可扩展到页面其余独立代码。

来源校验：`ukai.ttc` 为17,151,049字节，SHA256 `cfc758e69386a21bade8cb3b373fda20d7f2fac6e8904ced2ded98588b63e274`。整个原字库不随网页复制。子集未压缩TTF为29,308字节（仅在构建内存中生成），实际发布WOFF2为9,540字节，SHA256 `442425d2fa0f23acfd8162f7d335a333560c48a4eddc5b5037e239fba29a879c`；WOFF2本身已经压缩，不能把此数字当作公网HTTP实测。

重建入口在源项目 `tools/build_piece_font.py`，使用已有 Python、fontTools 4.65.0 和 Brotli。先校验上述源文件哈希和CN face，再执行11字Unicode子集、去hinting、保留原版权／许可、改名及日期说明；固定字体时间为2026-10-25 UTC。输出本目录的WOFF2和原许可，内容相同不重写。无下载、系统字体修改或自动同步。

```sh
PYTHONDONTWRITEBYTECODE=1 /home/dticpw/conda/envs/py310/bin/python tools/build_piece_font.py
PYTHONDONTWRITEBYTECODE=1 /home/dticpw/conda/envs/py310/bin/python tools/build_piece_font.py --check
```

`--source`、`--license` 可指向同哈希的本地来源和原英文许可gzip文件；`--check` 仅在内存重建并比较，不写文件。页面只对主棋盘棋子及比较小盘棋子应用此字体，正文、原注和其他页面不使用它。CSS中的字体URL带内容SHA前12位；字体更新后依次更新CSS引用及HTML的CSS版本。运行目录仅需本说明、原许可与这一个11字WOFF2，构建工具不属于网页运行依赖。
