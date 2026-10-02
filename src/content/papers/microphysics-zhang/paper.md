---
title: "微物理方案的尺度依赖：以 WRF 中 Morrison 2-moment 为例"
slug: microphysics-zhang
date: 2026-09-15
type: paper
journal: "J. Atmos. Sci."
authors: ["张某某", "李某某", "Y. Lv"]
year: 2024
doi: ""
pdf: ""
abstract: "演示条目 — 用于示范 paper-reader.js 在 microphysics 主题论文上的批注阅读体验。"
status: published
layout: "layouts/paper.njk"
tags: ["microphysics", "WRF", "Morrison-2moment", "scale-dependence"]
description: "演示条目 — 用于示范 paper-reader.js 在 microphysics 主题论文上的批注阅读体验。"
---
<!--
  microphysics-zhang · 示范条目 paper.md
  11ty v3 markdown-it 默认不解析 {#id}，故段落 id 用显式 HTML <h2 id> / <a id>。
  段落 id 必须能被 annotations.json 的 anchor.value 命中（p-001..p-006）。
-->
<h2 id="p-001">一、研究动机：为什么又要做微物理</h2>

东亚夏季风的极端降水预报里，模式系统偏差里相当一部分来自云微物理方案对降水粒子谱分布的描述方式。1-moment 方案把整层云水含量绑定到一个固定谱型，对流核区云水一旦过量就丢到雨滴上；2-moment 方案额外预报数浓度，让粒子大小有自由度，理论上更贴近真实分档过程。但代价是闭合假设变多，参数化路径也随之分化。Morrison 2-moment 在中文大气科学社区被用得很多，却很少有人系统比较它在 km-grid 与 100-m-grid 下的实际表现差异。

<h2 id="p-002">二、闭合假设概览</h2>

Morrison 方案对云水、雨、雪、霰、冰晶五种水凝物各预报含水量与数浓度，谱型默认 γ 分布（θ=0）。淋雨、云冰、雪向霰的自动转换、以及冰晶繁生是几个最容易触发差异化的开关。本研究统一关掉冰晶繁生，开关其余参数走默认；这是为了把「尺度依赖」从「参数化空间」里隔离出来——否则你看到的差异可能是不同人挑参数的结果，而不是不同尺度下应该有的真实表现。

<h2 id="p-003">三、试验设计</h2>

用同一段 2020 年 8 月华北强降水过程跑三套网格：dx ≈ 27 km（业务可用）、dx ≈ 9 km（区域研究）、dx ≈ 1 km（对流解析）。三个网格共享初始与侧边界（来自 ERA5 + 3-h 同化窗口），区别在嵌套比与微物理本身。前两个网格同开 Morrison；第三个网格额外跑 Thompson 2-moment 与 NSSL 2-moment 做诊断对比。地表、辐射、边界层用统一配置，避免差异被外层方案吃掉。

<h2 id="p-004">四、关键结果</h2>

1. 在 dx ≈ 27 km 上，Morrison 与 Thompson、NSSL 的小时降水 TS 评分差异在 5% 量级以内，对流核区位置偏 1–2 个网格；可视为「模式不确定性区间」的代表。
2. 在 dx ≈ 9 km 上，Morrison 的冷云降水（雪→霰）路径偏快，导致对流核区上层冰水含量被低估，下层液态水偏高，最大小时降水强度系统性偏强 ~12%。
3. 在 dx ≈ 1 km 上，三种方案的差异收窄到 3% 以内，但 Morrison 仍然保留了 9-km 网格上的「冷云路径偏快」倾向——说明这是方案本身的结构性问题，不只是格点尺度解析问题。

<h2 id="p-005">五、机制解释：为什么冷云路径偏快</h2>

Morrison 方案对雪→霰的自动转换阈值采用固定温度函数（−4 °C 左右），不依赖于谱型宽度。在 dx ≈ 9 km 这种部分解析对流的尺度上，模式分辨率不足以显式分辨浅对流顶，云顶温度因此偏冷，触发雪→霰的概率被系统性抬高。这是一条「半解析尺度」下的特殊陷阱——纯对流解析尺度（dx ≈ 1 km）云顶位置真实，纯业务尺度（dx ≈ 27 km）对流被参数化包住，唯独中间这段最尴尬。

<h2 id="p-006">六、可借鉴的几条结论</h2>

- 在 dx ≈ 9 km 这种「半解析」尺度下用 Morrison 2-moment 跑极端降水，**最大小时降水系统偏差 ~12% 是默认值**，写论文时要把这个量级记到 limitations 里。
- 想把这条偏差修掉，最便宜的做法是给雪→霰阈值加一个尺度依赖（dx < 5 km 才允许默认阈值，否则提高阈值 1–2 °C），代价是方案可移植性下降。
- 真要彻底研究冷云路径问题，应该上分档 bin scheme（像 Hebrew University Predicted Particle Properties，P3），不过 P3 在国内 WRF 编译链里维护成本偏高，适合专项试验不适合业务。

<!--
  本文为示范条目，段落摘自三篇 microphysics 综述的合并叙述：
    1. Morrison et al. 2009 JAS (双参数方案原始论文)
    2. Bao et al. 2019 JGR Atmospheres (极端降水偏差综述)
    3. Lin & Colle 2011 MWR (尺度依赖综述)
  人物 / 数字均为示意，用于演示 paper-reader.js 在 microphysics 主题论文上的双向联动批注体验。
-->