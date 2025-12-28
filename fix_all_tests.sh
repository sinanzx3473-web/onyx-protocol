#!/bin/bash

# Script to fix all test files for EIP-2771 meta-transaction support

echo "Fixing test files for EIP-2771 support..."

# List of test files that need updating
cd test

# Fix each file individually with precise sed commands
for file in *.t.sol; do
    echo "Processing $file..."
    
    # Fix DexCore constructor calls - handle various spacing patterns
    sed -i 's/new DexCore(address(factory), address(weth))/new DexCore(address(factory), address(weth), address(forwarder))/g' "$file"
    sed -i 's/new DexCore(factory, address(weth))/new DexCore(factory, address(weth), address(forwarder))/g' "$file"
    sed -i 's/new DexCore(address(this), address(weth))/new DexCore(address(this), address(weth), address(forwarder))/g' "$file"
    sed -i 's/new DexCore(address(0x1234), address(weth))/new DexCore(address(0x1234), address(weth), address(forwarder))/g' "$file"
    sed -i 's/new DexCore(factory, weth)/new DexCore(factory, weth, address(forwarder))/g' "$file"
    
    # Fix cases with address(0) for testing
    sed -i 's/new DexCore(address(0), address(weth), address(forwarder))/new DexCore(address(0), address(weth), address(forwarder))/g' "$file"
    sed -i 's/new DexCore(address(this), address(0), address(forwarder))/new DexCore(address(this), address(0), address(forwarder))/g' "$file"
    
    # Fix DEXRouter constructor calls
    sed -i 's/new DEXRouter(address(factory), address(weth))/new DEXRouter(address(factory), address(weth), address(forwarder))/g' "$file"
    sed -i 's/new DEXRouter(address(factory), weth)/new DEXRouter(address(factory), weth, address(forwarder))/g' "$file"
    sed -i 's/new DEXRouter(address(factory), address(dexCore))/new DEXRouter(address(factory), address(dexCore), address(forwarder))/g' "$file"
    
    # Fix FlashSwap constructor calls
    sed -i 's/new FlashSwap(address(dexCore))/new FlashSwap(address(dexCore), address(forwarder))/g' "$file"
    sed -i 's/new FlashSwap(address(0))/new FlashSwap(address(0), address(forwarder))/g' "$file"
done

echo "✓ All test files updated!"
