// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title MockCustody - Simplified custody contract for Nitrolite channels
contract MockCustody {
    struct Channel {
        address owner;
        address token;
        uint256 balance;
        uint256 createdAt;
        bool active;
    }
    
    mapping(bytes32 => Channel) public channels;
    
    event ChannelCreated(bytes32 indexed channelId, address indexed owner, address token);
    event Deposited(bytes32 indexed channelId, address indexed depositor, uint256 amount);
    event Withdrawn(bytes32 indexed channelId, address indexed recipient, uint256 amount);
    event ChannelClosed(bytes32 indexed channelId);
    
    /// @notice Create a new channel
    function createChannel(
        bytes32 channelId,
        address token
    ) external {
        require(!channels[channelId].active, "Channel already exists");
        
        channels[channelId] = Channel({
            owner: msg.sender,
            token: token,
            balance: 0,
            createdAt: block.timestamp,
            active: true
        });
        
        emit ChannelCreated(channelId, msg.sender, token);
    }
    
    /// @notice Deposit tokens into a channel
    function deposit(bytes32 channelId, uint256 amount) external {
        Channel storage channel = channels[channelId];
        require(channel.active, "Channel not active");
        
        bool success = IERC20(channel.token).transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
        channel.balance += amount;
        
        emit Deposited(channelId, msg.sender, amount);
    }
    
    /// @notice Withdraw tokens from a channel (owner only for simplicity)
    function withdraw(bytes32 channelId, uint256 amount) external {
        Channel storage channel = channels[channelId];
        require(channel.active, "Channel not active");
        require(msg.sender == channel.owner, "Not channel owner");
        require(channel.balance >= amount, "Insufficient balance");
        
        channel.balance -= amount;
        
        bool success = IERC20(channel.token).transfer(msg.sender, amount);
        require(success, "Transfer failed");
        
        emit Withdrawn(channelId, msg.sender, amount);
    }
    
    /// @notice Close a channel and withdraw all funds
    function closeChannel(bytes32 channelId) external {
        Channel storage channel = channels[channelId];
        require(channel.active, "Channel not active");
        require(msg.sender == channel.owner, "Not channel owner");
        
        uint256 balance = channel.balance;
        if (balance > 0) {
            channel.balance = 0;
            bool success = IERC20(channel.token).transfer(msg.sender, balance);
            require(success, "Transfer failed");
        }
        
        channel.active = false;
        emit ChannelClosed(channelId);
    }
    
    /// @notice Get channel balance
    function getBalance(bytes32 channelId) external view returns (uint256) {
        return channels[channelId].balance;
    }
    
    /// @notice Get channel info
    function getChannel(bytes32 channelId) external view returns (
        address owner,
        address token,
        uint256 balance,
        uint256 createdAt,
        bool active
    ) {
        Channel memory channel = channels[channelId];
        return (
            channel.owner,
            channel.token,
            channel.balance,
            channel.createdAt,
            channel.active
        );
    }
}
