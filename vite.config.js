import { defineConfig } from 'vite'
import uniModule from '@dcloudio/vite-plugin-uni'

// HBuilderX 和 Node 对 CommonJS 默认导出的包装方式可能不同。
const uni = typeof uniModule === 'function' ? uniModule : uniModule.default
export default defineConfig({ plugins: [uni()] })
