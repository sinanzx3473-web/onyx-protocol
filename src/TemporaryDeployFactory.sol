// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DEXFactory.sol";
import "./DEXRouter.sol";
import "./DexCore.sol";
import "./FlashSwap.sol";
import "./BridgeAdapter.sol";
import "./MockERC20.sol";
import "./MinimalForwarder.sol";

/**
 * @title TemporaryDeployFactory
 * @notice EIP-6780 compliant factory for parameter-free multi-chain deployment
 * @dev Deploys all DEX contracts and emits event before self-destructing
 */
contract TemporaryDeployFactory {
    /// @notice Emitted when all contracts are deployed
    /// @dev This event enables frontend to query deployed contracts by tx hash
    event ContractsDeployed(
        address indexed deployer,
        string[] contractNames,
        address[] contractAddresses
    );

    /**
     * @notice Deploys all DEX contracts with chain-specific configuration
     * @dev Uses block.chainid for automatic chain detection
     */
    constructor() {
        uint256 chainId = block.chainid;
        address deployer = msg.sender;

        // Get WETH address based on chain
        address wethAddress = getWETHAddress(chainId);

        // Deploy MinimalForwarder for EIP-2771 meta-transactions
        MinimalForwarder forwarder = new MinimalForwarder();

        // Deploy DEXFactory
        DEXFactory factory = new DEXFactory(deployer);

        // Deploy DEXRouter with forwarder
        DEXRouter router = new DEXRouter(address(factory), wethAddress, address(forwarder));

        // Deploy DexCore with forwarder
        DexCore dexCore = new DexCore(address(factory), wethAddress, address(forwarder));

        // Deploy FlashSwap with forwarder
        FlashSwap flashSwap = new FlashSwap(address(dexCore), address(forwarder));

        // Deploy BridgeAdapter
        BridgeAdapter bridgeAdapter = new BridgeAdapter(address(dexCore), deployer);

        // Deploy mock tokens for testing (only on testnets)
        address tokenA;
        address tokenB;
        
        if (isTestnet(chainId)) {
            MockERC20 mockTokenA = new MockERC20("Token A", "TKA", 18);
            MockERC20 mockTokenB = new MockERC20("Token B", "TKB", 18);
            tokenA = address(mockTokenA);
            tokenB = address(mockTokenB);
        }

        // Build contract info arrays
        uint256 contractCount = isTestnet(chainId) ? 8 : 6;
        string[] memory contractNames = new string[](contractCount);
        address[] memory contractAddresses = new address[](contractCount);

        contractNames[0] = "MinimalForwarder";
        contractNames[1] = "DEXFactory";
        contractNames[2] = "DEXRouter";
        contractNames[3] = "DexCore";
        contractNames[4] = "FlashSwap";
        contractNames[5] = "BridgeAdapter";
        contractAddresses[0] = address(forwarder);
        contractAddresses[1] = address(factory);
        contractAddresses[2] = address(router);
        contractAddresses[3] = address(dexCore);
        contractAddresses[4] = address(flashSwap);
        contractAddresses[5] = address(bridgeAdapter);

        if (isTestnet(chainId)) {
            contractNames[6] = "MockTokenA";
            contractNames[7] = "MockTokenB";
            contractAddresses[6] = tokenA;
            contractAddresses[7] = tokenB;
        }

        // Emit deployment event
        emit ContractsDeployed(deployer, contractNames, contractAddresses);

        // Self-destruct to enable same bytecode on all chains
        selfdestruct(payable(deployer));
    }

    /**
     * @notice Returns WETH address for supported chains
     * @param chainId Chain ID
     * @return WETH contract address
     */
    function getWETHAddress(uint256 chainId) internal pure returns (address) {
        if (chainId == 1 || chainId == 20258) {
            // Ethereum Mainnet / Testnet
            return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        } else if (chainId == 11155111) {
            // Ethereum Sepolia
            return 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
        } else if (chainId == 137) {
            // Polygon Mainnet
            return 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270; // WMATIC
        } else if (chainId == 80001) {
            // Polygon Mumbai
            return 0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889; // WMATIC
        } else if (chainId == 42161) {
            // Arbitrum One
            return 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
        } else if (chainId == 421614) {
            // Arbitrum Sepolia
            return 0x980B62Da83eFf3D4576C647993b0c1D7faf17c73;
        } else if (chainId == 56) {
            // BSC Mainnet
            return 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c; // WBNB
        } else if (chainId == 97) {
            // BSC Testnet
            return 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd; // WBNB
        } else if (chainId == 10) {
            // Optimism Mainnet
            return 0x4200000000000000000000000000000000000006;
        } else if (chainId == 8453) {
            // Base Mainnet
            return 0x4200000000000000000000000000000000000006;
        } else if (chainId == 84532) {
            // Base Sepolia
            return 0x4200000000000000000000000000000000000006;
        } else {
            // Default to Ethereum mainnet WETH for unknown chains
            return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
        }
    }

    /**
     * @notice Checks if chain is a testnet
     * @param chainId Chain ID
     * @return True if testnet
     */
    function isTestnet(uint256 chainId) internal pure returns (bool) {
        return chainId == 11155111 || // Sepolia
               chainId == 80001 ||    // Mumbai
               chainId == 421614 ||   // Arbitrum Sepolia
               chainId == 97 ||       // BSC Testnet
               chainId == 84532 ||    // Base Sepolia
               chainId == 20258;      // Custom testnet
    }
}
