# 并行切片模式：P1–P4 执行指导

> 本文件在主控 Agent 触发「并行切片模式」时必须完整阅读。
> 对应 SKILL.md 中的「阶段一点五：并行切片执行（条件阶段）」P1–P4 四个子节点。

---

## P1：切片适用性评估

### 输入信息

**必须入参**：
- 阶段一产出的条款索引表（全文，含条款 ID / 类型 / 优先级 / 实现设计类）
- 目标仓库路径

### 目标要求

**任务**：判断本次变更是否适合并行切片模式，输出唯一决策

**目标**：从「仅有条款索引」变为「已有明确探索策略决策」

**完成判定（必须同时满足）**：
- P1. 输出三选一决策：`串行` / `并行` / `两阶段并行`（不允许「可能需要」类模糊表述）
- P2. 若条款中含「所有/全部」修饰语 → 必须有中心化探查结论（存在 / 不存在，含探查命令及输出摘要）
- P3. 决策为「并行」时，说明触发理由（子模块数量 + 各模块预估条款量）
- P4. 决策为「串行」时，说明降级理由（横切+中心化 / 变量量过少 / 模块高度同质）
- P5. 不在本节产出切片设计（越权，留 P3）

### 工作依据

**切片适用的信号（满足其一即可评估）**：
- 80% 以上的条款可分配到 2+ 个「命名可区分的子系统」（如「用户模块」「通知模块」「网关服务」）
- 规范变更涉及 ≥ 3 个独立代码目录，且各目录变更在物理上相对独立
- 主控估计串行系统探索将超过 30 分钟（可通过条款数量粗估）

**切片不适用的信号（任一出现即降级串行）**：
- 规范含「所有接口」「全部日志」「整个系统」类横切修饰，且中心化实现点存在
- 所有子模块变更内容高度同质（同一段代码逻辑重复 N 次，无实质差异）
- 全部变更条款归属同一代码目录（无法切片）

**中心化快速探查流程**（发现横切候选时执行，5 分钟内完成）：

```bash
# 1. 全局 middleware/filter 目录
ls src/middleware/ src/middlewares/ src/filters/ 2>/dev/null

# 2. 全局挂载点检查（Express / NestJS / Koa 适用）
rg "app\.use\|addGlobalFilter\|useGlobalInterceptors\|useGlobalPipes\|globalMiddleware" src/ --type ts --type js -l

# 3. 日志统一初始化点
rg "createLogger\|winston\|pino\|log4js" src/ --type ts --type js -l

# 4. 确认是否有集中处理点（读该文件，判断是否可在此统一植入变更）
```

**高耦合 ≠ 不可切片**（专家直觉）：
- 高耦合（多处 @Inject、service 间互相调用）描述的是「调用依赖」
- 切片的判断标准是「物理变更是否独立」——各自改各自的表/字段/文件
- 调用依赖不影响「各切片能否独立探索并产出变更条目」

**产出格式**：

```markdown
## P1 切片适用性评估结论

**决策**：[串行 / 并行 / 两阶段并行]

**触发/降级理由**：
[具体理由，包括条款归属分析或横切探查结果]

**横切候选处理记录**（若有）：
- 条款 [Sx]：含「[所有...]」修饰语
  - 探查命令：`[命令]`
  - 探查结果：[存在中心化点（路径：X） / 不存在，理由：Y]
  - 处理方式：[降级串行 / 中心化变更归属单独切片]
```

---

## P2：共享资源前置探索

### 输入信息

**必须入参**：
- P1 决策（并行或两阶段并行）
- 目标仓库路径
- 阶段一条款索引表（驱动搜索目标）

### 目标要求

**任务**：探查共享资源的 owner 归属和内容快照，以及绿地切片依赖的 FK 类型

**完成判定（必须同时满足）**：
- P1. Owner Mapping 表完整（每行含：资源名/类型/owner切片/来源文件/禁止产出变更的其他切片）
- P2. 无「owner=待确认」行（若真无法确认，标「owner=主控」，由主控直接处理）
- P3. 绿地切片依赖的 FK 目标表主键类型已记录（字段名 + 类型 + migration 来源文件路径）
- P4. 共享资源内容快照已产出（如枚举当前全量值，后续注入 subagent prompt）
- P5. 不在本节设计切片（越权，留 P3）

### 工作依据

**搜索策略（按顺序执行）**：

```bash
# 1. 共享目录探查
ls src/shared/ src/libs/ libs/ packages/ 2>/dev/null

# 2. 跨模块 import 扫描（发现哪些文件被多模块引用）
rg "from ['\"]\.\.\/shared|from ['\"]\.\.\/\.\.\/shared|from ['\"]libs\/" src/modules/ --type ts -l

# 3. 共享表写入方确认（对条款中涉及的关键表名）
# TypeORM / 原生 SQL：
rg "INSERT INTO auth_token|auth_token.*INSERT\|queryRunner.*auth_token.*createTable" services/ --type ts -l
# ORM 的 entity 写入（TypeORM save/create）：
rg "authTokenRepository\.save\|authTokenRepository\.create\|new AuthToken" services/ --type ts -l

# 4. 绿地切片 FK 主键类型探查
# 在 migrations 目录找目标表
rg "CREATE TABLE.*users\b|createTable.*users" src/migrations/ --type ts --type sql -l
# 读该文件，提取 id 字段定义
```

