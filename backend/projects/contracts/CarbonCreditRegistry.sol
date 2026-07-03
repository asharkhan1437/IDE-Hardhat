// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CarbonCreditRegistry
/// @notice Each carbon credit is minted as an NFT. Its metadata (certification
///         documents, project details, vintage year, tonnage, verifier signature, etc.)
///         lives on IPFS — the contract only stores the IPFS hash (CID), keeping
///         on-chain storage cheap while the proof data stays immutable and content-addressed.
contract CarbonCreditRegistry is ERC721, Ownable {
    uint256 private _nextTokenId;

    struct CreditRecord {
        string ipfsCID;        // e.g. "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
        address issuer;        // who registered this credit
        uint256 tonnesCO2;     // amount of CO2 offset, in tonnes
        uint256 issuedAt;      // block timestamp
        bool retired;          // true once the credit has been "used" / retired
    }

    mapping(uint256 => CreditRecord) public records;

    // Track which issuers are allowed to mint — set up your verification flow here
    mapping(address => bool) public approvedIssuers;

    event CreditRegistered(uint256 indexed tokenId, address indexed issuer, string ipfsCID, uint256 tonnesCO2);
    event CreditRetired(uint256 indexed tokenId, address indexed retiredBy);
    event IssuerApproved(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    constructor() ERC721("Zicon Carbon Credit", "ZCC") Ownable(msg.sender) {
        approvedIssuers[msg.sender] = true;
    }

    modifier onlyApprovedIssuer() {
        require(approvedIssuers[msg.sender], "Not an approved issuer");
        _;
    }

    /// @notice Approve a new address to register carbon credits (e.g. a verified project developer)
    function approveIssuer(address issuer) external onlyOwner {
        approvedIssuers[issuer] = true;
        emit IssuerApproved(issuer);
    }

    function revokeIssuer(address issuer) external onlyOwner {
        approvedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    /// @notice Register a new carbon credit. The IPFS CID should point to a JSON document
    ///         describing the project, verification body, vintage, location, and any
    ///         supporting certificate PDFs (also uploaded to IPFS, referenced inside the JSON).
    /// @param ipfsCID Content ID returned by your pinning service after uploading metadata
    /// @param tonnesCO2 Amount of CO2 offset represented by this credit, in tonnes
    function registerCredit(string calldata ipfsCID, uint256 tonnesCO2)
        external
        onlyApprovedIssuer
        returns (uint256 tokenId)
    {
        require(bytes(ipfsCID).length > 0, "CID required");
        require(tonnesCO2 > 0, "Must offset > 0 tonnes");

        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        records[tokenId] = CreditRecord({
            ipfsCID: ipfsCID,
            issuer: msg.sender,
            tonnesCO2: tonnesCO2,
            issuedAt: block.timestamp,
            retired: false
        });

        emit CreditRegistered(tokenId, msg.sender, ipfsCID, tonnesCO2);
    }

    /// @notice Permanently retire a credit (marks it as "used" — can no longer be retired again
    ///         or transferred meaningfully for offsetting purposes). Anyone holding the token can retire it.
    function retireCredit(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(!records[tokenId].retired, "Already retired");
        records[tokenId].retired = true;
        emit CreditRetired(tokenId, msg.sender);
    }

    /// @notice Standard ERC721 metadata URI — points to IPFS via the ipfs:// scheme,
    ///         which wallets, marketplaces, and explorers resolve through a gateway automatically.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked("ipfs://", records[tokenId].ipfsCID));
    }

    /// @notice Convenience getter for the full record in one call
    function getCredit(uint256 tokenId) external view returns (CreditRecord memory) {
        _requireOwned(tokenId);
        return records[tokenId];
    }

    function totalCredits() external view returns (uint256) {
        return _nextTokenId;
    }
}
