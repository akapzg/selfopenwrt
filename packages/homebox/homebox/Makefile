# SPDX-License-Identifier: GPL-3.0-only

include $(TOPDIR)/rules.mk

PKG_NAME:=homebox
PKG_VERSION:=0.1.3
PKG_RELEASE:=1

ifeq ($(ARCH),x86_64)
	HB_ARCH:=amd64-musl
	PKG_HASH:=4e2d7c3961da60f1b48822ba7a817aa139975c171663ab98c106822ba93b9030
else ifeq ($(ARCH),aarch64)
	HB_ARCH:=arm64-musl
	PKG_HASH:=793c5c273e09155b7ac35c23dd0638afefa5f9d453b6350b8bd8e0ca0d87c9e9
endif

PKG_SOURCE:=homebox-linux-$(HB_ARCH).tar.gz
PKG_SOURCE_URL:=https://github.com/XGHeaven/homebox/releases/download/v$(PKG_VERSION)/
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/homebox
  SECTION:=net
  CATEGORY:=Network
  TITLE:=HomeBox HTML5 Local Network Speed Test
  URL:=https://github.com/XGHeaven/homebox
  DEPENDS:=@(x86_64||aarch64)
endef

define Package/homebox/description
  A self-hosted HTML5 local network speed test tool.
endef

define Package/homebox/conffiles
/etc/config/homebox
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	tar -xzf $(DL_DIR)/$(PKG_SOURCE) -C $(PKG_BUILD_DIR)
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/homebox/install
	$(INSTALL_DIR) $(1)/usr/bin $(1)/etc/config $(1)/etc/init.d
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/homebox-linux-$(HB_ARCH) $(1)/usr/bin/homebox
	$(INSTALL_CONF) ./files/homebox.config $(1)/etc/config/homebox
	$(INSTALL_BIN) ./files/homebox.init $(1)/etc/init.d/homebox
endef

$(eval $(call BuildPackage,homebox))
