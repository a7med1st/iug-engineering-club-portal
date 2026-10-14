#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
test_root="$(mktemp -d)"
trap 'rm -rf -- "$test_root"' EXIT
releases_dir="$test_root/releases"
shared_dir="$test_root/shared"
current_link="$test_root/current"
mkdir -p "$releases_dir" "$shared_dir"
printf 'user data' > "$shared_dir/keep"
current_sha="$(printf '%040d' 1)"
backup_sha="$(printf '%040d' 2)"
old_sha="$(printf '%040d' 3)"
commit_sha="$(printf '%040d' 4)"
symlink_sha="$(printf '%040d' 5)"
for sha in "$current_sha" "$backup_sha" "$old_sha" "$commit_sha"; do
  mkdir -p "$releases_dir/$sha/node_modules" "$releases_dir/$sha/.next"
  touch "$releases_dir/$sha/.next/BUILD_ID" "$releases_dir/$sha/source.ts"
  touch -t 202601010000 "$releases_dir/$sha"
done
touch -t 202601020000 "$releases_dir/$backup_sha"
ln -s "$releases_dir/$current_sha" "$current_link"
ln -s "$shared_dir" "$releases_dir/$symlink_sha"
mkdir -p "$releases_dir/unrecognized/node_modules"

source <(awk '{sub(/\r$/, "")} /^current_release=/{printing=1} /^echo "Disk space/{printing=0} printing' "$script_dir/deploy-production.sh")

for sha in "$current_sha" "$backup_sha" "$commit_sha"; do
  [[ -d "$releases_dir/$sha/node_modules" && -f "$releases_dir/$sha/.next/BUILD_ID" ]]
done
[[ ! -e "$releases_dir/$old_sha/node_modules" && ! -e "$releases_dir/$old_sha/.next" ]]
[[ -f "$releases_dir/$old_sha/source.ts" && -f "$shared_dir/keep" ]]
[[ -L "$releases_dir/$symlink_sha" && -d "$releases_dir/unrecognized/node_modules" ]]
echo "Deployment cleanup tests passed: current, backup, target, shared data and symlinks preserved."
