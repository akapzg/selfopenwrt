# Custom ImmortalWrt 25.12 Builder (x86_64 & NanoPi R5S)

基于 **ImmortalWrt 25.12 最新正式版** 构建的自用定制固件项目，支持 **全套 `fw4 (nftables)` 纯净防火墙接管（零 `iptables`）**、**磁盘剩余空间自动挂载 `/opt`（OTA 无损恢复）**、**官方内核 `vermagic` 对齐（100% 兼容官方源 `kmod-*`）** 以及 **GitHub Releases 在线 OTA 升级**。

---

## 一、 核心定制特性

| 类别 | 定制内容 |
| :--- | :--- |
| **目标设备** | `x86_64`（UEFI / PVE / ESXi，含 2.5G/10G 驱动与 KVM 支持）& `NanoPi R5S / R5C` |
| **默认后台与网口** | 管理地址：`http://192.168.100.1`（`root` 无密码）；两台设备统一为 **`eth0` = WAN，其余网口全桥接至 LAN** |
| **分区与自动扩容** | 系统盘固定 `2048MB (2GB)`（支持 `SquashFS` 一键重置）；首次开机自动将磁盘剩余空间建第 3 分区 (`DOCKER_DATA`) 挂载至 `/opt`，OTA 升级后自动无损找回 |
| **Web 与外观** | `Nginx`（支持 HTTP/3，替换 `uhttpd`，放宽 `ubus`/`uwsgi` 并发与超时）+ `Argon` 主题 + 全局简体中文 (`zh_Hans`) |
| **IPv6 与 DNS 治理** | 切换为 **纯 SLAAC**（解决 NAS/PC 公网 IPv6 后缀漂移）+ **关闭 IPv6 RDNSS 广播**（防双栈 DNS 抢答泄漏与污染） |
| **Docker 纯净解耦** | 移除 `iptables` 依赖，配置 `iptables='0'` 与 `data_root='/opt/docker/'`；由 `fw4` 统一接管 `172.16.0.0/12` 全局出口 NAT (`src='*'`) 及 `docker <-> lan` / `docker -> wan` 转发，严禁容器穿透防火墙 |
| **Tailscale 纯净接管** | 强制 `--netfilter-mode=off`，自动预置 `tailscale0` 接口、`tailscale` 防火墙区域（含 `masq` / `mtu_fix`）及 `tailscale <-> lan` 双向互访 + `tailscale -> wan` (Exit Node) 转发 |

---

## 二、 内置插件列表（共 32 项）

- **代理与分流**：`HomeProxy`、`Nikki (mihomo-meta)`、`MosDNS v5`
- **组网与内网穿透**：`Tailscale`（含 `luci-app-tailscale`）、`WireGuard`、`DDNS`、`Socat`、`UPnP`
- **存储、文件与下载**：`Docker / DockerMan`、`DiskMan`、`QuickFile 文件管理`、`OpenList`、`Rclone`、`Samba4`、`qBittorrent`、`Aria2`（含 `AriaNg` 面板）
- **影音与电视组播**：`AirPlay 2`（含 USB 声卡驱动）、`rtp2httpd`（IPTV 组播转单播）
- **测速、扫描、监控与流控**：`FastNet 网络体检与测速`、`HomeBox 内网测速`、`局域网设备扫描 (LAN Scanner + arp-scan)`、`网速测试`（含 `iPerf3` + `Speedtest`）、`nlbwmon 带宽监控`、`SQM 队列管理`、`EQoS IP 限速`
- **系统工具与升级**：`OTA 在线升级`、`TTY 终端`、`CPU 性能调节`、`LED 配置`、`自定义命令`、`网络唤醒 (WoL)`、`Watchcat`、`KMS 服务器`、`释放内存`、`定时重启`、`emmc-install`（R5S 专属刷写 eMMC 命令）

---

## 三、 工作流与目录结构（按需手动触发 + 编译前强制自检断言）

1. **[`.github/workflows/sync-packages.yml`](.github/workflows/sync-packages.yml)**（手动触发：同步第三方插件源码）：
   - 平时完全冻结 [`packages/`](packages) 下经过实机验证的插件版本；当需要更新插件时手动点击 `Run workflow`，安全拉取上游最新代码并自带删库保护。
2. **[`.github/workflows/build.yml`](.github/workflows/build.yml)**（手动触发：云端编译双平台固件并发布 OTA）：
   - 手动点击 `Run workflow` 即可拉取最新 `ImmortalWrt v25.12.*` 正式版标签（或指定版本），执行 **源码补丁断言 + `.config` 纯净度断言**，并发编译 `x86_64` 与 `NanoPi R5S` 固件并发布至 GitHub Releases。
3. **[`UPGRADE_CHECKLIST.md`](UPGRADE_CHECKLIST.md)**（上游更新与编译前检查清单）：
   - 同步插件或升级 ImmortalWrt 版本前对照检查的完整说明与本地 30 秒预检命令。
4. **[`scripts/diy.sh`](scripts/diy.sh)**：编译前源码定制脚本（含末尾 8 项强制自检断言，防止 `sed` 静默失效）。
5. **[`files/`](files)**：首次开机固化配置 [`99-custom-settings`](files/etc/uci-defaults/99-custom-settings)、早期自动挂载与 OTA 恢复服务 [`opt-mount`](files/etc/init.d/opt-mount) 及 R5S 写盘工具 [`emmc-install`](files/sbin/emmc-install)。
6. **[`configs/`](configs)**：[`x86_64.config`](configs/x86_64.config)、[`nanopi-r5s.config`](configs/nanopi-r5s.config) 与共用插件配置 [`common.config`](configs/common.config)。
