# SPDX-License-Identifier: GPL-3.0-only

include $(TOPDIR)/rules.mk

PKG_ARCH_FASTNET:=$(ARCH)

PKG_NAME:=fastnet
PKG_VERSION:=0.7.7
PKG_RELEASE:=6

PKG_SOURCE:=$(PKG_NAME)-binary-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://github.com/istoreos/istoreos-app-hub/releases/download/fastnet-runtime-v$(PKG_VERSION)/
PKG_HASH:=724d63916f04063ca62b5f6420aa0c673bc1166f493e45fe00e431edb8dcc300

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-binary-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/fastnet
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  TITLE:=FastNet - Network Speed Test & Diagnostics Web UI
  DEPENDS:=@(arm||x86_64||aarch64)
endef

define Package/fastnet/description
  FastNet provides network speed testing, NAT/IPv6 diagnostics, and a Web UI.
endef

define Package/fastnet/conffiles
/etc/config/fastnet
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/fastnet/install
	$(INSTALL_DIR) $(1)/usr/sbin $(1)/etc/config $(1)/etc/init.d
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/FastNet.$(PKG_ARCH_FASTNET) $(1)/usr/sbin/FastNet
	$(INSTALL_CONF) ./files/fastnet.config $(1)/etc/config/fastnet
	$(INSTALL_BIN) ./files/fastnet.init $(1)/etc/init.d/fastnet
endef

$(eval $(call BuildPackage,fastnet))
