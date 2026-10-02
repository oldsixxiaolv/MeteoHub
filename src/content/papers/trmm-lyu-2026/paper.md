---
title: "New Insights from TRMM Legacy: Stage-Dependent Relationships Between Lightning and Convective Structure in Thunderstorms Over Tropical Africa"
authors:
  - Xueke Wu
  - Yihang Lyu
  - Xiaoqun Hu
  - Zihao Zhang
  - Yuhang Hu
  - Guohao Hu
  - Xingyi Lin
affiliation: "College of Atmospheric Sciences, Lanzhou University"
journal: "JGR: Atmospheres"
year: 2026
doi: "10.1029/2026JD046836"
doi_url: "https://doi.org/10.1029/2026JD046836"
description: "用改进的机器学习聚类方法分析 TRMM Legacy 资料，研究热带非洲雷暴在不同发展阶段中闪电活动与对流结构的 stage-dependent 关系。"
slug: "trmm-lyu-2026"
cover: "cover.svg"
summary: "用改进的机器学习聚类方法分析 TRMM Legacy 资料，研究热带非洲雷暴在不同发展阶段（compact / extensive / 各阶段）中闪电活动与对流结构的 stage-dependent 关系。"
layout: "layouts/paper.njk"
tags: ["TRMM", "lightning", "convection", "tropical africa", "machine learning"]
---
<!--
  TRMM Legacy · Tropical Africa · Lightning × Convection Stage
  Stage 8 由 Yihang Lyu 转本人（Lyuyihang）撰写 paper.md。
  段落 id 用 <h2 id="p-XXX"> 或 <a id="p-XXX"></a>，必须能被 annotations.json 的 anchor.value 命中。
  共 21 段：abstract × 2 + intro × 4 + data & methods × 4 + results × 8 + conclusion × 3。
-->

<h2 id="p-001">一、摘要</h2>

热带测雨卫星（TRMM）联合提供雷达与闪电观测，是研究全球与区域尺度强对流的关键资料，但快照式观测限制了对雷暴演化的研究。本研究用 16 年（1998–2013）热带非洲的 TRMM 数据（全球闪电与雷暴最热点），开发了基于机器学习的改进 K-means 聚类方法，按雷达回波结构对快照雷暴分类。该分类对占总样本约 81% 的紧凑型雷暴（CS）进一步划为三簇，对应 Pre-Mature / Mature / Post-Mature 三个发展阶段并与已知生命周期一致。Mature 阶段对流最强；Pre-Mature 水平尺度小但闪电密度更高；Post-Mature 反之。stage-dependent 线性拟合显示，尽管相关系数接近，但各阶段斜率与截距显著不同（p < 0.001），意味着 electrification 机制存在阶段特异性。

<h2 id="p-002">二、摘要续（Plain Language Summary）</h2>

闪电是对流强度的优秀指标，但雷暴演化过程中该关系会变。本研究用机器学习聚类把快照雷达结构分为三阶段，发现 Pre- 与 Post-Mature 总闪频相近但机制不同——前者高密度小核，后者大面积低密度。stage-dependent 拟合差异显著（p < 0.001），说明雷电参数化必须分阶段考虑，并可用 GPM / FY-3G 等后续卫星推广。

<h2 id="p-003">三、引言：雷暴与闪电关系的传统视角</h2>

雷暴是大气科学的持久挑战，在气候变暖背景下愈发受关注。闪电作为对流强度的代理指标，被广泛用于雷暴研究（Zipser et al., 2006; Deierling and Petersen, 2008; Liu et al., 2012; Wu et al., 2016）。这种联系源于混合相态区（0 至 −40 °C）——冰粒碰撞在过冷水存在下通过非感应起电高效分离电荷（Takahashi, 1978; Bürgesser et al., 2006; Kang et al., 2023）。强上升气流是闪电生成的必要动力，闪频快速增加标志对流最盛期，常伴大冰雹、强降水与龙卷。

<h2 id="p-004">四、引言：TRMM 快照观测的局限</h2>

TRMM 上的 LIS（闪电成像传感器）与 PR（测雨雷达）联合观测为研究雷暴内闪电与对流强度关系提供了宝贵机会。但卫星低轨运行导致快照式观测：先前研究在建立统计关系时未区分发展阶段，而不同阶段的物理机制差异显著。热带非洲同时具备强对流核心与高云顶，是研究闪电—对流关系的最理想区域之一（Cecil et al., 2014; Wu et al., 2020, 2023）。

<h2 id="p-005">五、引言：发展阶段与回波结构演化</h2>

