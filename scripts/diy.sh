#!/bin/bash
# ==============================================================================
# ImmortalWrt 25.12 Pre-Build Customization Script (scripts/diy.sh)
# Principles:
#   1. Reuse official ImmortalWrt feeds whenever available.
#   2. Patch official packages in-place for custom behavior (Docker/Tailscale/Nginx).
#   3. Copy third-party plugins directly from local repository `packages/` directory
#      (maintained automatically by `.github/workflows/sync-packages.yml`).
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

echo ">>> [3/6] Modifying Official ImmortalWrt Docker (Remove iptables, 100% fw4 Pure)..."
if [ -f feeds/packages/utils/dockerd/Makefile ]; then
    sed -i '/+iptables/d; /+IPV6:ip6tables/d; /+IPV6:kmod-ipt-/d; /+kmod-ipt-/d' feeds/packages/utils/dockerd/Makefile
fi
if [ -f feeds/packages/utils/dockerd/files/etc/config/dockerd ]; then
    sed -i "s/option iptables '1'/option iptables '0'/g" feeds/packages/utils/dockerd/files/etc/config/dockerd
    grep -q "option iptables" feeds/packages/utils/dockerd/files/etc/config/dockerd || \
        sed -i "/option data_root/a\\\toption iptables '0'" feeds/packages/utils/dockerd/files/etc/config/dockerd
fi

echo ">>> [4/6] Modifying Official ImmortalWrt Tailscale (--netfilter-mode=off) & Samba4..."
if [ -f feeds/packages/net/tailscale/files/tailscale.init ]; then
    sed -i 's/procd_set_param command $PROG/procd_set_param command $PROG --netfilter-mode=off/g' feeds/packages/net/tailscale/files/tailscale.init
    sed -i 's|/usr/sbin/tailscaled|/usr/sbin/tailscaled --netfilter-mode=off|g' feeds/packages/net/tailscale/files/tailscale.init
fi
if [ -f feeds/packages/net/samba4/files/smb.conf.template ]; then
    sed -i 's/invalid users = root/#invalid users = root/g' feeds/packages/net/samba4/files/smb.conf.template
    sed -i 's/bind interfaces only = yes/bind interfaces only = no/g' feeds/packages/net/samba4/files/smb.conf.template
    sed -i '/workgroup/a \\n\tserver multi channel support = yes' feeds/packages/net/samba4/files/smb.conf.template
fi

echo ">>> [5/6] Loading Third-Party Plugins from Local Repository (packages/)..."
# Remove conflicting CLI-only / legacy packages in official feeds before copying local packages/
rm -rf feeds/luci/applications/luci-app-filemanager
rm -rf feeds/packages/net/{mosdns,v2ray-geodata} feeds/luci/applications/luci-app-mosdns

mkdir -p package/new
cp -rf "$WORKSPACE_DIR/packages/"* package/new/

echo ">>> [6/6] Injecting Custom Files (uci-defaults, emmc-install, OTA URL)..."
cp -rf "$WORKSPACE_DIR/files" ./
chmod 0755 files/etc/uci-defaults/* files/sbin/* 2>/dev/null || true

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
sed -i '/^exit 0$/d' files/etc/uci-defaults/99-custom-settings
echo "exit 0" >> files/etc/uci-defaults/99-custom-settings

echo ">>> DIY Customization Completed Successfully!"
