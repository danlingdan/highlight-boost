import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
export default tseslint.config(
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  {
    files: ['src/**/*.ts'],
    plugins: { obsidianmd },
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      'obsidianmd/detach-leaves': 'error',
      'obsidianmd/settings-tab/no-manual-html-headings': 'error',
      'obsidianmd/settings-tab/prefer-setting-definitions': 'error',
      'obsidianmd/settings-tab/prefer-update-over-display': 'error',
      'obsidianmd/settings-tab/no-deprecated-display': 'error',
      'obsidianmd/no-forbidden-elements': 'error',
      'obsidianmd/no-static-styles-assignment': 'error',
      'obsidianmd/prefer-create-el': 'error',
      'obsidianmd/prefer-window-timers': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
    },
  },
);
