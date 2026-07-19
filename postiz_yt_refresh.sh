#!/usr/bin/env bash
# postiz_yt_refresh.sh — make Postiz able to auto-publish to YouTube on this localhost install.
# Run this RIGHT BEFORE post_to_postiz.py publishes (the access token lasts ~1h and a video can take
# longer to produce, so refreshing at run-start is not enough — refresh immediately before posting).
#
# It fixes the three self-hosted-localhost bugs that otherwise leave posts stuck on a manual "Post" click:
#   1) media forwarder: the publisher fetches media from http://localhost:4007 but inside the container
#      nothing listens on 4007 (host 4007 -> container 5000). Start an in-container 4007->5000 forwarder.
#   2) stale OAuth: Postiz's own token refresh isn't firing -> it sets refreshNeeded and errors with
#      "reconnect your YouTube account". Mint a fresh access token from Google with the stored refresh
#      token and write it into Postiz's DB, clearing refreshNeeded.
#   (3) the dead Temporal worker is handled separately by ensure_postiz.ps1 restarting the orchestrator.)
set -uo pipefail

PG="docker exec postiz-postgres psql -U postiz-user -d postiz-db-local -t -A"

# 1) ensure the in-container media forwarder is up (idempotent; a 2nd listener just EADDRINUSE-exits)
docker exec -d postiz node -e 'const net=require("net");net.createServer(c=>{const u=net.connect(5000,"127.0.0.1");c.pipe(u);u.pipe(c);u.on("error",()=>c.destroy());c.on("error",()=>u.destroy())}).listen(4007,"127.0.0.1")' 2>/dev/null || true

# 2) refresh the YouTube OAuth token and write it back
CID=$(docker exec postiz printenv YOUTUBE_CLIENT_ID 2>/dev/null | tr -d '\r\n')
CSEC=$(docker exec postiz printenv YOUTUBE_CLIENT_SECRET 2>/dev/null | tr -d '\r\n')
RT=$($PG -c "SELECT \"refreshToken\" FROM \"Integration\" WHERE \"providerIdentifier\"='youtube' AND \"refreshToken\" IS NOT NULL ORDER BY \"updatedAt\" DESC LIMIT 1;" 2>/dev/null | tr -d '\r\n')

if [ -z "$CID" ] || [ -z "$RT" ]; then
  echo "yt-refresh: ERROR missing client id / refresh token (is a YouTube channel connected?)"; exit 1
fi

AT=$(curl -s -X POST https://oauth2.googleapis.com/token \
      -d "client_id=$CID" -d "client_secret=$CSEC" \
      -d "refresh_token=$RT" -d "grant_type=refresh_token" \
     | python -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -z "$AT" ]; then
  echo "yt-refresh: ERROR Google refused the refresh token. It is likely revoked/expired."
  echo "           -> Reconnect YouTube once in the Postiz UI (http://localhost:4007 -> channel -> reconnect)."
  exit 1
fi

$PG -c "UPDATE \"Integration\" SET token='$AT', \"tokenExpiration\"=NOW()+interval '55 minutes', \"refreshNeeded\"=false, disabled=false WHERE \"providerIdentifier\"='youtube';" >/dev/null 2>&1
echo "yt-refresh: OK (fresh YouTube token written, refreshNeeded cleared, media forwarder up)"
