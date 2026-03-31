# Justfile for PackPal

# Default goal
default: dev

# Install all dependencies
install:
    bun install

# Run development server
dev:
    bun run dev

# Format code
format:
    bun run format

# Run all linters and type checks
check:
    bun run lint
    bun run check

# Run Playwright E2E tests (isolated test DB on port 5199)
test:
    DATABASE_PATH=data/packpal-test.db bun run test

# Run Playwright tests with UI
test-ui:
    DATABASE_PATH=data/packpal-test.db bun run test:ui

# Remove test database files
test-clean:
    rm -f data/packpal-test.db data/packpal-test.db-wal data/packpal-test.db-shm

# Full verification gate -- must pass before any task is declared done
verify: format check

# Build for production
build:
    bun run build

# Preview production build locally
preview: build
    bun run preview

# Docker build and run
docker:
    docker compose up --build
