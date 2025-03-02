// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/**
 * @title SnakeGame
 * @dev A smart contract to track snake game scores on the Somnia blockchain
 */
contract SnakeGame {
    // Struct to store player score information
    struct PlayerScore {
        address player;
        uint256 score;
    }
    
    // Mapping to track highest score for each player
    mapping(address => uint256) private playerScores;
    
    // Array to track top scores
    PlayerScore[] private topScores;
    
    // Maximum number of top scores to track
    uint8 private constant MAX_TOP_SCORES = 10;
    
    // Events
    event ScoreUpdated(address indexed player, uint256 score);
    event NewTopScore(address indexed player, uint256 score, uint256 position);
    
    /**
     * @dev Updates player score if it's higher than their previous best
     * @param _player The player address
     * @param _score The score to update
     */
    function updateScore(address _player, uint256 _score) external {
        // Check if the new score is higher than player's existing score
        if (_score > playerScores[_player]) {
            // Update player's best score
            playerScores[_player] = _score;
            
            // Update top scores if needed
            _updateTopScores(_player, _score);
            
            // Emit event
            emit ScoreUpdated(_player, _score);
        }
    }
    
    /**
     * @dev Internal function to update top scores array
     * @param _player The player address
     * @param _score The player's score
     */
    function _updateTopScores(address _player, uint256 _score) private {
        // Find if player is already in top scores
        int256 playerIndex = -1;
        uint256 lowestScoreIndex = 0;
        uint256 lowestScore = type(uint256).max;
        
        for (uint8 i = 0; i < topScores.length; i++) {
            // If player already in array, track their index
            if (topScores[i].player == _player) {
                playerIndex = int256(uint256(i));
            }
            
            // Track lowest score for potential replacement
            if (topScores[i].score < lowestScore) {
                lowestScore = topScores[i].score;
                lowestScoreIndex = i;
            }
        }
        
        // If player is already in top scores, update their score
        if (playerIndex >= 0) {
            topScores[uint256(playerIndex)].score = _score;
        } 
        // If top scores array isn't full yet, add new entry
        else if (topScores.length < MAX_TOP_SCORES) {
            topScores.push(PlayerScore(_player, _score));
            emit NewTopScore(_player, _score, topScores.length - 1);
        } 
        // If score is higher than the current lowest score, replace it
        else if (_score > lowestScore) {
            topScores[lowestScoreIndex] = PlayerScore(_player, _score);
            emit NewTopScore(_player, _score, lowestScoreIndex);
        }
        
        // Sort top scores array (simple bubble sort for gas efficiency with small array)
        _sortTopScores();
    }
    
    /**
     * @dev Internal function to sort top scores (bubble sort - efficient for small arrays)
     */
    function _sortTopScores() private {
        uint256 n = topScores.length;
        
        for (uint256 i = 0; i < n - 1; i++) {
            for (uint256 j = 0; j < n - i - 1; j++) {
                if (topScores[j].score < topScores[j + 1].score) {
                    // Swap
                    PlayerScore memory temp = topScores[j];
                    topScores[j] = topScores[j + 1];
                    topScores[j + 1] = temp;
                }
            }
        }
    }
    
    /**
     * @dev Returns a player's highest score
     * @param _player The player address
     * @return The player's highest score
     */
    function getPlayerScore(address _player) external view returns (uint256) {
        return playerScores[_player];
    }
    
    /**
     * @dev Returns the top scores
     * @return Array of top scores with player addresses
     */
    function getTopScores() external view returns (PlayerScore[] memory) {
        return topScores;
    }
}