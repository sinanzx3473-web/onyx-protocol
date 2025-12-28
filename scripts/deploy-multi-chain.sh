#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# Multi-Chain DEX Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
# 
# This script automates the deployment of DexCore contracts to multiple chains
# with automatic verification and deployment tracking.
#
# Usage:
#   ./scripts/deploy-multi-chain.sh <chain>
#
# Examples:
#   ./scripts/deploy-multi-chain.sh sepolia
#   ./scripts/deploy-multi-chain.sh mainnet
#   ./scripts/deploy-multi-chain.sh all
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

DEPLOYMENT_DIR="${DEPLOYMENT_DIR:-$PROJECT_ROOT/deployments}"
CONFIRMATIONS="${CONFIRMATIONS:-5}"
AUTO_VERIFY="${AUTO_VERIFY:-true}"

# Gas configuration - use dynamic gas pricing
USE_LEGACY_TX="${USE_LEGACY_TX:-false}"
PRIORITY_GAS_PRICE="${PRIORITY_GAS_PRICE:-}"  # Optional: set in .env for custom priority fee

# Supported chains
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
    ["localhost"]="31337"
    ["anvil"]="20258"
)

declare -A RPC_URLS=(
    ["mainnet"]="$MAINNET_RPC_URL"
    ["sepolia"]="$SEPOLIA_RPC_URL"
    ["arbitrum"]="$ARBITRUM_RPC_URL"
    ["optimism"]="$OPTIMISM_RPC_URL"
    ["base"]="$BASE_RPC_URL"
    ["polygon"]="$POLYGON_RPC_URL"
    ["bnb_smart_chain"]="$BSC_RPC_URL"
    ["avalanche"]="$AVALANCHE_RPC_URL"
    ["gnosis_chain"]="$GNOSIS_RPC_URL"
    ["localhost"]="$LOCALHOST_RPC_URL"
    ["anvil"]="$ANVIL_RPC_URL"
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

# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

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

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check if forge is installed
    if ! command -v forge &> /dev/null; then
        print_error "Foundry (forge) is not installed!"
        echo "Install from: https://book.getfoundry.sh/getting-started/installation"
        exit 1
    fi
    print_success "Foundry installed: $(forge --version | head -n 1)"
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        print_error "jq is not installed!"
        echo "Install with: sudo apt-get install jq (Linux) or brew install jq (Mac)"
        exit 1
    fi
    print_success "jq installed"
    
    # Check if private key is set
    if [ -z "$PRIVATE_KEY" ]; then
        print_error "PRIVATE_KEY not set in .env file!"
        exit 1
    fi
    print_success "Private key configured"
    
    echo ""
}

validate_chain() {
    local chain=$1
    
    if [ "$chain" == "all" ]; then
        return 0
    fi
    
    if [ -z "${CHAIN_IDS[$chain]}" ]; then
        print_error "Unsupported chain: $chain"
        echo "Supported chains: ${!CHAIN_IDS[@]}"
        exit 1
    fi
    
    if [ -z "${RPC_URLS[$chain]}" ]; then
        print_error "RPC URL not configured for chain: $chain"
        echo "Please set ${chain^^}_RPC_URL in .env file"
        exit 1
    fi
}

confirm_deployment() {
    local chain=$1
    
    # Always show network information
    echo ""
    print_warning "═══════════════════════════════════════════════════════════════"
    print_warning "DEPLOYMENT CONFIRMATION"
    print_warning "═══════════════════════════════════════════════════════════════"
    print_warning "Network: $chain"
    print_warning "Chain ID: ${CHAIN_IDS[$chain]}"
    print_warning "RPC URL: ${RPC_URLS[$chain]}"
    print_warning "═══════════════════════════════════════════════════════════════"
    echo ""
    
    # Require explicit confirmation (override REQUIRE_CONFIRMATION)
    read -p "Are you sure you want to deploy to $chain? Type 'yes' to continue: " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "Deployment cancelled by user"
        exit 0
    fi
    
    print_success "Deployment confirmed. Proceeding..."
    echo ""
}

create_deployment_dir() {
    local chain=$1
    local chain_dir="$DEPLOYMENT_DIR/$chain"
    
    mkdir -p "$chain_dir"
    echo "$chain_dir"
}

