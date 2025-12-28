#!/bin/bash
set -e

echo "Running comprehensive test coverage analysis..."
forge coverage --report summary 2>&1 | tee coverage-output.txt
