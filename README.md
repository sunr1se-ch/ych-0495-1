# 盐田阶梯蒸发池卤度批次追溯与收卤窗口看板

## 项目结构

```
├── routes/                    # Fresh 路由
│   ├── _app.tsx              # 全局布局
│   ├── index.tsx             # 首页（重定向到 dashboard）
│   ├── dashboard.tsx         # 主看板页面
│   └── api/
│       ├── readings.ts       # POST /api/readings 录入读数
│       ├── batches.ts        # GET /api/batches 获取批次列表
│       ├── batches/[tag]/timeline.ts  # GET /api/batches/{tag}/timeline
│       └── harvest/suggest.ts        # GET /api/harvest/suggest
├── islands/                   # Preact islands（客户端交互）
│   ├── DashboardApp.tsx      # 主应用组件
│   ├── PondChart.tsx         # 四池双轴折线图
│   ├── HypotheticalSidebar.tsx  # 假设录入侧栏
│   └── HarvestWindowList.tsx    # 历史窗口列表
├── utils/                     # 业务逻辑
│   ├── types.ts              # 类型定义
│   ├── db.ts                 # SQLite 连接与表初始化
│   ├── queries.ts            # SQL 查询（手写，无 ORM）
│   ├── time.ts               # 时间工具类（Asia/Shanghai）
│   └── harvest.ts            # 收卤窗口判定算法
├── tools/                     # 工具脚本
│   ├── seed.ts               # 初始化数据库
│   └── generate_readings.ts  # 生成测试数据
├── static/styles.css         # 全局样式
├── Dockerfile
├── docker-compose.yml
└── deno.json
```

## 收卤窗口判定规则

当 D 池同时满足以下两个条件时，判定进入「可收卤窗口」：
1. 连续 2 天波美度 ≥ 26°Bé
2. 连续 2 天液面降幅 < 5cm/日

任一条件不满足则自动关闭窗口。

## 快速启动

### Docker Compose（推荐）

```bash
# 构建并启动
docker compose up -d --build

# 生成测试数据（容器内执行）
docker compose exec app deno task generate

# 访问看板
# http://localhost:8000/dashboard
```

### 本地开发（需安装 Deno 1.40+）

```bash
# 初始化数据库
deno task seed

# 生成测试数据
deno task generate

# 启动开发服务器
deno task dev

# 访问 http://localhost:8000/dashboard
```

## API 说明

### POST /api/readings

录入单池读数，同 pool+measured_at 重复返回 409。

请求体：
```json
{
  "pond_code": "D",
  "measured_at": "2026-06-05T08:00:00+08:00",
  "baume_deg": 26.5,
  "level_cm": 58.2,
  "batch_tag": "2026-S1"
}
```

### GET /api/batches/{tag}/timeline

返回四池按日 readings 序列 + 当前是否 in_window。

支持通过 `X-Hypothetical-Readings` 请求头传递假设录入数据（URL-encoded JSON 数组），用于前端预览。

### GET /api/harvest/suggest?as_of=

按 as_of（ISO8601）模拟判定，缺省用 Asia/Shanghai 当日。

返回当前收卤建议和 D 池条件详情。

## 看板功能

- **批次选择**：下拉切换不同批次
- **四池折线图**：波美度（左轴）+ 液面（右轴）双轴显示
- **D池 in_window 横幅**：进入收卤窗口时页头绿色提示
- **历史窗口列表**：展示所有收卤窗口的开启/关闭时间和原因
- **假设录入侧栏**：前端 session 预览，不落库，支持模拟判定
- **实时指标卡**：四池最新读数一目了然

## 数据持久化

SQLite 数据库文件挂载在 `./data/` 目录，容器重建数据不丢失。
