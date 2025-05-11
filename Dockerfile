# Use Node.js 22 as base image
FROM node:22

# Install Go 1.24.3
RUN curl -sSL https://go.dev/dl/go1.24.3.linux-amd64.tar.gz | tar -C /usr/local -xzf - \
    && ln -s /usr/local/go/bin/go /usr/bin/go

# Set Go environment variables
ENV GOROOT=/usr/local/go
ENV GOPATH=/go
ENV PATH=$PATH:$GOROOT/bin:$GOPATH/bin

# Install required tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    bash

# Install Air (Go hot reload tool)
RUN go install github.com/air-verse/air@latest

# Set working directory back to root
WORKDIR /wattrent

# Copy entire project directory
COPY . /wattrent

WORKDIR /wattrent/backend
RUN go mod download

# Expose necessary ports
EXPOSE 8080 19006