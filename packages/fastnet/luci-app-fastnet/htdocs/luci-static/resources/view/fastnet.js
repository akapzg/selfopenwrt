'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require poll';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('fastnet'), {}).then(function (res) {
		var isRunning = false;
		try {
			isRunning = res['fastnet']['instances']['instance1']['running'];
		} catch (e) { }
		return isRunning;
	});
}

return view.extend({
	load: function () {
		return Promise.all([
			getServiceStatus(),
			uci.load('fastnet')
		]);
	},

	render: function (data) {
		var isRunning = data[0];
		var sections = uci.sections('fastnet', 'fastnet');
		var port = (sections.length > 0 && sections[0].port) ? sections[0].port : '3200';
		var webUrl = 'http://' + window.location.hostname + ':' + port + '/webui/';

		var m, s, o;
		m = new form.Map('fastnet', _('FastNet'), _('FastNet provides network speed testing, NAT/IPv6 diagnostics, and a Web UI.'));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = function () {
			poll.add(function () {
				return L.resolveDefault(getServiceStatus()).then(function (res) {
					var viewEl = document.getElementById('fastnet_status');
					if (viewEl) {
						viewEl.innerHTML = res
							? '<span style="color:green;font-weight:bold">FastNet ' + _('RUNNING') + '</span> &nbsp; <a class="btn cbi-button-action" href="' + webUrl + '" target="_blank" rel="noreferrer">' + _('Open Web UI') + '</a>'
							: '<span style="color:red;font-weight:bold">FastNet ' + _('NOT RUNNING') + '</span>';
					}
				});
			});
			return E('div', { class: 'cbi-section' }, [
				E('p', { id: 'fastnet_status' },
					isRunning
						? [E('span', { style: 'color:green;font-weight:bold' }, 'FastNet ' + _('RUNNING')), E('span', ' \u00a0 '), E('a', { class: 'btn cbi-button-action', href: webUrl, target: '_blank', rel: 'noreferrer' }, _('Open Web UI'))]
						: E('span', { style: 'color:red;font-weight:bold' }, 'FastNet ' + _('NOT RUNNING'))
				)
			]);
		};

		s = m.section(form.TypedSection, 'fastnet', _('Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('Listen Port'));
		o.datatype = 'port';
		o.default = '3200';
		o.rmempty = false;

		o = s.option(form.Value, 'token', _('API Token'));
		o.password = true;
		o.rmempty = true;

		o = s.option(form.Flag, 'logger', _('Enable Logging'));
		o.default = '0';
		o.rmempty = false;

		return m.render();
	}
});
