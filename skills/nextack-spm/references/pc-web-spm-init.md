# PC Web SPM：项目初始化与首次配置

**根目录（本文一律指）**：项目仓库内 **前端 npm 包的根目录**，即该包 **`package.json` 所在目录**；**`spm.config.json` 与该 `package.json` 同级**。单包前端仓时多与 Git 仓库根重合；**monorepo 时多为 `apps/web` 等子包目录，不是整个 monorepo 的 Git 根**（除非仓库根本身就是该前端包）。执行 **`spm` / `spm -c`** 及依赖安装时，约定 **`cd` 到此前端包根**。

**PC Web 中台**（React Router、Vite/Webpack 等自管路由）场景下，通常不能依赖 `spm` 从框架托管配置自动解析 B 位；须在 **前端包根目录** 维护 **`spm.config.json`**，并在页面或路由中声明 **`spmBPos` / `spmb`**。

按顺序完成下文各节；**前序未完成时不要批量申请 CD**，否则易出现 A/B 与页面不一致。

---

## 无托管配置时的 spm.config.json（必备）

**适用** Vite、CRA、自研路由等 **未**在仓库内提供 **`config/config.js`**（或等价、可由 `spm` 自动识别项目类型的托管配置）的仓：**必须**在 **该前端包根目录** 增加 `spm.config.json`，否则 `spm` / `spm -c` 会报「找不到预期的配置文件」，且部分版本在 `projectConfig` 为空时可能在雨燕上报处异常退出。

最小示例（**PC Web 中台** 的 `appType` 用 **`site`**；`page` 指向**页面根目录**，其下**每个一级子目录**默认对应一个页面 / 一套 B 位逻辑）：

```json
{
  "type": "h5app",
  "appType": "site",
  "page": "src/pages",
  "spma": "a165"
}
```

- **`type`**：PC Web 中台默认填 **`h5app`**（与 `spm --help` 及平台约定一致时）。
- **`appType`**：**PC 中后台**填 **`site`**；纯移动 H5 填 **`webapp`**；小程序填 **`tinyapp`**。(注：绝大部分场景都是 PC 中后台项目使用该技能)
- **`page`**：`spm` 扫描的页面根路径（相对 **在前端包根下执行命令** 时的当前工作目录，通常如 `src/pages`）。
- **`spma`**：应用在埋点平台侧已申请/绑定的 **A 位**。

---

## Tracert 4.x HTML（`<head>` 内联启动器 + SDK）

