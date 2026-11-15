import { ExpressiveCodeEngine } from '@expressive-code/core';
import { createCssVariableThemeBundle, createEcEngineConfig, EC_VIRTUAL_SETTINGS } from './upstream/Config';
import { OBSIDIAN_THEME } from './upstream/ObsidianTheme';

export async function syntaxStyles(): Promise<string> {
  const mapped = createCssVariableThemeBundle(OBSIDIAN_THEME);
  const engine = new ExpressiveCodeEngine(createEcEngineConfig({
    theme: mapped.theme, customLanguages: [], settings: EC_VIRTUAL_SETTINGS, usingObsidianTheme: true,
  }));
  return mapped.restoreCssVariables(`${await engine.getBaseStyles()}\n${await engine.getThemeStyles()}`);
}
