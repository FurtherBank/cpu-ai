## 研发流程: DAO SQL 开发

### 自动生成的 DAO 内置方法一览

建表过程中执行的 `dalgen` 命令，根据索引信息自动生成以下方法，**无需手写 SQL 即可直接使用**：

| 自动生成的方法                         | 说明                                  | 对应 SQL                                      |
| -------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `insert(data)`                         | 插入                                  | `INSERT INTO ...`                             |
| `update(id, data)`                     | 按主键更新                            | `UPDATE ... WHERE id = ?`                     |
| `delete(id)` / `del(id)`               | 按主键删除                            | `DELETE FROM ... WHERE id = ?`                |
| `findById(id)`                         | 按主键查询                            | `SELECT ... WHERE id = ?`                     |
| `findByPrimary(id)`                    | 同上别名                              | `SELECT ... WHERE id = ?`                     |
| `findOneBy${uniqueField}(uniqueField)` | 对于唯一索引，按 uk_unique_field 查询 | `SELECT ... WHERE unique_field = ? LIMIT 0,1` |

以上表内的内置方法可以放心使用，其它内置方法由于**实际业务查询坑点复杂性的原因**，绝大多数情况不会真的使用这些方法直接查询，因此**禁止使用**。

以上不支持的情况，请按照以下流程编写自定义 SQL 使用：

### Step 1：在 Extension 文件中编写 SQL

接下来以`OpenapiOrder`为例，编写自定义 SQL：

**文件**：`app/module/${moduleName}/dal/extension/OpenapiOrderExtension.ts`

**完整模板**：

