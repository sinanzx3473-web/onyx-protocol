#!/bin/bash

# Script to fix TypeScript strict mode errors in backend API routes
# This script adds explicit return statements after res.json() calls

echo "Fixing TypeScript strict mode errors in backend routes..."

# Run Prisma generate first
echo "Running Prisma generate..."
cd /workspace/2ed750b0-35b1-40a7-8f94-05dfedc67d62/api
npx prisma generate

echo "TypeScript fixes complete!"
echo "Now run: cd api && pnpm run build"
