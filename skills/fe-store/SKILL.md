---
name: fe-store
description: 基于 Valtio 封装的极简 Store 方案，用于 React 业务模块中的跨层级状态共享和业务逻辑解耦。支持直觉式 mutable 修改、原生 async/await 异步 Action、以及状态自动重渲染。当需要替代 useState 进行复杂状态管理或解决 Prop Drilling 问题时使用。
---

# Frontend Store (Valtio-based)

## 🎯 适用场景
在 React 开发中，当遇到以下情况时应优先使用此方案：
- **跨层级共享**：一个大型业务模块（如复杂表单、详情页、Dashboard）中，深层组件需要读写根组件数据，避免 **Prop Drilling**。
- **逻辑解耦**：需要将复杂的业务逻辑（Action）从 UI 组件中分离出来，保持组件清爽。
- **异步操作**：需要处理复杂的异步请求流，且希望像写同步代码一样直接修改状态。

**原则**：
- 状态仅由一个组件独享：使用 `useState`。
- 状态跨组件树共享或逻辑复杂：使用本 Store 方案。

## 🏗️ 核心架构
基于 **Valtio** 封装，核心特点：
1. **直觉式修改**：在 Action 中像修改普通 JS 对象一样直接赋值 `state.x = y`。
2. **异步友好**：Action 原生支持 `async/await`，无需额外中间件。
3. **自动渲染**：State 变化时，订阅该状态的组件会自动重渲染。

## 🚀 快速上手

### 0. 准备工作
在使用此方案前，请确保已完成以下准备：

1. **安装 valtio 前端依赖**：
   ```bash
   npm install valtio lodash
   npm install -D @types/lodash
   ```
2. **确认/创建工具函数**：
   检查项目中是否存在 `src/utils/store.ts`（或类似路径）。如果不存在，请参考 [reference.md](reference.md) 中的核心实现代码创建一个。
3. **确定 Store 存放位置**：
   建议在业务模块目录下创建 `stores/` 文件夹，或在 `src/stores/` 统一管理。

### 1. 定义 Store (`src/stores/xxxStore.ts`)
使用 `createStore` 定义初始状态和动作。

```typescript
import { createStore } from '@/utils/store';

const initialState = {
  userInfo: {}, 
  counter: 0,
  loading: false
};

export const myStore = createStore({
  initialState,
  actions: {
    // 同步修改
    increment: ({ state }, delta = 1) => {
      state.counter += delta;
    },
    // 异步操作
    fetchUser: async ({ state, actions }, userId) => {
      state.loading = true;
      try {
        const res = await api.getUser(userId);
        state.userInfo = res;
        actions.increment(1); // 调用兄弟 Action
      } finally {
        state.loading = false;
      }
    },
    // 重置状态
    logout: ({ reset }) => {
      reset();
    }
  }
}, 'MyStore');
```

### 2. 在组件中使用
使用 `useStore` Hook 获取状态和动作。

```tsx
import { useStore } from '@/utils/store';
import { myStore } from '@/stores/xxxStore';

export const MyComponent = () => {
  const [state, actions] = useStore(myStore);

  return (
    <div>
      <h1>User: {state.userInfo.name}</h1>
      <button onClick={() => actions.increment()}>
        Count: {state.counter}
      </button>
    </div>
  );
};
```

## 🛡️ 最佳实践与规范 (必读)

### 1. 异步 Action 中禁止解构 State
在 `await` 之后获取 state 字段时，必须通过 `state.xxx` 引用获取，禁止预先解构。
- ✅ **正确**：`await api.submit(state.count)` (获取最新值)
- ❌ **错误**：`const { count } = state; await sleep(); api.submit(count)` (可能拿到旧值)

### 2. 状态修改必须走 Action
禁止在组件中直接修改 `state`，所有状态变更逻辑应封装在 Store 的 `actions` 中。

### 3. 派生数据使用 useMemo
不要在 Store 中存储冗余的计算属性，应在组件层使用 `useMemo` 基于 `state` 计算。

## 📖 参考资料
- utils/store.ts 核心实现代码：[reference.md](reference.md)
- 更多详细用法请参考项目文档。
