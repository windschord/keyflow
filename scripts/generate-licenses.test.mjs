// TASK-076: scripts/generate-licenses.mjs のユニットテスト（DEC-008）
//
// 実際のnode_modulesに依存せず、mkdtempSyncで作成した一時フィクスチャ
// ディレクトリに対して走査ロジックを検証する（自前実装、外部ライブラリ不使用）。
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateLicensesFromPackageRoot } from './generate-licenses.mjs';

/**
 * フィクスチャ用の擬似パッケージルートを作成する。
 * @param {object} rootPkg - ルートpackage.jsonの内容（dependencies/devDependencies）
 * @param {Record<string, { pkg: object, licenseFile?: { name: string, content: string } }>} deps
 * @returns {string} 作成した一時ディレクトリのパス
 */
function createFixture(rootPkg, deps) {
  const root = mkdtempSync(join(tmpdir(), 'generate-licenses-test-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify(rootPkg), 'utf-8');

  for (const [name, { pkg, licenseFile }] of Object.entries(deps)) {
    const pkgDir = join(root, 'node_modules', name);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkg), 'utf-8');
    if (licenseFile) {
      writeFileSync(join(pkgDir, licenseFile.name), licenseFile.content, 'utf-8');
    }
  }

  return root;
}

describe('generate-licenses.mjs', () => {
  let fixtureRoot;

  afterEach(() => {
    if (fixtureRoot) {
      rmSync(fixtureRoot, { recursive: true, force: true });
      fixtureRoot = undefined;
    }
  });

  it('dependencies全件が出力に含まれ、devDependenciesは含まれない', () => {
    fixtureRoot = createFixture(
      {
        name: 'fixture-root',
        version: '1.0.0',
        dependencies: { 'pkg-a': '^1.0.0', 'pkg-c': '^2.0.0' },
        devDependencies: { 'pkg-b': '^1.0.0' },
      },
      {
        'pkg-a': { pkg: { name: 'pkg-a', version: '1.2.3', license: 'MIT' } },
        'pkg-b': { pkg: { name: 'pkg-b', version: '9.9.9', license: 'MIT' } },
        'pkg-c': { pkg: { name: 'pkg-c', version: '2.0.1', license: 'Apache-2.0' } },
      }
    );

    const licenses = generateLicensesFromPackageRoot(fixtureRoot);
    const names = licenses.map((l) => l.name);

    expect(names).toContain('pkg-a');
    expect(names).toContain('pkg-c');
    expect(names).not.toContain('pkg-b');
    expect(licenses).toHaveLength(2);
  });

  it('name/version/licenseが依存先package.jsonから取得できる', () => {
    fixtureRoot = createFixture(
      { name: 'fixture-root', version: '1.0.0', dependencies: { 'pkg-a': '^1.0.0' } },
      { 'pkg-a': { pkg: { name: 'pkg-a', version: '1.2.3', license: 'MIT' } } }
    );

    const [entry] = generateLicensesFromPackageRoot(fixtureRoot);

    expect(entry).toMatchObject({ name: 'pkg-a', version: '1.2.3', license: 'MIT' });
  });

  it('LICENSEファイルが存在する場合、licenseTextに本文が格納される', () => {
    const licenseBody = 'MIT License\n\nCopyright (c) 2026 Example\n';
    fixtureRoot = createFixture(
      { name: 'fixture-root', version: '1.0.0', dependencies: { 'pkg-a': '^1.0.0' } },
      {
        'pkg-a': {
          pkg: { name: 'pkg-a', version: '1.2.3', license: 'MIT' },
          licenseFile: { name: 'LICENSE', content: licenseBody },
        },
      }
    );

    const [entry] = generateLicensesFromPackageRoot(fixtureRoot);

    expect(entry.licenseText).toBe(licenseBody);
  });

  it('LICENSEファイルが存在しない場合、licenseTextはSPDX表記にフォールバックする', () => {
    fixtureRoot = createFixture(
      { name: 'fixture-root', version: '1.0.0', dependencies: { 'pkg-a': '^1.0.0' } },
      { 'pkg-a': { pkg: { name: 'pkg-a', version: '1.2.3', license: 'MIT' } } }
    );

    const [entry] = generateLicensesFromPackageRoot(fixtureRoot);

    expect(entry.licenseText).toBe('MIT');
  });

  it('license.type形式（旧式オブジェクト表記）からもライセンス名を取得できる', () => {
    fixtureRoot = createFixture(
      { name: 'fixture-root', version: '1.0.0', dependencies: { 'pkg-a': '^1.0.0' } },
      {
        'pkg-a': {
          pkg: { name: 'pkg-a', version: '1.2.3', license: { type: 'BSD-3-Clause' } },
        },
      }
    );

    const [entry] = generateLicensesFromPackageRoot(fixtureRoot);

    expect(entry.license).toBe('BSD-3-Clause');
  });

  it('dependenciesが存在しない場合は空配列を返す', () => {
    fixtureRoot = createFixture({ name: 'fixture-root', version: '1.0.0' }, {});

    expect(generateLicensesFromPackageRoot(fixtureRoot)).toEqual([]);
  });
});
