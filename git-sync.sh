#!/bin/bash

# Script to group git commit and push functionalities
# Usage: ./git-sync.sh "your commit message"

COMMIT_MESSAGE=$1

if [ -z "$COMMIT_MESSAGE" ]; then
  echo "Error: Please provide a commit message."
  echo "Usage: ./git-sync.sh \"your commit message\""
  exit 1
fi

echo "Staging all changes..."
git add .

echo "Committing with message: $COMMIT_MESSAGE"
git commit -m "$COMMIT_MESSAGE"

echo "Pushing changes to remote..."
git push

echo "Successfully synced with git!"
