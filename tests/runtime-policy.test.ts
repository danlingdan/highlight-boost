import { expect, it } from 'vitest';
import manifest from '../manifest.json';
import versions from '../versions.json';
import runtime from './runtime.json';
import packageJson from '../package.json';

it('发布版本要求与当前验收运行包一致', () => {
  expect(manifest.minAppVersion).toBe(runtime.appVersion);
  expect(versions[manifest.version as keyof typeof versions]).toBe(runtime.appVersion);
  expect(runtime.appVersion).toMatch(/^\d+\.\d+\.\d+$/);
});
it('Electron 测试依赖与官方安装器运行时基线一致', () => {
  expect(packageJson.devDependencies.electron).toBe(runtime.electronVersion);
});
it('运行包来自官方固定版本资产并带完整摘要', () => {
  const url = new URL(runtime.assetUrl);
  expect(url.origin).toBe('https://github.com');
  expect(url.pathname).toBe(`/obsidianmd/obsidian-releases/releases/download/v${runtime.appVersion}/obsidian-${runtime.appVersion}.asar.gz`);
  expect(runtime.sha256).toMatch(/^[0-9a-f]{64}$/);
});
