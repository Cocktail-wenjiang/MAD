const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pageCount = fs
  .readdirSync(path.join(root, "pages"), { withFileTypes: true })
  .filter((item) => item.isDirectory()).length;
const componentCount = fs
  .readdirSync(path.join(root, "components"), { withFileTypes: true })
  .filter((item) => item.isDirectory()).length;
assert.ok(pageCount >= 6, `页面数量不足：${pageCount}`);
assert.ok(componentCount >= 10, `组件数量不足：${componentCount}`);

const rolePage = fs.readFileSync(path.join(root, "pages/role-center/role-center.js"), "utf8");
assert.ok(rolePage.includes('role === "admin"'), "角色中心没有按管理员分流");
assert.ok(rolePage.includes("adminListUsers"), "管理员页面没有查询用户");
assert.ok(rolePage.includes("listHistory"), "普通用户页面没有查询测评历史");

const adminList = fs.readFileSync(
  path.join(root, "cloudfunctions/adminListUsers/index.js"),
  "utf8"
);
const adminGet = fs.readFileSync(path.join(root, "cloudfunctions/adminGetUser/index.js"), "utf8");
assert.ok(adminList.includes('user.role !== "admin"'), "用户列表云函数缺少管理员校验");
assert.ok(adminGet.includes('user.role !== "admin"'), "用户详情云函数缺少管理员校验");

console.log(`[PASS] 页面数量 ${pageCount}，自定义组件数量 ${componentCount}`);
console.log("[PASS] 普通用户趋势/管理员用户管理分流存在");
console.log("[PASS] 管理员云函数权限校验存在");
