# Store 方案核心实现代码

该参考文件包含了 Store 方案的核心实现，供 Agent 在生成 Store 定义和组件使用代码时参考。

```typescript
/**
 * ============================================================================
 * 前端极简状态管理方案 - 基于 Valtio
 * ============================================================================
 * 
 * 核心特点：
 * 1. 直接修改 state，无需 reducer
 * 2. Action 支持 async/await，无需 saga
 * 3. 自动响应式更新，组件自动重渲染
 * 4. 支持 reset 重置状态
 */

import { proxy, useSnapshot } from 'valtio';
import cloneDeep from 'lodash/cloneDeep';

/**
 * Store 定义接口
 */
export interface StoreDefinition<S = any, A = any> {
  /** 初始状态 */
  initialState: S;
  /** 动作集合 */
  actions: {
    [K in keyof A]: (
      context: {
        /** 可修改的响应式状态 */
        state: S;
        /** 当前 store 的所有 actions，可用于 action 间互相调用 */
        actions: A;
        /** 重置状态到初始值 */
        reset: () => void;
      },
      ...args: any[]
    ) => any;
  };
}

/**
 * Store 实例接口
 */
export interface StoreInstance<S = any, A = any> {
  /** 响应式状态代理对象 */
  state: S;
  /** 绑定后的动作集合 */
  actions: { [K in keyof A]: (...args: any[]) => any };
  /** 初始状态快照（用于 reset） */
  _initialState: S;
  /** Store 名称（用于调试） */
  _name?: string;
}

/**
 * 创建一个新的 Store 实例
 * 
 * @param definition - Store 定义对象，包含 initialState 和 actions
 * @param name - Store 名称，用于调试和日志
 * @return Store 实例，包含 state 和 actions
 */
export function createStore<S extends object, A extends Record<string, any>>(
  definition: StoreDefinition<S, A>,
  name?: string,
): StoreInstance<S, A> {
  // 1. 深拷贝初始状态，用于 reset 功能
  const initialStateCopy = cloneDeep(definition.initialState);

  // 2. 将初始状态转换为响应式 Proxy
  const stateProxy = proxy<S>(definition.initialState);

  // 3. 定义 reset 函数，用于重置状态
  const reset = () => {
    Object.keys(stateProxy).forEach(key => {
      delete (stateProxy as any)[key];
    });
    Object.assign(stateProxy, cloneDeep(initialStateCopy));
  };

  // 4. 创建 actions 对象并绑定上下文
  const actions = {} as any;
  Object.keys(definition.actions).forEach(key => {
    const originalFn = definition.actions[key];
    actions[key] = (...args: any[]) => {
      return originalFn(
        {
          state: stateProxy,
          actions,
          reset,
        },
        ...args,
      );
    };
  });

  return {
    state: stateProxy,
    actions,
    _initialState: initialStateCopy,
    _name: name,
  };
}

/**
 * 在 React 组件中使用 Store 的 Hook
 * 
 * @param storeInstance - 由 createStore 创建的 store 实例
 * @param selector - 可选的选择器函数，用于只监听 store 的一部分数据
 * @return [state, actions] 元组
 */
export function useStore<S extends object, A extends Record<string, any>>(
  storeInstance: StoreInstance<S, A>,
): [Readonly<S>, A];
export function useStore<S extends object, A extends Record<string, any>, T>(
  storeInstance: StoreInstance<S, A>,
  selector: (state: S) => T,
): [Readonly<T>, A];
export function useStore<S extends object, A extends Record<string, any>, T>(
  storeInstance: StoreInstance<S, A>,
  selector?: (state: S) => T,
): [Readonly<S | T>, A] {
  const snapshot = useSnapshot(storeInstance.state);
  const selectedState = selector ? selector(snapshot as S) : snapshot;
  return [selectedState as any, storeInstance.actions as any];
}

/**
 * 工具函数：从 window.appData 安全地获取初始数据
 */
export function getFromAppData<T = any>(path: string, defaultValue: T): T {
  // ... 实现细节见 store.ts
  return defaultValue;
}
```