**共享资源类型识别**：
- 共享枚举/常量文件（`shared_enums.ts`、`constants.ts`）→ 类型=枚举，需内容快照
- 共享数据库表（多服务/多模块共同读写）→ 类型=DB 表，需确认写入方
- 共享库（`libs/auth-middleware`、`packages/shared-types`）→ 类型=共享库，owner=该库目录的切片

**ORM 检测坑位**：
- TypeORM 的 `repository.save(entity)` 不含表名字面量，需改为搜 entity class 名：`rg "new AuthToken\|AuthToken\(\)" src/ --type ts -l`
- Prisma 的 `prisma.tableName.create/update` 含表名，可直接搜

**产出格式**：

```markdown
## P2 共享资源 Owner Mapping 表

| 资源名 | 类型 | Owner 切片 | 来源文件 | 禁止产出变更的切片 |
|--------|------|-----------|---------|-----------------|
| shared_enums.ts | 枚举文件 | 主控统一 | src/shared/shared_enums.ts | 全部（各切片在节D记录意向，主控合并）|
| auth_token 表 | DB 表 | identity 切片 | services/identity/ | resource 切片, gateway 切片 |
| auth-middleware | 共享库 | shared-lib 切片 | libs/auth-middleware/ | identity 切片, resource 切片, gateway 切片 |

## P2 共享资源内容快照

### shared_enums.ts 当前枚举
```typescript
export enum AppStatus { ACTIVE = 'active', INACTIVE = 'inactive' }
// [完整内容...]
```

## P2 FK 类型上下文

| 绿地切片 | FK 目标表 | 目标主键字段 | 主键类型 | 来源文件 |
|---------|---------|------------|--------|---------|
| openapi-developer 切片 | users 表 | id | UUID | src/migrations/001-create-users.ts |
```

---

## P3：切片边界与 ID 体系设计

### 输入信息

**必须入参**：
- P2 Owner Mapping 表 + FK 类型上下文
- 阶段一条款索引表（每条款分配到一个切片）

### 目标要求

**完成判定（必须同时满足）**：
- P1. 条款覆盖率 100%（每条款有且只有一个切片归属，无遗漏、无重复归属）
- P2. 切片边界精确到「文件路径前缀」或「文件名 glob 模式」（禁止「用户相关文件」类模糊描述）
- P3. 每个切片有明确类型：`Greenfield`（目标目录不存在）或 `Brownfield`（目标目录存在）
- P4. 若存在切片间前置依赖（Greenfield 需 Brownfield 探出的 FK 类型），两阶段标注正确
- P5. 每个切片有唯一 ID 前缀（2-4 个大写字母，如 DEV、AUTH、GW、NOTIF）

### 工作依据

**切片边界类型选择逻辑**：

1. **系统有按业务模块切分的目录**（如 `src/modules/*/`）→ 以模块目录为切片边界，最清晰
   ```
   切片名: developer 切片
   边界: src/modules/developer/（含所有子目录）
   ```

2. **系统只有技术层目录**（如 `controllers/`, `services/`, `dao/`）→ 以文件名 glob 模式为边界
   ```
   切片名: user 切片
   边界: 
   - src/services/user*.service.ts
   - src/controllers/user*.controller.ts
   - src/dao/user*.repository.ts
   - src/entities/user*.entity.ts
   - src/migrations/*create-user*.ts（或*user*.ts）
   ```

3. **多服务仓库**（如 `services/identity/`, `services/gateway/`）→ 以服务目录为边界，共享库单独切片
   ```
   切片名: identity 切片
   边界: services/identity/（含所有子目录）
   
   切片名: shared-lib 切片
   边界: libs/auth-middleware/（含所有子目录）
   ```

**两阶段依赖判断**（需要两阶段时标注，否则默认并行）：
- **需要两阶段**：Greenfield 切片规范中有 FK 引用，且 FK 目标表的主键类型在 P2 中无法确定（未在 migrations 中找到）→ 先派 Brownfield 切片探出主键类型，再派 Greenfield 切片
- **不需要两阶段**（仅语义依赖）：切片 A 的服务层变更调用切片 B 的新建接口 → 各自独立探索，主控在 P6 处理顺序关系

**产出格式**：

```markdown
## P3 切片清单

| 切片名 | 类型 | ID 前缀 | 边界（路径前缀/glob） | 负责条款 | 前置依赖 | 派发阶段 |
|--------|------|---------|---------------------|---------|---------|---------|
| developer 切片 | Brownfield | DEV | src/modules/developer/ | S1-S5 | 无 | 阶段一 |
| notification 切片 | Brownfield | NOTIF | src/modules/notification/ | S6-S10 | 无 | 阶段一 |
| openapi-developer 切片 | Greenfield | ODEV | src/modules/openapi-developer/ | S11-S15 | identity 切片（users.id 类型）| 阶段二 |
| shared-lib 切片 | Brownfield | SLIB | libs/auth-middleware/ | S16 | 无 | 阶段一 |
```

