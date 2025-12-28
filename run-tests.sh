#!/bin/bash

# Test Runner Script for DEX Smart Contracts
# Runs all test suites with different verbosity levels

echo "======================================"
echo "  DEX Smart Contracts Test Runner"
echo "======================================"
echo ""

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo "Error: Forge is not installed. Please install Foundry."
    exit 1
fi

# Parse command line arguments
VERBOSITY="-vv"
SPECIFIC_TEST=""
GAS_REPORT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSITY="-vvv"
            shift
            ;;
        -vv|--very-verbose)
            VERBOSITY="-vvvv"
            shift
            ;;
        -t|--test)
            SPECIFIC_TEST="--match-test $2"
            shift 2
            ;;
        -c|--contract)
            SPECIFIC_TEST="--match-contract $2"
            shift 2
            ;;
        -g|--gas)
            GAS_REPORT=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./run-tests.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose           Verbose output (-vvv)"
            echo "  -vv, --very-verbose     Very verbose output (-vvvv)"
            echo "  -t, --test <name>       Run specific test"
            echo "  -c, --contract <name>   Run tests for specific contract"
            echo "  -g, --gas               Show gas report"
            echo "  -h, --help              Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run-tests.sh                          # Run all tests"
            echo "  ./run-tests.sh -v                       # Run with verbose output"
            echo "  ./run-tests.sh -t testSwap              # Run specific test"
            echo "  ./run-tests.sh -c DexCoreTest           # Run DexCore tests"
            echo "  ./run-tests.sh -g                       # Run with gas report"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

echo "Running tests with options:"
echo "  Verbosity: $VERBOSITY"
if [ -n "$SPECIFIC_TEST" ]; then
    echo "  Filter: $SPECIFIC_TEST"
fi
if [ "$GAS_REPORT" = true ]; then
    echo "  Gas Report: Enabled"
fi
echo ""

# Build command
CMD="forge test $VERBOSITY $SPECIFIC_TEST"

if [ "$GAS_REPORT" = true ]; then
    CMD="$CMD --gas-report"
fi

# Run tests
eval $CMD

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "  All Tests Passed! ✓"
    echo "======================================"
else
    echo ""
    echo "======================================"
    echo "  Some Tests Failed! ✗"
    echo "======================================"
    exit 1
fi
