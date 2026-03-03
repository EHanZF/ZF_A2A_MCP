name: Build and Push Runner Image

on:
  push:
    branches:
      - main
      - develop
      - 'feature/**'
    paths:
      - 'runner/**'
      - '.github/workflows/build-and-push.yml'
  workflow_dispatch:

permissions:
  contents: read
  packages: write

env:
  REGISTRY: ghcr.io/${{ github.repository_owner }}

jobs:
  build-runner-image:
    runs-on: ubuntu-latest
    name: Build & Push Custom Runner Image

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract image metadata
        id: meta
        run: |
          echo "sha_short=$(echo $GITHUB_SHA | cut -c1-7)" >> $GITHUB_OUTPUT
          echo "branch=$(echo ${GITHUB_REF#refs/heads/} | tr '/' '-')" >> $GITHUB_OUTPUT

      - name: Build and Push
        uses: docker/build-push-action@v6
        with:
          context: ./runner
          file: ./runner/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/runner:${{ steps.meta.outputs.branch }}
            ${{ env.REGISTRY }}/runner:${{ steps.meta.outputs.sha_short }}
            ${{ github.ref == 'refs/heads/main' && format('{0}/runner:latest', env.REGISTRY) || '' }}

      - name: Summary
        run: |
          echo "Runner image pushed:"
          echo "- ${{ env.REGISTRY }}/runner:${{ steps.meta.outputs.branch }}"
          echo "- ${{ env.REGISTRY }}/runner:${{ steps.meta.outputs.sha_short }}"
          if [[ "${GITHUB_REF}" == "refs/heads/main" ]]; then
            echo "- ${{ env.REGISTRY }}/runner:latest"
          fi