PC Web 埋点与 **Tracert 4.x** 一致，语雀基线：[Tracert 4.x](https://yuque.antfin.com/tracert/4.x)。官方文档只要求「放在 `<head>`」，未指定 DOM 子节点序号；**Vite + React + TS** 场景下按运行时约束落地如下。

占位 **`{spma}`** 须替换为埋点平台绑定的 A 位，且与 **`spm.config.json` 的 `spma`**、内联 `set` 中的 **`spmAPos`** 一致。

### 改哪个文件

- **单应用 Vite 包**：修改 **Vite `root`** 下的 **`index.html`**（通常与 **前端包根** 一致）。应用脚本仍由 Vite 注入的 `<script type="module" src="/src/main.tsx">` 等加载；**不要**把 Tracert 片段写进 `src/main.tsx` 替代 HTML——启动器须在首屏 HTML 解析阶段尽早执行。
- **Monorepo 多应用**：每个带独立 `vite.config` / 独立 `index.html` 的包，各自维护自己的 **`index.html`**。

### 在 `<head>` 中的推荐顺序

1. **charset / viewport / title** 等既有 meta 可保留在最前。
2. **内联 Tracert 启动器**（整段 IIFE）：紧跟在基础 meta 之后，**早于** Tracert CDN 的 `<script src="https://ur.alipay.com/tracert_…">`，避免 CDN 异步到达前业务或 SDK 调用 `window.Tracert` 报未定义。
3. **外链** `https://ur.alipay.com/tracert_{spma}.js`，`crossorigin="anonymous"`、`async`。
4. **内联** `if (window.Tracert && window.Tracert.call) { window.Tracert.call('set', { … }) }`：`spmAPos` 与 **`spm.config.json` 的 `spma`**、CDN URL 中的 **`{spma}`** 三者一致（替换占位符）。

### 启动器（内联，整段放入 `<head>`）

```html
<script>
(function loader() {
  if (Object.prototype.toString.call(window.TracertCmdCache) === '[object Array]') {
    window.TracertCmdCache = [];
  }
  var Tracert = {
    _isInit: true,
    _readyToRun: [],
    _guid: function _guid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
      });
    },
    get: function get(key) {
      if (key === 'pageId') {
        window._tracert_loader_cfg = window._tracert_loader_cfg || {};
        if (window._tracert_loader_cfg.pageId) {
          return window._tracert_loader_cfg.pageId;
        }
        var metaa = document.querySelectorAll('meta[name=data-aspm]');
        var spma = metaa && metaa[0] && metaa[0].getAttribute('content');
        var spmb = document.body && document.body.getAttribute('data-aspm');
        var pageId = spma && spmb ? "".concat(spma, ".").concat(spmb, "_").concat(Tracert._guid(), "_").concat(Date.now()) : "-_".concat(Tracert._guid(), "_").concat(Date.now());
        window._tracert_loader_cfg.pageId = pageId;
        return pageId;
      }
      return this[key];
    },
    call: function call() {
      var args = arguments;
      var argsList;
      try {
        argsList = [].slice.call(args, 0);
      } catch (ex) {
        var argsLen = args.length;
        argsList = [];
        for (var i = 0; i < argsLen; i++) {
          argsList.push(args[i]);
        }
      }
      Tracert.addToRun(function () {
        Tracert.call.apply(Tracert, argsList);
      });
    },
    addToRun: function addToRun(_fn) {
      var fn = _fn;
      if (typeof fn === 'function') {
        fn._logTimer = new Date() - 0;
        Tracert._readyToRun.push(fn);
      }
    },
    createTracert: undefined,
    spmAPos: undefined,
    autoLogPv: undefined,
    autoExpo: undefined,
    bizType: undefined,
    ifRouterNeedPv: undefined,
    enableMicroAppInstance: undefined,
    v: undefined
  };
  var fnlist = ['config', 'logPv', 'info', 'error', 'click', 'expo', 'pageName', 'pageState', 'time', 'timeEnd', 'parse', 'expoCheck', 'stringify', 'report', 'set', 'before'];
  for (var i = 0; i < fnlist.length; i++) {
    var fn = fnlist[i];
    (function (fn) {
      Tracert[fn] = function () {
        var args = arguments;
        var argsList;
        try {
          argsList = [].slice.call(args, 0);
        } catch (ex) {
          var argsLen = args.length;
          argsList = [];
          for (var _i2 = 0; _i2 < argsLen; _i2++) {
            argsList.push(args[_i2]);
          }
        }
        argsList.unshift(fn);
        Tracert.addToRun(function () {
          Tracert.call.apply(Tracert, argsList);
        });
      };
    })(fn);
  }
  if (window.Proxy) {
    var handler = {
      get: function get(target, property) {
        var _targetVMhasOwnPropert;
        if (target !== null && target !== void 0 && (_targetVMhasOwnPropert = target.hasOwnProperty) !== null && _targetVMhasOwnPropert !== void 0 && _targetVMhasOwnPropert.call(target, property)) {
          return target[property];
        }
        return target.call.bind(this, property);
      }
    };
    var proxyTracert = new window.Proxy(Tracert, handler);
    window.Tracert = proxyTracert;
  } else {
    window.Tracert = Tracert;
  }
})();
</script>
```

### Tracert SDK 与 `set`（紧随启动器之后，仍在 `<head>`）

将 URL 与脚本中的 **`{spma}`** 全部替换为真实 spma（如 `a1173`）。

```html
<script src="https://ur.alipay.com/tracert_{spma}.js" crossorigin="anonymous" async></script>
<script>
  if (window.Tracert && window.Tracert.call) {
    window.Tracert.call('set', {
      bizType: 'common',
      spmAPos: '{spma}',
      autoExpo: true,
      autoLogPv: true,
    });
  }
</script>
```

### B 位（`body`，与 HTML 规范一致时）

若采用文档式 **页面级 B 位** 自动上报，在 **`index.html`** 的 `<body>` 上设置 `data-aspm`（值为平台下发的 **`b`+数字**，与下文「B 位（spmb）」及页面目录内 **`PAGE_SPMB` 等字面量** 台账一致）：

```html
<body data-aspm="b23765">
```

Vite 默认 `<body>` 内还有挂载点（如 `<div id="root">`），保留即可。

### 开发规范摘要（与平台文档一致）

优先声明式 `data-aspm` / `data-aspm-click` / `data-aspm-expo`；B 位由配置与页面约定处理；C/D 只写后缀；点击用 D 位（`data-aspm-click`）；扩展参用 **`Tracert.stringify()`**。禁止在 D 位元素上再写 `data-aspm`；禁止在 C 位元素上绑点击；禁止手拼扩展参数字符串。

---

## CLI 安装与版本

1. `which spm` — 未安装则全局安装，例如：`npm i -g @alipay/fast-spm` 或组织内常用的 `pnpm` / `tnpm` 等价命令。
2. `spm --version` 与 **`npm view @alipay/fast-spm version`**（或等价 registry 查询）对比，非最新则升级后再次 `spm --version`  
   声明式扫描能力需 **`spm` ≥ 3.5.11**；保持最新版可减少 token 初始化等摩擦。

---

## A 位（spma）— 首次必排期项

- **`spm` 不负责申请 A 位**；A 位代表业务站点/应用身份，通常走 **埋点或数据平台侧审批/绑定**（以你们组织流程为准）。
- **初始化检查清单（建议写入项目 README 或迭代说明）**：
  - 是否已有本应用/本域名的 **spma**（如 `a1234567890`）。
  - 若无：先走 **A 位申请或复用既有站点**，再在该前端包 **`spm.config.json` 的 `spma`**、`index.html` CDN 与 **`Tracert.call('set')` 的 `spmAPos`** **三者一致**，避免每人本地不一致。

---

## B 位（spmb）— 推荐做法

**约定**：**`page` 下每个一级文件夹即一个页面、一套 B 位**；源码中凡出现 **`spmb` / `spmBPos`**（及等价字面量），`spm` 可识别 **页面中文** 并申请、回填，例如：

```text
{ spmb: "页面中文" }
{ spmBPos: "页面中文" }
const spmb = "页面中文"
const spmBPos = "页面中文"
```

**运行时**：在 Tracert 4.x 中常用 **`Tracert.set({ spmAPos, spmBPos, … })`**（或项目封装的 `config`）；须保证 **`spmBPos`/`spmb` 等关键字形态** 可被 `spm` 扫描到。

中台还可辅以（团队选一种并写进规范）：

| 方式 | 做法 | 适用 |
|------|------|------|
| **A** | 维护 **`pages-spm.json`（或 `spm-pages.json`）** 于 **该前端包根**（或团队约定的应用子目录）：列出 `{ "path": "/dashboard/team", "title": "团队管理", "spmb": "" }`，人工或脚本与路由表对齐 | 页面多、需审计 B 位中文是否重复 |
| **B** | 在各 **页面根组件**（如 `src/pages/Home/index.tsx`）内写清 **`spmBPos`/`spmb`** 与 **`spmAPos`**（或集中在 layout） | 页面少、希望 B 位与代码同文件 |
| **C** | 在 **应用壳**（layout）里根据 `location.pathname` 映射到 `spmBPos` | 路径与 B 位集中管理 |

**B 位中文名不可重复**；若多个路由展示名称相同，用 **对内描述** 区分（如 `团队管理-成员子页`），不必与导航文案完全一致。

**数字 `b` 位与平台**：整仓 `spm` 或后置校验时，工具常需在页面目录内解析到**已存在于埋点平台**的 **`b`+数字** 位。若平台返回 **`spmb is not exist` / `500214`**，须先在平台注册该页 B 位或改用已有 `b`，再重跑 `spm`。可在页面目录源码中保留**唯一**一处与平台一致的 **`'b12345'`** 字面量（如 `export const PAGE_SPMB = 'b12345'`），**且**与命令 `ab=<spma>.b12345` 中的 `b` 段一致，便于 `spm path=… ab=` 与后置扫描对齐。

---

## 页面目录约定（与 `spm path=`、`ab=` 配合）

- **约定**：可埋点页面组件集中在 **`src/pages/<页面名>/`**（一级子目录 = 一个页面维度），路径相对 **前端包根**；从 **Git 仓库根** 看的物理路径示例：`apps/web/src/pages/...`。
- **扫描范围**：在 **前端包根** 执行 `spm` / `spm -c`，`path=` 相对该目录（如 `path=src/pages/某页`），避免在 monorepo 最外层误跑导致扫到无关包或找不到配置。
- **页面名（用于 B 位中文或 desc）** 建议来源优先级：
  1. 产品/设计给出的页面中文名（唯一）。
  2. **路由 path** 最后一段 + 业务域，如 `/dashboard/team` → `团队`；完整路径防重名：`仪表盘-团队`。
  3. **文件/目录名**：`TeamPage.tsx` 或 `dashboard/team` → 转中文可读名（需人工校验不重复）。

---

## 首次写入 A.B 与整仓或按页申请

当路由侧**未**集中托管 `spmb`、需依赖源码声明时，推荐两步：

1. **整仓一把梭（推荐）**：在 `spm.config.json`、`page` 目录与各页 **`spmBPos`/`spmb`**、各控件 **`spm="模块-按钮"`** 写好后，于 **前端包根** 执行：  
   **`spm`**  
   由工具顺序申请 **B + CD** 并回填空 `spmb`、生成 **`data-aspm-click`** / **`data-aspm-expo`** 等（即「把声明编译为平台点位代码」）。
2. **指定目录 + 已有 A.B**：仅补某页 CD 时使用（具体以 `spm --help` 为准）：

```bash
spm path=src/pages/Home ab=a1234567890.b9876543210
```

- **`ab=`**：`b` 段必须在平台已存在并与该页一致，否则接口报错，**不会**回填 CD。
- **后置 WARN**：使用 `path=` 时，后置 `spm -l` 可能仍打印「无法识别文件夹归属于哪个 b 位」类提示；若 **`spm -c` 已通过**且接口成功，**以接口回填与 `-c` 为准**，不必被单一 WARN 误导为失败。

---

## TypeScript 与 `spm` / `data-aspm-*`

React + TS 项目默认 **没有** 原生元素上的 `spm`、`data-aspm-click` 等类型。请在 **埋点应用源码** 的 **`src/`**（相对 **前端包根**；monorepo 下物理路径示例 `apps/web/src/`）下增加模块扩充（示例文件名 `spm-dom.d.ts`）：

```typescript
import 'react'

declare module 'react' {
  interface HTMLAttributes<T> {
    spm?: string
    'data-aspm'?: string
    'data-aspm-click'?: string
    'data-aspm-expo'?: boolean | string
    'data-aspm-desc'?: string
    'data-aspm-param'?: string
  }
}
```

（若 ESLint 对泛型 `T` 报 unused，可对文件使用 `eslint-disable @typescript-eslint/no-unused-vars` 或按团队规范处理。）

---

## 组件库与共享包（可选）

若埋点发生在 **被多应用复用的组件**内，可使用 **`spm --help`** 中的 **组件模式**（如 `mode=cp`）及 **`.fast-spm-local.json`**（按组织与 CLI 说明使用）；与 PC 中台不冲突，按仓库策略选择。
