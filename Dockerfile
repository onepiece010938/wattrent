# Use Node.js 22 as base image
FROM node:22

# Install Go 1.24.3
RUN curl -sSL https://go.dev/dl/go1.24.3.linux-amd64.tar.gz | tar -C /usr/local -xzf - \
    && ln -s /usr/local/go/bin/go /usr/bin/go

# Set Go environment variables
ENV GOROOT=/usr/local/go
ENV GOPATH=/go
ENV PATH=$PATH:$GOROOT/bin:$GOPATH/bin:/go/bin

# Install required tools and sudo
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    bash \
    bash-completion \
    sudo \
    && echo "root:root" | chpasswd \
    && echo "developer ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/developer

# Install Air (Go hot reload tool)
RUN go install github.com/air-verse/air@latest && \
    ln -s /go/bin/air /usr/local/bin/air

# Add non-root user
RUN useradd -ms /bin/bash developer

USER developer

# Enable bash completion
RUN echo 'if [ -f /etc/bash_completion ]; then . /etc/bash_completion; fi' >> /home/developer/.bashrc

# Set working directory
WORKDIR /wattrent

# Copy only necessary files (use .dockerignore to exclude)
COPY . /wattrent

# Expose necessary ports
EXPOSE 8080 8090 8081 19000 19001 19002 19006

# Default command (optional)
CMD ["bash"]

# docker build -t wattrent-dev .
# docker run -itd -v %cd%:/wattrent ^
#   -p 8080:8080 ^
#   -p 8090:8090 ^
#   -p 8081:8081 ^
#   -p 19000:19000 ^
#   -p 19001:19001 ^
#   -p 19002:19002 ^
#   -p 19006:19006 ^
#   --name=wattrent-dev wattrent-dev

