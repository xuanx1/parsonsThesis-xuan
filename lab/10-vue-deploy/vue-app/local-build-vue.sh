#!/bin/bash

## VUE DEPLOYMENT SCRIPT
## Deploys the /dist directory to the 'gh-pages' branch of the repository.

# Exit immediately if a command exits with a non-zero status
set -e

# Ensure the build directory exists
echo "Building the Vue app..."
npm run build

# Navigate to the /dist directory
cd dist

# Initialize a temporary Git repository
echo "Initializing a temporary Git repository..."
git init
git checkout -b main

# Add and commit all files
git add .
git commit -m "Deploy to gh-pages"

# Add the remote repository
echo "Adding remote repository..."
git remote add origin $URL

# Push to the 'gh-pages' branch
echo "Pushing to gh-pages branch..."
git push -f origin main:gh-pages

# Clean up
echo "Cleaning up..."
rm -rf .git

# Return to the project root
cd ..

echo "Deployment complete!"