
### 业务组件三层架构

**对于复杂的业务组件（如页面、业务区块），采用 Biz-VM-Component 三层架构进行拆分**。

#### 何时使用三层架构

- ✅ **复杂业务组件**：包含多个业务逻辑、状态管理、API 调用的组件
- ✅ **页面级组件**：完整的页面实现
- ✅ **业务区块**：可复用的业务功能模块
- ❌ **简单展示组件**：基础展示型组件/无业务内容语义的组件，无需复杂逻辑拆分

#### 目录结构


组件实现的目录结构：
```
{module}/common/biz/
└── product.ts          # 1. Biz 层：纯业务逻辑（不依赖 React），相同业务模型可全项目范围复用
{module}/.../components/ComponentName/
├── vm.tsx              # 2. ViewModel 层：状态与交互逻辑
└── index.tsx           # 3. Component 层：纯粹的视图渲染
```

#### 1. Biz 层：抽象业务领域模型

**目标**：提取纯逻辑，不依赖 React，易于测试和复用。

```typescript
// ✅ {module}/common/biz/product.ts

// 类型定义
export interface Product {
  id: string;
  title: string;
  price: number;
  discount?: number;
  stock: number;
}

/**
 * 业务逻辑：计算折后价
 * 纯函数，极易编写单元测试
 */
export function calculateProductFinalPrice(
  price: number,
  discount?: number,
): number {
  if (!discount || discount <= 0) return price;
  return price * (1 - discount);
}

/**
 * 业务逻辑：判断库存状态
 */
export function getProductStockStatus(stock: number) {
  return {
    isOutOfStock: stock <= 0,
    isLowStock: stock > 0 && stock < 5,
  };
}

/**
 * 业务逻辑：校验购买数量
 */
export function validateProductQuantity(qty: number, stock: number): boolean {
  return qty > 0 && qty <= stock;
}
```

#### 2. ViewModel 层：抽象交互状态

**目标**：连接 Biz 与 View，处理副作用，提供"傻瓜式"数据给 UI。

```typescript
// ✅ vm.tsx
import { useState, useMemo } from 'react';
import {
  calculateProductFinalPrice,
  getProductStockStatus,
  validateProductQuantity,
  Product,
} from '@/page/{module}/common/biz/product';

export const useComponentModel = (product: Product) => {
  const [qty, setQty] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 利用 Biz 逻辑计算衍生数据
  const displayPrice = useMemo(() => {
    return calculateProductFinalPrice(product.price, product.discount);
  }, [product.price, product.discount]);

  const { isOutOfStock, isLowStock } = useMemo(() => {
    return getProductStockStatus(product.stock);
  }, [product.stock]);

  // 交互动作
  const updateQuantity = (newQty: number) => {
    if (newQty < 1) return;
    setQty(newQty);
  };

  const addToCart = async () => {
    if (!validateProductQuantity(qty, product.stock)) {
      message.error(__('库存不足或数量无效'));
      return;
    }

    setIsSubmitting(true);
    try {
      await saveToCart({ productId: product.id, qty });
      message.success(__('添加成功'));
    } catch (error) {
      message.error(error || __('添加失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ViewModel 向外暴露的接口
  return {
    state: {
      qty,
      displayPrice,
      isOutOfStock,
      isLowStock,
      isSubmitting,
      canBuy: !isOutOfStock,
    },
    actions: {
      updateQuantity,
      addToCart,
    },
  };
};
```

#### 3. Component 层：纯粹的视图渲染

**目标**：极致的轻量化，只负责"画"出来。

```tsx
// ✅ index.tsx
import React from 'react';
import { useComponentModel } from './vm';
import { Product } from './component.biz'; // 只引入类型
import styles from './index.module.less';

interface ComponentProps {
  product: Product;
}

export const Component: React.FC<ComponentProps> = ({ product }) => {
  // 一行代码接管所有逻辑
  const { state, actions } = useComponentModel(product);

  return (
    <div className={styles.container}>
      <h3>{product.title}</h3>
      <div className={styles.price}>{state.displayPrice}</div>
      {state.isLowStock && (
        <span className={styles.warning}>{__('库存紧张')}</span>
      )}

      {state.isOutOfStock ? (
        <div className={styles.outOfStock}>{__('暂时缺货')}</div>
      ) : (
        <div className={styles.actions}>
          <button onClick={() => actions.updateQuantity(state.qty - 1)}>
            -
          </button>
          <span>{state.qty}</span>
          <button onClick={() => actions.updateQuantity(state.qty + 1)}>
            +
          </button>
          <button onClick={actions.addToCart} disabled={state.isSubmitting}>
            {state.isSubmitting ? __('处理中...') : __('加入购物车')}
          </button>
        </div>
      )}
    </div>
  );
};
```

#### 三层架构的优势

| 维度 | 传统模式 (All-in-one) | Biz-VM-Component 模式 |
| :-- | :-- | :-- |
| **逻辑复用** | 困难，业务逻辑可能在多处重复 | **极高**，`biz/product.ts` 可在列表、详情、购物车多处引用 |
| **测试难度** | 需要渲染组件才能测试逻辑 | **极低**，`biz` 层只需简单的单元测试，`vm` 层可用 `renderHook` 测试 |
| **代码阅读** | 混杂了 JSX 和 `useEffect`，看不清重点 | 职责分离，看 UI 找 `index.tsx`，看逻辑找 `vm.tsx` |
| **UI 替换** | 修改 UI 容易误触逻辑代码 | **安全**，不仅可以随意换 UI 库，甚至可以适配 React Native |
