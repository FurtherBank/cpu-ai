# 技术方案：{功能名称}

> 本模板由 s-ai-dev-enable 建设，供 AI Agent 在需要技术方案时使用。

## 关联信息
- Issue：#{issue-number}
- 预计影响面：{小/中/大}
- 是否有 breaking change：{是/否}

## 变更概述
一句话描述本方案要做什么。

## 涉及文件/模块

| 文件/模块 | 变更类型 | 变更描述 |
|---|---|---|
| {路径} | 新增/修改/删除 | {描述} |

## 影响面分析
{运行影响面分析命令的预期结果，如：
- `npx nx affected --target=build` 预期影响：web-app、feature-user
- 无跨包影响
}

## 方案详述

### API 变更（如有）
{描述 API endpoint 的增/删/改，含 request/response schema 变化}

### 数据库变更（如有）
{描述 migration 内容，包含 up 和 down 方向}

### 公共 API 变更（SDK 项目，如有）
{描述导出接口的变化，ai-extractor 预期输出类型：minor/major}

## 风险与回滚
- 风险点：{如：修改了高频调用的共享 util，影响面广}
- 回滚方案：{如：直接 revert commit / 执行 migration down}

## 测试计划
- 单元测试：{描述要新增的测试用例}
- 集成测试：{如适用}
- E2E 测试：{如适用}
- 手动验证步骤：{如适用}
