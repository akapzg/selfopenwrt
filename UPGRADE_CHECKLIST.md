# 上游更新与编译前检查清单（Pre-Build Checklist）

本仓库已采用 **“纯手动触发（`workflow_dispatch`）+ 编译前自动强制断言（Assertions）”** 策略。平时仓库完全锁定在经过 QEMU 虚拟机实测通过的源码与插件状态，不会在后台自动拉取或编译。

当你准备**同步最新第三方插件**或**升级 ImmortalWrt 上游版本**时，请按以下清单逐项对照检查后再触发编译。

---

## 一、同步第三方插件后的 4 项检查（运行 `Sync Third-Party Packages` 后）

当你手动在 GitHub Actions 运行 [`sync-packages.yml`](.github/workflows/sync-packages.yml) 后，它会自动生成一个包含上游插件更新的 Commit。在编译固件前，请点开该 Commit 的 Diff 查看以下 4 处：

### 1. 检查 `packages/luci-app-tailscale` 是否修改了启动脚本
- **关注文件**：`packages/luci-app-tailscale/root/etc/init.d/tailscale` 与 `root/usr/sbin/tailscale_helper`
- **检查重点**：
  - 确认启动命令是否仍包含 `--netfilter-mode=off`（[`scripts/diy.sh`](scripts/diy.sh) 会自动替换 `procd_set_param command $PROGD`，若上游改了变量名，`diy.sh` 的断言会报错提示）。
  - 确认 `tailscale_helper` 末尾没有重新加入自动创建/删除防火墙规则的代码（防止与我们在 [`99-custom-settings`](files/etc/uci-defaults/99-custom-settings) 中预置的纯 `fw4` 规则冲突）。

### 2. 检查 `packages/luci-app-ota` 是否修改了 `/usr/bin/ota`
- **关注文件**：`packages/luci-app-ota/root/usr/bin/ota`
- **检查重点**：
  - 确认 `do_check()` 中的 `curl` 命令包含 `-L` 参数（跟随 GitHub Releases 的 `HTTP 302` 重定向），且 `ota_init()` 创建了 `/var/run/ota` 与 `/var/lock`。

### 3. 检查 `packages/nikki` 与 `packages/mosdns` 的编译器版本要求
- **关注文件**：`packages/nikki/mihomo-meta/Makefile`、`packages/mosdns/mosdns/Makefile`
- **检查重点**：
  - 检查是否有新增的 `GO_VERSION` 要求超出当前 ImmortalWrt `v25.12` 分支内置的 Go 版本（目前为 `Go 1.26`）。
  - 确认 `packages/nikki/mihomo-alpha` 已被自动清理（仅保留 `mihomo-meta`，防止 Kconfig 循环依赖）。

### 4. 检查是否有插件新增了 `+iptables` 依赖
- **关注文件**：本次 Commit 中所有变动過的 `Makefile`
- **检查重点**：
  - 搜索 Diff 中是否出现了 `+iptables`、`+ip6tables` 或 `+kmod-ipt-`。若有，需在 [`scripts/diy.sh`](scripts/diy.sh) 中将其剥离，保持全系统 `0` 个 `iptables` 包。

---

## 二、升级 ImmortalWrt 官方版本时的 5 项检查

### 情况 A：同分支小版本升级（例如 `v25.12.2` -> `v25.12.3`）
同分支小版本仅包含内核小版本安全修补（如 `6.12.103` -> `6.12.108`）与 Bug 修复，架构与配置结构不变，通常**无需修改任何代码**，直接点击 [`build.yml`](.github/workflows/build.yml) 的 `Run workflow` 即可，内置的 7 项 `diy.sh` 断言和 `.config` 断言会自动替你完成校验。

### 情况 B：跨大版本升级（例如未来从 `v25.12` 升级到 `v26.xx`）
跨大版本升级时，请对照检查以下 5 项：

