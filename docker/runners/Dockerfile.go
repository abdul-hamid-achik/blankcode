FROM golang:1.22-alpine

WORKDIR /app

# Create non-root user for security
RUN adduser -D -u 10000 runner
USER runner

CMD ["go", "test", "-v", "./..."]