deploy_contracts() {
    local chain=$1
    local rpc_url="${RPC_URLS[$chain]}"
    local chain_id="${CHAIN_IDS[$chain]}"
    
    print_header "Deploying to $chain (Chain ID: $chain_id)"
    
    # Create deployment directory
    local deploy_dir=$(create_deployment_dir "$chain")
    
    # Build contracts first
    print_info "Building contracts..."
    cd "$PROJECT_ROOT"
    forge build
    
    # Deploy using forge script
    print_info "Deploying contracts..."
    
    # Get current nonce for the deployer address
    local deployer_address=$(cast wallet address --private-key $PRIVATE_KEY)
    local current_nonce=$(cast nonce $deployer_address --rpc-url $rpc_url)
    print_info "Deployer address: $deployer_address"
    print_info "Current nonce: $current_nonce"
    
    local deploy_cmd="forge script script/Deploy.s.sol:Deploy \
        --rpc-url $rpc_url \
        --private-key $PRIVATE_KEY \
        --broadcast \
        --json"
    
    # Dynamic gas configuration
    if [ "$USE_LEGACY_TX" == "true" ]; then
        # Use legacy transactions with gas price
        deploy_cmd="$deploy_cmd --legacy"
        if [ -n "$GAS_PRICE" ]; then
            deploy_cmd="$deploy_cmd --gas-price ${GAS_PRICE}gwei"
        fi
    else
        # Use EIP-1559 transactions
        if [ -n "$PRIORITY_GAS_PRICE" ]; then
            deploy_cmd="$deploy_cmd --priority-gas-price ${PRIORITY_GAS_PRICE}gwei"
        fi
        if [ -n "$MAX_FEE_PER_GAS" ]; then
            deploy_cmd="$deploy_cmd --with-gas-price ${MAX_FEE_PER_GAS}gwei"
        fi
    fi
    
    # Execute deployment
    if [ "$DRY_RUN" == "true" ]; then
        print_warning "DRY RUN MODE - No transactions will be broadcast"
        deploy_cmd="${deploy_cmd/--broadcast/}"
    fi
    
    local output=$(eval $deploy_cmd 2>&1)
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        print_error "Deployment failed!"
        echo "$output"
        return 1
    fi
    
    # Verify nonce incremented (indicates successful deployment)
    if [ "$DRY_RUN" != "true" ]; then
        local new_nonce=$(cast nonce $deployer_address --rpc-url $rpc_url)
        if [ $new_nonce -le $current_nonce ]; then
            print_warning "Nonce did not increment. Deployment may have failed."
            print_warning "Previous nonce: $current_nonce, Current nonce: $new_nonce"
        else
            print_success "Nonce incremented from $current_nonce to $new_nonce"
        fi
    fi
    
    print_success "Contracts deployed successfully!"
    
    # Parse deployment output and save addresses
    save_deployment_info "$chain" "$output" "$deploy_dir"
    
    # Wait for confirmations
    if [ "$DRY_RUN" != "true" ]; then
        print_info "Waiting for $CONFIRMATIONS confirmations..."
        sleep $((CONFIRMATIONS * 12))  # Approximate block time
    fi
    
    return 0
}

save_deployment_info() {
    local chain=$1
    local output=$2
    local deploy_dir=$3
    
    print_info "Saving deployment information..."
    
    # Extract deployment info from broadcast files
    local broadcast_dir="$PROJECT_ROOT/broadcast/Deploy.s.sol/${CHAIN_IDS[$chain]}"
    
    if [ -d "$broadcast_dir" ]; then
        local latest_run=$(ls -t "$broadcast_dir" | grep "run-latest.json" | head -1)
        
        if [ -n "$latest_run" ]; then
            local run_file="$broadcast_dir/$latest_run"
            
            # Copy broadcast file to deployment directory
            cp "$run_file" "$deploy_dir/deployment-$(date +%Y%m%d-%H%M%S).json"
            
            # Extract contract addresses
            local addresses=$(jq -r '.transactions[] | select(.transactionType == "CREATE") | {contractName: .contractName, contractAddress: .contractAddress}' "$run_file")
            
            # Save addresses to a simple JSON file
            echo "$addresses" | jq -s '.' > "$deploy_dir/addresses.json"
            
            # Create metadata.json for frontend
            create_metadata_file "$chain" "$deploy_dir/addresses.json" "$deploy_dir"
            
            print_success "Deployment info saved to: $deploy_dir"
        fi
    fi
}

