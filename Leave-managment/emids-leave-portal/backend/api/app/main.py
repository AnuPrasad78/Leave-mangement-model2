import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db import engine, settings
from app.routes import router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Leave Portal API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "traceparent"],
)
app.include_router(router)


from urllib.parse import urlsplit

from fastapi.responses import JSONResponse

from app.security import SESSION_COOKIE_NAME

_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_ALLOWED_ORIGINS = {
    origin.strip().rstrip('/')
    for origin in settings.CORS_ORIGINS.split(',')
    if origin.strip()
}


def _origin_allowed(origin: str) -> bool:
    parts = urlsplit(origin)
    actual = f"{parts.scheme}://{parts.netloc}".lower()
    return actual in _ALLOWED_ORIGINS


@app.middleware("http")
async def csrf_origin_guard(request, call_next):
    """CSRF guard for cookie-authenticated state-changing requests.

    Browsers always attach an Origin header to unsafe-method fetches; when the
    session cookie rides along, that origin must be one of the configured
    frontend origins. Requests that authenticate via the Authorization header
    instead of the cookie (programmatic clients) are exempt — cookie-based CSRF
    does not apply to them."""
    if request.method in _UNSAFE_METHODS and SESSION_COOKIE_NAME in request.cookies:
        origin = request.headers.get("origin")
        if origin is None or not _origin_allowed(origin):
            return JSONResponse(status_code=403, content={"detail": "Cross-site state changes are not permitted"})
    return await call_next(request)


@app.middleware("http")
async def add_trace_id(request, call_next):
    response = await call_next(request)
    traceparent = request.headers.get("traceparent", "")
    parts = traceparent.split("-")
    if len(parts) == 4 and len(parts[1]) == 32 and parts[1].strip("0123456789abcdef") == "":
        response.headers["x-trace-id"] = parts[1]
    return response

if settings.OTEL_EXPORTER_OTLP_ENDPOINT:
    provider = TracerProvider(resource=Resource.create({"service.name": "leave-portal-api"}))
    provider.add_span_processor(
        BatchSpanProcessor(
            OTLPSpanExporter(
                endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
                insecure=True,
            )
        )
    )
    trace.set_tracer_provider(provider)
    SQLAlchemyInstrumentor().instrument(engine=engine)
    FastAPIInstrumentor.instrument_app(app)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/db")
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        raise HTTPException(status_code=503, detail="Database unavailable")

    return {"status": "ok", "database": "connected"}