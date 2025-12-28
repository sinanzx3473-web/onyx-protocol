#!/bin/bash

# Script to update all test files with new constructor parameters for EIP-2771 support

# Find all test files
find test -name "*.t.sol" -type f | while read file; do
    echo "Processing $file..."
    
    # Add MinimalForwarder import if not present
    if ! grep -q "import.*MinimalForwarder" "$file"; then
        sed -i '/import "forge-std\/Test.sol";/a import "../src/MinimalForwarder.sol";' "$file"
    fi
    
    # Add forwarder variable declaration in setUp if DexCore/DEXRouter/FlashSwap are present
    if grep -q "DexCore\|DEXRouter\|FlashSwap" "$file"; then
        # Add forwarder declaration after other contract declarations
        if ! grep -q "MinimalForwarder.*forwarder" "$file"; then
            sed -i '/MockERC20.*weth;/a \    MinimalForwarder public forwarder;' "$file"
        fi
        
        # Deploy forwarder in setUp
        if ! grep -q "forwarder = new MinimalForwarder" "$file"; then
            sed -i '/weth = new MockERC20/a \        forwarder = new MinimalForwarder();' "$file"
        fi
    fi
    
    # Update DexCore constructor calls
    sed -i 's/new DexCore(\([^,]*\), \([^)]*\))/new DexCore(\1, \2, address(forwarder))/g' "$file"
    
    # Update DEXRouter constructor calls
    sed -i 's/new DEXRouter(\([^,]*\), \([^)]*\))/new DEXRouter(\1, \2, address(forwarder))/g' "$file"
    
    # Update FlashSwap constructor calls
    sed -i 's/new FlashSwap(\([^)]*\))/new FlashSwap(\1, address(forwarder))/g' "$file"
done

echo "All test files updated!"
