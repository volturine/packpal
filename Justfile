# Justfile for PackPal

# Default goal
default: dev

# Install all dependencies
install:
    npm install

# Run development server
dev:
    npm run dev

# Format code
format:
    npm run format

# Run all linters and type checks
check:
    npm run lint
    npm run check

# Run Playwright E2E tests (isolated test DB on port 5199)
test:
    DATABASE_PATH=data/packpal-test.db npm run test

# Run Playwright tests with UI
test-ui:
    DATABASE_PATH=data/packpal-test.db npm run test:ui

# Remove test database files
test-clean:
    rm -f data/packpal-test.db data/packpal-test.db-wal data/packpal-test.db-shm

# Full verification gate -- must pass before any task is declared done
verify: format check

# Build for production
build:
    npm run build

# Preview production build locally
preview: build
    npm run preview

# Docker build and run
docker:
    docker compose --project-directory . -f docker/compose.yaml up -d --build
