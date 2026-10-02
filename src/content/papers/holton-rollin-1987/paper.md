---
title: On the Role of Moist Convection in the Tropical Stratospheric QBO
slug: holton-rollin-1987
authors: Holton, J. R., & Rolin, J.
journal: J. Atmos. Sci.
year: 1987
doi: 10.1175/1520-0469(1987)044<1414:OTROMC>2.0.CO;2
pdf: https://doi.org/10.1175/1520-0469(1987)044<1414:OTROMC>2.0.CO;2
tags: [qbo, stratosphere, moist-convection, kelvin-wave]
readingStatus: finished
totalAnnotations: 8
---

> 这篇 1987 年的 JAS 短文是 QBO 理论里被引用最多的「补丁型」工作。
> 它不是新建一个机制，而是把 Lindzen–Holton 1973 的纯动力学框架修了一刀——
> 把「湿对流加热」作为赤道 Kelvin 波的强迫源，放回方程里。
> 下面是我整理的一份读者友好版，重点不是逐句翻译，而是把作者想
> 解决的具体问题、关键推导跳跃、以及它给后人的启示拎出来。

<!--
  Stage 1 · Lyuyihang · paper-reader 集成
  ------------------------------------------------------------------------
  每个 anchor 对应 annotations.json 里的一个 p-XXX；markdown-it 默认不解析 `{#id}`，
  所以这里用显式 HTML <h2 id> / <a id> 来保证稳定的 DOM id，p-001..p-008 必须都在。
--><h2 id="p-001">一、为什么是这篇</h2>

QBO（Quasi-Biennial Oscillation，准两年振荡）是赤道平流层风场在 20–35 km
高度上呈现 ~28 个月周期的下传振荡。1973 年 Lindzen 和 Holton 已经能用
两类赤道波（开尔文波 + 罗斯贝–重力混合波）把动量通量下传过程写得很干净，
但有一个「刺」始终没拔干净：**理论需要 Kelvin 波在 20 hPa 以上有足够强
的辐合**，而当时 SABER / UARS 时代之前的观测并不明确支持这一点。

Holton 和 Rolin 在这篇里做的核心动作是：**把对流层顶附近的凝结潜热释放
放进 Kelvin 波的「强迫项」**，让 Kelvin 波在上对流层获得更强的辐合，
自然就有了更强的动量下沉。整个工作理论分量小、机制澄清分量大，是一
篇很好的「小而精」样本。

<h2 id="p-002">二、关键方程与一段推导</h2>

> 原文 §2 给出了带湿对流强迫的赤道扰动方程；下面给出「读者友好」版本，
> 跳过 1980 年前后的旧式正压近似，回退到现代教科书的记号。

记赤道 β 平面上的扰动量为 (u', v', w', Φ')，基本态为 ū(y, z)。
浅水 + 浮力近似下，Boussinesq 形式为：

