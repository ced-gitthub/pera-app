// Bundles the real QuickAdd component with mocked server actions for tests/browser/quickadd.py
const esbuild = require('esbuild'), path = require('path'), root = path.resolve(__dirname, '../..');
esbuild.build({ entryPoints: [path.join(__dirname, 'entry.tsx')], bundle: true, outfile: path.join(__dirname, 'bundle.js'), jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error', nodePaths: (process.env.NODE_PATH || '').split(':').filter(Boolean),
  alias: { '@/app/actions': path.join(__dirname, 'actions.mock.ts'), 'next/navigation': path.join(__dirname, 'nav.mock.ts'), '@/core': path.join(root, 'src/core'), '@/components': path.join(root, 'src/components') } }).then(() => console.log('bundle ok')).catch(() => process.exit(1));
