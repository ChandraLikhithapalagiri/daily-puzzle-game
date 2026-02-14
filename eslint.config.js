import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
   ecmaVersion: "latest",
   sourceType: "module",
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    }
  },
  globals: {
    document: "readonly",
    window: "readonly"
  }
},

    plugins: {
      react: reactPlugin
    },
    rules: {
      "react/react-in-jsx-scope": "off"
    }
  }
];
