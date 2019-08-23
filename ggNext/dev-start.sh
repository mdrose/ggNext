#!/usr/bin/env bash
source ./dev.settings
export GGNEXT_URL=$GGNEXT_DEV_URL
export GGNEXT_CLIENT_ID=$GGNEXT_DEV_CLIENT_ID
export GGNEXT_CLIENT_SECRET=$GGNEXT_DEV_CLIENT_SECRET

if [ "$GGNEXT_ENV" != "test" ]; then
    export GGNEXT_MONGODB_DBNAME=$GGNEXT_DEV_MONGODB_DBNAME
    export GGNEXT_MONGODB_URI=$GGNEXT_DEV_MONGODB_URI$GGNEXT_MONGODB_DBNAME
    echo "Starting Development Environment"
    npx babel --watch ggNext/client/src --out-dir ggNext/client --presets @babel/preset-react &
    npx nodemon --ignore client/ --exec node --inspect=0.0.0.0 ggNext/app.js
elif [ "$GGNEXT_ENV" = "test" ]; then
    export GGNEXT_MONGODB_DBNAME="test"
    export GGNEXT_MONGODB_URI=$GGNEXT_DEV_MONGODB_URI$GGNEXT_MONGODB_DBNAME
    echo "Running tests"
    npx jest --detectOpenHandles --coverage
    mongoshell/bin/mongo $GGNEXT_MONGODB_URI -eval "db.dropDatabase()"
fi
