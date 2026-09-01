// eslint.config.mjs
import typescriptEslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'src/prisma/contract.d.ts',
    ],
  },
  ...typescriptEslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.spec.ts', '**/*.e2e-spec.ts'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        project: null,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin,
      prettier,
    },
    rules: {
			'@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { 
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_',
      }],
      '@typescript-eslint/no-empty-object-type': 'off',
      'prettier/prettier': 'off',
    },
  },
];