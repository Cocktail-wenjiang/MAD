# MAD AI Gateway

独立的 Python/FastAPI 模型中转站。客户端只配置一个网关地址和一个 `BACKEND_API_KEY`，网关根据模型名自动转发到 OpenAI、Anthropic、DeepSeek、Kimi、智谱 GLM 或其他 OpenAI 兼容服务。

## 启动

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

配置 `backend/.env` 中的上游 API Key。所有 Provider 和模型清单统一放在 `backend/config/providers.yaml`；生产环境设置一个 `BACKEND_API_KEY` 作为中转站访问凭证，客户端通过 `Authorization: Bearer <key>` 调用。

填写位置速查：上游 URL 和 Key 在 `backend/.env`；模型名在 `backend/config/providers.yaml` 的 `models[].id`；客户端访问中转站的 Key 是 `backend/.env` 里的 `BACKEND_API_KEY`。

### 球员火柴人视频分析

姿态服务复用 [SoloShuttlePose](https://github.com/sunwuzhou03/SoloShuttlePose)
的 COCO-17 球员关键点流程。将合法的 Keypoint R-CNN 权重放到
`backend/models/soloshuttlepose.pth`，或在 `.env` 中设置
`POSE_MODEL_PATH`。未安装 CUDA 时会自动使用 CPU；GPU 主机请按照 PyTorch
官方页面为对应 CUDA 版本安装 `torch`/`torchvision`，不要直接套用 CPU wheel。

默认限制是 100 MiB、60 秒和一个并发任务，可通过
`POSE_MAX_UPLOAD_BYTES`、`POSE_MAX_DURATION_SECONDS`、
`POSE_MAX_CONCURRENT_JOBS` 调整。启动服务后，使用 `backend/docs/pose-api.md`
中的 curl 示例上传 MP4、轮询任务，并下载 `annotated.mp4`、`frames.jsonl`
和 `summary.json`。输出保留原视频背景，只叠加球员火柴人，不显示羽毛球轨迹。

第一版直接使用已有权重做推理；后续微调应使用合法取得且留出的
ShuttleSet/ShuttleSet22 样本，并单独记录训练配置和评估集，避免把测试视频用于训练。

## 接口

`GET /api/v1/health` 不需要内部鉴权。其余接口包括 `/providers`、`/models`、`/chat/completions`、`/embeddings`、`/images/generations`、`/audio/transcriptions`、`/audio/speech`。

客户端推荐使用 OpenAI SDK：

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="your-backend-api-key",
)
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "你好"}],
)
```

`provider` 字段现在是可选的。网关会根据 `model` 自动路由；也可以使用 `kimi/moonshot-v1-8k` 这样的前缀强制指定 Provider。带 `/api/v1` 的旧地址仍兼容。OpenAI、DeepSeek、Kimi、智谱使用统一的 OpenAI 风格请求；Anthropic 的消息转换由适配器处理。流式对话设置 `stream: true`，响应为 SSE。

不支持的能力返回 501：

```json
{ "error": { "type": "gateway_error", "code": "capability_not_supported", "message": "..." } }
```

## 扩展 Provider

实现 `ModelProvider` 协议，声明 `provider_id`、`capabilities` 和各能力方法，然后在 `app/providers/factory.py` 注册。业务路由和前端协议不需要改动。

配置说明见 `config/README.md`，UML 见 `docs/uml/provider-gateway.md`。旧的 `docs/provider-uml.md` 仍保留作为兼容入口。

## 来源与许可

SoloShuttlePose 代码按 MIT 许可使用，发布时保留其仓库链接、版权和许可文本。
ShuttleSet/ShuttleSet22 仅作为已获授权的数据来源；请引用其论文并遵守数据集的
访问、研究和再分发条款。原始数据集视频、模型权重和用户上传视频均不提交到 Git。
