# Go Stack Directives
- **Linter & Formatter**: `golangci-lint` + `go fmt`
- **Static Typecheck**: `go vet` + compilación estricta
- **Testing Engine**: `go test -v -coverprofile=coverage.out ./...`
- **SonarQube Coverage**: Ingestión en `coverage.out` para Gate 4 y Gate 5
- **Contract Engine**: Schemathesis contra Gin / Chi / Fiber / standard net/http
- **Tooling**: Go modules