1. **检查纯 `fw4` 零 `iptables` 断言是否通过**
   - 检查官方 `feeds/packages/utils/dockerd/Makefile` 和 `feeds/packages/net/sqm-scripts/Makefile` 是否终于原生移除了 `+iptables`，或者改用了新的依赖写法。
2. **检查 `luci` 默认 Web 服务器替换是否生效**
   - 检查 `feeds/luci/collections/luci-light/Makefile` 是否仍依赖 `+uhttpd`，确认 [`scripts/diy.sh`](scripts/diy.sh) 第 2 步将其替换为 `+luci-nginx` 后，`make defconfig` 生成的 `.config` 中没有 `CONFIG_PACKAGE_uhttpd=y`。
3. **检查默认网口桥接结构（`br-lan`）**
   - 检查新版本 `package/base-files/files/bin/config_generate` 生成的 `/etc/config/network` 中，`network.@device[0]` 是否依然是 `br-lan`。
   - 检查 [`files/etc/uci-defaults/99-custom-settings`](files/etc/uci-defaults/99-custom-settings) 中的 `uci add_list network.@device[0].ports` 是否仍指向 `br-lan`。
4. **检查 IPv6 `odhcpd` 配置项名称**
   - 检查官方 `odhcpd` 是否调整了 `/etc/config/dhcp` 中的 `ra_slaac`、`ra_flags`、`dns_service`、`ra_dns` 选项名。
5. **检查磁盘分区结构（GPT 分区号）**
   - 确认官方 `x86_64` 与 `rockchip/armv8` 镜像依然使用第 1 分区 `/boot`、第 2 分区 `rootfs`，确保 [`files/etc/init.d/opt-mount`](files/etc/init.d/opt-mount) 创建第 3 分区（`${part_prefix}3`）不会与系统分区号冲突。

---

## 三、内置的自动化防呆拦截机制（无需人工盯守的部分）

为了防止上游变动导致“编译成功但刷入后出 Bug”，我们在构建链路中内置了两道强制拦截关卡（任一条件不满足即刻终止编译，绝不产出问题固件）：

1. **[`scripts/diy.sh`](scripts/diy.sh) 末尾的 8 项源码补丁断言（Step `[7/7]`）**：
   - 强制校验默认 IP `192.168.100.1`、默认终端 `/bin/bash`、`+luci-nginx` 替换、`dockerd` 无 `+iptables`、`sqm-scripts` 无 `+iptables`、`cpufreq` 支持 `x86_64`、Tailscale 包含 `--netfilter-mode=off`、OTA 脚本包含 `curl -L`。
2. **[`.github/workflows/build.yml`](.github/workflows/build.yml) 的 `Post-Defconfig` 配置表断言**：
   - 在 `make defconfig` 之后强制扫描 `.config`：
     - 若存在任何 `CONFIG_PACKAGE_iptables*=y` 或 `CONFIG_PACKAGE_ip6tables*=y` -> **立即报错终止**；
     - 若存在 `CONFIG_PACKAGE_uhttpd=y` -> **立即报错终止**；
     - 自动遍历 `configs/${model}.config` 与 `configs/common.config` 中的每一项 `CONFIG_PACKAGE_*=y`，若有任何一个软件包在 `make defconfig` 后被丢弃（保留率不足 100%）-> **立即报错终止并打印被丢弃的包名**。

---

## 四、本地 WSL2 30 秒快速预检命令（无需完整编译）

如果你在本地 WSL2 保留了 `/root/immortalwrt-build/openwrt` 目录，未来上游更新后只需运行以下几行命令（耗时约 30 秒），即可在不跑完整编译的情况下验证所有补丁和依赖是否 100% 正常：

