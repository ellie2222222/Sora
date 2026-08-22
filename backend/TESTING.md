# Integration Testing Guide

This project uses pytest for integration testing with a real SQLite database. All tests run against actual database operations, not mocks.

## Test Structure

```
tests/
├── conftest.py          # Pytest configuration and shared fixtures
├── test_auth.py         # Authentication endpoint tests
└── test_workspace.py    # Workspace management tests
```

## Quick Start

### Run all tests:
```bash
pytest
```

### Run specific test file:
```bash
pytest tests/test_auth.py
```

### Run specific test class:
```bash
pytest tests/test_auth.py::TestAuthLogin
```

### Run specific test:
```bash
pytest tests/test_auth.py::TestAuthLogin::test_login_success
```

### Run with verbose output:
```bash
pytest -v
```

### Run with coverage report:
```bash
pip install pytest-cov
pytest --cov=app tests/
```

### Run only marked tests:
```bash
pytest -m auth
pytest -m workspace
```

## Test Fixtures

Common fixtures available in all tests:

### `db`
SQLite database session for the test. Automatically creates and cleans up tables.
```python
def test_something(db):
    user = db.query(User).first()
```

### `client`
FastAPI TestClient with overridden database dependency.
```python
def test_register(client):
    response = client.post("/api/v1/auth/register", json={...})
```

### `test_user`
Pre-created verified user:
- Email: `test@example.com`
- Password: `testpassword123`
- Status: Email verified

### `test_user_unverified`
Pre-created unverified user:
- Email: `unverified@example.com`
- Password: `testpassword123`
- Status: Email not verified

### `auth_token`
Valid JWT access token for `test_user`.

### `auth_headers`
Dictionary with Authorization header for authenticated requests:
```python
def test_protected_route(client, auth_headers):
    response = client.get("/api/v1/workspaces", headers=auth_headers)
```

## Test Coverage

### Authentication Tests (`test_auth.py`)

**Registration:**
- ✅ Successful registration with all fields
- ✅ Reject duplicate email
- ✅ Validate email format
- ✅ Password handling

**Login:**
- ✅ Successful login with verified email
- ✅ Reject invalid credentials
- ✅ Reject nonexistent user
- ✅ Reject unverified email
- ✅ Brute-force protection (5 failed attempts → lockout)

**Email Verification:**
- ✅ Successful verification with valid token
- ✅ Reject invalid token
- ✅ Reject expired token

**Token Refresh:**
- ✅ Successful refresh with valid token
- ✅ Reject invalid refresh token
- ✅ Require token in request

**Logout:**
- ✅ Successful logout
- ✅ Idempotent (no error on invalid token)

### Workspace Tests (`test_workspace.py`)

**CRUD Operations:**
- ✅ Create workspace with owner and default categories
- ✅ List workspaces (user's own workspaces only)
- ✅ Get workspace details (with user role)
- ✅ Update workspace (OWNER only)
- ✅ Delete workspace (soft delete)

**Access Control:**
- ✅ Require authentication
- ✅ Prevent access to other users' workspaces
- ✅ Enforce OWNER-only operations

**Member Management:**
- ✅ Invite members (OWNER only)
- ✅ Accept invitation (email validation)
- ✅ Update member role (OWNER only)
- ✅ Remove member (OWNER only)
- ✅ Prevent removing OWNER

## Writing New Tests

### Basic Structure

```python
class TestFeatureName:
    def test_success_case(self, client, auth_headers, db):
        # Arrange: Set up test data
        response = client.post(
            "/api/v1/endpoint",
            json={"field": "value"},
            headers=auth_headers
        )
        
        # Assert: Verify response
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        
        # Assert: Verify database state
        obj = db.query(Model).filter(...).first()
        assert obj is not None

    def test_error_case(self, client):
        response = client.post(
            "/api/v1/endpoint",
            json={"invalid": "data"}
        )
        
        assert response.status_code == 422
```

### Testing Protected Endpoints

```python
def test_protected_endpoint(self, client, auth_headers):
    # With authentication
    response = client.get("/api/v1/protected", headers=auth_headers)
    assert response.status_code == 200
    
def test_protected_endpoint_unauthorized(self, client):
    # Without authentication
    response = client.get("/api/v1/protected")
    assert response.status_code == 401
```

### Testing Database State

```python
def test_creates_record(self, client, auth_headers, db):
    response = client.post(
        "/api/v1/items",
        json={"name": "Item"},
        headers=auth_headers
    )
    
    # Verify in database
    item = db.query(Item).filter(Item.name == "Item").first()
    assert item is not None
    assert item.created_by == test_user.id
```

## Integration Test Philosophy

These are **integration tests**, not unit tests:
- ✅ Use a real database (SQLite for tests)
- ✅ Test entire request/response flow
- ✅ Verify database state changes
- ✅ Test error codes and status codes
- ✅ Test authorization rules

Avoid:
- ❌ Mocking database calls
- ❌ Testing internal functions in isolation
- ❌ Skipping database checks

## Debugging Tests

### Print debug info:
```python
def test_something(client, db):
    response = client.post(...)
    print("Response:", response.json())  # Will show in pytest output with -s
```

### Run with output:
```bash
pytest tests/test_auth.py::TestAuthLogin::test_login_success -s
```

### Drop into debugger:
```python
import pdb; pdb.set_trace()  # Breakpoint
```

### Check database state:
```python
def test_something(db):
    users = db.query(User).all()
    print(f"Users in DB: {len(users)}")
```

## Common Issues

**Tests pass locally but fail in CI:**
- Ensure database is clean between tests (fixtures handle this)
- Check timezone handling (use UTC)
- Verify environment variables

**Fixture not found:**
- Ensure conftest.py is in tests/ directory
- Check fixture name spelling

**Database locked error:**
- SQLite has issues with concurrent access
- Tests run sequentially by default (correct)
- Use `-n auto` for parallel runs only with proper DB

**Import errors:**
- Add tests/ directory to Python path
- Ensure app package can be imported

## CI/CD Integration

Add to CI pipeline:
```bash
cd backend
pip install -r requirements.txt
pytest tests/ --cov=app --cov-report=xml
```

## Performance

- Full test suite runs in ~5-10 seconds
- Each test creates/destroys database tables
- No external service dependencies (email, SMS, etc.)
- Use in-memory SQLite for fastest runs

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [FastAPI testing guide](https://fastapi.tiangolo.com/advanced/testing-dependencies/)
- [SQLAlchemy testing patterns](https://docs.sqlalchemy.org/en/20/faq/general_sql.html#how-do-i-use-the-new-1-4-api-for-unit-tests)
