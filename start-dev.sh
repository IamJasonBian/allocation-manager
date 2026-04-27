#!/bin/bash

# Kill any process using port 8888
echo "Checking for processes using port 8888..."
PID=$(lsof -ti :8888)

if [ -n "$PID" ]; then
  echo "Found process $PID using port 8888. Killing it..."
  kill -9 $PID
  sleep 1
  
  # Verify the process was killed
  if ps -p $PID > /dev/null; then
    echo "Failed to kill process $PID"
    exit 1
  else
    echo "Successfully killed process $PID"
  fi
else
  echo "No processes found using port 8888"
fi

# Start the Netlify development server
echo "Starting Netlify development server..."
npx netlify dev
