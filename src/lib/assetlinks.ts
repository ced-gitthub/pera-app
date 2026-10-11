// Builds the Digital Asset Links document. Returns an empty list until a package name and at least one valid fingerprint are configured.
const FP = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const PKG = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export function buildAssetLinks(pkg: string | undefined, fingerprints: string | undefined) {
  const name = (pkg ?? '').trim();
  const prints = (fingerprints ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => FP.test(s));
  if (!PKG.test(name) || !prints.length) return [];
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: name, sha256_cert_fingerprints: prints },
    },
  ];
}
