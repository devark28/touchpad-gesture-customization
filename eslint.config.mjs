import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
// import jsdoc from 'eslint-plugin-jsdoc';
import stylistic from '@stylistic/eslint-plugin'

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            'padding-line-between-statements': [
                'error',
                {'blankLine': 'always', 'prev': '*', 'next': ['function', 'class', 'block-like']},
                {'blankLine': 'always', 'prev': ['function', 'class', 'block-like', 'import'], 'next': '*'},
                {'blankLine': 'never', 'prev': 'import', 'next': 'import'}
            ],
            'lines-around-comment': [
                'error',
                {
                    'beforeBlockComment': true,
                    'beforeLineComment': true,
                    'allowBlockStart': true
                }
            ],
            'no-multiple-empty-lines': [
                'error',
                {"max": 1}
            ],
            'lines-between-class-members': [
                'error',
                {
                    'enforce': [
                        {blankLine: "never", prev: "field", next: "field"},
                        {blankLine: "always", prev: "*", next: "method"},
                        {blankLine: "always", prev: "method", next: "field"},
                    ]
                }
            ],
            'padded-blocks': [
                'error',
                {"classes": "always"}
            ]
        }
    },
    {
        ignores: ['./node_modules/'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            'no-undef': 'off',
        }
    },
);