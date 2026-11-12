import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.astro/**', '**/coverage/**', 'apps/game/public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    // Règle d'architecture : le moteur de règles est du TypeScript pur.
    files: ['packages/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['phaser', 'phaser/*'], message: 'Le moteur ne dépend jamais de Phaser.' },
            {
              group: ['@antiqua/game', '@antiqua/site', '@antiqua/asset-pipeline'],
              message: 'Le moteur ne dépend jamais des apps ni des outils.',
            },
            {
              group: ['**/apps/**', '**/tools/**'],
              message: 'Le moteur ne dépend jamais des apps ni des outils.',
            },
          ],
        },
      ],
    },
  },
);
