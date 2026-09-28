/**
 * uni-config-center 云配置中心
 * 官方文档: https://uniapp.dcloud.net.cn/uniCloud/uni-config-center.html
 * 插件市场: https://ext.dcloud.net.cn/plugin?id=4425
 */

const path = require('path')
const fs = require('fs')

/**
 * 深度合并对象
 */
function deepMerge(target, source) {
	if (typeof target !== 'object' || target === null) return source
	if (typeof source !== 'object' || source === null) return target
	const result = Array.isArray(target) ? [...target] : { ...target }
	for (const key of Object.keys(source)) {
		if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
			result[key] = deepMerge(result[key] || {}, source[key])
		} else {
			result[key] = source[key]
		}
	}
	return result
}

/**
 * 根据路径获取嵌套对象的值
 */
function getByPath(obj, keyPath) {
	const keys = keyPath.split('.')
	let current = obj
	for (const key of keys) {
		if (current === null || typeof current !== 'object' || !(key in current)) {
			return undefined
		}
		current = current[key]
	}
	return current
}

module.exports = function createConfig(options) {
	const { pluginId, defaultConfig, customMerge } = options || {}

	if (!pluginId) {
		throw new Error('uni-config-center: pluginId is required')
	}

	// 配置目录路径: common/uni-config-center/{pluginId}
	const configDir = path.resolve(__dirname, pluginId)
	const configFilePath = path.join(configDir, 'config.json')

	// 读取用户配置文件
	let userConfig = {}
	if (fs.existsSync(configFilePath)) {
		try {
			const content = fs.readFileSync(configFilePath, 'utf-8')
			userConfig = JSON.parse(content)
		} catch (e) {
			console.error(`uni-config-center: Failed to parse ${pluginId}/config.json`, e.message)
		}
	}

	// 合并默认配置和用户配置
	const mergeFn = typeof customMerge === 'function' ? customMerge : deepMerge
	const mergedConfig = defaultConfig
		? mergeFn(JSON.parse(JSON.stringify(defaultConfig)), userConfig)
		: userConfig

	return {
		/**
		 * 获取配置内容
		 * @param {string} [key] - 配置项名，支持点号路径，如 'service.sms.codeExpiresIn'
		 * @param {*} [defaultValue] - 获取不到时的默认值
		 */
		config(key, defaultValue) {
			if (key === undefined) {
				return mergedConfig
			}
			const val = getByPath(mergedConfig, key)
			return val !== undefined ? val : defaultValue
		},

		/**
		 * 获取配置目录下文件的绝对路径
		 * @param {string} fileName - 文件名
		 */
		resolve(fileName) {
			return path.join(configDir, fileName)
		},

		/**
		 * 使用 require 引用配置目录下的 js/json 文件
		 * @param {string} fileName - 文件名
		 */
		requireFile(fileName) {
			const filePath = path.join(configDir, fileName)
			if (!fs.existsSync(filePath)) {
				return undefined
			}
			return require(filePath)
		},

		/**
		 * 判断配置目录下是否存在指定文件
		 * @param {string} fileName - 文件名
		 */
		hasFile(fileName) {
			return fs.existsSync(path.join(configDir, fileName))
		}
	}
}
