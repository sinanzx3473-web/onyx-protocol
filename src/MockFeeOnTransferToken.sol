// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockFeeOnTransferToken
 * @notice Mock ERC20 token that deducts a fee on every transfer
 * @dev Used for testing fee-on-transfer token compatibility
 */
contract MockFeeOnTransferToken is ERC20 {
    /// @notice Transfer fee in basis points (e.g., 300 = 3%)
    uint256 public transferFeeBps;
    
    /// @notice Fee denominator (10000 = 100%)
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    /// @notice Address that receives transfer fees
    address public feeRecipient;

    /**
     * @notice Deploy mock fee-on-transfer token
     * @param name Token name
     * @param symbol Token symbol
     * @param _transferFeeBps Transfer fee in basis points (e.g., 300 = 3%)
     * @param _feeRecipient Address to receive fees
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 _transferFeeBps,
        address _feeRecipient
    ) ERC20(name, symbol) {
        require(_transferFeeBps <= FEE_DENOMINATOR, "Fee too high");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        transferFeeBps = _transferFeeBps;
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Mint tokens to address (for testing)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Override transfer to deduct fee
     * @param to Recipient address
     * @param amount Amount to transfer (before fee)
     * @return True if successful
     */
    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        address owner = _msgSender();
        
        // Calculate fee
        uint256 fee = (amount * transferFeeBps) / FEE_DENOMINATOR;
        uint256 amountAfterFee = amount - fee;
        
        // Transfer fee to fee recipient
        if (fee > 0) {
            _transfer(owner, feeRecipient, fee);
        }
        
        // Transfer remaining amount to recipient
        _transfer(owner, to, amountAfterFee);
        
        return true;
    }

    /**
     * @notice Override transferFrom to deduct fee
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer (before fee)
     * @return True if successful
     */
    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        
        // Calculate fee
        uint256 fee = (amount * transferFeeBps) / FEE_DENOMINATOR;
        uint256 amountAfterFee = amount - fee;
        
        // Transfer fee to fee recipient
        if (fee > 0) {
            _transfer(from, feeRecipient, fee);
        }
        
        // Transfer remaining amount to recipient
        _transfer(from, to, amountAfterFee);
        
        return true;
    }
    
    /**
     * @notice Update transfer fee (for testing different scenarios)
     * @param newFeeBps New fee in basis points
     */
    function setTransferFee(uint256 newFeeBps) external {
        require(newFeeBps <= FEE_DENOMINATOR, "Fee too high");
        transferFeeBps = newFeeBps;
    }
}
