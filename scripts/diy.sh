#!/bin/bash
# ==============================================================================
# ImmortalWrt 25.12 Pre-Build Customization Script (scripts/diy.sh)
# Usage: bash scripts/diy.sh <repo_owner/repo_name>
# ==============================================================================
set -e

REPO_SLUG="${1:-akapzg/selfopenwrt}"
WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo ">>> [1/6] Configuring Default LAN IP (192.168.100.1) & Shell (bash)..."
sed -i 's/192.168.1.1/192.168.100.1/g' package/base-files/files/bin/config_generate
sed -i 's#/bin/ash#/bin/bash#g' package/base-files/files/etc/passwd

echo ">>> [2/6] Replacing uhttpd with Nginx & Tuning ubus/uwsgi Timeouts..."
sed -i 's/+uhttpd /+luci-nginx /g' feeds/luci/collections/luci/Makefile
sed -i 's/+uhttpd-mod-ubus //' feeds/luci/collections/luci/Makefile
sed -i 's/+uhttpd /+luci-nginx /g' feeds/luci/collections/luci-light/Makefile
sed -i 's/+luci /+luci-nginx /g' feeds/luci/collections/luci-ssl-openssl/Makefile
sed -i 's/+luci /+luci-nginx /g' feeds/luci/collections/luci-ssl/Makefile
sed -i '/uhttpd-mod-ubus/d' feeds/luci/collections/luci-light/Makefile

if [ -f feeds/packages/net/nginx/files-luci-support/60_nginx-luci-support ]; then
    sed -i 's/ubus_parallel_req 2/ubus_parallel_req 6/g' feeds/packages/net/nginx/files-luci-support/60_nginx-luci-support
    sed -i '/ubus_parallel_req/a\        ubus_script_timeout 300;' feeds/packages/net/nginx/files-luci-support/60_nginx-luci-support
fi
if [ -f feeds/packages/net/uwsgi/files-luci-support/luci-webui.ini ]; then
    sed -i '$a cgi-timeout = 600' feeds/packages/net/uwsgi/files-luci-support/luci-*.ini
    sed -i '/limit-as/c\limit-as = 5000' feeds/packages/net/uwsgi/files-luci-support/luci-webui.ini
    sed -i 's/threads = 1/threads = 2/g; s/processes = 3/processes = 4/g' feeds/packages/net/uwsgi/files-luci-support/luci-webui.ini
fi
if [ -f package/system/rpcd/files/rpcd.config ]; then
    sed -i 's/option timeout 30/option timeout 60/g' package/system/rpcd/files/rpcd.config
fi

echo ">>> [3/6] Decoupling ImmortalWrt Official Docker from iptables (100% fw4 Pure)..."
if [ -f feeds/packages/utils/dockerd/Makefile ]; then
    # Remove iptables/ip6tables dependencies from official ImmortalWrt dockerd package
    sed -i '/+iptables/d; /+IPV6:ip6tables/d; /+IPV6:kmod-ipt-/d; /+kmod-ipt-/d' feeds/packages/utils/dockerd/Makefile
fi
if [ -f feeds/packages/utils/dockerd/files/etc/config/dockerd ]; then
    sed -i "s/option iptables '1'/option iptables '0'/g" feeds/packages/utils/dockerd/files/etc/config/dockerd
    grep -q "option iptables" feeds/packages/utils/dockerd/files/etc/config/dockerd || \
        sed -i "/option data_root/a\\\toption iptables '0'" feeds/packages/utils/dockerd/files/etc/config/dockerd
fi

echo ">>> [4/6] Enforcing Tailscale --netfilter-mode=off (100% fw4 Managed)..."
if [ -f feeds/packages/net/tailscale/files/tailscale.init ]; then
    sed -i 's/procd_set_param command $PROG/procd_set_param command $PROG --netfilter-mode=off/g' feeds/packages/net/tailscale/files/tailscale.init
    sed -i 's|/usr/sbin/tailscaled|/usr/sbin/tailscaled --netfilter-mode=off|g' feeds/packages/net/tailscale/files/tailscale.init
fi

echo ">>> [5/6] Integrating External Plugins (Upstream Latest + Local Fallback)..."
mkdir -p package/new

