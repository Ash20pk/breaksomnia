// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title ChainReactionRecorder
 * @dev Extremely minimal contract for stress testing the Somnia blockchain.
 */
contract ChainReactionRecorder {
    // Simple counters
    uint public totalReactions;
    uint public totalExplosions;
    uint public lastTimestamp;
    
    // Event for reaction logging
    event CellReaction(uint x, uint y, uint energy);
    event Explosion();
    
    /**
     * @dev Records a cell reaction 
     * @param _x The x coordinate
     * @param _y The y coordinate
     * @param _energy The energy level
     */
    function recordReaction(uint _x, uint _y, uint _energy) external {
        totalReactions++;
        lastTimestamp = block.timestamp;
        emit CellReaction(_x, _y, _energy);
    }
    
    /**
     * @dev Simply records that an explosion happened
     * No parameters needed for free-form stress testing
     */
    function recordExplosion() external {
        totalExplosions++;
        lastTimestamp = block.timestamp;
        emit Explosion();
    }
    
    /**
     * @dev Returns basic stats
     */
    function getStats() external view returns (uint, uint) {
        return (totalReactions, totalExplosions);
    }
}