create_metadata_file() {
    local chain=$1
    local addresses_file=$2
    local deploy_dir=$3
    
    # Read deployed addresses
    local factory_addr=$(jq -r '.[] | select(.contractName == "DEXFactory") | .contractAddress' "$addresses_file" 2>/dev/null || echo "")
    local router_addr=$(jq -r '.[] | select(.contractName == "DEXRouter") | .contractAddress' "$addresses_file" 2>/dev/null || echo "")
    local dexcore_addr=$(jq -r '.[] | select(.contractName == "DexCore") | .contractAddress' "$addresses_file" 2>/dev/null || echo "")
    local flashswap_addr=$(jq -r '.[] | select(.contractName == "FlashSwap") | .contractAddress' "$addresses_file" 2>/dev/null || echo "")
    local bridge_addr=$(jq -r '.[] | select(.contractName == "BridgeAdapter") | .contractAddress' "$addresses_file" 2>/dev/null || echo "")
    
    # Create metadata.json
    cat > "$deploy_dir/metadata.json" <<EOF
{
  "network": "$chain",
  "chainId": "${CHAIN_IDS[$chain]}",
  "rpc_url": "${RPC_URLS[$chain]}",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "contracts": {
    "DEXFactory": {
      "address": "$factory_addr",
      "verified": false
    },
    "DEXRouter": {
      "address": "$router_addr",
      "verified": false
    },
    "DexCore": {
      "address": "$dexcore_addr",
      "verified": false
    },
    "FlashSwap": {
      "address": "$flashswap_addr",
      "verified": false
    },
    "BridgeAdapter": {
      "address": "$bridge_addr",
      "verified": false
    }
  }
}
EOF
    
    print_success "Metadata file created: $deploy_dir/metadata.json"
}

verify_contracts() {
    local chain=$1
    local deploy_dir=$(create_deployment_dir "$chain")
    local explorer_key="${EXPLORER_KEYS[$chain]}"
    
    if [ "$AUTO_VERIFY" != "true" ]; then
        print_info "Auto-verification disabled, skipping..."
        return 0
    fi
    
    if [ -z "$explorer_key" ]; then
        print_warning "No explorer API key configured for $chain, skipping verification"
        return 0
    fi
    
    if [ "$DRY_RUN" == "true" ]; then
        print_info "DRY RUN MODE - Skipping verification"
        return 0
    fi
    
    print_header "Verifying Contracts on $chain"
    
    # Read addresses
    local addresses_file="$deploy_dir/addresses.json"
    
    if [ ! -f "$addresses_file" ]; then
        print_error "Addresses file not found: $addresses_file"
        return 1
    fi
    
    # Verify each contract
    local contracts=("DEXFactory" "DEXRouter" "DexCore" "FlashSwap" "BridgeAdapter")
    
    for contract in "${contracts[@]}"; do
        local address=$(jq -r ".[] | select(.contractName == \"$contract\") | .contractAddress" "$addresses_file" 2>/dev/null || echo "")
        
        if [ -n "$address" ] && [ "$address" != "null" ]; then
            print_info "Verifying $contract at $address..."
            
            # Run verification script
            "$SCRIPT_DIR/verify-contract.sh" "$chain" "$contract" "$address" || print_warning "Verification failed for $contract"
        fi
    done
    
    print_success "Verification process completed"
}

print_deployment_summary() {
    local chain=$1
    local deploy_dir=$(create_deployment_dir "$chain")
    
    print_header "Deployment Summary - $chain"
    
    if [ -f "$deploy_dir/metadata.json" ]; then
        echo ""
        jq -r '.contracts | to_entries[] | "\(.key): \(.value.address)"' "$deploy_dir/metadata.json"
        echo ""
        print_info "Full deployment details: $deploy_dir/metadata.json"
        print_info "Block explorer: $(get_explorer_url "$chain")"
    else
        print_warning "No deployment metadata found"
    fi
    
    echo ""
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

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    local target_chain="${1:-$DEPLOY_CHAIN}"
    
    if [ -z "$target_chain" ]; then
        print_error "No chain specified!"
        echo "Usage: $0 <chain>"
        echo "Example: $0 sepolia"
        echo "Supported chains: ${!CHAIN_IDS[@]}"
        exit 1
    fi
    
    print_header "DexCore Multi-Chain Deployment"
    echo ""
    
    check_prerequisites
    
    if [ "$target_chain" == "all" ]; then
        # Deploy to all configured chains
        for chain in "${!CHAIN_IDS[@]}"; do
            if [ -n "${RPC_URLS[$chain]}" ]; then
                validate_chain "$chain"
                confirm_deployment "$chain"
                
                if deploy_contracts "$chain"; then
                    verify_contracts "$chain"
                    print_deployment_summary "$chain"
                else
                    print_error "Deployment to $chain failed!"
                fi
                
                echo ""
            fi
        done
    else
        # Deploy to single chain
        validate_chain "$target_chain"
        confirm_deployment "$target_chain"
        
        if deploy_contracts "$target_chain"; then
            verify_contracts "$target_chain"
            print_deployment_summary "$target_chain"
        else
            print_error "Deployment failed!"
            exit 1
        fi
    fi
    
    print_success "Deployment process completed!"
}

# Run main function
main "$@"
