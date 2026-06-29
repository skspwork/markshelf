import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "scripts/**",
      ".claude/**",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 素の Node スクリプト（.mjs/.js）には Node グローバルを与える
    // （bin/ の CLI などが process / console を使うため）。
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // TypeScript が未定義参照を担保するため、ESLint の no-undef は無効化する
    // （ブラウザ/Node グローバルを誤検知するため。typescript-eslint 公式推奨）。
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
    },
  },
  {
    // Next / react-hooks ルールはアプリ本体 src/** のみに適用する。
    // root 直下の設定ファイル(eslint.config.mjs / vitest.config.ts)や bin/ は対象外で意図通り。
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      // react-hooks v6 で追加された構造系ルールは既存実装に多数該当する。
      // 退行検知ゲートを塞がないよう warn に下げ、可視化は残す（段階的に解消する）。
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
);
