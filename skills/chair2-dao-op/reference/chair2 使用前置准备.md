
## 应用数据源申请

1. 参考 物理数据库申请 在 ODC 平台申请物理数据库。
2. 物理数据源申请成功后，参考应用数据源申请，在 sofa portal 中申请应用数据源，并记录应用数据源名称。
![image](https://mass-office.alipay.com/huamei_koqzbu/afts/img/iyjPRY64HSEAAAAAAAAAABAAenV5AQBr/fmt.webp)

## 应用配置

### framework 设置

> 仅标准应用需要设置 framework，函数应用不需要。

确保在 `package.json` 中设置 framework 为 chair。

```json
// package.json
{
  ...,
  "egg": {
    "framework": "chair"
  }
}
```
### 开启插件

> 仅标准应用需要开启 teggDal 插件，函数应用不需要。

在 `config/plugin.ts` 中开启 dal 插件。

```typescript
// config/plugin.ts
export default {
  teggDal: true,
};
```
### 配置数据源

在 `module.yml` 中配置前面申请到的应用数据源名称，例如 `afx_data_layer`。

```yaml
# module.yml
dataSource:
  # 数据源名称，可以在 @Table 注解中指定
  # 如果 module 中只有一个 dataSource，@Table 会默认使用这个数据源
  default:
    database: afx_data_layer
    forkDb: true
    # 默认值 500ms, 仅在出现 PoolWaitTimeoutError 错误时需要配置
    # poolWaitTimeout: 500
```
若需要配置多个数据源，可以在 `module.yml` 中配置多个，并通过 key 进行区分。

```yaml
# module.yml
dataSource:
  firstDS:
    database: afx_data_layer
    forkDb: true
  otherDS:
    database: other_ds
    forkDb: true
```
### script & ci 配置

在 `package.json` 中新增 dal 脚本以及 ci 配置，编辑后运行 `tnpm update` 以更新 `.aci.yml`。

⚠️ 注意：修改配置后，请务必运行 `tnpm update` 更新 `.aci.yml` 文件。

```json
// package.json
{
  "devDependencies": {
    "@ali/ci": "^4.70.0",
    ...,
  },
  "scripts": {
    "dalgen": "chair-bin dal gen"
  },
  "ci": {
    "variables": {
      "MYSQL_DATABASE": "{数据库名称}, 同 module.yml 中的 database 字段。若用到多个数据库，用逗号分隔，例如 afx_data_layer,other_ds"
    }
  }
}
```
