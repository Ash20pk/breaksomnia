// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title ChainReactionRecorder
 * @dev Extremely minimal contract for stress testing the Somnia blockchain.
 * Updated to track atoms by ID.
 */
contract ChainReactionRecorder {
    // Simple counters
    uint public totalReactions;
    uint public totalExplosions;
    uint public lastTimestamp;
    
    // Event for reaction logging with atom ID
    event CellReaction(uint x, uint y, uint energy, string atomId);
    event Explosion(string atomId);
    
    /**
     * @dev Records a cell reaction 
     * @param _x The x coordinate
     * @param _y The y coordinate
     * @param _energy The energy level
     * @param _atomId The unique identifier of the atom
     */
    function recordReaction(uint _x, uint _y, uint _energy, string calldata _atomId) external {
        totalReactions++;
        lastTimestamp = block.timestamp;
        emit CellReaction(_x, _y, _energy, _atomId);
    }
    
    /**
     * @dev Records an explosion with associated atom ID
     * @param _atomId The unique identifier of the atom that exploded
     */
    function recordExplosion(string calldata _atomId) external {
        totalExplosions++;
        lastTimestamp = block.timestamp;
        emit Explosion(_atomId);
    }
    
    /**
     * @dev Returns basic stats
     */
    function getStats() external view returns (uint, uint, uint) {
        return (totalReactions, totalExplosions, lastTimestamp);
    }
}