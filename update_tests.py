#!/usr/bin/env python3
"""
Script to update all test files with MinimalForwarder support for EIP-2771 meta-transactions
"""

import re
import os
from pathlib import Path

def update_test_file(filepath):
    """Update a single test file with MinimalForwarder integration"""
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Step 1: Add MinimalForwarder import if not present
    if 'MinimalForwarder' not in content:
        # Find the last import statement
        import_pattern = r'(import "[^"]+";)'
        imports = list(re.finditer(import_pattern, content))
        if imports:
            last_import = imports[-1]
            insert_pos = last_import.end()
            content = (content[:insert_pos] + 
                      '\nimport "@openzeppelin/contracts/metatx/MinimalForwarder.sol";' +
                      content[insert_pos:])
    
    # Step 2: Add forwarder variable declaration in contract
    if 'MinimalForwarder' in content and 'MinimalForwarder public forwarder' not in content:
        # Find contract declaration
        contract_pattern = r'contract\s+\w+\s+is\s+Test\s*\{'
        match = re.search(contract_pattern, content)
        if match:
            # Find first variable declaration after contract start
            start_pos = match.end()
            # Look for existing variable declarations
            var_pattern = r'(\n\s+\w+\s+public\s+\w+;)'
            var_match = re.search(var_pattern, content[start_pos:])
            if var_match:
                insert_pos = start_pos + var_match.end()
                content = (content[:insert_pos] + 
                          '\n    MinimalForwarder public forwarder;' +
                          content[insert_pos:])
    
    # Step 3: Deploy forwarder in setUp function
    if 'MinimalForwarder' in content and 'forwarder = new MinimalForwarder()' not in content:
        # Find setUp function
        setup_pattern = r'function setUp\(\) public \{[^}]*'
        match = re.search(setup_pattern, content, re.DOTALL)
        if match:
            setup_end = match.end()
            # Find a good insertion point (after token deployments)
            insert_pattern = r'(weth = new MockERC20[^;]+;)'
            insert_match = re.search(insert_pattern, content[:setup_end])
            if insert_match:
                insert_pos = insert_match.end()
                content = (content[:insert_pos] + 
                          '\n        \n        // Deploy MinimalForwarder for EIP-2771 meta-transactions\n        forwarder = new MinimalForwarder();' +
                          content[insert_pos:])
    
    # Step 4: Update DexCore constructor calls
    # Pattern: new DexCore(arg1, arg2)
    content = re.sub(
        r'new DexCore\(([^,]+),\s*([^)]+)\)',
        r'new DexCore(\1, \2, address(forwarder))',
        content
    )
    
    # Step 5: Update DEXRouter constructor calls
    content = re.sub(
        r'new DEXRouter\(([^,]+),\s*([^)]+)\)',
        r'new DEXRouter(\1, \2, address(forwarder))',
        content
    )
    
    # Step 6: Update FlashSwap constructor calls
    content = re.sub(
        r'new FlashSwap\(([^)]+)\)',
        r'new FlashSwap(\1, address(forwarder))',
        content
    )
    
    # Only write if content changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

def main():
    """Update all test files in the test directory"""
    test_dir = Path('test')
    updated_files = []
    
    for test_file in test_dir.glob('*.t.sol'):
        if update_test_file(test_file):
            updated_files.append(test_file.name)
            print(f"✓ Updated {test_file.name}")
        else:
            print(f"- Skipped {test_file.name} (no changes needed)")
    
    print(f"\n✓ Updated {len(updated_files)} test files")
    if updated_files:
        print("Updated files:")
        for f in updated_files:
            print(f"  - {f}")

if __name__ == '__main__':
    main()
