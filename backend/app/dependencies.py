from fastapi import Header, HTTPException, Request
from app.config import get_settings


async def require_api_key(request: Request, authorization: str | None = Header(default=None)):
    expected = request.app.state.settings.backend_api_key
    if not expected:
        return
    if authorization != f"Bearer {expected}":
        raise HTTPException(
            status_code=401,
            detail={
                "type": "auth_error",
                "code": "unauthorized",
                "message": "A valid backend API key is required",
            },
        )