$$
\left(\frac{\partial}{\partial t} + \bar{u}\frac{\partial}{\partial x}\right) u' - \beta y \, v' + \frac{\partial \Phi'}{\partial x} = 0
$$

$$
\left(\frac{\partial}{\partial t} + \bar{u}\frac{\partial}{\partial x}\right) v' + \beta y \, u' + \frac{\partial \Phi'}{\partial y} = 0
$$

$$
\frac{\partial u'}{\partial x} + \frac{\partial v'}{\partial y} + \frac{1}{\rho_0}\frac{\partial}{\partial z}\left(\rho_0 w'\right) = 0
$$

$$
\left(\frac{\partial}{\partial t} + \bar{u}\frac{\partial}{\partial x}\right) \frac{\partial \Phi'}{\partial z} + w' N^2 = -N^2 \kappa \, Q'(x, y, z, t)
$$

最后一项里的 κ Q' 就是**湿对流造成的有效浮力扰动**，Holton–Rolin
给出的关键是把它投影到 Kelvin 波结构上：

$$
Q'(x, y, z, t) = \bar{Q}(z)\, e^{i(k x - \omega t)} \, \phi_0(y) \, \mathcal{H}(z - z_{\text{trop}})
$$

其中 ℋ 是 Heaviside 函数（强迫只在 z > z_trop 生效），φ₀(y) 是赤道 β 平面
Kelvin 波的经向结构 ∝ exp(-y² / 2L_y²)。

把以上四式线性化、分离变量，最终得到 Kelvin 波垂直结构方程：<a id="p-003"></a>

$$
\frac{\mathrm{d}^2 \hat{w}}{\mathrm{d}z^2} + \left[\frac{N^2}{(c - \bar{u})^2} - k^2 - \frac{\beta k}{c - \bar{u}} - \frac{1}{4H^2}\right] \hat{w} = \frac{\kappa \bar{Q}(z)}{(c - \bar{u})^2}
$$

读到这里你只需要注意两件事：<a id="p-004"></a>

1. 右端的 κ Q̄(z) / (c - ū)² 是**异质强迫项**，
   当 ū 接近 c（开尔文波相速）时会被放大（共振）；
2. 整篇文章的物理图像是：**湿对流把能量注入到 Kelvin 波垂直模态**，
   波在传播过程中向基本流沉积动量，使 ū 周期反转。

<h2 id="p-005">三、机制图（Holton–Rolin 视角）</h2>

```
              ┌────────── 平流层 30 hPa ──────────┐
              │                                    │
   深对流      │     Kelvin 波携带动量下沉           │
   释放潜热 → → ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ▶
   20 hPa      │                                    │
              └────────── 对流层顶 ────────────────┘
              ↓
         下传相速度 ~1 km / month
              ↓
         周期 ~28 个月
```

注：原文 Figure 1 给出了 1D 垂直动量方程的简化示意图；这里我重新画了一
版，让因果关系更清楚。

<h2 id="p-006">四、这篇工作的几个「非显然」的判断</h2>

- **湿对流是「补丁」，不是「主菜」**。 论文从头到尾强调：没有湿对流，Lindzen–<a id="p-007"></a>
  Holton 框架也能跑；湿对流只是修正了 Kelvin 波在上对流层的强度。
- **纬向对称假设下结论仍成立**。 这条非常重要——后续 Plumb (1977) 的双波
  解释（开尔文 + 罗斯贝）能给出更对称的动量收支，但 Holton–Rolin 提醒
  我们「湿对流强迫」对两类机制都有效，所以**对机制选择是中性的**。
- **数值实现非常轻量**。 全文只有一组参数化实验，没有跑 GCM——这也
  是它「补丁型」工作的标志。

<h2 id="p-008">五、留给后续工作的三个问题</h2>

1. **湿对流加热的垂直分布**到底长什么样？1990 年之后的高分辨率模拟和
   TRMM 降水观测给出了不同的答案，Holton–Rolin 用的是 1980 年代对流参数
   化的旧产物；
2. **MJO 的影响**：MJO 与赤道开尔文波的对偶关系在 2000 年后才被系统研究，
   本文的「湿对流 → Kelvin 波」在 MJO 框架里是重新焕发还是被边缘化？
3. **与现代再分析资料的对比**：ERA5、JRA-3Q 给出的 QBO 周期比 1970–1990
   年代偏长，可能与海温背景态变化有关，与本文的机制选择形成新的因果问题。

<h2 id="p-009">六、给读者的「阅读路径」建议</h2>

- 先读 Holton 原书 *An Introduction to Dynamic Meteorology* 第 12 章，
  把赤道波背景补齐；
- 再读 Lindzen & Holton (1973)，理解「两波」框架；
- 然后回到本文，2 小时足够；
- 想看现代视角时，推荐 Baldwin et al. (2001) Rev. Geophys. 综述。

读完这一组三件套，QBO 这块基本就能跟同行聊天不露怯了。

---

**封面图占位**：`cover.png`（SVG 见同目录）
