---
name: chair2-dao-op
description: chair2 项目后端数据库操作规范，包含数据表结构定义、DAO 层 SQL 开发、数据表结构设计与迁移等。编写或审查后端数据库操作代码（entity、dal、extension、service 等文件）时应遵守其中规则。
---
# Chair 2.0 后端数据库操作规范

## 前置约定

### 目录结构说明

```
app/module/${moduleName}/
├── entity/              ← 【你手写】表结构 DSL（TypeScript 装饰器）
├── dal/
│   ├── dao/
│   │   ├── base/        ← 【禁止修改】dalgen 自动生成
│   │   └── Foo DAO.ts   ← 【可扩展】自定义查询方法写这里
│   ├── extension/       ← 【你手写】自定义 SQL 写这里
│   └── structure/       ← 【禁止修改】dalgen 自动生成（.json + .sql）
└── service/             ← 【你手写】业务逻辑，注入 DAO 调用
```

所有命令 cwd 均在 weavefox-infra 项目根目录执行。

---

## 研发流程处理

如果是根据表结构设计定义创建新数据表，必须基于`./workflow/研发流程：新建数据表.md`流程处理。

如果是基于已有数据表进行 DAO 层 SQL 开发，必须基于`./workflow/研发流程：DAO SQL 开发.md`流程处理。

## todo

> placeholder，不需要参考执行

- 数据库单测依赖
- 修改表结构设计 & 结构迁移