雷暴生命周期由上升气流主导向下降气流主导的转变标记（Byers and Braham, 1948; Wurman et al., 2010），雷达回波结构从高大紧凑的对流核、演变为对流与层状混合区、再到以层状降水为主（Houze, 1997; Romatschke and Houze, 2009）。Bang and Zipser (2015) 用对流性降水比例（Rconv）区分"年轻"与"成熟"雷暴，提示 Rconv 是 stage 分类的潜在信号。

<h2 id="p-006">六、引言：本文目标与结构</h2>

本研究应用改进的机器学习方法，把 TRMM 快照雷暴按对流结构特征聚类，重建 lightning–convection 的 stage-dependent 关系。第 2 节给出数据与方法；第 3 节呈现结果；第 4 节讨论意义。

<h2 id="p-007">七、数据：TRMM 卫星与产品</h2>

TRMM 1997 发射，2015 年 4 月 15 日因燃料耗尽退役。其多传感器联合观测（Kummerow et al., 1998, 2000）为缺乏密集地面气象站的热带非洲（20°W–50°E，20°S–20°N）提供了宝贵资料。PR 提供三维回波结构（水平约 4.3 km，垂直 250 m），LIS 提供闪电数据（夜/午检测效率约 93/73%，Boccippio et al., 2002）。研究用 1998–2013 年 16 年数据（2001 年 8 月因轨道调整排除）。

<h2 id="p-008">八、数据：变量与预处理</h2>

提取 PR 像素聚合出的降水特征（PFs，Nesbitt et al., 2000; Liu et al., 2008）：20/30/40 dBZ 各阈值对应的回波顶高（Maxht20/30/40）、回波面积（Area20/30/40）、体积（Volume20/30/40）、闪电闪频（FlashCount）、对流性降水与总降水。标准化面积得到 D20/30/40eq；闪频密度 FD40 = FlRate / 100 km²；Rconv = 对流体积降水 / 总体积降水。仅保留 ≥ 4 个 PR 像素、剔除异常垂直廓线与质量标记异常的 PF。

<h2 id="p-009">九、方法：改进的 K-means 聚类</h2>

K-means 对初始值与离群点敏感（Sinaga and Yang, 2020）；DBSCAN 抗离群但需调参（Eps / MinPts）。本研究混合三种算法：DBSCAN 去噪 → K-means++ 概率播种避免差初始化（Arthur and Vassilvitskii, 2007）→ Bisecting K-means 递归分裂产生单调层次（Steinbach et al., 2000）。理论上最优 k 由 Calinski–Harabasz / Davies–Bouldin 指标评估，但实际选择还需物理可解释性。

<h2 id="p-010">十、方法：六个聚类参数与最终分类</h2>

选了 6 个表征对流结构差异最小的参数（z-score 标准化）：Epsd20 = Maxht20 / D20eq 表征形态；RH = (Maxht20 − Maxht40) / Maxht20 表垂直发展；RS = D40eq / D20eq 表水平发展（其余三个是 Maxht20 / D20eq / D40eq）。DBSCAN 去噪后 k=4：81% 紧凑雷暴（CS）+ 19% extensive storms (ES)；CS 进一步分为 Pre-Mature / Mature / Post-Mature 三簇，以 Mature 最强为基准 + Rconv 区分 Pre-（高 Rconv）与 Post-（低 Rconv）。

<h2 id="p-011">十一、结果：对流特征在不同阶段的差异</h2>

Mature 阶段对流最强（垂直发展与水平面积都达峰）；Pre-Mature 水平尺度小但闪电密度更高；Post-Mature 反之。三阶段雷达回波顶高（图 5）与闪电密度（图 7）随 Rconv 变化趋势与总样本一致，证实聚类成功捕获雷暴演化。CS 数量随 Rconv 减小先升后降（右偏分布，峰值在 0.92），Pre-Mature 与 Post-Mature 总闪频相近但"闪电产生效率 vs 水平面积"trade-off 截然不同。

<h2 id="p-012">十二、结果：Maxht40 vs FlRate 阶段相关</h2>

闪电闪频与 40 dBZ 回波顶高（强对流核心高度）的对数呈正相关（Liu et al., 2012）。本研究证实该关系**强 stage-dependent**：三阶段 F-test 斜率与截距差异均显著（p < 0.001）。Mature 阶段相关系数最高（r > 0.7），最大顶高约 16 km；Pre-Mature 约 13 km 但斜率/截距明显小；Post-Mature 约 10 km 且分布更散。

<h2 id="p-013">十三、结果：水平尺度 vs FlRate 阶段相关</h2>

