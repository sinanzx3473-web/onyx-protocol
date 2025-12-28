// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./DEXPair.sol";

/**
 * @title DEXFactory
 * @notice Factory contract for creating and managing DEX pairs
 * @dev Implements deterministic pair creation with CREATE2
 */
contract DEXFactory is AccessControl {
    /// @notice Mapping from token pair to pair address
    mapping(address => mapping(address => address)) public getPair;
    
    /// @notice Array of all created pairs
    address[] public allPairs;
    
    /// @notice Address that receives protocol fees
    address public feeTo;
    
    /// @notice Address that can set feeTo
    address public feeToSetter;
    
    /// @notice Router contract address
    address public router;
    
    // ═══════════════════════════════════════════════════════════════════════════════
    //                              ROLE DEFINITIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    
    /// @notice Role for governance operations (fee recipient changes)
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    /// @notice Role for administrative operations (setting router)
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    /// @notice Emitted when a new pair is created
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 pairCount);

    /// @notice Thrown when tokens are identical
    error IdenticalAddresses();
    
    /// @notice Thrown when token address is zero
    error ZeroAddress();
    
    /// @notice Thrown when pair already exists
    error PairExists();
    
    /// @notice Thrown when caller is not fee setter
    error Forbidden();

    /**
     * @notice Initializes the factory
     * @param _feeToSetter Address that can set protocol fee recipient
     */
    constructor(address _feeToSetter) {
        require(_feeToSetter != address(0), "Invalid fee setter");
        feeToSetter = _feeToSetter;
        
        // Setup roles: deployer gets all roles initially
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Returns the number of pairs created
     * @return Number of pairs
     */
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    /**
     * @notice Sets the router address (one-time only)
     * @param _router Router contract address
     */
    function setRouter(address _router) external onlyRole(ADMIN_ROLE) {
        require(router == address(0), "Router already set");
        require(_router != address(0), "Invalid router");
        router = _router;
    }

    /**
     * @notice Creates a new token pair
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return pair Address of created pair
     */
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        if (tokenA == tokenB) revert IdenticalAddresses();
        
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        
        if (token0 == address(0)) revert ZeroAddress();
        if (getPair[token0][token1] != address(0)) revert PairExists();
        
        // Deploy new pair contract
        pair = address(new DEXPair{salt: keccak256(abi.encodePacked(token0, token1))}(token0, token1));
        
        // Set router if available
        if (router != address(0)) {
            DEXPair(pair).setRouter(router);
        }
        
        // Store pair mapping
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        
        uint256 pairsLength = allPairs.length; // Cache array length
        emit PairCreated(token0, token1, pair, pairsLength);
    }

    /**
     * @notice Sets the protocol fee recipient
     * @param _feeTo New fee recipient address
     */
    function setFeeTo(address _feeTo) external onlyRole(GOVERNANCE_ROLE) {
        feeTo = _feeTo;
    }

    /**
     * @notice Sets the fee setter address
     * @param _feeToSetter New fee setter address
     */
    function setFeeToSetter(address _feeToSetter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeToSetter != address(0), "Invalid fee setter");
        feeToSetter = _feeToSetter;
    }
}
