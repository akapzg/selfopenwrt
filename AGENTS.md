# AI 驾驶员操作守则 (AGENTS.md)

本文档是本项目（ImmortalWrt 25.12 固件定制）的**最高架构守则与操作规范**。任何接手此代码库的 AI 助手在执行用户指令前，必须无条件阅读并严格遵守以下准则。

---

## 一、项目核心架构与不可动摇原则（Invariants）

1. **纯净 `fw4 (nftables)` 架构，严禁引入 `iptables`**
   - 固件全链路基于 Linux nftables 与 fw4。
   - 绝对禁止添加依赖 `iptables`、`ip6tables`、`kmod-ipt-*`、`turboacc` 或 `shortcut-fe (SFE)` 的废弃插件。
   - CI 编译系统中已内置强制断言检测，一旦检测到 iptables 相关符号将直接中断编译。

2. **坚守 `SquashFS` 镜像格式，杜绝 `ext4` 作为根分区**
   - 必须保持 `CONFIG_TARGET_ROOTFS_SQUASHFS=y`。
   - 严禁启用 `CONFIG_TARGET_ROOTFS_EXT4FS`。SquashFS 拥有只读保护与 Overlay 机制，是支持 `firstboot -y` 秒级出厂重置的核心前提；ext4 断电易损坏且无法重置。

3. **重构建在云端，轻维护在本地**
   - 本地（WSL2 / Windows）职责：修改配置、编辑脚本、语法自查（`bash -n`）、比对 git diff。
   - 云端（GitHub Actions）职责：全量源码自举、多核心编译打包、Releases 发布与 OTA 分发。
   - 严禁在本地无授权运行耗时数小时且吞噬数十 GB 磁盘空间的全量编译。

4. **存储与 Docker 隔离挂载**
   - 系统分区固定为 2048MB (2GB)。
   - 磁盘剩余空间由 [files/etc/init.d/opt-mount](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/files/etc/init.d/opt-mount) 自动扩容格式化为第 3 分区（卷标 `DOCKER_DATA`）并挂载至 `/opt`。
   - Docker 数据目录固定位于 `/opt/docker/`，OTA 升级后配置与容器数据无损保留。

5. **Tailscale 独立防火墙与纯 SLAAC IPv6**
   - Tailscale 必须维持 `--netfilter-mode=off` 与独立 `tailscale` 防火墙区域，禁止动态重写宿主网络。
   - IPv6 采用纯 SLAAC（无有状态 DHCPv6）并抑制 RDNSS，杜绝 DNS 抢答与泄漏。

---

## 二、编译前更新/添加插件的注意事项（防翻车红线）

当用户发出“同步插件”、“更新第三方包”或“新增插件”指令时，AI 必须逐项对照以下清单：

1. **三方插件更新后的“自动防冲刷加固”**
   - 上游仓库（如 sbwml、asvow）代码常带有针对通用系统的原生写法，更新时**严禁无脑覆盖**：
     - **`luci-app-ota`**：必须保持为标准函数 `board_name() { ... }`，绝对不能回退为上游在非交互 shell 报错的 `alias board_name`。
     - **`luci-app-tailscale`**：更新后必须确保 `--netfilter-mode=off` 依然生效，且移除其试图动态修改 `/etc/config/firewall` 的逻辑。
     - **`OpenWrt-nikki`**：每次拉取后必须自动清除 `packages/nikki/mihomo-alpha`，防止编译报符号冲突。
   - 规则：优先通过 [.github/workflows/sync-packages.yml](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/.github/workflows/sync-packages.yml) 触发更新，其内置了 Post-Sync 自动加固守门员。

2. **插件依赖自检（Dependency Check）**
   - 新增插件只需在 [configs/common.config](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/configs/common.config) 或目标架构 `.config` 中增加 `CONFIG_PACKAGE_xxx=y`。
   - 严禁随意引入需要自举 Rust/LLVM 极庞大工具链的冷门依赖，除非用户明确要求。
   - 检查插件是否尝试替换 Nginx 为 uhttpd，系统默认 Web 服务器强制为 Nginx。

3. **脚本权限与行尾符规范**
   - 每次修改或拉取脚本后，必须保证 Linux 权限与 LF 换行：
     ```bash
     find files/ packages/ -type f -exec sed -i 's/\r$//' {} +
     chmod 0755 files/etc/init.d/* files/etc/uci-defaults/* files/sbin/*
     ```
   - 提交前必须执行语法校验：`bash -n <脚本路径>`。

---

## 三、用户自然语言口令映射表（AI Action Playbook）

| 用户口令示例 | AI 执行标准动作 | 严禁行为 |
|---|---|---|
| **“帮我加个插件 XXX”** | 1. 确认该插件不依赖 iptables；<br>2. 在 `configs/common.config` 声明 `CONFIG_PACKAGE_xxx=y`；<br>3. 提交并推送。 | 严禁手写 Makefile 覆盖官方 feed。 |
| **“同步第三方插件”** | 运行更新脚本并触发加固钩子；比对 diff 确认无异常后推送 commit。 | 严禁直接拉取上游盲目覆盖把本地修复洗掉。 |
| **“编译固件 / 发个版本”** | 1. 确认 `git status` 干净；<br>2. 确认命名规则为 `immortalwrt-${VERSION}-${DATE}-${MODEL}-squashfs-...`；<br>3. 协助用户触发 GitHub Actions。 | 严禁在本地执行全量构建。 |
| **“出错了 / 怎么断网了”** | 1. 检查防火墙规则（fw4/flow_offload）；<br>2. 检查 DNS（192.168.100.1#53）；<br>3. 检查 Tailscale 路由冲突（accept_routes）。 | 严禁推荐用户安装 SFE 或降级 fw3。 |

---

## 四、AI 输出规范（遵循 ADHD 友好准则）

1. **结论/代码先行**：优先给出命令、文件路径或修改的代码片段。
2. **列表最多 5 项**：拒绝信息轰炸与长篇大论。
3. **时间估算必须具象**：给出具体分钟/秒数（如“耗时约 30 秒”），绝不用“一会儿/很快”。
4. **完成当前 issue 再提新问题**：不随意发散主题。
5. **句尾标点**：单个中文句号 `。` 结尾，禁止多重标点。
