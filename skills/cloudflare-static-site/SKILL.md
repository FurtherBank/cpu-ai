---
name: cloudflare-static-site
description: |
  WHAT：把 HTML、CSS、JavaScript 等静态文件部署到已登录的 Cloudflare 账户，留下不绑定自有域名、部署结束后仍然存在的 workers.dev 网站。
  WHEN：用户要发布简单静态站点，并接受 workers.dev 地址。Wrangler 未登录时，先通知用户完成登录，再做这次长期部署。只有用户明确要一个约 60 分钟后过期的预览时，才使用 `wrangler deploy --temporary`。
---

# Cloudflare 静态站点

默认结果是一个长期网站：Wrangler 已登入某个 Cloudflare 账户，执行不带 `--temporary` 的 `wrangler deploy`。部署结束后，网站留在该账户的 `workers.dev` 地址上。命令行不会打印 `Claim within`，也没有认领链接。

`wrangler deploy --temporary` 是另一条命令。它在未登录时换一个大约 60 分钟后过期的预览，命令行会打印 `Claim within: 60 minutes` 和 Claim URL。用户没有明确要这种预览时，不要用它代替长期部署。

「登录」指 Wrangler 登入 Cloudflare 账户，用 `npx wrangler whoami` 判断。已经登录就直接做长期部署。尚未登录时，发 macOS 通知请用户在浏览器里完成 `npx wrangler login`，等 `whoami` 显示已登录后，再执行长期部署。不要在未登录时改跑 `--temporary`。

Cloudflare Pages 是另一个托管产品的名字，不是「多个 HTML 页面」。R2 是 Cloudflare 的对象存储产品。这两条都不在本 skill 里。本 skill 不判断账单。

## 2026-09-23 已跑过的长期部署

以下发生在写出这份记录的那台电脑上，不是正在读这份文件的电脑此刻的状态。

那天 `npx wrangler` 版本是 `4.136.3`，`whoami` 显示已经用 OAuth 登录。在静态项目目录执行：

```bash
npx wrangler deploy
```

命令成功，打印的网址是 `https://ai-ws-static-poc.1293874885.workers.dev`。`ai-ws-static-poc` 是 `wrangler.jsonc` 里的 `name`。`1293874885` 是这个账户的 `workers.dev` 子域，由账户决定，不要写进 `wrangler.jsonc`。输出里没有 `Claim within`，也没有 Claim URL。确认页面返回之后，该项目目录里写入了 `cloudflare-site.json`，其中的网址就是这次打印的地址。

随后在那台电脑上用 curl 请求该网址的 `/`，以及页面里 `./site.css` 对应的 `/site.css`。两者都是 HTTP 200，正文与上传文件一致。

同一天更早，未登录时执行过 `wrangler deploy --temporary`，得到的是另一个主机名，并带有 60 分钟认领时限。那次不作为默认结果。

## 文件

在要部署的目录里新建 `wrangler.jsonc`。不要加入 `main` 字段。`assets` 里只写 `directory`，不要加 `binding`。

`name` 写成这次站点自己的名字。它只变成网址的第一段。第二段用账户已有的 `workers.dev` 子域，部署时由命令行打印，不要自己编。名字不超过 63 个字符，只能含字母、数字和连字符，且不能以连字符开头或结尾。

`compatibility_date` 写成部署当天，格式与 `2026-09-23` 相同：四位年、两位月、两位日，中间用连字符。

```jsonc
{
  "name": "换成这次站点的名字",
  "compatibility_date": "2026-09-23",
  "assets": {
    "directory": "./public"
  }
}
```

代码块里的日期只演示格式，部署时改成当天。

在要部署的目录下创建文件夹 `public`。首页的路径是 `public/index.html`。不要放成 `public/public/index.html`。样式和脚本放在 `public` 里，HTML 用相对路径引用。2026-09-23 那次，HTML 写的是 `./site.css`，curl 请求的是网址上的 `/site.css`。这次 HTML 若引用别的文件，以这次 HTML 为准。

## 部署

在要部署的目录执行 `npx wrangler whoami`。

已经登录：执行

```bash
npx wrangler deploy
```

不要加 `--temporary`。把命令行打印的完整网址写进给用户的回复。

尚未登录：先发通知，再执行 `npx wrangler login`，让用户在浏览器里完成登录。

```bash
osascript -e 'display notification "要留下长期网站，需要在浏览器里完成 Cloudflare 登录。登录后会继续部署。" with title "Cloudflare 静态站点" sound name "Glass"'
npx wrangler login
```

`whoami` 变为已登录后，再执行上面的 `npx wrangler deploy`。登录没有完成时，停在这里，不要改跑 `--temporary`。

## 用户明确要短期预览时

用户说出要一个会过期的预览之后，先看这次 `npx wrangler whoami` 的原文。

未登录，且这次输出里出现 `wrangler deploy --temporary` 这句命令：执行

```bash
npx wrangler deploy --temporary
```

2026-09-23 未登录时，`whoami` 曾把这句命令写在输出里。以这次输出里有没有这句话为准，不要凭记忆假定它一定还在。

回复里写明命令行打印的时限、预览网址和 Claim URL。Claim URL 含一次性 token，不要写入 skill、仓库或日志。

这次 `whoami` 没有这句命令：不要执行 `--temporary`。告诉用户当前 Wrangler 没有给出短期预览命令。若用户改要长期网站，回到上一节，登录后执行 `npx wrangler deploy`。

## 怎样算网站返回了页面

在刚执行部署的这台电脑上，用 curl 请求命令行打印的网址，以及这次 `index.html` 用相对路径引用的每个文件在该网址上的对应路径。

每一项都是 HTTP 200，且正文与刚上传的文件一致，才算这次网站从这台电脑所在的网络返回了页面。长期部署没有认领时限；有 `Claim within` 的那次是短期预览。

长期部署通过上述检查后，在 `wrangler.jsonc` 同一目录写入或覆盖 `cloudflare-site.json`。这个文件记录网站现在部署在哪，供下次改这个网站时使用。它不是 Wrangler 的部署配置。短期预览不要写入这个文件。

```json
{
  "说明": "这个文件夹对应的长期网站。下次改页面后，在本目录执行 npx wrangler deploy，沿用 wrangler.jsonc 里的 name。",
  "网址": "https://命令行这次打印的完整网址",
  "站点名": "与 wrangler.jsonc 的 name 相同",
  "最近部署日期": "2026-09-23"
}
```

`网址` 用命令行这次打印的完整地址。`站点名` 与 `wrangler.jsonc` 的 `name` 写成同一个字符串。`最近部署日期` 用这次部署当天，格式与 `2026-09-23` 相同。代码块里的日期和占位句子只演示格式，写入文件时换成这次的真实网址、站点名和日期。

下次进入已有网站的目录时，先读 `cloudflare-site.json`。文件不存在时，把它当作还没有长期部署记录，按上面的部署步骤做完后创建。文件存在时，`站点名` 必须与 `wrangler.jsonc` 的 `name` 一致；不一致就停下来告诉用户，不要部署。一致时执行 `npx wrangler deploy`。curl 通过后，把 `网址` 和 `最近部署日期` 改成这次的结果。`说明` 保持上面这句，除非用户改了维护方式。

不要把这一次 HTTP 200 写成每个国家或每条网络都已验证。2026-09-23 那次记录没有从中国大陆测量 `workers.dev`。正在做的这次验收也不要补做跨国测量。
