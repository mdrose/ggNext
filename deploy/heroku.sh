#!/usr/bin/env bash
set -e

SCRIPT_DIR=$(readlink -f $(dirname ${BASH_SOURCE}))
cp -r $SCRIPT_DIR/../ggNext deployment
cp $SCRIPT_DIR/../package.json deployment/
cp $SCRIPT_DIR/../package-lock.json deployment/

cd $SCRIPT_DIR/deployment
git init
git add .
git commit -m 'deployment'
heroku git:remote -a ggnext
git push --force heroku master
