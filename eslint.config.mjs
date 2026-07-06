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
    ],
  },
];

export default eslintConfig;
