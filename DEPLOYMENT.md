# 生产部署指南（Docker 自建镜像）

## 架构概览

```
                         ┌─────────────────────────┐
  guohesky.com ─────────▶│  Caddy (Docker 容器)     │ :443/:80
  app.guohesky.com ─────▶│                         │
                         └──┬──────────────┬───────┘
                            │              │ reverse_proxy :13000
              ┌─────────────▼──┐   ┌───────▼────────┐
              │  Astro 静态站   │   │   NocoBase     │ Docker 容器
              │  (Docker 内)    │   │  (Docker 内)    │ 从源码构建
              └────────────────┘   └───────┬────────┘
                                           │ :5432 (内部网络)
                                    ┌──────▼───────┐
                                    │  PostgreSQL  │ Docker 容器
                                    └──────────────┘
```

- **NocoBase**：从本仓库源码构建 Docker 镜像，自定义插件随 `yarn build` 一起编译
- **PostgreSQL**：Docker 容器，在 `docker-compose.prod.yml` 中管理
- **Caddy**：共用 guohesky 项目已有的 Caddy 容器，自动 HTTPS
- **域名**：`app.guohesky.com`

---

## 前提条件

- 服务器已部署 guohesky 官网（Caddy + Docker）
- guohesky 项目的 `Caddyfile` 已配置 `app.guohesky.com` 反代到 `host.docker.internal:13000`
- DNS 已添加 A 记录：`app.guohesky.com` → 服务器 IP

---

## 首次部署

```bash
# 1. 克隆仓库
git clone <repo-url> guohesky-inner
cd guohesky-inner

# 2. 配置环境变量
cp .env.prod.example .env.prod

# 生成 APP_KEY 和 DB_PASSWORD，自动写入 .env.prod
APP_KEY=$(openssl rand -base64 48)
DB_PASSWORD=$(openssl rand -base64 32)
sed -i "s|^APP_KEY=.*|APP_KEY=$APP_KEY|" .env.prod
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$DB_PASSWORD|" .env.prod

# 设置首次登录密码（自己定一个，登录后可修改）
sed -i "s|^INIT_ROOT_PASSWORD=.*|INIT_ROOT_PASSWORD=your_password_here|" .env.prod

# 确认结果
cat .env.prod

# 3. 构建镜像并启动
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

首次启动会自动初始化数据库。等待约 1-2 分钟后访问 `https://app.guohesky.com`。

---

## 更新插件 / 升级

```bash
cd guohesky-inner
git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

---

## 日常运维

### 查看状态

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f nocobase
```

### 数据库备份

```bash
# 手动备份
docker exec nocobase-postgres pg_dump -U nocobase -d nocobase -F c > backup.dump

# 恢复
docker exec -i nocobase-postgres pg_restore -U nocobase -d nocobase -c < backup.dump
```

自动备份（`crontab -e`）：

```
0 2 * * * docker exec nocobase-postgres pg_dump -U nocobase -d nocobase -F c > /opt/backups/nocobase_$(date +\%Y\%m\%d).dump && find /opt/backups -name "nocobase_*.dump" -mtime +7 -delete
```

### 重启服务

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod restart nocobase
```

---

## 验证

1. `docker compose -f docker-compose.prod.yml --env-file .env.prod ps` — 两个服务 running
2. `curl http://localhost:13000` — NocoBase 响应
3. `https://app.guohesky.com` — 通过 Caddy 访问，HTTPS 正常
4. 登录 → 插件管理 → 看到"模板打印"插件 → 启用测试

---

## 安全清单

- [ ] `APP_KEY` 使用 `openssl rand -base64 48` 生成
- [ ] 数据库使用强密码
- [ ] 防火墙仅开放 80、443、SSH
- [ ] NocoBase 端口仅绑定 127.0.0.1（已在 docker-compose.prod.yml 中配置）
- [ ] PostgreSQL 不暴露端口（仅 Docker 内部网络）
- [ ] 首次登录后修改管理员密码
- [ ] `.env.prod` 不提交到 git