```bash
cd /root/immortalwrt-build/openwrt
git checkout -- .
git -C feeds/packages checkout -- .
git -C feeds/luci checkout -- .

# 1. 运行 diy.sh（会自动执行 8 项源码补丁断言）
bash /mnt/c/Users/thepz/OneDrive/Documents/VScode/openwrt/scripts/diy.sh akapzg/selfopenwrt

# 2. 生成 .config 并检查是否存在 iptables 或 uhttpd
cat /mnt/c/Users/thepz/OneDrive/Documents/VScode/openwrt/configs/x86_64.config > .config
cat /mnt/c/Users/thepz/OneDrive/Documents/VScode/openwrt/configs/common.config >> .config
make defconfig
grep -E '^CONFIG_PACKAGE_(ip6?tables|uhttpd).*=y' .config || echo "预检通过：零 iptables、零 uhttpd！"
```

---

## 五、如何增减内置软件包与新增其他设备固件

### 1. 增加或删除内置软件包

#### 情况 A：ImmortalWrt 官方源已有的软件包（只需改 1 个文件）
- **所有设备共用**：打开 [`configs/common.config`](configs/common.config)，在末尾添加：
  ```ini
  CONFIG_PACKAGE_luci-app-xxx=y
  ```
- **仅单台设备专用**（例如某款网卡驱动）：添加到 [`configs/x86_64.config`](configs/x86_64.config) 或 [`configs/nanopi-r5s.config`](configs/nanopi-r5s.config) 末尾。
- **删除某个内置插件**：直接从 [`configs/common.config`](configs/common.config) 中删除对应的 `CONFIG_PACKAGE_...=y` 行即可。

#### 情况 B：第三方 GitHub 独立插件（官方源中没有的包，只需 2 步）
1. 将插件源码文件夹放入 [`packages/<插件名>`](packages) 目录下（[`scripts/diy.sh`](scripts/diy.sh) 在编译时会自动把 `packages/*` 全部复制到 `package/new/` 参与编译；如需后续支持一键同步，可在 [`.github/workflows/sync-packages.yml`](.github/workflows/sync-packages.yml) 中加一行 `sync_repo "https://github.com/作者/仓库.git" "分支" "<插件名>"`）。
2. 在 [`configs/common.config`](configs/common.config) 末尾添加：
   ```ini
   CONFIG_PACKAGE_luci-app-xxx=y
   ```

---

### 2. 新增其他设备的固件（只需 2 步，自动继承全部 28 款插件与系统优化）

由于本项目将 **硬件底层（`configs/<设备名>.config`）** 与 **公共插件层（[`configs/common.config`](configs/common.config)）** 完全解耦，新增一台设备（例如 `NanoPi R6S` 或其他 ARM/x86 路由）只需 2 步：

1. **新建 `configs/<设备名>.config`**（如 `configs/nanopi-r6s.config`）：
   参照 [`configs/nanopi-r5s.config`](configs/nanopi-r5s.config)，写入目标架构、设备型号与硬件专属驱动：
   ```ini
   CONFIG_TARGET_rockchip=y
   CONFIG_TARGET_rockchip_armv8=y
   CONFIG_TARGET_MULTI_PROFILE=y
   CONFIG_TARGET_DEVICE_rockchip_armv8_DEVICE_friendlyarm_nanopi-r6s=y

   CONFIG_TARGET_KERNEL_PARTSIZE=32
   CONFIG_TARGET_ROOTFS_PARTSIZE=2048
   CONFIG_TARGET_ROOTFS_SQUASHFS=y
   CONFIG_TARGET_ROOTFS_EXT4FS=y
   CONFIG_TARGET_IMAGES_GZIP=y

   CONFIG_PACKAGE_autocore=y
   CONFIG_PACKAGE_kmod-r8125=y
   ```
2. **在 [`.github/workflows/build.yml`](.github/workflows/build.yml) 中注册新设备**：
   - 在 `matrix.model` 列表下增加 `- nanopi-r6s`（编译时会自动将 `configs/nanopi-r6s.config` 与 [`configs/common.config`](configs/common.config) 合并，自动拥有全部 28 款插件、纯 `fw4` 防火墙、Nginx、`/opt` 自动挂载与 `192.168.100.1` 配置）；
   - 在 `Collect Firmware Artifacts & Generate OTA Metadata` 步骤中增加对应的固件收集与 `ota_<设备名>.json` 生成条目即可。