```typescript
import { SqlMap, SqlType } from 'chair/tegg/dal';

export default {
  // ─── 示例：多条件组合查询 + 分页 ────────────────────────────
  queryOrderList: {
    type: SqlType.SELECT,
    // 使用 Nunjucks 模板语法进行条件判断和输入入参注入，如
    sql: `
      SELECT {{ allColumns }}
      FROM \`openapi_order\`
      WHERE \`gmt_deleted\` IS NULL

      {# 等值条件（可选）#}
      {% if $status !== undefined %}
        AND \`status\` = {{ $status | param }}
      {% endif %}

      {% if $userId %}
        AND \`user_id\` = {{ $userId | param }}
      {% endif %}

      {# 范围条件（可选）#}
      {% if $amountMin !== undefined %}
        AND \`amount\` >= {{ $amountMin | param }}
      {% endif %}

      {% if $amountMax !== undefined %}
        AND \`amount\` <= {{ $amountMax | param }}
      {% endif %}

      {% if $gmtCreateAfter %}
        AND \`gmt_create\` >= {{ $gmtCreateAfter | param }}
      {% endif %}

      {% if $gmtCreateBefore %}
        AND \`gmt_create\` <= {{ $gmtCreateBefore | param }}
      {% endif %}

      {# LIKE 模糊查询（可选）#}
      {% if $keyword %}
        AND \`remark\` LIKE CONCAT('%', {{ $keyword | param }}, '%')
      {% endif %}

      {# 排序：字段和方向都用白名单控制，不能用 | param（ORDER BY ? 语法无效）#}
      ORDER BY
      {% if $orderBy == 'amount' %}
        \`amount\`
      {% elif $orderBy == 'gmtCreate' %}
        \`gmt_create\`
      {% else %}
        \`gmt_create\`
      {% endif %}
      {% if $orderDir == 'ASC' %} ASC {% else %} DESC {% endif %}
    `,
  },

  // ─── 示例：聚合统计（不用 allColumns）───────────────────────
  countByStatus: {
    type: SqlType.SELECT,
    sql: `
      SELECT \`status\`, COUNT(*) AS cnt
      FROM \`openapi_order\`
      WHERE \`gmt_deleted\` IS NULL
      {% if $userId %}
        AND \`user_id\` = {{ $userId | param }}
      {% endif %}
      GROUP BY \`status\`
    `,
  },
} as Record<string, SqlMap>;
```

**SQL 模板语法速查**：

| 写法                                                                   | 说明                                                    | 安全性             |
| ---------------------------------------------------------------------- | ------------------------------------------------------- | ------------------ |
| `{{ allColumns }}`                                                     | 展开为所有列名；`paginate` 计数查询情况，自动替换为 `0` | 安全               |
| `{{ $foo \| param }}`                                                  | 对于查询入参变量，需通过这种写法，防止注入              | **必须加，防注入** |
| `CONCAT('%', {{ $kw \| param }}, '%')`                                 | 对于 LIKE 模糊搜索入参变量，需通过这种写法，防止注入    | 安全               |
| `{% if $foo !== undefined %}...{% endif %}`                            | 可选条件，值为空/undefined 时整段跳过                   | —                  |
| `{% if $x == 'a' %}...{% elif $x == 'b' %}...{% else %}...{% endif %}` | 白名单枚举，用于 ORDER BY 字段等不能用 param 的场景     | 安全               |
| `{# 注释内容 #}`                                                       | Nunjucks 注释，不输出到 SQL                             | —                  |

**注意事项**：

- 列名一律用反引号 `` ` `` 包裹，且在 TypeScript 字符串中需转义为 `` \` ``
- 所有用户可控的值**必须加 `| param`**，否则存在 SQL 注入风险
- ORDER BY 的字段名和方向**不能用 `| param`**（`ORDER BY ?` 是无效 SQL），必须用 `{% if %}` 白名单

---

### Step 2：在 DAO 文件中添加查询方法

**文件**：`app/module/weavefox_openapi/dal/dao/OpenapiOrderDAO.ts`

```typescript
import { SingletonProto, AccessLevel } from 'chair/tegg';
import { BaseOpenapiOrderDAO } from './base/BaseOpenapiOrderDAO';
import { OpenapiOrder } from '../../entity/OpenapiOrder';

// ─── 查询参数类型定义 ────────────────────────────────────────────
export interface OrderListQuery {
  status?: number; // 可选：等值过滤
  userId?: string; // 可选：等值过滤
  amountMin?: number; // 可选：金额下限（含）
  amountMax?: number; // 可选：金额上限（含）
  gmtCreateAfter?: Date; // 可选：创建时间起
  gmtCreateBefore?: Date; // 可选：创建时间止
  keyword?: string; // 可选：备注关键词 LIKE 搜索
  orderBy?: 'amount' | 'gmtCreate';
  orderDir?: 'ASC' | 'DESC';
}

// ─── 分页结果类型定义 ────────────────────────────────────────────
export interface PageResult<T> {
  total: number; // 总记录数
  pageNum: number; // 当前页码
  rows: T[]; // 当前页数据
}

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export default class OpenapiOrderDAO extends BaseOpenapiOrderDAO {
  // ─── 多条件组合分页查询 ──────────────────────────────────────
  async queryOrderList(
    query: OrderListQuery,
    page: number, // 页码，从 1 开始
    pageSize: number, // 每页条数
  ): Promise<PageResult<OpenapiOrder>> {
    return this.dataSource.paginate(
      'queryOrderList', // 对应 Extension 中的 key
      {
        // 所有参数以 $ 开头传入，与 SQL 模板中 {{ $xxx }} 对应
        $status: query.status,
        $userId: query.userId,
        $amountMin: query.amountMin,
        $amountMax: query.amountMax,
        $gmtCreateAfter: query.gmtCreateAfter,
        $gmtCreateBefore: query.gmtCreateBefore,
        $keyword: query.keyword,
        $orderBy: query.orderBy ?? 'gmtCreate',
        $orderDir: query.orderDir ?? 'DESC',
      },
      page,
      pageSize,
    );
    // 返回值：{ total: number, pageNum: number, rows: OpenapiOrder[] }
  }

  // ─── 聚合统计（返回原始数据，不映射为 Entity）──────────────────
  async countByStatus(userId?: string): Promise<Array<{ status: number; cnt: number }>> {
    return this.dataSource.executeRaw('countByStatus', {
      $userId: userId,
    });
  }
}
```

**`dataSource` 方法决定了输出数据的 js 类型，选择指南**：

| 方法                                   | 返回值                     | 适用场景                                   |
| -------------------------------------- | -------------------------- | ------------------------------------------ |
| `execute(name, data)`                  | `T[]`                      | 查多条，自动映射为 Entity[] 对象             |
| `executeScalar(name, data)`            | `T \| null`                | 查单条，自动映射为 Entity 对象             |
| `executeRaw(name, data)`               | `any[]`                    | 查多条，返回原始行对象（聚合/JOIN 等场景） |
| `executeRawScalar(name, data)`         | `any \| null`              | 查单条，返回原始行对象                     |
| `paginate(name, data, page, pageSize)` | `{ total, pageNum, rows }` | 分页查询，自动执行 COUNT + 数据两条 SQL；**page 从 1 开始**，传 0 会导致 `LIMIT -N, N` SQL 语法错误 |

---

### Step 3：在 Service 中注入 DAO 并调用

```typescript
// service/OrderService.ts
import { SingletonProto, Inject } from 'chair/tegg';
import OpenapiOrderDAO, { OrderListQuery, PageResult } from '../dal/dao/OpenapiOrderDAO';
import { OpenapiOrder } from '../entity/OpenapiOrder';

@SingletonProto()
export class OrderService {
  @Inject()
  private readonly openapiOrderDAO: OpenapiOrderDAO;

  // ─── 分页查询订单列表 ───────────────────────────────────────
  async listOrders(params: OrderListQuery & { page: number; pageSize: number }) {
    const { page, pageSize, ...query } = params;

    // 参数校验（可选，防止 page/pageSize 异常值）
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));

    const result = await this.openapiOrderDAO.queryOrderList(query, safePage, safePageSize);

    return {
      total: result.total,
      page: result.pageNum,
      pageSize: safePageSize,
      list: result.rows,
    };
  }

  // ─── 插入（内置方法，直接调用）─────────────────────────────
  async createOrder(data: Omit<OpenapiOrder, 'id' | 'gmtCreate' | 'gmtModified'>) {
    const result = await this.openapiOrderDAO.insert(data);
    return result.insertId; // 返回新插入的主键 id
  }

  // ─── 更新（内置方法，按主键更新）────────────────────────────
  async updateOrderStatus(id: string, status: number) {
    await this.openapiOrderDAO.update(id, { status });
  }
}
```

#### 事务

通过 `Transactional` 对方法进行打标实现数据库事务。

注意事务需要尽量小，如果执行时间过长可能长时间占用连接导致性能问题。

```typescript
import { Transactional } from 'chair/tegg/transactional';

class FooService {
  // 以下方法会以事务的方式执行
  @Transactional()
  private async helloTransaction() {
    await this.fooDAO.insert({});
    await this.barDAO.insert({});
  }
}
```

---
