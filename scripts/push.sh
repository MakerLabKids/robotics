#!/bin/sh
# Push main to GitHub (MakerLabKids/robotics) with the token in /workspace/.env
# (variable makerlabkids_robotics). The token never reaches the output or git config.
set -e
ENV_FILE="${ENV_FILE:-/workspace/.env}"
set -a; . "$ENV_FILE"; set +a
cd "$(dirname "$0")/.."
git -c credential.helper= -c credential.helper='!f() { echo username=x-access-token; echo "password=$makerlabkids_robotics"; }; f' \
  push origin main 2>&1 | sed "s/$makerlabkids_robotics/<token>/g"
