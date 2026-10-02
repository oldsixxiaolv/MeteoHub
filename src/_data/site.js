module.exports = {
  title: "MeteoHub · 个人学术站点",
  shortTitle: "MeteoHub",
  tagline: "以大气之名，写下可被验证的东西。",
  description:
    "中科院大气物理研究所 · 个人学术站点 — 作品集、博客与论文精读。",
  // ⚠️  author 字段单一来源（Phase 2B.1）：
  //   · 所有 hero / footer / Person JSON-LD / 学术画像都消费这里的 author.jobTitle
  //   · 别在模板里硬编码 "PhD Candidate" / "Postdoctoral researcher" / "博士后"
  //   · 如需更新身份，改这一处即可
  author: {
    name: "Yihang Lv",
    givenName: "Yihang",
    familyName: "Lv",
    alternateName: "吕亦航",
    fullName: "吕亦航",
    affiliation: "中科院大气物理研究所",
    affiliationShort: "IAP-CAS",
    affiliationUrl: "https://www.iap.cas.cn/",
    // 学术身份（Single Source of Truth）。Phase 2B.1 决策：采用 "PhD Candidate"
    //   · 与 OG 图像 / Person JSON-LD / hero 文案保持完全一致
    //   · IAP-CAS 学术站点的常见表述
    jobTitle: "PhD Candidate",
    // role 字段已弃用，统一用 jobTitle（保留仅为旧模板兼容，勿手动改）
    role: "PhD Candidate",
    research: "东亚季风变异 · 数据同化 · 机器学习订正",
    bio:
      "PhD candidate at IAP-CAS, working on East Asian monsoon variability, satellite data assimilation, machine-learning bias correction and high-resolution numerical simulation.",
    email: "yihang.lv@mail.iap.ac.cn",
    github: "https://github.com/oldsixxiaolv/MeteoHub",
    // ⏬ 以下是部署时人工替换的占位符：⏬
    //   scholar：Google Scholar 个人主页 user id（在 scholar.google.com/citations?user=XXX）
    //   orcid：ORCID 官方 16 位 ID（https://orcid.org/XXXX-XXXX-XXXX-XXXX）
    //   twitterSite / twitterCreator：X / Twitter handle（无 @）
    scholar: "https://scholar.google.com/citations?user=example", // ⚠️ 占位，请替换 user=example 为真实 user id
    orcid: "https://orcid.org/0000-0000-0000-0000",               // ⚠️ 占位，请替换 0000-0000-0000-0000 为真实 ORCID
    twitterSite: "@meteohub",          // ⚠️ 占位，请替换 @meteohub 为真实 X/Twitter site handle
    twitterCreator: "@oldsixxiaolv",   // ⚠️ 占位，请替换 @oldsixxiaolv 为真实 X/Twitter creator handle
    // sameAs 是 Google 用来把多个 profile 关联到同一个人（实体消歧）。
    // 顺序无所谓，权威源（ORCID / 官方机构页）放前面，模板里 Person JSON-LD 会消费。
    sameAs: [
      "https://orcid.org/0000-0000-0000-0000",                      // ⚠️ 占位 ORCID
      "https://scholar.google.com/citations?user=example",          // ⚠️ 占位 Scholar
      "https://github.com/oldsixxiaolv/MeteoHub",
      "https://github.com/oldsixxiaolv/Manuscript_Lvyh",
      "mailto:yihang.lv@mail.iap.ac.cn",
    ],
    // knowsAbout 用于学术画像；写研究领域关键词（中英双语方便搜索引擎抓）。
    knowsAbout: [
      "Atmospheric Sciences",
      "East Asian Monsoon",
      "Data Assimilation",
      "Machine Learning Bias Correction",
      "Numerical Weather Prediction",
      "Satellite Remote Sensing",
      "Tropical Cyclones",
      "Boundary Layer Meteorology",
      "大气科学",
      "东亚季风",
      "数据同化",
      "机器学习订正",
      "数值模拟",
    ],
  },
  url: "https://oldsixxiaolv.github.io/MeteoHub",
  locale: "zh-CN",
  buildYear: new Date().getFullYear(),
  nav: [
    { label: "首页", href: "/" },
    { label: "作品集", href: "/portfolio/" },
    { label: "博客", href: "/blog/" },
    { label: "论文精读", href: "/papers/" },
    { label: "关于", href: "/about/" },
  ],
  social: [
    // 链接到用户的论文手稿仓（与 site 仓 oldsixxiaolv/MeteoHub 区分）
    { label: "GitHub", href: "https://github.com/oldsixxiaolv/Manuscript_Lvyh", icon: "github" },
    { label: "Scholar", href: "https://scholar.google.com/citations?user=example", icon: "graduation-cap" }, // ⚠️ 占位
    { label: "Email", href: "mailto:yihang.lv@mail.iap.ac.cn", icon: "mail" },
  ],
};
