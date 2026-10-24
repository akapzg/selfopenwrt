# Custom ImmortalWrt 25.12 Builder (x86_64 & NanoPi R5S)

基于 **ImmortalWrt 25.12 最新正式版** 构建的自用定制固件项目，支持 **自动巡检上游版本更新**、**全套 `fw4 (nftables)` 纯净防火墙接管**、**磁盘剩余空间自动挂载 `/opt`（OTA 无损恢复）** 以及 **GitHub Releases 在线 OTA 升级**。

---

## 一、 核心定制特性

| 类别 | 定制内容 |
| :--- | :--- |
| **目标设备** | `x86_64`（UEFI / PVE / ESXi，含 2.5G/10G 驱动与 KVM 支持）& `NanoPi R5S / R5C` |
| **默认后台与网口** | 管理地址：`http://192.168.100.1`（`root` 无密码）；两台设备统一为 **`eth0` = WAN，其余网口全桥接至 LAN** |
| **分区与自动扩容** | 系统盘固定 `2048MB (2GB)`（支持 `SquashFS` 一键重置）；首次开机自动将磁盘剩余空间建第 3 分区 (`DOCKER_DATA`) 挂载至 `/opt`，OTA 升级后自动无损找回 |
| **Web 与外观** | `Nginx`（支持 HTTP/3，替换 `uhttpd`）+ `Argon` 主题 + 全局简体中文 (`zh_Hans`) + HDMI 终端输出 |
| **IPv6 与 DNS 治理** | 切换为 **纯 SLAAC**（解决 NAS/PC 公网 IPv6 后缀漂移）+ **关闭 IPv6 RDNSS 广播**（防双栈 DNS 抢答泄漏与污染） |
| **Docker 纯净解耦** | 移除 `iptables` 依赖，配置 `iptables='0'` 与 `data_root='/opt/docker/'`；由 `fw4` 统一接管 `172.16.0.0/12` 全局出口 NAT (`src='*'`) 及 `docker <-> lan` / `docker -> wan` 转发，严禁容器穿透防火墙 |
| **Tailscale 纯净接管** | 强制 `--netfilter-mode=off`，自动预置 `tailscale0` 接口、`tailscale` 防火墙区域（含 `masq` / `mtu_fix`）及 `tailscale <-> lan` 双向互访 + `tailscale -> wan` (Exit Node) 转发 |

---

## 二、 内置插件列表（共 28 项）

- **代理与分流**：`HomeProxy`、`Nikki`、`MosDNS v5`
- **组网与内网穿透**：`Tailscale`（含 `luci-app-tailscale`）、`WireGuard`、`DDNS`、`Socat`、`UPnP`
- **存储、文件与下载**：`Docker / DockerMan`、`DiskMan`、`QuickFile 文件管理`、`OpenList`、`Rclone`、`Samba4`、`qBittorrent`
- **影音与电视组播**：`AirPlay 2`（含 USB 声卡驱动）、`rtp2httpd`（IPTV 组播转单播）
- **测速、监控与流控**：`网速测试`（含 `iPerf3` 内网测速 + `Speedtest` 外网测速）、`nlbwmon 带宽监控`、`SQM 队列管理`、`EQoS IP 限速`
- **系统工具与升级**：`OTA 在线升级`、`TTY 终端`、`CPU 性能调节`、`LED 配置`、`自定义命令`、`网络唤醒 (WoL)`、`Watchcat`、`KMS 服务器`、`释放内存`、`定时重启`、`emmc-install`（R5S 专属刷写 eMMC 命令）

---

## 三、 双自动化工作流与目录结构

1. **[`.github/workflows/sync-packages.yml`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/.github/workflows/sync-packages.yml)**（自动化 1：每日同步第三方插件）：
   - 每天北京时间 03:00 自动检查非 ImmortalWrt 官方源的外部插件（`quickfile`、`mosdns`、`v2ray-geodata`、`nikki`、`luci-app-tailscale`、`luci-app-ota`、`luci-app-netspeedtest`、`luci-app-socat`）是否有更新，有更新则自动同步提交至本仓库 [`packages/`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/packages) 目录（若上游删库则自动跳过并保留本仓库已有代码）。
2. **[`.github/workflows/build.yml`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/.github/workflows/build.yml)**（自动化 2：追踪 ImmortalWrt 正式版并编译固件）：
   - 每天北京时间 04:00 自动巡检上游 `ImmortalWrt` 最新 `v25.12.*` 正式版 Tag；有新版本（或手动点击触发）时并发编译 `x86_64` 与 `NanoPi R5S` 固件并发布 OTA。
3. **[`scripts/diy.sh`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/scripts/diy.sh)**：编译前源码定制脚本（官方源插件直接沿用并按需修改，第三方插件 100% 直接从本仓库 [`packages/`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/packages) 读取，零外部克隆风险）。
4. **[`files/etc/uci-defaults/99-custom-settings`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/files/etc/uci-defaults/99-custom-settings)**：首次开机自动执行的固化配置与 `/opt` 自动分区恢复脚本。
5. **[`configs/`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/configs)**：[`x86_64.config`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/configs/x86_64.config)、[`nanopi-r5s.config`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/configs/nanopi-r5s.config) 与共用插件配置 [`common.config`](file:///c:/Users/thepz/OneDrive/Documents/VScode/openwrt/configs/common.config)。
