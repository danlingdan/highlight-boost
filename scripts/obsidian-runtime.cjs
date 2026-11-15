const fs = require('node:fs');
const path = require('node:path');
module.exports = function obsidianRuntime(root) {
  const configuration = JSON.parse(fs.readFileSync(path.join(root, 'tests/runtime.json'), 'utf8'));
  const resources = process.env.OBSIDIAN_RESOURCES ? path.resolve(process.env.OBSIDIAN_RESOURCES) : path.join(root, '.research-cache', `obsidian-${configuration.appVersion}`, 'resources');
  const source = path.join(resources, 'obsidian.asar');
  if (!fs.existsSync(source)) throw new Error('Run pnpm prepare:runtime to download the configured Obsidian runtime.');
  return { ...configuration, resources, source };
};
