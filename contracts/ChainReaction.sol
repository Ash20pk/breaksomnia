// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title CellPositionStorage
 * @dev Simple storage contract for cell positions and energy levels in the Chain Reaction simulation
 */
contract CellPositionStorage {
    // Structure to represent a cell
    struct Cell {
        uint256 x;
        uint256 y;
        uint256 energy;
        uint256 lastUpdated;
    }
    
    // Mapping to store cells: position hash => Cell
    mapping(bytes32 => Cell) public cells;
    
    // Array to keep track of active cell positions
    bytes32[] public activeCellKeys;
    
    // Event emitted when a cell is updated
    event CellUpdated(uint256 x, uint256 y, uint256 energy);
    
    /**
     * @dev Update a cell's energy level
     * @param _x X coordinate
     * @param _y Y coordinate
     * @param _energy Energy level
     */
    function updateCell(uint256 _x, uint256 _y, uint256 _energy) external {
        bytes32 positionHash = keccak256(abi.encodePacked(_x, _y));
        
        // Check if cell exists
        if (cells[positionHash].lastUpdated == 0) {
            // New cell, add to active cells list
            activeCellKeys.push(positionHash);
        }
        
        // Update cell data
        cells[positionHash] = Cell({
            x: _x,
            y: _y,
            energy: _energy,
            lastUpdated: block.timestamp
        });
        
        // Emit event
        emit CellUpdated(_x, _y, _energy);
    }
    
    /**
     * @dev Get a cell's current data
     * @param _x X coordinate
     * @param _y Y coordinate
     * @return Cell data (x, y, energy, lastUpdated)
     */
    function getCell(uint256 _x, uint256 _y) external view returns (Cell memory) {
        bytes32 positionHash = keccak256(abi.encodePacked(_x, _y));
        return cells[positionHash];
    }
    
    /**
     * @dev Get all active cells
     * @return Array of active cells
     */
    function getAllActiveCells() external view returns (Cell[] memory) {
        Cell[] memory result = new Cell[](activeCellKeys.length);
        
        for (uint256 i = 0; i < activeCellKeys.length; i++) {
            result[i] = cells[activeCellKeys[i]];
        }
        
        return result;
    }
    
    /**
     * @dev Get recent active cells (limited to last 100 for gas efficiency)
     * @param _count Number of recent cells to return
     * @return Array of recently active cells
     */
    function getRecentActiveCells(uint256 _count) external view returns (Cell[] memory) {
        uint256 count = _count;
        
        // Limit to available count or 100 maximum
        if (count > activeCellKeys.length) {
            count = activeCellKeys.length;
        }
        if (count > 100) {
            count = 100;
        }
        
        Cell[] memory result = new Cell[](count);
        
        for (uint256 i = 0; i < count; i++) {
            uint256 index = activeCellKeys.length - 1 - i;
            result[i] = cells[activeCellKeys[index]];
        }
        
        return result;
    }
    
    /**
     * @dev Get count of active cells
     * @return Total cell count
     */
    function getActiveCellCount() external view returns (uint256) {
        return activeCellKeys.length;
    }
}