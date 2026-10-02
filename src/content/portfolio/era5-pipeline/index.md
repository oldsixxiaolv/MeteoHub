---
title: ERA5 数据本地化与质量控制流水线
slug: era5-pipeline
type: tool
year: 2024
role: Solo
stack: [Python, xarray, Dask, cdsapi, Prefect]
cover: cover.png
repo: https://github.com/yihang-lv/era5-pipeline
demo: https://yihang-lv.github.io/era5-pipeline/
status: shipped
---

## 项目动机

ERA5 是好数据，但**从 CDS API 到能直接喂给模式 / 论文脚本的 Zarr 仓库**，
中间那段"选区 / 切变量 / 单位换算 / 异常值剔除"几乎每个课题组都要写一遍。
我也不例外，三年里重写了两次，索性沉淀成一个流水线。

## 流水线结构

```
CDS API (cdsapi)
   │ 单变量 + 单层 + 单月
   ▼
[Stage 1] Raw NetCDF (hourly, 单变量单层, lat/lon 0.25°)
   │
   ▼
[Stage 2] QC: 异常值 / 缺测填补 / 范围裁剪
   │
   ▼
[Stage 3] 衍生变量: 位温 / 涡度 / 散度 / 水汽通量
   │
   ▼
[Stage 4] Rechunk + Zarr v2 仓库（按年/月）
```

整个流程用 Prefect 编排，可以本地跑、也可以丢到一台 32 核 + 128 GB
的机器上。`xarray + Dask` 处理衍生变量时按 chunk 滑动窗口，避免一次性
加载整年数据。

## 关键设计取舍

- **不直接转 GRIB**：GRIB 在 xarray 里读写都要 `cfgrib` + `eccodes`，
  不同变量还会用不同的 section 模板，对论文脚本不友好；
- **衍生变量按需计算**：`thta` / `vor` 不预生成到仓库，运行时用
  `dask.array.map_blocks` 计算 + 缓存到本地 parquet；
- **单位强校验**：进仓库前用 `cf-units` 把每个变量名 + 单位登记到
  manifest，任何后续脚本失败首先检查 manifest 是否漂移；
- **小时级重采样**：日 / 月统计放仓库侧脚本里算，不污染原始仓库。

## 结果与反思

这套流水线目前是我们组 + 邻近两个课题组的事实标准。**最大的实际收益不是
速度，而是 manifest 强校验**——过去三年因为单位漂移（Pa vs hPa、K vs °C、
m s⁻¹ vs knot）导致的研究脚本返工，至少砍掉了八成。

回头看最值得记下的取舍是"不预生成衍生变量"。当时是为了省存储，事实证明
这个决定也帮我们避免了"仓库里同时存在两份 vorticity 实现"这种常见灾难。
唯一后悔的是没早一点接 Zarr v3 兼容层——2025 年开始多个新工具链只支持 v3。

给同样场景的后来人一个建议：**先建 manifest、再谈优化**。元数据写在第一位，
否则一年内一定重构。

## 已踩过的坑

1. `cdsapi` 同一账户并发请求会被 ban，所以串行 + 重试；
2. `dask` 的 worker 内存估算偏小，碰到高分辨率区域（如东亚 + 0.1°）
   会 OOM，目前靠 chunk 切到 256 MB 控制；
3. Zarr v2 在并发写上偶尔会留下 "incomplete" 标记，CI 里加了
   `zarr.convenience.consolidate_metadata()` 之后稳定下来。

## 后续

- 计划做一份公开的 Zarr 仓库镜像（放在阿里云 OSS），欢迎来取；
- 接下来要把 CMA-MESO、HRCLDAS 也按同样模板接入。
