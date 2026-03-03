FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    curl wget git sudo build-essential jq \
    && rm -rf /var/lib/apt/lists/*

# Create runner user
RUN useradd -m runner && \
    echo "runner ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/runner

USER runner
WORKDIR /home/runner
