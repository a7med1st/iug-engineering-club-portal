#!/usr/bin/env bash
set -Eeuo pipefail

commit_sha="${1:?A commit SHA is required}"
repository_url="https://github.com/a7med1st/iug-engineering-club-portal.git"
deploy_root="/var/www/main"
releases_dir="$deploy_root/releases"
shared_dir="$deploy_root/shared"
release_dir="$releases_dir/$commit_sha"
current_link="$deploy_root/current"
candidate_link="$deploy_root/current.next"

if [[ ! "$commit_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid commit SHA" >&2
  exit 2
fi

mkdir -p "$releases_dir" "$shared_dir"

if [[ ! -f "$shared_dir/.env" ]]; then
  echo "Missing production environment file: $shared_dir/.env" >&2
  exit 3
fi

if [[ -e "$release_dir" ]]; then
  echo "Release already exists: $commit_sha"
else
  git clone --filter=blob:none --no-checkout "$repository_url" "$release_dir"
  git -C "$release_dir" fetch --depth 1 origin "$commit_sha"
  git -C "$release_dir" checkout --detach "$commit_sha"
fi

ln -sfn "$shared_dir/.env" "$release_dir/.env"

cd "$release_dir"
npm ci
npm run db:generate
npm run db:deploy
npm run build

previous_release=""
if [[ -L "$current_link" ]]; then
  previous_release="$(readlink -f "$current_link")"
fi

ln -sfn "$release_dir" "$candidate_link"
mv -Tf "$candidate_link" "$current_link"
sudo /usr/bin/systemctl restart iug-main.service

healthy=false
for _ in {1..20}; do
  if curl --fail --silent --show-error --max-time 5 \
    http://127.0.0.1:3000/ >/dev/null; then
    healthy=true
    break
  fi
  sleep 3
done

if [[ "$healthy" != "true" ]]; then
  echo "Health check failed for $commit_sha" >&2

  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -sfn "$previous_release" "$candidate_link"
    mv -Tf "$candidate_link" "$current_link"
    sudo /usr/bin/systemctl restart iug-main.service
    echo "Rolled back to $previous_release" >&2
  fi

  exit 4
fi

echo "Deployment succeeded: $commit_sha"
