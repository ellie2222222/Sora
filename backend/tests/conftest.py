import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, get_db
from app.models import User
from passlib.context import CryptContext

# Use SQLite for testing (simpler than PostgreSQL in tests)
TEST_DATABASE_URL = "sqlite:///./test.db"

# Create test engine
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="function")
def db():
    """Create a new database session for each test."""
    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db: Session):
    """Create a test client with overridden database dependency."""

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db: Session):
    """Create a test user."""
    user = User(
        email="test@example.com",
        hashed_password=pwd_context.hash("testpassword123"),
        full_name="Test User",
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_user_unverified(db: Session):
    """Create an unverified test user."""
    user = User(
        email="unverified@example.com",
        hashed_password=pwd_context.hash("testpassword123"),
        full_name="Unverified User",
        is_email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_token(client: TestClient, test_user: User):
    """Get authentication token for test user."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "testpassword123"},
    )
    return response.json()["data"]["access_token"]


@pytest.fixture
def auth_headers(auth_token: str):
    """Get authorization headers."""
    return {"Authorization": f"Bearer {auth_token}"}
