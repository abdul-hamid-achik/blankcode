FROM golang:1.22-alpine

WORKDIR /app

# Create non-root user with writable Go cache directories
RUN adduser -D -u 10000 runner && \
    mkdir -p /home/runner/go /home/runner/.cache/go-build && \
    chown -R runner:runner /home/runner

ENV HOME=/home/runner
ENV GOPATH=/home/runner/go
ENV GOCACHE=/home/runner/.cache/go-build

USER runner

CMD ["go", "test", "-v", "./..."]
