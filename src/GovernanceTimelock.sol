// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title GovernanceTimelock
 * @notice TimelockController for DEX governance with 2-day delay
 * @dev Extends OpenZeppelin's TimelockController with custom configuration
 * 
 * ## Role Structure
 * - PROPOSER_ROLE: Can schedule operations (typically multi-sig)
 * - EXECUTOR_ROLE: Can execute operations after delay (typically multi-sig or anyone)
 * - CANCELLER_ROLE: Can cancel pending operations (typically multi-sig)
 * - DEFAULT_ADMIN_ROLE: Can manage roles (typically renounced after setup)
 * 
 * ## Timelock Delay
 * - Minimum delay: 2 days (172800 seconds)
 * - Allows community to review and react to governance proposals
 * - Critical for security and decentralization
 * 
 * ## Usage Pattern
 * 1. Multi-sig proposes operation via scheduleOperation()
 * 2. Wait 2 days for timelock delay
 * 3. Anyone (or multi-sig) executes operation via execute()
 * 4. Operation is executed on target contract (DexCore, DEXFactory, FlashSwap)
 */
contract GovernanceTimelock is TimelockController {
    /**
     * @notice Initialize timelock with 2-day delay
     * @param proposers Addresses that can propose operations (typically multi-sig)
     * @param executors Addresses that can execute operations (address(0) = anyone can execute)
     * @param admin Address that can manage roles (typically renounced after setup)
     */
    constructor(
        address[] memory proposers,
        address[] memory executors,
        address admin
    ) TimelockController(
        2 days, // minDelay: 2-day timelock for all operations
        proposers,
        executors,
        admin
    ) {}
}
