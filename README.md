# 糖糖日记

给妈妈在 iPhone 上使用的单人照护日记。首页四个入口为喂奶、尿布、黄疸和体温，卡片沿用原来的大小，并显示最近一次的关键内容和时间。喂奶入口先显示每日奶量折线图，再显示具体记录；其他入口显示该类历史记录，底部“添加记录”按钮可录入最新一次。健康页还能记体重和实际用药。母乳增强剂仅记录是否添加，每次新建喂奶记录时默认关闭。

首次打开是空日记。可先填宝宝昵称和真实出生日期时间；已有记录则可从“设置 → 导入备份数据（JSON）”恢复。数据保存在当前设备的浏览器里，不用账号，不会自动同步到其他设备。

首页宝宝天数从出生当天算第 1 天，按本机日期更新。在首页点“历史奶量”可查看每日实际喝入总量的折线图，切换 7 天或 30 天。选择日期可回看截至当天的趋势和当天的喂奶明细。各类记录按时间从新到旧排列，底部按钮可直接添加该类记录，默认时间为当前时间。黄疸可以记录一次或多次测量，通过“添加一次测量”增添读数，也可移除多余项；按已填写的同单位读数实时计算平均值，空白不计入。JSON 备份保留原始读数，兼容旧版单次数值、四次读数及原有增强剂明细；编辑旧记录也会保留原有增强剂明细。

## iPhone 使用与迁移

1. 在 Safari 打开正式网页，点“共享 → 添加到主屏幕”；如有“作为网页 App 打开”，将它打开，再点“添加”。以后从主屏幕上的「糖糖日记」进入。[Apple 操作说明](https://support.apple.com/zh-cn/guide/iphone/iphea86e5236/27/ios/27)
2. 若从旧 ChatGPT 站迁移，先在旧站导出完整 JSON 并确认文件已保存。建议从新网页的主屏幕图标打开，再导入旧备份、核对时间线并重新导出一份。旧站与新站属于不同域名，记录不会自动出现。
3. 定期从“设置 → 导出完整数据（JSON）”备份。在系统分享中选“存储到文件”，或去 Safari 的“下载”查找，确认文件确实存在。CSV 可用 Excel 查看或打印；完整恢复请使用 JSON。

更详细的操作见 [数据隐私、备份与旧记录迁移](docs/PRIVACY_AND_MIGRATION.md)。

## 本地检查

`dist/` 是原生 HTML、CSS、JavaScript 源码。需要 Node.js 24 运行测试；Playwright 仅用于开发和 CI。没有前端构建或第三方运行时。

```sh
npm ci
npx playwright install chromium
npm test
```

可安装 `webkit` 后以 `TANGTANG_BROWSER=webkit` 运行相同浏览器测试（PowerShell：`$env:TANGTANG_BROWSER='webkit'`）。桌面 WebKit 不代表 iPhone 真机。

本地预览先运行 `node scripts/stage-pages.mjs .pages`，再用 `python -m http.server 8000 --directory .pages` 启动，然后访问 `http://localhost:8000/`。每次准备新版本请使用尚不存在的输出目录。

## GitHub Pages 发布

在目标仓库的 **Settings → Pages → Source** 选择 **GitHub Actions**。运行 “Verify and deploy GitHub Pages” 或向 `main` 推送。工作流通过测试后只上传静态网页文件，并根据这些文件的内容设置 Service Worker 缓存版本。旧版本会在打开的网页关闭后交接；用户第一次联网打开新地址并完成缓存后，才可离线启动。

发布步骤参见 [GitHub Pages 官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。提交和发布时不要包含真实资料、JSON/CSV 导出文件或账号凭据。
