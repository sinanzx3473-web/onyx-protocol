// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriceOracle
 * @notice TWAP oracle provides manipulation-resistant pricing
 * @dev WARNING:
 *      - Minimum 10-minute observation window required
 *      - Not suitable for low-liquidity pairs (<$100k TVL)
 *      - Large trades may still influence price within window
 *      - Consider external oracle (Chainlink) for critical operations
 */
contract PriceOracle is Ownable {
    /// @notice Minimum time window for TWAP queries to prevent manipulation
    uint32 public constant MIN_TWAP_PERIOD = 10 minutes;
    
    /// @notice Maximum allowed price deviation in basis points (10%)
    uint256 public constant MAX_PRICE_DEVIATION_BPS = 1000;

    struct PriceData {
        uint256 price0Cumulative;
        uint256 price1Cumulative;
        uint32 blockTimestampLast;
        uint32 blockNumberLast;
        uint32 blockTimestampFirst; // Track when oracle started for this pair
    }

    /// @notice Price data for each token pair
    mapping(address => mapping(address => PriceData)) public priceData;

    /// @notice Emitted when price deviation exceeds threshold
    event PriceDeviationAlert(
        address indexed token0,
        address indexed token1,
        uint256 currentPrice,
        uint256 lastTWAP,
        uint256 deviation
    );

    /// @notice Emitted when price is updated
    event PriceUpdated(
        address indexed token0,
        address indexed token1,
        uint256 price0Cumulative,
        uint256 price1Cumulative,
        uint32 blockTimestamp,
        uint32 blockNumber
    );

    error WindowTooShort();
    error SameBlockUpdate();
    error InvalidReserves();
    error NoHistoricalData();
    error PriceDeviationTooHigh();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Update price data for a token pair
     * @dev Prevents same-block updates and checks for price deviation
     * @param token0 First token address
     * @param token1 Second token address
     * @param reserve0 Reserve of token0
     * @param reserve1 Reserve of token1
     */
    function update(
        address token0,
        address token1,
        uint256 reserve0,
        uint256 reserve1
    ) external {
        if (reserve0 == 0 || reserve1 == 0) revert InvalidReserves();

        PriceData storage data = priceData[token0][token1];

        // Prevent same-block updates
        if (block.number == data.blockNumberLast) revert SameBlockUpdate();

        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed;
        
        if (data.blockTimestampLast != 0) {
            unchecked {
                timeElapsed = blockTimestamp - data.blockTimestampLast;
            }

            // M-1 FIX: Prevent updates within MIN_TWAP_PERIOD to avoid manipulation window
            // Only allow if this is NOT the first update (blockTimestampFirst would be 0 on first update)
            if (timeElapsed < MIN_TWAP_PERIOD) {
                revert WindowTooShort();
            }

            // Check price deviation BEFORE updating cumulative prices
            // Calculate total time elapsed since first update
            uint32 totalTimeElapsed;
            unchecked {
                totalTimeElapsed = blockTimestamp - data.blockTimestampFirst;
            }
            
            // Only check if we have sufficient history (at least MIN_TWAP_PERIOD elapsed)
            if (totalTimeElapsed >= MIN_TWAP_PERIOD && data.price0Cumulative > 0) {
                _checkPriceDeviation(token0, token1, reserve0, reserve1, timeElapsed, data.price0Cumulative, totalTimeElapsed);
            }

            // Update cumulative prices
            unchecked {
                data.price0Cumulative += (reserve1 * 1e18 / reserve0) * timeElapsed;
                data.price1Cumulative += (reserve0 * 1e18 / reserve1) * timeElapsed;
            }
        } else {
            // First update - initialize cumulative prices and start timestamp
            data.price0Cumulative = 0;
            data.price1Cumulative = 0;
            data.blockTimestampFirst = blockTimestamp;
        }

        data.blockTimestampLast = blockTimestamp;
        data.blockNumberLast = uint32(block.number);

        emit PriceUpdated(
            token0,
            token1,
            data.price0Cumulative,
            data.price1Cumulative,
            blockTimestamp,
            uint32(block.number)
        );
    }

    /**
     * @notice Get TWAP for a token pair over specified time window
     * @dev Requires minimum 10-minute window to prevent manipulation
     * @param token0 First token address
     * @param token1 Second token address
     * @param timeWindow Time window in seconds (must be >= MIN_TWAP_PERIOD)
     * @return price0Average Average price of token0 in terms of token1
     * @return price1Average Average price of token1 in terms of token0
     */
    function consult(
        address token0,
        address token1,
        uint256 timeWindow
    ) external view returns (uint256 price0Average, uint256 price1Average) {
        if (timeWindow < MIN_TWAP_PERIOD) revert WindowTooShort();

        PriceData storage data = priceData[token0][token1];
        
        if (data.blockTimestampLast == 0) revert NoHistoricalData();

        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        uint32 timeElapsed;
        
        unchecked {
            timeElapsed = blockTimestamp - data.blockTimestampLast;
        }

        if (timeElapsed < timeWindow) revert WindowTooShort();

        // Calculate average prices over the time window
        price0Average = data.price0Cumulative / timeWindow;
        price1Average = data.price1Cumulative / timeWindow;
    }

    /**
     * @notice Get current price data for a token pair
     * @param token0 First token address
     * @param token1 Second token address
     * @return Current price data struct
     */
    function getPriceData(
        address token0,
        address token1
    ) external view returns (PriceData memory) {
        return priceData[token0][token1];
    }

    /**
     * @dev Internal function to check price deviation and revert if too high
     * @param token0 First token address
     * @param token1 Second token address
     * @param reserve0 Current reserve of token0
     * @param reserve1 Current reserve of token1
     * @param timeElapsed Time elapsed since last update
     */
    function _checkPriceDeviation(
        address token0,
        address token1,
        uint256 reserve0,
        uint256 reserve1,
        uint32 timeElapsed,
        uint256 price0CumulativeBefore,
        uint32 totalTimeElapsed
    ) internal {
        // Calculate current spot price (token1 per token0)
        uint256 currentPrice = (reserve1 * 1e18) / reserve0;

        // Calculate TWAP: average price over total time since oracle started
        // Cumulative price = sum of (price * time) for each update period
        // TWAP = cumulative / total_time_elapsed_since_first_update
        uint256 twapPrice = price0CumulativeBefore / uint256(totalTimeElapsed);

        // Skip check if TWAP is zero (avoid division by zero)
        if (twapPrice == 0) return;

        // Calculate deviation between current spot price and TWAP
        uint256 deviation;
        if (currentPrice > twapPrice) {
            deviation = ((currentPrice - twapPrice) * 10000) / twapPrice;
        } else {
            deviation = ((twapPrice - currentPrice) * 10000) / twapPrice;
        }

        // Revert if deviation exceeds threshold (circuit breaker)
        if (deviation > MAX_PRICE_DEVIATION_BPS) {
            emit PriceDeviationAlert(
                token0,
                token1,
                currentPrice,
                twapPrice,
                deviation
            );
            revert PriceDeviationTooHigh();
        }
    }

    /**
     * @dev Internal function to check price deviation and emit alert only (no revert)
     * @param token0 First token address
     * @param token1 Second token address
     * @param reserve0 Current reserve of token0
     * @param reserve1 Current reserve of token1
     * @param timeElapsed Time elapsed since last update
     */
    function _checkPriceDeviationAlert(
        address token0,
        address token1,
        uint256 reserve0,
        uint256 reserve1,
        uint32 timeElapsed,
        uint256 price0CumulativeBefore,
        uint32 totalTimeElapsed
    ) internal {
        // Calculate current spot price (token1 per token0)
        uint256 currentPrice = (reserve1 * 1e18) / reserve0;

        // Calculate TWAP: average price over total time since oracle started
        uint256 twapPrice = price0CumulativeBefore / uint256(totalTimeElapsed);

        // Skip check if TWAP is zero (avoid division by zero)
        if (twapPrice == 0) return;

        // Calculate deviation in basis points
        uint256 deviation;
        if (currentPrice > twapPrice) {
            deviation = ((currentPrice - twapPrice) * 10000) / twapPrice;
        } else {
            deviation = ((twapPrice - currentPrice) * 10000) / twapPrice;
        }

        // Emit alert if deviation exceeds threshold (monitoring only)
        if (deviation > MAX_PRICE_DEVIATION_BPS) {
            emit PriceDeviationAlert(
                token0,
                token1,
                currentPrice,
                twapPrice,
                deviation
            );
        }
    }
}
