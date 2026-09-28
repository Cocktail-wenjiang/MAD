from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from app.config import Settings, get_settings
from app.api import router
from app.providers.factory import create_registry
from app.pose.engine import PoseEngine
from app.pose.jobs import PoseJobManager


def create_app(settings: Settings | None = None, backend_api_key: str | None = None) -> FastAPI:
    settings = settings or get_settings()
    if backend_api_key is not None:
        settings.backend_api_key = backend_api_key
    app = FastAPI(title=settings.app_name, version="1.0.0")
    app.state.settings = settings
    app.state.registry = create_registry(settings)
    app.state.pose_jobs = PoseJobManager(
        storage_dir=settings.pose_storage_dir,
        engine_factory=lambda: PoseEngine(settings=settings),
        max_concurrent_jobs=settings.pose_max_concurrent_jobs,
        keypoint_threshold=settings.pose_detection_threshold,
    )

    @app.exception_handler(Exception)
    async def gateway_error(request: Request, exc: Exception):
        if hasattr(exc, "status_code") and hasattr(exc, "detail"):
            status = exc.status_code
            detail = (
                exc.detail
                if isinstance(exc.detail, dict)
                else {"type": "gateway_error", "code": "request_error", "message": str(exc.detail)}
            )
            return JSONResponse(status_code=status, content={"error": detail})
        return JSONResponse(
            status_code=500,
            content={
                "error": {"type": "gateway_error", "code": "internal_error", "message": str(exc)}
            },
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        detail = (
            exc.detail
            if isinstance(exc.detail, dict)
            else {"type": "gateway_error", "code": "request_error", "message": str(exc.detail)}
        )
        return JSONResponse(status_code=exc.status_code, content={"error": detail})

    app.include_router(router, prefix="/api/v1")
    app.include_router(router, prefix="/v1")
    return app


app = create_app()