# Helper: Try cloning upstream latest; fall back to local packages/ directory if upstream is deleted/unreachable
clone_or_fallback() {
    local repo_url="$1"
    local branch="$2"
    local target_dir="$3"
    local fallback_path="$4"

    rm -rf "$target_dir"
    if [ -n "$branch" ]; then
        git clone --depth=1 -b "$branch" "$repo_url" "$target_dir" 2>/dev/null && return 0
    else
        git clone --depth=1 "$repo_url" "$target_dir" 2>/dev/null && return 0
    fi

    if [ -n "$fallback_path" ] && [ -d "$fallback_path" ]; then
        echo "  [Fallback] Upstream $repo_url unreachable, using local backup: $fallback_path"
        cp -rf "$fallback_path" "$target_dir"
    else
        echo "  [Warning] Failed to clone $repo_url and no local fallback found."
    fi
}

# 5.1 Local embedded packages (OTA, Speedtest, Socat, Tailscale LuCI) - synced from upstream with local fallback
cp -rf "$WORKSPACE_DIR/packages/"* package/new/
clone_or_fallback "https://github.com/asvow/luci-app-tailscale.git" "" "package/new/luci-app-tailscale" "$WORKSPACE_DIR/packages/luci-app-tailscale"

if git clone --depth=1 --filter=blob:none --sparse "https://github.com/sbwml/openwrt_pkgs.git" /tmp/openwrt_pkgs 2>/dev/null; then
    pushd /tmp/openwrt_pkgs >/dev/null
    git sparse-checkout set luci-app-ota otahelper luci-app-netspeedtest speedtest-cli luci-app-socat
    cp -rf luci-app-ota otahelper luci-app-netspeedtest speedtest-cli luci-app-socat "$OLDPWD/package/new/"
    popd >/dev/null
    rm -rf /tmp/openwrt_pkgs
fi

# 5.2 QuickFile File Manager
rm -rf feeds/luci/applications/luci-app-filemanager
clone_or_fallback "https://github.com/sbwml/luci-app-quickfile.git" "" "package/new/quickfile" ""

# 5.3 MosDNS v5 (Replace CLI-only feed package with full LuCI + v5 bundle)
rm -rf feeds/packages/net/{mosdns,v2ray-geodata} feeds/luci/applications/luci-app-mosdns
clone_or_fallback "https://github.com/sbwml/luci-app-mosdns.git" "v5" "package/new/mosdns" ""
clone_or_fallback "https://github.com/sbwml/v2ray-geodata.git" "" "package/new/v2ray-geodata" ""

# 5.4 Nikki (Mihomo / Clash Meta)
clone_or_fallback "https://github.com/nikkinikki-org/OpenWrt-nikki.git" "" "package/new/nikki" ""

# 5.5 Samba4 Multi-Channel & Root Access Tuning
if [ -f feeds/packages/net/samba4/files/smb.conf.template ]; then
    sed -i 's/invalid users = root/#invalid users = root/g' feeds/packages/net/samba4/files/smb.conf.template
    sed -i 's/bind interfaces only = yes/bind interfaces only = no/g' feeds/packages/net/samba4/files/smb.conf.template
    sed -i '/workgroup/a \\n\tserver multi channel support = yes' feeds/packages/net/samba4/files/smb.conf.template
fi

echo ">>> [6/6] Injecting Custom Files (uci-defaults, emmc-install, OTA URL)..."
cp -rf "$WORKSPACE_DIR/files" ./
chmod 0755 files/etc/uci-defaults/* files/sbin/* 2>/dev/null || true

# Configure OTA check URL pointing to user's own GitHub Release ota.json
OTA_JSON_URL="https://gh-proxy.com/https://github.com/${REPO_SLUG}/releases/latest/download/ota.json"
cat >> files/etc/uci-defaults/99-custom-settings <<EOF

# ------------------------------------------------------------------------------
# 9. 自动绑定 GitHub Releases 在线 OTA 升级源
# ------------------------------------------------------------------------------
if [ -f /etc/config/ota ]; then
    uci set ota.config.api_url='${OTA_JSON_URL}'
    uci commit ota
fi
EOF
# Ensure exit 0 is at the very end of 99-custom-settings
sed -i '/^exit 0$/d' files/etc/uci-defaults/99-custom-settings
echo "exit 0" >> files/etc/uci-defaults/99-custom-settings

echo ">>> DIY Customization Completed Successfully!"
