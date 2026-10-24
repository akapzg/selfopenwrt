'use strict';
'require view';
'require ui';
'require fs';
'require poll';

function callBackend(args) {
	return fs.exec('/usr/libexec/usb-writer', args || []).then(function(res) {
		try {
			return JSON.parse((res && res.stdout) ? res.stdout.trim() : '{}');
		} catch (e) {
			return { ok: false, error: (res && res.stderr) ? res.stderr.trim() : '解析后端返回数据失败' };
		}
	});
}

return view.extend({
	selectedImage: '',
	selectedDisk: '',

	load: function() {
		return callBackend(['status']);
	},

	updateUI: function(data, nodes) {
		if (!data || !data.ok)
			return;

		var images = data.images || [];
		var disks = data.disks || [];
		var job = data.job || {};
		var running = !!job.running;

		nodes.protectedBadge.textContent = data.protected_disks
			? '已自动锁定并屏蔽系统启动盘: /dev/' + data.protected_disks.trim().split(/\s+/).join(', /dev/')
			: '已启用系统启动盘防误刷锁定保护';

		// Update Image Select
		var currentImg = this.selectedImage || nodes.imgSelect.value;
		nodes.imgSelect.innerHTML = '';
		if (images.length === 0) {
			nodes.imgSelect.appendChild(E('option', { value: '' }, '-- 暂无镜像文件（请点击右侧“上传镜像”或将文件放入 /opt/downloads） --'));
			this.selectedImage = '';
		} else {
			var foundImg = false;
			images.forEach(function(img) {
				var opt = E('option', { value: img.path }, img.name + ' (' + img.size_human + ') — ' + img.path);
				if (img.path === currentImg) {
					opt.selected = true;
					foundImg = true;
				}
				nodes.imgSelect.appendChild(opt);
			});
			this.selectedImage = foundImg ? currentImg : images[0].path;
			nodes.imgSelect.value = this.selectedImage;
		}

		// Update Disk Select
		var currentDisk = this.selectedDisk || nodes.diskSelect.value;
		nodes.diskSelect.innerHTML = '';
		if (disks.length === 0) {
			nodes.diskSelect.appendChild(E('option', { value: '' }, '-- 未检测到外接 U 盘 / 移动磁盘（请插入 U 盘后点击“刷新设备”） --'));
			this.selectedDisk = '';
		} else {
			var foundDisk = false;
			disks.forEach(function(d) {
				var mountNote = d.mounts ? ' [已挂载: ' + d.mounts + '，烧录前将自动卸载]' : '';
				var opt = E('option', { value: d.path }, d.path + ' — ' + d.model + ' [' + d.size_human + ']' + mountNote);
				if (d.path === currentDisk) {
					opt.selected = true;
					foundDisk = true;
				}
				nodes.diskSelect.appendChild(opt);
			});
			this.selectedDisk = foundDisk ? currentDisk : disks[0].path;
			nodes.diskSelect.value = this.selectedDisk;
		}

		nodes.imgSelect.disabled = running;
		nodes.diskSelect.disabled = running;
		nodes.uploadBtn.disabled = running;
		nodes.deleteImgBtn.disabled = running || !this.selectedImage;
		nodes.refreshBtn.disabled = running;
		nodes.flashBtn.disabled = running || !this.selectedImage || !this.selectedDisk;
		nodes.stopBtn.style.display = running ? '' : 'none';

		// Update Job Progress Panel
		if (job.phase === 'idle' && !job.error) {
			nodes.progressWrap.style.display = 'none';
		} else {
			nodes.progressWrap.style.display = '';
			var pct = job.percent || 0;
			nodes.progressBar.style.width = pct + '%';

			if (job.phase === 'writing') {
				nodes.progressBar.style.background = '#2563eb';
				nodes.statusTitle.textContent = '正在烧录镜像到 ' + (job.disk || '') + ' (' + pct + '%)';
				nodes.statusDetail.textContent = '已写入: ' + (job.written_human || '0 B') +
					(job.speed_human ? ' | 平均速度: ' + job.speed_human : '') +
					' | 已用时: ' + (job.elapsed || 0) + ' 秒';
			} else if (job.phase === 'syncing') {
				nodes.progressBar.style.background = '#d97706';
				nodes.statusTitle.textContent = '正在刷新缓存落盘 (sync)，请勿拔出 U 盘... (99%)';
				nodes.statusDetail.textContent = '已写入: ' + (job.written_human || '') + ' | 已用时: ' + (job.elapsed || 0) + ' 秒';
			} else if (job.phase === 'done') {
				nodes.progressBar.style.background = '#16a34a';
				nodes.statusTitle.textContent = '✅ 烧录完成！现在可以安全拔出 U 盘 (' + (job.disk || '') + ')';
				nodes.statusDetail.textContent = '总写入数据: ' + (job.written_human || '') + ' | 总耗时: ' + (job.elapsed || 0) + ' 秒';
			} else if (job.phase === 'error') {
				nodes.progressBar.style.background = '#dc2626';
				nodes.statusTitle.textContent = '❌ 烧录中止或出错';
				nodes.statusDetail.textContent = job.error || '未知错误';
			}
		}
	},

	render: function(initialData) {
		var self = this;
		var nodes = {};

		nodes.protectedBadge = E('span', {
			'style': 'display:inline-block;padding:4px 10px;border-radius:4px;background:#dcfce7;color:#166534;font-weight:600;font-size:12px;'
		}, '正在检测系统盘保护状态...');

		nodes.imgSelect = E('select', {
			'class': 'cbi-input-select',
			'style': 'min-width:340px;max-width:100%;',
			'change': function(ev) {
				self.selectedImage = ev.target.value;
			}
		});

		nodes.uploadBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': function() {
				var tmpPath = '/opt/downloads/.usb-writer-upload.tmp';
				ui.uploadFile(tmpPath).then(function(btn, res) {
					var origName = (res && res.name) ? res.name : 'uploaded.img.gz';
					return callBackend(['finalize_upload', tmpPath, origName]);
				}).then(function(r) {
					if (r && r.ok) {
						self.selectedImage = r.path;
						ui.addNotification(null, E('p', '镜像上传成功：' + r.name), 'info');
					} else if (r && r.error) {
						ui.addNotification(null, E('p', '保存上传文件失败：' + r.error), 'danger');
					}
					return callBackend(['status']);
				}).then(function(st) {
					self.updateUI(st, nodes);
				}).catch(function(err) {
					if (err && err.message !== 'Upload has been cancelled')
						ui.addNotification(null, E('p', '上传未完成：' + (err.message || err)), 'warning');
				});
			}
		}, '上传镜像文件');

		nodes.deleteImgBtn = E('button', {
			'class': 'btn cbi-button cbi-button-remove',
			'click': function() {
				var img = nodes.imgSelect.value;
				if (!img)
					return;
				if (!window.confirm('确定要删除镜像文件 ' + img + ' 吗？'))
					return;
				callBackend(['delete_image', img]).then(function() {
					self.selectedImage = '';
					return callBackend(['status']);
				}).then(function(st) {
					self.updateUI(st, nodes);
				});
			}
		}, '删除选中镜像');

		nodes.diskSelect = E('select', {
			'class': 'cbi-input-select',
			'style': 'min-width:340px;max-width:100%;',
			'change': function(ev) {
				self.selectedDisk = ev.target.value;
			}
		});

		nodes.refreshBtn = E('button', {
			'class': 'btn cbi-button cbi-button-neutral',
			'click': function() {
				callBackend(['status']).then(function(st) {
					self.updateUI(st, nodes);
				});
			}
		}, '刷新设备与文件列表');

		nodes.flashBtn = E('button', {
			'class': 'btn cbi-button cbi-button-save',
			'style': 'font-weight:600;padding:6px 20px;',
			'click': function() {
				var img = nodes.imgSelect.value;
				var disk = nodes.diskSelect.value;
				if (!img || !disk)
					return;
				var diskLabel = nodes.diskSelect.options[nodes.diskSelect.selectedIndex].text;

				ui.showModal('确认烧录镜像到 U 盘', [
					E('p', { 'style': 'color:#dc2626;font-weight:600;' }, '⚠️ 警告：目标 U 盘上的所有现有分区和数据都将被彻底覆盖且不可恢复！'),
					E('ul', { 'style': 'line-height:1.8;' }, [
						E('li', {}, [ E('strong', {}, '源镜像文件：'), E('code', {}, img) ]),
						E('li', {}, [ E('strong', {}, '目标 U 盘设备：'), E('code', {}, diskLabel) ])
					]),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn cbi-button-neutral',
							'click': ui.hideModal
						}, '取消'),
						' ',
						E('button', {
							'class': 'btn cbi-button-negative',
							'click': function() {
								ui.hideModal();
								callBackend(['start', img, disk]).then(function(r) {
									if (!r || !r.ok) {
										ui.addNotification(null, E('p', '启动烧录失败：' + (r && r.error ? r.error : '未知错误')), 'danger');
									}
									return callBackend(['status']);
								}).then(function(st) {
									self.updateUI(st, nodes);
								});
							}
						}, '确认覆盖并开始烧录')
					])
				]);
			}
		}, '开始烧录 (Flash)');

		nodes.stopBtn = E('button', {
			'class': 'btn cbi-button cbi-button-negative',
			'style': 'display:none;margin-left:10px;',
			'click': function() {
				if (!window.confirm('确定要强制中止当前正在进行的烧录任务吗？'))
					return;
				callBackend(['stop']).then(function() {
					return callBackend(['status']);
				}).then(function(st) {
					self.updateUI(st, nodes);
				});
			}
		}, '中止烧录');

		nodes.statusTitle = E('div', { 'style': 'font-weight:600;margin-bottom:6px;font-size:14px;' }, '');
		nodes.statusDetail = E('div', { 'style': 'font-size:12px;color:#4b5563;margin-top:6px;' }, '');
		nodes.progressBar = E('div', {
			'style': 'height:18px;width:0%;background:#2563eb;border-radius:6px;transition:width 0.3s ease;'
		});
		nodes.progressWrap = E('div', {
			'class': 'cbi-section',
			'style': 'display:none;padding:16px;margin-top:16px;border-left:4px solid #2563eb;'
		}, [
			nodes.statusTitle,
			E('div', { 'style': 'width:100%;height:18px;background:#e5e7eb;border-radius:6px;overflow:hidden;' }, [
				nodes.progressBar
			]),
			nodes.statusDetail
		]);

		var viewNode = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, 'U盘镜像烧录 (USB Image Writer)'),
			E('div', { 'class': 'cbi-map-descr' }, [
				'将固件或系统镜像（支持 ',
				E('code', {}, '.img'), ' / ', E('code', {}, '.img.gz'), ' / ', E('code', {}, '.img.xz'), ' / ', E('code', {}, '.iso'),
				'）直接烧录至路由器外接的 U 盘或读卡器 TF 卡中（类似电脑端 balenaEtcher）。',
				E('div', { 'style': 'margin-top:8px;' }, [ nodes.protectedBadge ])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, '第一步：选择或上传镜像文件'),
				E('div', { 'class': 'cbi-section-node', 'style': 'padding:12px 16px;' }, [
					E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;' }, [
						nodes.imgSelect,
						nodes.uploadBtn,
						nodes.deleteImgBtn
					]),
					E('div', { 'style': 'font-size:12px;color:#6b7280;margin-top:6px;' },
						'提示：自动扫描 /opt/downloads 目录下的镜像文件，也可以直接点击“上传镜像文件”从电脑上传。')
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, '第二步：选择目标 U 盘 / 读卡器'),
				E('div', { 'class': 'cbi-section-node', 'style': 'padding:12px 16px;' }, [
					E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:10px;align-items:center;' }, [
						nodes.diskSelect,
						nodes.refreshBtn
					]),
					E('div', { 'style': 'font-size:12px;color:#6b7280;margin-top:6px;' },
						'提示：系统启动盘已被硬件级锁定隐藏，下拉列表仅显示可安全刷写的外接磁盘。')
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, '第三步：执行烧录'),
				E('div', { 'class': 'cbi-section-node', 'style': 'padding:12px 16px;' }, [
					nodes.flashBtn,
					nodes.stopBtn
				])
			]),

			nodes.progressWrap
		]);

		this.updateUI(initialData, nodes);

		poll.add(function() {
			return callBackend(['status']).then(function(st) {
				self.updateUI(st, nodes);
			});
		}, 2);

		return viewNode;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
