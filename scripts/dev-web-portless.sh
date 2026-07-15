#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script_path="$script_dir/$(basename "${BASH_SOURCE[0]}")"

export PORTLESS_TLD="${PORTLESS_TLD:-com}"
export PORTLESS_APP_NAME="${PORTLESS_APP_NAME:-cap.portless.moc11}"
export PORTLESS_S3_APP_NAME="${PORTLESS_S3_APP_NAME:-s3.cap.portless.moc11}"
export PORTLESS_WILDCARD="${PORTLESS_WILDCARD:-1}"

if [[ "${CAP_PORTLESS_CHILD:-0}" == "1" ]]; then
	export TURBO_UI="${TURBO_UI:-true}"

	portless_url="${PORTLESS_URL:-https://${PORTLESS_APP_NAME}.${PORTLESS_TLD}}"
	s3_public_endpoint="${S3_PUBLIC_ENDPOINT:-https://${PORTLESS_S3_APP_NAME}.${PORTLESS_TLD}}"

	export WEB_URL="$portless_url"
	export NEXTAUTH_URL="$portless_url"
	export NEXT_PUBLIC_WEB_URL="$portless_url"
	export VITE_SERVER_URL="$portless_url"
	export MEDIA_SERVER_WEBHOOK_URL="${MEDIA_SERVER_WEBHOOK_URL:-http://host.docker.internal:${PORT:-3000}}"
	export S3_PUBLIC_ENDPOINT="$s3_public_endpoint"
	export S3_INTERNAL_ENDPOINT="${S3_INTERNAL_ENDPOINT:-http://localhost:3900}"

	exec pnpm dev:web
fi

portless alias "$PORTLESS_S3_APP_NAME" "${PORTLESS_S3_PORT:-3900}"
exec portless --name "$PORTLESS_APP_NAME" env CAP_PORTLESS_CHILD=1 bash "$script_path"
