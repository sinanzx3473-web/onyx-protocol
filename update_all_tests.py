#!/usr/bin/env python3
"""
Comprehensive script to update ALL test files with MinimalForwarder support for EIP-2771
"""

import re
from pathlib import Path

# Mapping of files to their specific constructor patterns
TEST_FILES = {
    "DEXPairFeeOnTransfer.t.sol": [
        ("new DEXRouter(address(factory), weth)", "new DEXRouter(address(factory), weth, address(forwarder))"),
    ],
    "DEXRouter.t.sol": [
        ("new DEXRouter(address(factory), address(weth))", "new DEXRouter(address(factory), address(weth), address(forwarder))"),
    ],
    "EventEmission.t.sol": [
        ("new DexCore(address(this), address(weth))", "new DexCore(address(this), address(weth), address(forwarder))"),
    ],
    "FeeOnTransferToken.t.sol": [
        ("new DexCore(factory, weth)", "new DexCore(factory, weth, address(forwarder))"),
    ],
    "FlashLoanFeeDistribution.t.sol": [
        ("new DexCore(factory, weth)", "new DexCore(factory, weth, address(forwarder))"),
        ("new FlashSwap(address(dexCore))", "new FlashSwap(address(dexCore), address(forwarder))"),
    ],
    "FlashLoanHardening.t.sol": [
        ("new DexCore(factory, weth)", "new DexCore(factory, weth, address(forwarder))"),
        ("new FlashSwap(address(dexCore))", "new FlashSwap(address(dexCore), address(forwarder))"),
    ],
    "FlashSwap.t.sol": [
        ("new DexCore(factory, weth)", "new DexCore(factory, weth, address(forwarder))"),
        ("new FlashSwap(address(dexCore))", "new FlashSwap(address(dexCore), address(forwarder))"),
    ],
    "FuzzTests.t.sol": [
        ("new DexCore(address(factory), address(weth))", "new DexCore(address(factory), address(weth), address(forwarder))"),
        ("new DEXRouter(address(factory), address(weth))", "new DEXRouter(address(factory), address(weth), address(forwarder))"),
    ],
    "GasOptimization.t.sol": [
        ("new DexCore(address(factory), address(weth))", "new DexCore(address(factory), address(weth), address(forwarder))"),
        ("new DEXRouter(address(factory), address(weth))", "new DEXRouter(address(factory), address(weth), address(forwarder))"),
    ],
    "GovernanceTimelock.t.sol": [
        ("new DexCore(address(factory), address(weth))", "new DexCore(address(factory), address(weth), address(forwarder))"),
        ("new FlashSwap(address(dexCore))", "new FlashSwap(address(dexCore), address(forwarder))"),
    ],
    "IntegrationTests.t.sol": [
        ("new DexCore(address(factory), address(weth))", "new DexCore(address(factory), address(weth), address(forwarder))"),
        ("new DEXRouter(address(factory), address(weth))", "new DEXRouter(address(factory), address(weth), address(forwarder))"),
        ("new FlashSwap(address(dexCore))", "new FlashSwap(address(dexCore), address(forwarder))"),
    ],
    "LPToken.t.sol": [
        ("new DexCore(factory, address(weth))", "new DexCore(factory, address(weth), address(forwarder))"),
    ],
    "LiquidityFlows.t.sol": [
        ("new DexCore(address(factory), address(weth))", "new DexCore(address(factory), address(weth), address(forwarder))"),
    ],
    "LowSeverityFixes.t.sol": [
        ("new DexCore(address(this), address(weth))", "new DexCore(address(this), address(weth), address(forwarder))"),
        ("new FlashSwap(address(dexCore))", "new FlashSwap(address(dexCore), address(forwarder))"),
        ("new DexCore(address(0), address(weth))", "new DexCore(address(0), address(weth), address(forwarder))"),
        ("new DexCore(address(this), address(0))", "new DexCore(address(this), address(0), address(forwarder))"),
        ("new FlashSwap(address(0))", "new FlashSwap(address(0), address(forwarder))"),
    ],
    "PermitIntegration.t.sol": [
        ("new DexCore(address(factory), address(weth))", "new DexCore(address(factory), address(weth), address(forwarder))"),
    ],
    "ProtocolFeeCap.t.sol": [
        ("new DexCore(address(0x1234), address(weth))", "new DexCore(address(0x1234), address(weth), address(forwarder))"),
    ],
    "RegressionTests.t.sol": [
        ("new DexCore(address(factory), address(weth))", "new DexCore(address(factory), address(weth), address(forwarder))"),
        ("new DEXRouter(address(factory), address(dexCore))", "new DEXRouter(address(factory), address(dexCore), address(forwarder))"),
    ],
    "SlippageProtection.t.sol": [
        ("new DEXRouter(address(factory), address(weth))", "new DEXRouter(address(factory), address(weth), address(forwarder))"),
    ],
    "SqrtPrecision.t.sol": [
        ("new DexCore(address(0x1234), address(weth))", "new DexCore(address(0x1234), address(weth), address(forwarder))"),
    ],
}

def update_test_file(filepath, replacements):
    """Update a test file with specified replacements"""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Apply all replacements
    for old_pattern, new_pattern in replacements:
        content = content.replace(old_pattern, new_pattern)
    
    # Only write if content changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    test_dir = Path('test')
    updated_count = 0
    
    for filename, replacements in TEST_FILES.items():
        filepath = test_dir / filename
        if filepath.exists():
            if update_test_file(filepath, replacements):
                print(f"✓ Updated {filename}")
                updated_count += 1
            else:
                print(f"- Skipped {filename} (already updated or no changes)")
        else:
            print(f"✗ Not found: {filename}")
    
    print(f"\n✓ Updated {updated_count}/{len(TEST_FILES)} test files")

if __name__ == '__main__':
    main()
