#!/bin/bash
set -e

wasm-pack build --target bundler --release

echo "WASM DMN module built successfully."
``
