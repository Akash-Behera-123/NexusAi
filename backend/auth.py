
import os

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from dotenv import load_dotenv

load_dotenv()

CLERK_ISSUER = os.getenv("CLERK_ISSUER", "").rstrip("/")

if not CLERK_ISSUER:
    raise RuntimeError("CLERK_ISSUER is missing from backend/.env")

JWKS_URL = f"{CLERK_ISSUER}/.well-known/jwks.json"

jwks_client = PyJWKClient(JWKS_URL)
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_clerk_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=CLERK_ISSUER,
            options={"require": ["exp", "sub"]},
        )

        return payload

    except jwt.PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as exc:
        # Fail closed if the signing keys cannot be retrieved or verified.
        if exc.__class__.__module__.startswith("jwt"):
            raise HTTPException(
                status_code=401,
                detail="Unable to verify authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        raise HTTPException(
            status_code=503,
            detail="Authentication service temporarily unavailable.",
        )