---

## P4：subagent Prompt 撰写

### 输入信息

**必须入参**：
- P3 切片清单（每切片的类型/边界/前置依赖/ID前缀）
- P2 Owner Mapping 表 + 共享资源内容快照 + FK 类型上下文
- 规范文档（该切片对应的条款子集，**必须完整原文复制，不得摘要**）

**软上下文（按需查阅）**：
- [templates/slice-prompt-brownfield.md](../templates/slice-prompt-brownfield.md)（Brownfield 模板）
- [templates/slice-prompt-greenfield.md](../templates/slice-prompt-greenfield.md)（Greenfield 模板）

### 目标要求

**完成判定（必须同时满足）**：
- P1. 每份 prompt 通过盲盒测试：假设发给一个不知道任何上下文的 Agent，它能不追问地完成探索并返回正确四节格式
- P2. 「禁止产出」段的内容来自 P2 Owner Mapping（不能自行发明），每项禁止都有理由（「因为 owner 是 X 切片」）
- P3. Brownfield prompt 的探索范围精确到文件路径前缀（不允许「用户相关文件」类描述）
- P4. Greenfield prompt 明确区分「禁止业务模块内部探索」和「允许读基础设施接口签名」
- P5. 每份 prompt 末尾有节 C 格式自检指令（8 字段逐一检查）
- P6. 两类模板不得混用（Greenfield 切片不使用 Brownfield 模板，反之亦然）

### 工作依据

**Brownfield vs Greenfield 的根本差异**（最常见混淆点）：

| 维度 | Brownfield | Greenfield |
|------|------------|------------|
| 信息真值来源 | 代码库（migration + entity + handler） | 规范文档（代码库中无对应目录）|
| 核心任务 | 「探索现状 → 发现差距」 | 「解读规范 → 产出建什么」 |
| 四态标注 | 新增/修改/保留+扩展/冲突重写 | 全部为「新增」 |
| FK 类型来源 | 自行探索（现有 migration）| 主控前置探索提供（P2 FK 类型上下文）|
| 探索指令 | 三轨：数据轨/接口轨/鉴权轨 | 无探索指令（禁止探索业务模块内部）|

**常见错误与预防**：

1. **Brownfield prompt 漏写「跨切片调用返回值扩展风险」判断规则**
   - 场景：UserService 调用 OrgService.findById()，OrgService 有 spec 变更
   - 预防：若切片清单中的「负责条款」中某个 Brownfield 切片的变更会改变其 Entity 字段，则**所有调用该 Entity 方法的 Brownfield prompt 都需加入**以下规则：
     ```markdown
     ## 跨切片调用返回值扩展风险
     若探索中发现本模块调用了 [对方模块] 的 [方法名]，且对方模块有 spec 变更（见共享资源说明）：
     - 判断：该方法的返回值是否包含对方模块的 Entity？
     - 若是：在节 C 对应条款中标注「跨切片调用：返回值扩展风险」
     - 记录调用点：文件路径 + 函数名 + 返回值使用方式（destructure / 类型校验 / 直接透传）
     ```

2. **Greenfield prompt「禁止所有现有代码」过于绝对**
   - 预防：禁止项应精确描述为「禁止探索 `src/modules/[其他业务模块]/` 内部实现」，并显式添加：
     ```markdown
     ## 允许的探索（仅限以下场景）
     ✓ 查阅前置上下文中主控提供的 FK 类型信息
     ✓ 读取被本模块调用的基础设施接口签名（如邮件服务的 method 签名），仅限读接口定义文件，不读内部实现
     ✗ 禁止探索其他业务模块（src/modules/[其他模块]/）的内部实现
     ```

3. **规范条款复制不完整**
   - 绝不摘要规范条款。subagent 如果看到摘要后的规范，会基于不完整信息给出错误差距判断
   - 正确做法：从条款索引表中找到该切片负责的条款 ID，回到规范文档原文逐条复制

**格式自检指令模板**（每份 prompt 末尾必须包含）：

```markdown
## 输出前格式自检（节 C 必须通过）

在输出节 C 之前，对每个条款块逐字段自检，确认以下 8 个字段均已填写（不允许为空或遗漏）：
1. 条款ID：[Sx]
2. 当前状态：[已有 / 无 / 语义不符]
3. 落点：[具体文件路径:函数名/字段名，若无则填「无」]
4. 差距：[精确到字段名/接口路径的差异描述]
5. 变更方向：[新增 / 修改 / 保留+扩展 / 冲突重写 / 无需变更]
6. 本地编号：[前缀-Cx，从 C1 开始，本切片顺序编号]
7. 置信度：[高 / 中 / 低]（低置信时验证建议不能为空）
8. 涉及共享文件：[是 / 否]

若任一字段缺失，先补充后再输出。
```
