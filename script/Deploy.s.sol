// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/Vm.sol";
import "../src/TemporaryDeployFactory.sol";

/**
 * @title Deploy
 * @notice Deployment script for multi-chain DEX system
 * @dev Uses TemporaryDeployFactory for parameter-free deployment
 */
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        // Record logs before deployment
        vm.recordLogs();

        // Deploy factory (will self-destruct after emitting event)
        TemporaryDeployFactory factory = new TemporaryDeployFactory();

        // Parse ContractsDeployed event
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 eventSignature = keccak256("ContractsDeployed(address,string[],address[])");

        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == eventSignature && logs[i].emitter == address(factory)) {
                // Extract deployer from indexed parameter
                address deployer = address(uint160(uint256(logs[i].topics[1])));

                // Decode dynamic arrays from event data
                (string[] memory contractNames, address[] memory contractAddresses) =
                    abi.decode(logs[i].data, (string[], address[]));

                console.log("==============================================");
                console.log("Multi-Chain DEX Deployment Successful!");
                console.log("==============================================");
                console.log("Chain ID:", block.chainid);
                console.log("Deployer:", deployer);
                console.log("Contracts deployed:", contractNames.length);
                console.log("");

                // Log all deployed contracts
                for (uint256 j = 0; j < contractNames.length; j++) {
                    console.log("Contract:", contractNames[j]);
                    console.log("Address:", contractAddresses[j]);
                    console.log("");
                }

                console.log("==============================================");
                console.log("Deployment Validation:");
                
                // Validate deployments
                bool allValid = true;
                for (uint256 k = 0; k < contractAddresses.length; k++) {
                    if (contractAddresses[k] == address(0)) {
                        console.log("ERROR: Failed to deploy", contractNames[k]);
                        allValid = false;
                    } else if (contractAddresses[k].code.length == 0) {
                        console.log("ERROR: No code at", contractNames[k], "address");
                        allValid = false;
                    }
                }
                
                if (allValid) {
                    console.log("All contracts deployed and validated successfully!");
                } else {
                    console.log("WARNING: Some contracts failed validation");
                }
                
                console.log("==============================================");
                console.log("Next Steps:");
                console.log("1. Verify contracts on block explorer");
                console.log("2. Create trading pairs using DEXFactory");
                console.log("3. Add liquidity through DEXRouter");
                console.log("4. Start trading!");
                console.log("==============================================");
                
                break;
            }
        }

        vm.stopBroadcast();
    }
}
