#!/bin/bash

# Run integration tests for Finance Application

set -e

echo "🧪 Running Integration Tests..."
echo ""

# Run all tests
pytest tests/ -v --tb=short

echo ""
echo "✅ All tests passed!"
