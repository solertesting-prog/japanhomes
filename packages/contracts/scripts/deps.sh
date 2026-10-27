#!/usr/bin/env sh
# Fetches pinned Solidity dependencies into lib/ (kept out of git).
set -e
cd "$(dirname "$0")/.."
mkdir -p lib
fetch() { # dir repo tag
  if [ ! -d "lib/$1" ]; then
    git clone --quiet --depth 1 --branch "$3" "https://github.com/$2" "lib/$1"
  fi
}
fetch openzeppelin-contracts OpenZeppelin/openzeppelin-contracts v5.4.0
fetch forge-std foundry-rs/forge-std v1.11.0
echo "lib/ ready"