D40eq（强核水平直径）与 FlRate 在三阶段的关系更复杂：Mature 阶段 r 仍最高（~0.7）；Pre-（r = 0.46）与 Post-Mature（r = 0.6）显著不同，Post-Mature 比 Pre-Mature 对水平尺度更敏感。物理上：Pre-Mature 是窄而高的强上升气流核（高 FD40）；Post-Mature 是宽而浅的扩散层（低 FD40）。

<h2 id="p-014">十四、结果：综合参数 Volume40 的相关性</h2>

Volume40（40 dBZ 强核体积）与 FlRate 的相关性最强，所有阶段 r > 0.6（p < 0.001），Mature 阶段 r > 0.76。即使是"最优"参数 Volume40，其 r 在三阶段仍有显著差异（Pre-Mature 0.6 vs Mature 0.76），强化 stage-dependent 关系。20 dBZ / 30 dBZ 各参数也有 stage-specific 关系。

<h2 id="p-015">十五、讨论：三阶段机制差异总结</h2>

三阶段展现了闪电—对流关系的清晰 trade-off：Pre-Mature 是"高效率小核"（强上升气流、窄区域、闪电密度高）；Mature 是"全维度峰值"（垂直 + 水平都达峰）；Post-Mature 是"低效率大尺度"（扩散层、降雹减少、电荷分离弱）。两个非 Mature 阶段总闪频相近但**机制相反**——这是本研究的 key finding。

<h2 id="p-016">十六、讨论：方法学价值与推广</h2>

本研究方法对 GPM（与 TRMM 同样搭载降水雷达但无闪电传感器）以及中国 FY-3G 等低轨卫星可推广，提供全球雷暴气候研究的新框架。但区域差异（南美 vs 海洋大陆 vs 非洲）要求**区域特定标定**——热力、动力、水汽与气溶胶差异显著。

<h2 id="p-017">十七、结论：方法贡献</h2>

基于 TRMM 长期资料，本研究开发了基于机器学习的快照雷暴聚类方法，按对流结构参数客观分类，并据此重建 lightning–convection 的 stage-dependent 关系。结果证明：雷暴快照结构可基于其动力学与结构特征客观分类；stage-dependent 关系是真实存在的，不是统计噪音。

<h2 id="p-018">十八、结论：阶段分类与总样本一致性</h2>

聚类产生的三阶段 CS（Pre- / Mature / Post-Mature）与总样本的演化特征一致：闪频随 Rconv 减小先升后降；回波顶高先升后降；强核面积先扩大后收缩；弱回波面积持续扩大。闪电闪频的两个增长阶段，分别对应垂直结构强化与强核面积扩张——共同支撑 snapshot 雷暴可基于动力学与结构特征分类。

<h2 id="p-019">十九、结论：trade-off 是核心机制</h2>

三阶段的关键差异：Pre-Mature 是高大窄结构 + 高闪电效率；Mature 是最大垂直发展 + 强核面积峰值 + 闪电峰值；Post-Mature 是浅而广 + 低闪电效率。这些模式与 Wurman et al. (2010) 等生命周期研究一致——证实 stage-dependent 分类抓住了 thunderstorm 演化的本质。

<h2 id="p-020">二十、结论：全球推广意义与气候变暖关联</h2>

stage-dependent 关系强调闪电参数化必须分阶段考虑；该框架可推广至 GPM / FY-3G 等无闪电传感器的卫星，提供新的全球雷暴气候视角。但区域差异要求区域特定标定。最终，本研究证明全球星载雷达观测能显著提升我们对雷暴形成与起电机制的理解，对未来气候变暖背景下的强雷暴研究与预报有直接贡献。

<h2 id="p-021">二十一、数据可用性与致谢</h2>

原始数据来自犹他大学 TRMM 数据库（http://trmm.chpc.utah.edu/）。本文代码已开源在 GitHub（https://github.com/oldsixxiaolv/Manuscript_Lvyh），数据已存在 Zenodo（https://doi.org/10.5281/zenodo.18041880）。本研究受国家自然科学基金（42275068）和中央高校基本科研业务费（20250030065）联合资助，计算在兰州大学超算中心完成。

<!--
  本文为 Yihang Lyu 第二作者论文的中文编辑版，原文 JGR: Atmospheres 2026。
  段落结构按原文章节 + 中文编辑逻辑重排：abstract 整体 2 段 + intro 按论点 4 段 + data and methods 按子节 4 段 + results 按子节 8 段 + conclusion 整体 3 段 = 21 段。
  每段 ≤ 200 字，原文意思保留；段落 id p-001..p-021 与 annotations.json 的 anchor.value 对齐。
-->