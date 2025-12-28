#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# Post-Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Runs after successful deployment to:
# 1. Copy deployment metadata to frontend
# 2. Update contract addresses in frontend config
# 3. Generate TypeScript types from ABIs
# 4. Create deployment summary
#
# Usage:
#   ./scripts/post-deploy.sh <chain>
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_ROOT="$PROJECT_ROOT/contracts"

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

copy_metadata_to_frontend() {
    local chain=$1
    local deploy_dir="$CONTRACTS_ROOT/deployments/$chain"
    local frontend_dir="$PROJECT_ROOT/src"
    
    if [ ! -f "$deploy_dir/metadata.json" ]; then
        echo "No metadata found for $chain"
        return 1
    fi
    
    print_info "Copying deployment metadata to frontend..."
    
    # Copy metadata.json
    cp "$deploy_dir/metadata.json" "$frontend_dir/metadata.json"
    
    print_success "Metadata copied to src/metadata.json"
}

copy_abis_to_frontend() {
    local frontend_dir="$PROJECT_ROOT/src/abis"
    local contracts_out="$CONTRACTS_ROOT/out"
    
    print_info "Copying contract ABIs to frontend..."
    
    mkdir -p "$frontend_dir"
    
    # Copy ABIs from Foundry output
    for contract in DexCore DEXFactory DEXRouter DEXPair FlashSwap BridgeAdapter LPToken; do
        local abi_file="$contracts_out/${contract}.sol/${contract}.json"
        
        if [ -f "$abi_file" ]; then
            jq '.abi' "$abi_file" > "$frontend_dir/${contract}.json"
            print_success "Copied ${contract} ABI"
        fi
    done
}

generate_deployment_summary() {
    local chain=$1
    local deploy_dir="$CONTRACTS_ROOT/deployments/$chain"
    local summary_file="$deploy_dir/DEPLOYMENT_SUMMARY.md"
    
    print_info "Generating deployment summary..."
    
    cat > "$summary_file" <<EOF
# Deployment Summary - $chain

**Deployed at:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## Contract Addresses

EOF
    
    # Read addresses from metadata
    if [ -f "$deploy_dir/metadata.json" ]; then
        jq -r '.contracts | to_entries[] | "- **\(.key)**: \`\(.value.address)\`"' "$deploy_dir/metadata.json" >> "$summary_file"
    fi
    
    cat >> "$summary_file" <<EOF

## Verification Status

EOF
    
    # Add verification status
    if [ -f "$deploy_dir/metadata.json" ]; then
        jq -r '.contracts | to_entries[] | "- **\(.key)**: \(if .value.verified then "✓ Verified" else "⏳ Pending" end)"' "$deploy_dir/metadata.json" >> "$summary_file"
    fi
    
    cat >> "$summary_file" <<EOF

## Next Steps

1. **Verify Contracts** (if not auto-verified):
   \`\`\`bash
   ./scripts/verify-contract.sh $chain <contract_name> <address>
   \`\`\`

2. **Initialize Protocol**:
   - Set fee parameters
   - Configure admin roles
   - Create initial liquidity pairs

3. **Test Integration**:
   - Run frontend with deployed contracts
   - Test swap functionality
   - Verify flash swap operations

4. **Monitor**:
   - Check block explorer for contract activity
   - Monitor gas usage
   - Track liquidity metrics

## Resources

- Block Explorer: $(get_explorer_url "$chain")
- Deployment Metadata: \`deployments/$chain/metadata.json\`
- Contract ABIs: \`src/abis/\`

EOF
    
    print_success "Deployment summary created: $summary_file"
}

get_explorer_url() {
    local chain=$1
    
    case $chain in
        mainnet) echo "https://etherscan.io" ;;
        sepolia) echo "https://sepolia.etherscan.io" ;;
        arbitrum) echo "https://arbiscan.io" ;;
        optimism) echo "https://optimistic.etherscan.io" ;;
        base) echo "https://basescan.org" ;;
        polygon) echo "https://polygonscan.com" ;;
        bnb_smart_chain) echo "https://bscscan.com" ;;
        avalanche) echo "https://snowtrace.io" ;;
        gnosis_chain) echo "https://gnosisscan.io" ;;
        *) echo "N/A" ;;
    esac
}

update_env_example() {
    local chain=$1
    local deploy_dir="$CONTRACTS_ROOT/deployments/$chain"
    
    print_info "Updating .env.example with deployed addresses..."
    
    if [ -f "$deploy_dir/metadata.json" ]; then
        local dexcore=$(jq -r '.contracts.DexCore.address // ""' "$deploy_dir/metadata.json")
        local factory=$(jq -r '.contracts.DEXFactory.address // ""' "$deploy_dir/metadata.json")
        local router=$(jq -r '.contracts.DEXRouter.address // ""' "$deploy_dir/metadata.json")
        local flashswap=$(jq -r '.contracts.FlashSwap.address // ""' "$deploy_dir/metadata.json")
        local bridge=$(jq -r '.contracts.BridgeAdapter.address // ""' "$deploy_dir/metadata.json")
        
        cat >> "$PROJECT_ROOT/.env.example" <<EOF

# Deployed Contract Addresses ($chain)
# VITE_DEXCORE_ADDRESS=$dexcore
# VITE_FACTORY_ADDRESS=$factory
# VITE_ROUTER_ADDRESS=$router
# VITE_FLASHSWAP_ADDRESS=$flashswap
# VITE_BRIDGE_ADDRESS=$bridge
EOF
        
        print_success "Updated .env.example"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    local chain=$1
    
    if [ -z "$chain" ]; then
        echo "Usage: $0 <chain>"
        exit 1
    fi
    
    echo "Running post-deployment tasks for $chain..."
    echo ""
    
    copy_metadata_to_frontend "$chain"
    copy_abis_to_frontend
    generate_deployment_summary "$chain"
    update_env_example "$chain"
    
    echo ""
    print_success "Post-deployment tasks completed!"
    echo ""
    echo "Next steps:"
    echo "1. Review deployment summary: contracts/deployments/$chain/DEPLOYMENT_SUMMARY.md"
    echo "2. Update frontend .env with contract addresses"
    echo "3. Test the application with deployed contracts"
}

main "$@"
