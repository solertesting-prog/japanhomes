// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// ERC-1155 Smart Contract for Property Tokenization
// This contract manages tokenized real estate properties in Japan

contract PropertyTokens {
    
    struct Property {
        string propertyAddress;
        uint256 totalShares;
        uint256 valuation;
        string metadataURI;
        address manager;
        bool active;
    }
    
    mapping(uint256 => Property) public properties;
    mapping(uint256 => mapping(address => uint256)) public balances;
    
    uint256 public tokenIdCounter;
    
    event PropertyCreated(
        uint256 indexed tokenId,
        string propertyAddress,
        uint256 totalShares,
        uint256 valuation
    );
    
    event TokensTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 amount
    );
    
    function createProperty(
        string memory propertyAddress,
        uint256 totalShares,
        uint256 valuation,
        string memory metadataURI
    ) external returns (uint256) {
        uint256 tokenId = tokenIdCounter++;
        
        properties[tokenId] = Property({
            propertyAddress: propertyAddress,
            totalShares: totalShares,
            valuation: valuation,
            metadataURI: metadataURI,
            manager: msg.sender,
            active: true
        });
        
        balances[tokenId][msg.sender] = totalShares;
        
        emit PropertyCreated(tokenId, propertyAddress, totalShares, valuation);
        return tokenId;
    }
    
    function transfer(uint256 tokenId, address to, uint256 amount) external {
        require(balances[tokenId][msg.sender] >= amount, "Insufficient balance");
        require(properties[tokenId].active, "Property not active");
        
        balances[tokenId][msg.sender] -= amount;
        balances[tokenId][to] += amount;
        
        emit TokensTransferred(tokenId, msg.sender, to, amount);
    }
    
    function balanceOf(uint256 tokenId, address owner) external view returns (uint256) {
        return balances[tokenId][owner];
    }
}