# ----------------------------------------------------------------------
# WattRent Backend production image
#
# Multi-stage:
#   1. builder: cached go modules + compile a static binary
#   2. runtime: minimal distroless image
#
# Cloud Run injects the PORT env var; Gin defaults to 8080 and so do we.
# ----------------------------------------------------------------------

# ----- builder -----
# Use the floating tag 1.25-alpine so we always pull the latest patch in the series (incl. stdlib CVE fixes).
FROM golang:1.25-alpine AS builder

WORKDIR /src

# Copy go.mod / go.sum first to make the most of layer caching.
COPY go.mod go.sum ./
RUN go mod download

# Then copy the rest of the source.
COPY . .

# Static build (CGO_ENABLED=0 -> no glibc dependency, fits into distroless).
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -trimpath \
    -ldflags="-s -w -X main.version=${VERSION}" \
    -o /out/wattrent-api .

# ----- runtime -----
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder /out/wattrent-api /app/wattrent-api

USER nonroot:nonroot
EXPOSE 8080

ENV GIN_MODE=release \
    PORT=8080

ENTRYPOINT ["/app/wattrent-api"]
