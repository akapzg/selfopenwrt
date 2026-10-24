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
	return L.resolveDefault(callServiceList('homebox'), {}).then(function (res) {
		var isRunning = false;
		try {
			isRunning = res['homebox']['instances']['instance1']['running'];
		} catch (e) { }
		return isRunning;
	});
}

return view.extend({
	load: function () {
		return Promise.all([
			getServiceStatus(),
			uci.load('homebox')
		]);
	},

	render: function (data) {
		var isRunning = data[0];
		var port = uci.get('homebox', 'config', 'port') || '3300';
		var webUrl = 'http://' + window.location.hostname + ':' + port;

		var m, s, o;
		m = new form.Map('homebox', _('HomeBox'), _('HomeBox is an HTML5 local network speed test tool.'));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = function () {
			poll.add(function () {
				return L.resolveDefault(getServiceStatus()).then(function (res) {
					var viewEl = document.getElementById('homebox_status');
					if (viewEl) {
						viewEl.innerHTML = res
							? '<span style="color:green;font-weight:bold">HomeBox ' + _('RUNNING') + '</span> &nbsp; <a class="btn cbi-button-action" href="' + webUrl + '" target="_blank" rel="noreferrer">' + _('Open Web UI') + '</a>'
							: '<span style="color:red;font-weight:bold">HomeBox ' + _('NOT RUNNING') + '</span>';
					}
				});
			});
			return E('div', { class: 'cbi-section' }, [
				E('p', { id: 'homebox_status' },
					isRunning
						? [E('span', { style: 'color:green;font-weight:bold' }, 'HomeBox ' + _('RUNNING')), E('span', ' \u00a0 '), E('a', { class: 'btn cbi-button-action', href: webUrl, target: '_blank', rel: 'noreferrer' }, _('Open Web UI'))]
						: E('span', { style: 'color:red;font-weight:bold' }, 'HomeBox ' + _('NOT RUNNING'))
				)
			]);
		};

		s = m.section(form.NamedSection, 'config', 'homebox', _('Settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('Listen Port'));
		o.datatype = 'port';
		o.default = '3300';
		o.rmempty = false;

		return m.render();
	}
});
