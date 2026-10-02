---
title: WRF 模式实战笔记：边界层参数化对比
slug: 2026-08-04-wrf-pbl-lessons
date: 2026-08-04
author: Yihang Lv
tags: [wrf, pbl, parameterization, model-evaluation]
cover: cover.png
excerpt: 在东亚夏季风背景下跑 WRF 4.5，对比 YSU / MYJ / MYNN2.5 / Shin-Hong 四种 PBL 方案的差异。
readingTime: 12
status: published
---

WRF 的边界层方案（PBL scheme）一直是大家最容易忽略、又最影响结果的设置之一。
这篇文章把 2024 年我做的一组敏感性试验笔记整理出来，重点是**同一段梅雨
过程**在不同 PBL 方案下的差异——以及一些不那么显然的"为什么"。

## 一、试验设计

- WRF 4.5.1，单层嵌套，d01 9 km，覆盖东亚 (15–55°N, 90–140°E)；
- 微物理：Thompson；长波：RRTMG；短波：RRTMG；陆面：Noah-MP；
- 海表：HRCLDAS 实况替换；
- PBL 变量：YSU / MYJ / MYNN2.5 / Shin-Hong 共 4 组；
- 积分时段：2024-06-21 00 UTC – 2024-07-05 00 UTC；
- 评估：与 JRA-3Q、探空站（59431 武汉、58238 南京）的 T / q / u / v 对比，
  以及地面 2 m 气温、10 m 风与 CMA 自动站观测的 RMSE / bias。

## 二、四种方案的"性格"

> 这里的"性格"是基于本次个例的归纳，不代表普适结论。

- **YSU**：非局地闭合，对深对流边界层处理更"硬"。梅雨锋降水偏强，2 m 气温
  在夜间偏低 0.5–1 K（层结稳定时过度混合）。
- **MYJ**：局地 TKE 闭合，夜间稳定层结保留得最好，地面风速最接近实况。
  但白天因为 TKE 生成慢，混合层偏浅，污染潜势偏高。
- **MYNN2.5**：在 MYJ 基础上加了 2.5 阶矩，对流情形下与 YSU 类似，但
  稳定情形保留更多近地面细节。整体偏差最小，但 CPU 开销高约 18%。
- **Shin-Hong**：韩国的非局地方案，对深厚对流边界层做了显式夹卷处理。
  这次梅雨锋里降水落区偏南 100–150 km，原因待查——可能是夹卷长度尺度的
  地形修正项过于敏感。

## 三、几个我之前没想到的事

### 3.1 PBL 与陆面耦合

Noah-MP 输出 `HFX / LH / GRDFLX` 给 PBL，PBL 又把 `TAUX / TAUY` 反馈
回去。如果 PBL 切换**只改了 `bl_pbl_physics`**，但忘了同步 `sf_sfclay_physics`
（地表层方案），那真的是"换汤不换药"——大部分 PBL 方案都要求匹配特定的
地表层方案。

### 3.2 网格分辨率的隐性影响

d01 = 9 km 已经接近"灰区"，传统 PBL 方案的 K-profile 假设开始失灵。
实测下来 MYJ 在 9 km 上明显比 3 km 偏弱，因为 K-profile 的局地性假设在
9 km 上还有效，到了 3 km 之后大涡结构开始主导。**做敏感性试验前，先确
定你的网格尺度处于哪个 regime**。

### 3.3 输出频率

PBL 物理量的"瞬时"输出（如 `TKE_PBL`）如果按 6 小时一次采样，根本看不
出日变化。至少 1 小时一次，最好 15 分钟。我这次因为硬盘紧张一开始用了
3 小时，结果就错过了清晨稳定边界层崩溃的关键过程。

## 四、关于"最好"的方案

不存在。

我的经验法则是：

1. **稳定气候模拟**（如东亚季风长期积分）——MYJ 或 MYNN2.5；
2. **强对流 / 暴雨**——YSU；
3. **空气质量**——MYNN2.5 + ACM2（地表层）；
4. **业务化快速响应**——Shin-Hong（CPU 友好）。

具体到这次梅雨过程，**MYNN2.5 + Thompson + Noah-MP** 的组合整体偏差最小，
但降水极值偏弱——这是另一个故事了，下次写微物理对比。

## 五、给刚上手的同学的小贴士

- `ncdump -h wrfout_d01_2024-06-21_00:00:00 | grep -i bl_pbl` 可以确认实
  际用的是哪个方案（`BL_PBL_PHYSICS` 在 namelist.input 里，但实际生效
  还要看 `namelist.output`）；
- `wrf-python` 里 `getvar(wrf, "PBLH")` 拉出来的混合层高度非常有用，
  但要记得它对 YSU / MYJ 给出的定义不一样（YSU 给出的是夹卷层顶）；
- 多做几组 `vertical cross-section` 而不是单点时序，单点时序很容易"凑巧"
  看起来不错。
