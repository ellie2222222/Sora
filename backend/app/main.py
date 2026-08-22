from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from app.db import init_db
from app.core.config import settings
from app.core.logger import ConfigValidator, configure_logging
from app.api import setup_routes

# Configure logging
configure_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    app = FastAPI(title="Finance API", version="1.0.0")

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:3001"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def startup():
        """Initialize database on startup."""
        # Log configuration at startup
        ConfigValidator.log_configuration(settings)
        # Initialize database
        init_db()

    # Register all routes
    setup_routes(app)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
