#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# Contract Verification Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Verifies deployed contracts on block explorers (Etherscan, Arbiscan, etc.)
#
# Usage:
#   ./scripts/verify-contract.sh <chain> <contract_name> <contract_address> [constructor_args]
#
# Examples:
#   ./scripts/verify-contract.sh sepolia DexCore 0x1234...
#   ./scripts/verify-contract.sh mainnet DEXFactory 0x5678...
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

declare -A EXPLORER_URLS=(
    ["mainnet"]="https://api.etherscan.io/api"
    ["sepolia"]="https://api-sepolia.etherscan.io/api"
    ["arbitrum"]="https://api.arbiscan.io/api"
    ["optimism"]="https://api-optimistic.etherscan.io/api"
    ["base"]="https://api.basescan.org/api"
    ["polygon"]="https://api.polygonscan.com/api"
    ["bnb_smart_chain"]="https://api.bscscan.com/api"
    ["avalanche"]="https://api.snowtrace.io/api"
    ["gnosis_chain"]="https://api.gnosisscan.io/api"
)

declare -A EXPLORER_KEYS=(
    ["mainnet"]="$ETHERSCAN_API_KEY"
    ["sepolia"]="$ETHERSCAN_API_KEY"
    ["arbitrum"]="$ARBISCAN_API_KEY"
    ["optimism"]="$OPTIMISM_API_KEY"
    ["base"]="$BASESCAN_API_KEY"
    ["polygon"]="$POLYGONSCAN_API_KEY"
    ["bnb_smart_chain"]="$BSCSCAN_API_KEY"
    ["avalanche"]="$SNOWTRACE_API_KEY"
    ["gnosis_chain"]="$GNOSISSCAN_API_KEY"
)

declare -A CHAIN_IDS=(
    ["mainnet"]="1"
    ["sepolia"]="11155111"
    ["arbitrum"]="42161"
    ["optimism"]="10"
    ["base"]="8453"
    ["polygon"]="137"
    ["bnb_smart_chain"]="56"
    ["avalanche"]="43114"
    ["gnosis_chain"]="100"
)

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

get_contract_path() {
    local contract_name=$1
    
    case $contract_name in
        "DexCore") echo "src/DexCore.sol:DexCore" ;;
        "DEXFactory") echo "src/DEXFactory.sol:DEXFactory" ;;
        "DEXRouter") echo "src/DEXRouter.sol:DEXRouter" ;;
        "DEXPair") echo "src/DEXPair.sol:DEXPair" ;;
        "FlashSwap") echo "src/FlashSwap.sol:FlashSwap" ;;
        "BridgeAdapter") echo "src/BridgeAdapter.sol:BridgeAdapter" ;;
        "LPToken") echo "src/LPToken.sol:LPToken" ;;
        "MockERC20") echo "src/MockERC20.sol:MockERC20" ;;
        *) echo "" ;;
    esac
}

get_constructor_args() {
    local contract_name=$1
    local chain=$2
    
    # Read deployment metadata to get constructor arguments
    local deploy_dir="$PROJECT_ROOT/deployments/$chain"
    local metadata_file="$deploy_dir/metadata.json"
    
    if [ -f "$metadata_file" ]; then
        # Extract constructor args from metadata if available
        # This is a placeholder - actual implementation would parse from deployment artifacts
        echo ""
    else
        echo ""
    fi
}

verify_with_forge() {
    local chain=$1
    local contract_name=$2
    local contract_address=$3
    local constructor_args=$4
    
    local contract_path=$(get_contract_path "$contract_name")
    
    if [ -z "$contract_path" ]; then
        print_error "Unknown contract: $contract_name"
        return 1
    fi
    
    local explorer_key="${EXPLORER_KEYS[$chain]}"
    
    if [ -z "$explorer_key" ]; then
        print_error "No explorer API key configured for $chain"
        return 1
    fi
    
    print_info "Verifying $contract_name at $contract_address on $chain..."
    
    cd "$PROJECT_ROOT"
    
    # Build verification command
    local verify_cmd="forge verify-contract \
        --chain-id ${CHAIN_IDS[$chain]} \
        --compiler-version v0.8.29 \
        --optimizer-runs 200 \
        --etherscan-api-key $explorer_key \
        $contract_address \
        $contract_path"
    
    # Add constructor args if provided
    if [ -n "$constructor_args" ]; then
        verify_cmd="$verify_cmd --constructor-args $constructor_args"
    fi
    
    # Execute verification
    local output=$(eval $verify_cmd 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        print_success "$contract_name verified successfully!"
        
        # Update metadata to mark as verified
        update_verification_status "$chain" "$contract_name" "true"
        
        return 0
    else
        # Check if already verified
        if echo "$output" | grep -q "already verified"; then
            print_warning "$contract_name is already verified"
            update_verification_status "$chain" "$contract_name" "true"
            return 0
        else
            print_error "Verification failed for $contract_name"
            echo "$output"
            return 1
        fi
    fi
}

update_verification_status() {
    local chain=$1
    local contract_name=$2
    local verified=$3
    
    local deploy_dir="$PROJECT_ROOT/deployments/$chain"
    local metadata_file="$deploy_dir/metadata.json"
    
    if [ -f "$metadata_file" ]; then
        # Update verification status in metadata
        local temp_file=$(mktemp)
        jq ".contracts.${contract_name}.verified = ${verified}" "$metadata_file" > "$temp_file"
        mv "$temp_file" "$metadata_file"
        
        print_info "Updated verification status in metadata"
    fi
}

check_verification_status() {
    local chain=$1
    local contract_address=$2
    
    local explorer_url="${EXPLORER_URLS[$chain]}"
    local explorer_key="${EXPLORER_KEYS[$chain]}"
    
    if [ -z "$explorer_url" ] || [ -z "$explorer_key" ]; then
        return 1
    fi
    
    # Query explorer API
    local response=$(curl -s "${explorer_url}?module=contract&action=getsourcecode&address=${contract_address}&apikey=${explorer_key}")
    
    # Check if source code is verified
    if echo "$response" | jq -e '.result[0].SourceCode != ""' > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    local chain=$1
    local contract_name=$2
    local contract_address=$3
    local constructor_args=$4
    
    if [ -z "$chain" ] || [ -z "$contract_name" ] || [ -z "$contract_address" ]; then
        print_error "Usage: $0 <chain> <contract_name> <contract_address> [constructor_args]"
        exit 1
    fi
    
    # Validate chain
    if [ -z "${CHAIN_IDS[$chain]}" ]; then
        print_error "Unsupported chain: $chain"
        exit 1
    fi
    
    # Check if already verified
    if check_verification_status "$chain" "$contract_address"; then
        print_success "$contract_name is already verified on $chain"
        update_verification_status "$chain" "$contract_name" "true"
        exit 0
    fi
    
    # Get constructor args if not provided
    if [ -z "$constructor_args" ]; then
        constructor_args=$(get_constructor_args "$contract_name" "$chain")
    fi
    
    # Verify contract
    if verify_with_forge "$chain" "$contract_name" "$contract_address" "$constructor_args"; then
        print_success "Verification completed successfully!"
        exit 0
    else
        print_error "Verification failed!"
        exit 1
    fi
}

# Run main function
main "$@"
