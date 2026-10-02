---
title: ERA5 再分析数据入门：选区与下载
slug: 2026-09-12-era5-reanalysis-intro
date: 2026-09-12
author: Yihang Lv
tags: [reanalysis, era5, data-assimilation, xarray]
cover: cover.png
excerpt: 一份给大气科学初学者的 ERA5 选区与下载实战笔记。
readingTime: 8
status: published
---

第一次接触 ERA5 的同学，常常会被 CDS（Climate Data Store）网页上那一片
密密麻麻的变量表劝退。这篇文章把"我想研究 2020 年夏季长江中下游降水异常"
作为例子，演示从选区到本地 NetCDF 的完整流程。

## 一、先想清楚三件事

在打开网页之前，先回答这三个问题：

1. **空间范围**——是全球、东亚、还是某个省？ERA5 全球 0.25° 数据单变量
   一年大约 30 GB，全要素要乘个 10–20；下载前最好用 `geopandas` 把研究区
   bbox 算出来。
2. **时间分辨率**——hourly / monthly means？ERA5 hourly 单变量一年就 30 GB，
   monthly averaged 的 `stat` 表只有几 MB。**如果你的研究能用月平均就
   别下 hourly**，省时省力还省钱（CDS 配额）。
3. **变量清单**——把需要的变量、压强层（单层 / 等压面 / 模型层）、统计量
   （instant / accumulated）一次性列出来。ERA5 的变量命名很反直觉，例如
   "Total precipitation" 是 `tp`，单位是 m；"2 metre temperature" 是 `t2m`，
   单位是 K。

把这三件事写进一个小本子或 README，可以省下后面无数次"我是不是下错变量了"的怀疑。

## 二、用 CDS API 而不是网页下载

网页能下，但：

- 单次请求有变量数 / 文件大小限制；
- 浏览器 cookie 容易断；
- 没法写进流水线。

装好 `cdsapi` 之后，写一份 `~/.cdsapirc`：

```
url: https://cds.climate.copernicus.eu/api/v2
key: <YOUR_UID>:<YOUR_API_KEY>
```

> 2024 年 9 月起 CDS 域名从 `cds.climate.copernicus.eu` 改成
> `cds.climate.copernicus.eu`（实际是换到了新的 cds-beta），登录后的
> 个人页面里能直接看到 key，复制下来就好。

然后是最小可运行示例：

```python
import cdsapi

c = cdsapi.Client()
c.retrieve(
    "reanalysis-era5-single-levels",
    {
        "product_type": "reanalysis",
        "variable": ["2 metre temperature", "total precipitation"],
        "year": ["2020"],
        "month": ["06", "07", "08"],
        "day": [f"{d:02d}" for d in range(1, 32)],
        "time": [f"{h:02d}:00" for h in range(24)],
        "area": [35, 110, 25, 125],   # N, W, S, E
        "format": "netcdf",
    },
    "era5_2020_jja.nc",
)
```

注意 `area` 是 `[North, West, South, East]`，**顺序反的**，第一次用的人
几乎都栽过。

## 三、用 xarray 打开并快速 sanity check

```python
import xarray as xr

ds = xr.open_dataset("era5_2020_jja.nc")
print(ds)                          # 维度 + 坐标 + 变量
print(ds["t2m"].isel(time=0).plot())
print(ds["t2m"].mean("time").plot())
```

几个常见的"咦"：

- `longitude` 是 0–360 不是 -180–180，需要 `ds = ds.assign_coords(
  longitude=((ds.longitude + 180) % 360) - 180).sortby("longitude")`；
- `tp` 是累积量，ERA5 在每个 hour 边界给出的是**自上一小时末以来的累计**，
  真正的日合计需要 `tp.resample(time="1D").sum()`；
- `expver` 这个维度经常让人迷惑——ERA5 有时会出现 `era5` 和 `era5t`（实时）
  共存的情况，下载时记得明确 `product_type="reanalysis"` 就能避免。

## 四、顺手再做点后续

- 把上面的脚本打包成 `era5-fetch --bbox 110,25,125,35 --vars t2m,tp --years 2020:2024`；
- 把所有月份的结果用 `xarray.open_mfdataset` 合到一起，再用 `.to_zarr("era5_2020_2024.zarr")`
  转成 Zarr，后续按年切片分析会快得多；
- 记得把 `~/.cdsapirc` 加进 `.gitignore`，CDS API key 一旦泄露必须立刻重置。

## 小结

ERA5 不难，难的是**第一次**。把"先想清楚三件事 → CDS API → xarray sanity
check"这条路径走通一次，后面任何项目都能直接套用。
