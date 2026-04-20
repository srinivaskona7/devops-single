#!/bin/sh
# Substitute only ${BACKEND_URL} — leave nginx variables like $host, $http_upgrade intact
set -e
BACKEND_URL="${BACKEND_URL:-backend:8100}"
export BACKEND_URL
envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec "$@"
