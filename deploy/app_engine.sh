#!/usr/bin/env bash
set -e

SCRIPT_DIR=$(readlink -f $(dirname ${BASH_SOURCE}))
cp -r $SCRIPT_DIR/../ggNext deployment
cp $SCRIPT_DIR/../package.json deployment/
cp $SCRIPT_DIR/../package-lock.json deployment/
cp $SCRIPT_DIR/.gcloudignore deployment/

cd $SCRIPT_DIR/deployment
npm ci
npm run build

# Generates app.yaml
set -a
source $SCRIPT_DIR/../prod.settings
envsubst < $SCRIPT_DIR/app.template > $SCRIPT_DIR/deployment/app.yaml

# GO GO GO
gcloud app deploy
