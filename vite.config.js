import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import uniModule from "@dcloudio/vite-plugin-uni";

// HBuilderX projects keep manifest.json and pages.json at the project root.
// The standalone Vite CLI defaults to <project>/src, so point it at this
// directory unless HBuilderX (or the caller) has already supplied a location.
process.env.UNI_INPUT_DIR ||= dirname(fileURLToPath(import.meta.url));

// HBuilderX 和 Node 对 CommonJS 默认导出的包装方式可能不同。
const uni = typeof uniModule === "function" ? uniModule : uniModule.default;
export default defineConfig({ plugins: [uni()] });
