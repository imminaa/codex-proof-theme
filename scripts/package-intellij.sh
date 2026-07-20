#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
resources_dir="$repo_root/intellij/src/main/resources"
output_dir="$repo_root/dist"
output_file="$output_dir/proof-light-intellij-0.1.0.zip"
stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/proof-intellij.XXXXXX")"

cleanup() {
  rm -rf "$stage_dir"
}
trap cleanup EXIT

mkdir -p "$stage_dir/proof-light/lib" "$output_dir"

(
  cd "$resources_dir"
  jar --create --file "$stage_dir/proof-light/lib/proof-light.jar" META-INF themes
)

(
  cd "$stage_dir"
  zip -q -r "$output_file" proof-light
)

echo "Created $output_file"
