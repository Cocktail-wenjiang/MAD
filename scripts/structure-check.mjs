import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pages = fs.readdirSync(path.join(root, 'pages')).filter(name => fs.statSync(path.join(root, 'pages', name)).isDirectory())
const components = fs.readdirSync(path.join(root, 'components')).filter(name => name.endsWith('.vue'))
if (pages.length < 6 || components.length < 10) throw new Error(`pages=${pages.length}, components=${components.length}`)
const sourceFiles = [...pages.map(name => path.join(root, 'pages', name, `${name}.vue`)), ...components.map(name => path.join(root, 'components', name))]
if (sourceFiles.some(file => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('wx.'))) throw new Error('发现微信专用 wx.* API')
for (const name of ['syncUser', 'listBanners', 'listHistory', 'saveAssessment', 'adminListUsers', 'adminGetUser']) {
  if (!fs.existsSync(path.join(root, 'uniCloud', 'cloudfunctions', name, 'index.js'))) throw new Error(`缺少云函数：${name}`)
}
console.log(`[PASS] uni-app pages=${pages.length}, components=${components.length}`)
