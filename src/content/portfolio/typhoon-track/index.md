---
title: 西北太平洋台风路径快速可视化工具
slug: typhoon-track
type: tool
year: 2025
role: Solo
stack: [Python, Cartopy, xarray, geopandas]
cover: cover.png
repo: https://github.com/yihang-lv/typhoon-track
demo: https://yihang-lv.github.io/typhoon-track/
status: shipped
---

## 项目动机

每年汛期，组里都会收到一批 CMA、CMA-MESO、JTWC 多源最佳路径数据集
（Best Track）。我手动在 NCL 里画一张全洋面图，常常要写 30 行 `gsn_*` /
`gsm_*` 语句，再加上多年叠加、强度过滤——这种重复劳动本身没有任何信息含量。

这个工具的定位是：**给我一份 2020–2024 西北太平洋（含南海）的全样本路径，
30 秒内出图、10 秒内出 Shp 切片**。

## 主要能力

- 一条命令拉取/缓存中国气象局（CMA）上海台风所发布的最佳路径，
  落到本地 `~/.cache/typhoon/` 的 SQLite 表里，避免每次重下；
- 支持按年份、强度等级（TD / TS / STS / TY / STY / SuperTY）过滤；
- 输出 Cartopy 静态图（PNG/SVG）以及 `geopandas.GeoDataFrame`，
  方便直接 `qgis` 或 `kepler.gl` 二次加工；
- 提供 Jupyter 插件，能在 Notion / Obsidian 嵌入的 iframe 里交互；
- 自带简单 CLI：`typhoon-track plot --year 2024 --cat TY`。

## 技术选型笔记

为什么不用 `basemap`？因为 2025 年 Cartopy 已经稳定得多，投影字符串和
shapefile 缓存都顺手。`xarray` 用在这里其实有点杀鸡用牛刀，但等以后接
ERA5 卫星轨道插值时就不用重写一遍了。

数据源暂未直接接 IBTrACS，因为 IBTrACS 的字段定义跟 CMA 有出入（中心
定位算法不同），我不想做 ETL 之后再校对，不如让用户选源。

## 结果与反思

回头看，**最大的价值不在"省时间"，而在把"画图"和"分析"切开**。以前
汛期前一周的工作里有三天是在把数据搬进 NCL，剩下四天才真正在做诊断；
现在搬数据这一步被压缩到一个上午，下午可以专心做方法学层面的事。

IBTrACS 那条"不接"是当时最对的决定——2024 年组里没有任何一个项目需要跨
源对账，把这件事硬塞进 v1 只会增加维护成本。但反过来，2025 年开始要做
CMA 与 JTWC 多源融合时，这套结构反而成了负担，因为字段对账逻辑又得重新
进一遍。**早一点预留对账层、但不在 v1 实现它**，是我下一版会改的地方。

## 已知限制

- 目前只覆盖 CMA 源，JTWC / JMA 留待 v0.3；
- 大样本（> 1000 路径）渲染时 SVG 节点数会暴涨，需要后续切到 WebGL；
- 没有做 unit test，主要靠 `pytest --doctest-modules` 跑一遍示例脚本。

## 后续路线

- 把 CMA-MESO 10-min 风场叠到路径上做诊断；
- 接 IBTrACS，做多源融合的可视化对比；
- CLI 输出格式做一次 breaking change，给 `plot` 加 `--out-format` 选项
  并把 `gsn_*` 时代留下的隐式默认砍掉。
