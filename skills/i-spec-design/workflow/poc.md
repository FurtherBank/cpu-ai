
# poc (概念验证实验)

## 1. 技能描述
本技能用于在正式设计或编码前，对高风险、不确定的技术点进行低成本的实验验证。它支持两种模式：在独立环境中验证（Sandbox）或在实际项目分支中验证（In-Context）。

## 2. 输入参数
- `spec_folder`: 当前 Spec 所在目录 (例如 `./specs/⏳ 20260213-升级ORM/`)。
- `poc_name`: 实验名称，英文短横线命名 (例如 `verify-sql-parsing`)。
- `mode`: 实验模式。
    - `independent`: 独立实验（不需要项目上下文）。
    - `dependent`: 依赖实验（需要在项目代码库中修改）。
- `goal`: 实验要回答的核心问题。
- `codebase_path`: (仅 `dependent` 模式需要) 项目根路径。

## 3. 执行流程 (Workflow)

### 3.1 实验环境准备 (Setup)

**分支逻辑 A: 独立实验 (Mode: independent)**
*   **适用场景**: 验证纯算法、新库的基本用法、正则匹配等。
*   **动作**:
    1.  在 Spec 目录下创建实验专用子目录: `{spec_folder}/pocs/{poc_name}/`。
    2.  初始化实验环境（如创建 venv, package.json 等，视具体语言而定）。

**分支逻辑 B: 依赖实验 (Mode: dependent)**
*   **适用场景**: 验证老代码兼容性、集成测试、已有模块改造可行性。
*   **动作**:
    1.  进入 `codebase_path`。
    2.  确保工作区干净 (git status clean)。
    3.  基于当前主分支（或指定基准分支）签出新分支: `git checkout -b poc/{date}-{poc_name}`。
    4.  **注意**: 此模式下，实验代码将直接修改项目文件。

### 3.2 实验执行 (Execution)
**动作**: 编写并运行验证代码。
*   **编写**:
    *   *Independent*: 在 `{spec_folder}/pocs/{poc_name}/` 下创建代码文件（如 `main.py`）。
    *   *Dependent*: 直接修改项目源码或添加临时的 Test Case。
*   **运行**: 执行代码，并**捕获标准输出、错误日志、返回值**。
*   **提交 (关键)**:
    *   *Independent*: 代码文件自然保存在文件系统中。
    *   *Dependent*: 实验结束后，**必须**将修改提交并推送到远端，防止本地丢失。
        ```bash
        git add .
        git commit -m "POC: {poc_name} 实验代码"
        git push origin poc/{date}-{poc_name}
        ```

### 3.3 结果记录与清理 (Reporting & Cleanup)
**动作**: 根据模板生成 POC 报告。

**报告生成路径**:
*   *Independent*: `{spec_folder}/pocs/{poc_name}/POC.md`
*   *Dependent*: `{spec_folder}/pocs/{poc_name}_report.md` (因为代码在 Git 分支里，Spec 目录下只存报告)

**清理动作 (仅 Dependent)**:
*   切回主分支: `git checkout master` (或原分支)。
*   删除本地分支 (可选): `git branch -D poc/{date}-{poc_name}` (确保已 push)。

## 4. 报告标准模板 (Report Template)

无论是哪种模式，生成的 Markdown 文件必须包含以下内容：

```markdown
# POC 实验报告: {poc_name}

> **日期**: YYYY-MM-DD
> **模式**: {mode}
> **相关资源**: {Branch Name 或 Folder Path}

## 1. 实验目的 (Why)
简述为什么要进行这次实验。
- **待验证假设**: 例如“新版本的 A 库可以完全兼容旧版 B 函数的返回值”。
- **风险点**: 如果不验证，可能会导致什么后果。

## 2. 执行过程 (Process)
分步记录关键的实验步骤。
*(如果是 Dependent 模式，请注明：“完整代码见 Git 分支：`poc/xxx`，以下为核心改动片段”)*

### 步骤标题，例如：测试 xxx 运行逻辑
> 每个独立验证的步骤可以通过一个 h3 描述
1. 在`src/index.ts`文件中编写 xxx 过程代码；
2. 通过`npm run dev`命令运行实验代码，并观测 xx 过程的输出。
输出日志如下：
```text
Error: Method not found...
```
> 注：客观记录你看到的运行结果，不要掺杂主观判断。

**结论**: 这个方法无法获取到对应的函数，需要考虑对 xxx 进行调整

### 对 xxx 进行调整

...


## 3. 最终结论 (Conclusion)
基于观测结果给出的定性结论。
- **状态**: ✅ 通行 / ❌ 阻塞 / ⚠️ 需降级处理
- **建议**: 基于实验结果，对后续 Design 阶段的建议。
  - *Example*: "新库可以使用，但必须编写一个 Adapter 层来转换日期格式。"
```

## 5. 输出产物清单
1.  **POC 报告文件** (Markdown)。
2.  **代码产物**:
    - *Independent*: 本地文件夹中的代码脚本。
    - *Dependent*: 远端 Git 分支。
3.  **结论元数据**: 返回简单的 JSON 供上层 Skill 判断 (`{"status": "success", "risk_level": "low"}`)。
