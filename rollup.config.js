import typescript from "@rollup/plugin-typescript";
import dts from "rollup-plugin-dts";
import { terser } from "rollup-plugin-terser";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import packageJson from './package.json';

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: packageJson.main,
        format: "cjs",
      },
    ],
    plugins: [
      json(),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
      peerDepsExternal(),
      typescript({ tsconfig: "./tsconfig.build.json" }),
      terser(),
    ],
    external: ["axios"],
  },
  {
    input: "dist/types/index.d.ts",
    output: [{ file: packageJson.types, format: "esm" }],
    plugins: [dts()],
  },
];
