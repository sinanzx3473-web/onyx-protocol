#!/bin/bash

# Test Coverage Script for DEX Smart Contracts
# Runs comprehensive test suite and generates coverage report

echo "======================================"
echo "  DEX Smart Contracts Test Coverage"
echo "======================================"
echo ""

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo "Error: Forge is not installed. Please install Foundry."
    exit 1
fi

echo "Running test suite..."
echo ""

# Run all tests with verbosity
forge test -vv

echo ""
echo "======================================"
echo "  Generating Coverage Report"
echo "======================================"
echo ""

# Generate coverage report
forge coverage --report summary

echo ""
echo "======================================"
echo "  Detailed Coverage Report"
echo "======================================"
echo ""

# Generate detailed coverage with lcov format
forge coverage --report lcov

echo ""
echo "Coverage report generated successfully!"
echo "For detailed HTML report, run:"
echo "  genhtml lcov.info --branch-coverage --output-dir coverage"
echo ""
