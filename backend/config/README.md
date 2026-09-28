# Gateway configuration

## 填写位置

| 内容                     | 文件                    | 字段                               |
| ------------------------ | ----------------------- | ---------------------------------- |
| 中转站给客户端的访问 Key | `backend/.env`          | `BACKEND_API_KEY`                  |
| 上游厂商 API Key         | `backend/.env`          | `OPENAI_API_KEY` 等                |
| 上游厂商 URL             | `backend/.env`          | `OPENAI_BASE_URL` 等               |
| 上游模型名称             | `config/providers.yaml` | `providers.<provider>.models[].id` |

客户端使用 `http://localhost:8000/v1` 作为 URL，使用 `.env` 中的 `BACKEND_API_KEY`，模型名直接使用 YAML 中的 `id`。

这里是后端第三方模型的统一配置入口：

- `providers.yaml`：Provider 名称、适配器、环境变量名、模型和能力。
- `../.env`：真实 API Key 和可覆盖的 Base URL。不要把真实 Key 写入 YAML 或 Git。启动时从项目根目录执行 `uvicorn app.main:app`，或将 `backend/.env` 的变量导出到进程环境。
- `.env.example`：密钥配置模板，可复制到 `backend/.env`。

新增模型只需在 `providers.yaml` 对应 Provider 的 `models` 下增加 `id` 和 `capabilities`。客户端直接使用这个 `id`；也可用 `provider/model` 形式强制路由。新增 Provider 时增加完整配置，并在 `app/providers/factory.py` 注册适配器类型。
