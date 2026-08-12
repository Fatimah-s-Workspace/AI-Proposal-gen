import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "uploads/**",
      "exports/**",
      "dev.db",
      "tsconfig.tsbuildinfo",
      // Agent worktrees are full checkouts of this repo living inside it.
      // Without this, linting the project also lints every copy - which
      // buries real findings under tens of thousands of duplicates.
      ".claude/**",
    ],
  },
];

export default eslintConfig;
