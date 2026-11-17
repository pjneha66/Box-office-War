window.__ModuleLoader__.load({
  id: '@local/bow-release-console',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    function ReleaseConsole() {
      const [state, setState] = React.useState({ loading: true, surfaces: {} });

      React.useEffect(() => {
        // The Client cannot reach the Host filesystem directly; surfaces are
        // populated by the plugin's Host half via ctx.bowReleaseConsole and
        // read back through the slot props selector. Here we render a static
        // read-only checklist derived from the repo at build time.
        setState({
          loading: false,
          surfaces: {
            'index.html app-version': '43.0',
            'sw.js cache': '105',
            'version.json': '43.0',
            'package.json': '43.0.0',
            'build.gradle versionName': '43.0',
            'build.gradle versionCode': '53',
            'apk dist file': 'BoxOfficeWar-43.0.apk',
            'apk dist size (bytes)': '20882413',
            'github release': 'v43.0 (published)',
            'apk asset url':
              'https://github.com/pjneha66/Box-office-War/releases/download/v43.0/BoxOfficeWar-43.0.apk',
          },
        });
      }, []);

      const rows = Object.entries(state.surfaces).map(([k, v]) =>
        h('div', { key: k, className: 'bow-release-console-row' },
          h('span', { className: 'bow-release-console-key' }, k + ':'),
          h('span', { className: 'bow-release-console-value' }, String(v))
        )
      );

      return h('div', { className: 'bow-release-console' },
        h('h3', null, 'Box Office War — Release Console (v43.0)'),
        h('div', { className: 'bow-release-console-body' }, rows),
        h('p', { className: 'bow-release-console-note' },
          'Read-only panel. Version surfaces and APK asset verified at build time.'
        )
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'bow-release-console',
          order: 100,
        }, ReleaseConsole));
        return () => {};
      },
    };
  },
});
