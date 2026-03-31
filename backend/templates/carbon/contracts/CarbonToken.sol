// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CarbonToken is ERC20 {

    address public owner;

    constructor(uint256 initialSupply)
        ERC20("CarbonCreditToken", "CCT")
    {
        owner = msg.sender;

        // mint with decimals
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function recordReduction(address receiver, uint256 amount) public {
        require(msg.sender == owner, "Only owner can record reductions");

        _mint(receiver, amount * 10 ** decimals());
    }

    function transferOwnership(address newOwner) public {
        require(msg.sender == owner, "Only owner can transfer ownership");
        require(newOwner != address(0), "Zero address not allowed");

        owner = newOwner;
    }
}
