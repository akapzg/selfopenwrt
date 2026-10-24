include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-usb-writer
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

LUCI_TITLE:=LuCI support for USB Disk Image Writer
LUCI_DESCRIPTION:=Web-based USB flash drive image writer (like balenaEtcher) with system disk lock protection.
LUCI_DEPENDS:=+luci-base +rpcd +lsblk +blkid +gzip +xz-utils
LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/postinst
#!/bin/sh
if [ -n "$${IPKG_INSTROOT}" ]; then
	chmod 0755 "$${IPKG_INSTROOT}/usr/libexec/usb-writer" 2>/dev/null || true
else
	chmod 0755 /usr/libexec/usb-writer 2>/dev/null || true
	rm -f /tmp/luci-indexcache 2>/dev/null || true
	rm -rf /tmp/luci-modulecache 2>/dev/null || true
fi
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
