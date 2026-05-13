# ──────────────────────────────────────────────────────────────────────────
# WattRent Backend production image
#
# Multi-stage：
#   1. builder：cached go modules + 編譯 static binary
#   2. runtime：distroless 最小化 image
#
# Cloud Run 會帶 PORT env var；Gin 預設 8080，這裡也用 8080
# ──────────────────────────────────────────────────────────────────────────

# ───────────── builder ─────────────
# 用浮動 tag 1.25-alpine：自動拉到該系列最新 patch（含 stdlib CVE 修補）
FROM golang:1.25-alpine AS builder

WORKDIR /src

# 先複製 go.mod / go.sum 充分利用 layer cache
COPY go.mod go.sum ./
RUN go mod download

# 再複製整份 source
COPY . .

# 靜態編譯（CGO_ENABLED=0 → 不依賴 glibc，可塞進 distroless）
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -trimpath \
    -ldflags="-s -w -X main.version=${VERSION}" \
    -o /out/wattrent-api .

# ───────────── runtime ─────────────
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=builder /out/wattrent-api /app/wattrent-api

USER nonroot:nonroot
EXPOSE 8080

ENV GIN_MODE=release \
    PORT=8080

ENTRYPOINT ["/app/wattrent-api"]
