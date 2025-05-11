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
    bash \
    bash-completion

# Enable bash completion
RUN echo 'if [ -f /etc/bash_completion ]; then 
    . /etc/bash_completion
fi' >> ~/.bashrc

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

# Usage
# docker build -t wattrent-dev .
# For powershell
# docker run -itd -v "${PWD}:/wattrent" -p 8080:8080 -p 19006:19006 --name=wattrent-dev wattrent-dev